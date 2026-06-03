import { type ChatMessage, ChatRole } from "../../models/chat-types";
import { readFileAsBase64 } from "../../utils/ai-utils";
import { HTML_AI_MODEL, HTML_SYSTEM_PROMPT } from "../html-ai-prompt";
import { EditorAPI } from "../api";

/**
 * JSON schema for structured output from Claude.
 * Guarantees deterministic separation of explanation text and HTML code.
 */
const HTML_GENERATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    explanation: {
      type: "string",
      description:
        "Brief natural language explanation (1-3 sentences) describing what was created or changed. This will be shown to the user in a chat bubble.",
    },
    html: {
      type: "string",
      description:
        "The complete HTML/CSS/JS code snippet ready to be pasted into the editor. Do not include <html>, <head>, or <body> tags.",
    },
  },
  required: ["explanation", "html"],
  additionalProperties: false,
};

export interface LLMClientParams {
  context: ChatMessage[];
  currentHtml: string;
  imageFile?: File | null;
  sectionId?: string;
}

export interface LLMClient {
  generateResponse(params: LLMClientParams): Promise<{
    assistant: ChatMessage;
    html: string;
  }>;
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
}

/**
 * Claude (Anthropic) client focused on our HTML-generation use case.
 *
 * This client is intentionally minimal and does not expose Anthropic-specific
 * types to the rest of the codebase.
 */
export class ClaudeClient implements LLMClient {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model || HTML_AI_MODEL;

    if (!this.model) {
      throw new Error("AI model is not configured");
    }
  }

  /**
   * Helper method to add image to Anthropic content blocks.
   * Handles base64 conversion and error handling.
   */
  private async addImageToContent(
    content: AnthropicContentBlock[],
    imageFile: File
  ): Promise<void> {
    try {
      const { mediaType, data } = await readFileAsBase64(imageFile);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data,
        },
      });
    } catch (error) {
      console.error(
        "Failed to read attached image, continuing without image:",
        error
      );
    }
  }

  async generateResponse({
    context,
    currentHtml,
    imageFile,
    sectionId,
  }: LLMClientParams): Promise<{ assistant: ChatMessage; html: string }> {
    if (!this.model) {
      throw new Error("AI model is not configured");
    }

    const trimmedHtml = (currentHtml || "").trim();
    const currentCodeContext = trimmedHtml
      ? `\n\nCurrent code in editor:\n\`\`\`html\n${trimmedHtml}\n\`\`\``
      : "";

    const sectionIdContext = sectionId
      ? `\n\nSection ID for CSS scoping: "${sectionId}"\nUse this exact ID for the wrapper div and prefix ALL CSS selectors with #${sectionId}.`
      : "";

    // Map our internal ChatMessage history to Anthropic messages.
    const apiMessages: AnthropicMessage[] = context
      .filter((m) => m.role === ChatRole.USER || m.role === ChatRole.ASSISTANT)
      .map((m) => ({
        role: m.role === ChatRole.USER ? "user" : "assistant",
        content: [
          {
            type: "text" as const,
            text: m.content,
          },
        ],
      }));

    // Enrich the latest user message with goal + current HTML context.
    const lastUserIndex = [...apiMessages]
      .reverse()
      .findIndex((m) => m.role === "user");

    const resolvedLastUserIndex =
      lastUserIndex >= 0 ? apiMessages.length - 1 - lastUserIndex : -1;

    if (resolvedLastUserIndex >= 0) {
      const msg = apiMessages[resolvedLastUserIndex];
      const firstBlock = msg.content[0];
      const original =
        firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
      const userPrompt = original.trim();
      const userText = `Goal: Create a standalone, embeddable HTML snippet based on this input (which might include images for reference as well): **${userPrompt}**${currentCodeContext}${sectionIdContext}`;

      if (firstBlock && firstBlock.type === "text") {
        firstBlock.text = userText;
      }

      if (imageFile) {
        await this.addImageToContent(msg.content, imageFile);
      }
    } else {
      // No user message in context; fall back to a single synthetic user turn.
      const fallbackText = `Goal: Create a standalone, embeddable HTML snippet.${currentCodeContext}${sectionIdContext}`;
      const content: AnthropicContentBlock[] = [
        {
          type: "text" as const,
          text: fallbackText,
        },
      ];
      if (imageFile) {
        await this.addImageToContent(content, imageFile);
      }
      apiMessages.push({
        role: "user",
        content,
      });
    }

    const requestBody = {
      model: this.model,
      max_tokens: 4096,
      system: HTML_SYSTEM_PROMPT,
      messages: apiMessages,
      output_format: {
        type: "json_schema",
        schema: HTML_GENERATION_RESPONSE_SCHEMA,
      },
    };

    if (!requestBody.model || requestBody.model.trim() === "") {
      throw new Error(`Invalid model configuration: "${requestBody.model}"`);
    }

    // Call Anthropic via server-side proxy route to keep API key on the server.
    const data = (await EditorAPI.anthropicMessages(requestBody)) as {
      content?: Array<{ text?: string }>;
    };
    const jsonText = data.content?.[0]?.text || "";

    // Parse structured JSON response (guaranteed format via response_format)
    let parsedResponse: { explanation: string; html: string };
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch (error) {
      // Fallback if JSON parsing fails (shouldn't happen with structured output)
      console.error("Failed to parse structured response:", error);
      throw new Error("Invalid response format from AI");
    }

    const explanation =
      parsedResponse.explanation?.trim() ||
      "I've updated the code based on your request.";
    const htmlSnippet = parsedResponse.html?.trim() || "";

    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatRole.ASSISTANT,
      content: explanation,
      timestamp: new Date().toISOString(),
    };

    return {
      assistant,
      html: htmlSnippet,
    };
  }
}
