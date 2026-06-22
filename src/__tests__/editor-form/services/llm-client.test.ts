// SOURCE: apps/visual-editor/src/editor-form/services/chat/llm-client.ts
//
// ClaudeClient.generateResponse is the SUT and runs for real — message
// mapping, context enrichment, the structured-output request body, and the
// JSON parsing/fallback paths. The only thing stubbed is the network edge it
// delegates to: EditorAPI.anthropicMessages (spied, never hitting fetch).
// readFileAsBase64 (FileReader) runs for real against jsdom.
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { ClaudeClient } from "../../../editor-form/services/chat/llm-client";
import { EditorAPI } from "../../../editor-form/services/api";
import {
  HTML_AI_MODEL,
  HTML_SYSTEM_PROMPT,
} from "../../../editor-form/services/html-ai-prompt";
import { ChatRole, type ChatMessage } from "../../../editor-form/models/chat-types";

// Build the Anthropic-shaped response carrying our structured JSON payload.
function anthropicReply(payload: unknown) {
  return { content: [{ text: JSON.stringify(payload) }] };
}

function userMsg(content: string): ChatMessage {
  return { id: "u1", role: ChatRole.USER, content, timestamp: "t" };
}

let send: Mock;

beforeEach(() => {
  send = vi
    .spyOn(EditorAPI, "anthropicMessages")
    .mockResolvedValue(anthropicReply({ explanation: "done", html: "<div></div>" })) as unknown as Mock;
});

// The request body ClaudeClient handed to anthropicMessages.
function lastRequestBody() {
  return send.mock.calls.at(-1)![0] as {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
    output_format: { type: string; schema: unknown };
  };
}

describe("ClaudeClient.generateResponse — request shape", () => {
  it("sends the configured model, system prompt, and structured-output format", async () => {
    await new ClaudeClient().generateResponse({
      context: [userMsg("make a hero")],
      currentHtml: "",
    });

    const body = lastRequestBody();
    expect(body.model).toBe(HTML_AI_MODEL);
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe(HTML_SYSTEM_PROMPT);
    expect(body.output_format.type).toBe("json_schema");
  });

  it("honors an explicit model override", async () => {
    await new ClaudeClient("claude-custom").generateResponse({
      context: [userMsg("hi")],
      currentHtml: "",
    });
    expect(lastRequestBody().model).toBe("claude-custom");
  });

  it("filters out system messages and maps user/assistant roles", async () => {
    await new ClaudeClient().generateResponse({
      context: [
        { id: "s", role: ChatRole.SYSTEM, content: "sys", timestamp: "t" },
        userMsg("first"),
        { id: "a", role: ChatRole.ASSISTANT, content: "reply", timestamp: "t" },
      ],
      currentHtml: "",
    });

    const roles = lastRequestBody().messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant"]);
  });
});

describe("ClaudeClient.generateResponse — last-user enrichment", () => {
  it("wraps the latest user prompt in the Goal preamble", async () => {
    await new ClaudeClient().generateResponse({
      context: [userMsg("make a hero")],
      currentHtml: "",
    });

    const text = lastRequestBody().messages.at(-1)!.content[0].text!;
    expect(text).toContain("Goal: Create a standalone, embeddable HTML snippet");
    expect(text).toContain("**make a hero**");
  });

  it("appends the current editor code when currentHtml is non-empty", async () => {
    await new ClaudeClient().generateResponse({
      context: [userMsg("tweak it")],
      currentHtml: "<p>existing</p>",
    });

    const text = lastRequestBody().messages.at(-1)!.content[0].text!;
    expect(text).toContain("Current code in editor:");
    expect(text).toContain("<p>existing</p>");
  });

  it("omits the code context when currentHtml is only whitespace", async () => {
    await new ClaudeClient().generateResponse({
      context: [userMsg("scratch")],
      currentHtml: "   \n  ",
    });
    expect(lastRequestBody().messages.at(-1)!.content[0].text!).not.toContain(
      "Current code in editor:",
    );
  });

  it("adds the section-id scoping instruction when sectionId is provided", async () => {
    await new ClaudeClient().generateResponse({
      context: [userMsg("hi")],
      currentHtml: "",
      sectionId: "sec-42",
    });

    const text = lastRequestBody().messages.at(-1)!.content[0].text!;
    expect(text).toContain('Section ID for CSS scoping: "sec-42"');
    expect(text).toContain("#sec-42");
  });

  it("enriches the LAST user message, not an earlier one", async () => {
    await new ClaudeClient().generateResponse({
      context: [
        userMsg("old request"),
        { id: "a", role: ChatRole.ASSISTANT, content: "ok", timestamp: "t" },
        userMsg("new request"),
      ],
      currentHtml: "",
    });

    const messages = lastRequestBody().messages;
    // First user message is left as-is; the trailing one carries the Goal.
    expect(messages[0].content[0].text).toBe("old request");
    expect(messages.at(-1)!.content[0].text).toContain("**new request**");
  });
});

describe("ClaudeClient.generateResponse — fallback synthetic turn", () => {
  it("appends a synthetic user turn when context has no user message", async () => {
    await new ClaudeClient().generateResponse({
      context: [
        { id: "a", role: ChatRole.ASSISTANT, content: "reply", timestamp: "t" },
      ],
      currentHtml: "<span>x</span>",
    });

    const messages = lastRequestBody().messages;
    expect(messages.at(-1)!.role).toBe("user");
    const text = messages.at(-1)!.content[0].text!;
    expect(text).toContain("Goal: Create a standalone, embeddable HTML snippet.");
    expect(text).toContain("<span>x</span>");
  });
});

describe("ClaudeClient.generateResponse — image attachment", () => {
  it("appends a base64 image block to the enriched user message", async () => {
    const imageFile = new File([new Uint8Array([1, 2, 3])], "p.png", {
      type: "image/png",
    });

    await new ClaudeClient().generateResponse({
      context: [userMsg("use this")],
      currentHtml: "",
      imageFile,
    });

    const content = lastRequestBody().messages.at(-1)!.content;
    const imageBlock = content.find((b) => b.type === "image") as
      | { type: "image"; source: { media_type: string; data: string } }
      | undefined;
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.source.media_type).toBe("image/png");
    expect(typeof imageBlock!.source.data).toBe("string");
  });
});

describe("ClaudeClient.generateResponse — response parsing", () => {
  it("returns the assistant explanation and html on a valid structured reply", async () => {
    send.mockResolvedValue(
      anthropicReply({ explanation: "Built a hero", html: "<section>hi</section>" }),
    );

    const result = await new ClaudeClient().generateResponse({
      context: [userMsg("hero")],
      currentHtml: "",
    });

    expect(result.assistant.role).toBe(ChatRole.ASSISTANT);
    expect(result.assistant.content).toBe("Built a hero");
    expect(result.assistant.id).toBeTruthy();
    expect(result.html).toBe("<section>hi</section>");
  });

  it("trims whitespace off explanation and html", async () => {
    send.mockResolvedValue(
      anthropicReply({ explanation: "  spaced  ", html: "  <p></p>  " }),
    );
    const result = await new ClaudeClient().generateResponse({
      context: [userMsg("x")],
      currentHtml: "",
    });
    expect(result.assistant.content).toBe("spaced");
    expect(result.html).toBe("<p></p>");
  });

  it("defaults the explanation when the model returns an empty one", async () => {
    send.mockResolvedValue(anthropicReply({ explanation: "", html: "<i></i>" }));
    const result = await new ClaudeClient().generateResponse({
      context: [userMsg("x")],
      currentHtml: "",
    });
    expect(result.assistant.content).toBe(
      "I've updated the code based on your request.",
    );
  });

  it("defaults html to '' when the model omits it", async () => {
    send.mockResolvedValue(anthropicReply({ explanation: "note" }));
    const result = await new ClaudeClient().generateResponse({
      context: [userMsg("x")],
      currentHtml: "",
    });
    expect(result.html).toBe("");
  });

  it("throws 'Invalid response format' when the reply is not JSON", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValue({ content: [{ text: "not json at all" }] });

    await expect(
      new ClaudeClient().generateResponse({
        context: [userMsg("x")],
        currentHtml: "",
      }),
    ).rejects.toThrow(/Invalid response format from AI/);
    err.mockRestore();
  });
});
