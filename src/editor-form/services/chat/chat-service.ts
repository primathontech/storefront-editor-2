import {
  type ChatMessage,
  ChatMessageFactory,
  type Conversation,
  createConversation,
} from "../../models/chat-types";
import {
  type ConversationRepository,
  LocalStorageConversationRepository,
} from "./conversation-repository";
import { ClaudeClient, type LLMClient } from "./llm-client";

export interface SendMessageParams {
  conversationId: string;
  userInput: string;
  currentHtml: string;
  imageFile?: File | null;
}

export interface SendMessageResult {
  conversation: Conversation;
  assistant: ChatMessage;
  html: string;
}

/**
 * Orchestrates chat flow:
 * - Load or create conversation
 * - Append user message
 * - Call LLM client with full context
 * - Append assistant message
 * - Persist conversation
 */
export class ChatService {
  private readonly repository: ConversationRepository;
  private readonly llmClient: LLMClient;
  private pendingPrompts: Map<string, string> = new Map();
  private pendingImages: Map<string, File> = new Map();

  constructor(options?: {
    repository?: ConversationRepository;
    llmClient?: LLMClient;
  }) {
    this.repository =
      options?.repository ?? new LocalStorageConversationRepository();
    this.llmClient = options?.llmClient ?? new ClaudeClient();
  }

  getConversation(conversationId: string): Conversation {
    return (
      this.repository.get(conversationId) ??
      createConversation(conversationId, [])
    );
  }

  setPendingPrompt(sectionId: string, prompt: string): void {
    const conversationId = `custom-html:${sectionId}`;
    this.pendingPrompts.set(conversationId, prompt);
  }

  getAndClearPendingPrompt(sectionId: string): string | undefined {
    const conversationId = `custom-html:${sectionId}`;
    const prompt = this.pendingPrompts.get(conversationId);
    if (prompt) {
      this.pendingPrompts.delete(conversationId);
    }
    return prompt;
  }

  setPendingImage(sectionId: string, file: File): void {
    const conversationId = `custom-html:${sectionId}`;
    this.pendingImages.set(conversationId, file);
  }

  getAndClearPendingImage(sectionId: string): File | undefined {
    const conversationId = `custom-html:${sectionId}`;
    const file = this.pendingImages.get(conversationId);
    if (file) {
      this.pendingImages.delete(conversationId);
    }
    return file;
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const { conversationId, userInput, currentHtml, imageFile } = params;

    let conversation =
      this.repository.get(conversationId) ??
      createConversation(conversationId, []);

    const userMessage = ChatMessageFactory.user(userInput);
    conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
    };

    // Extract sectionId from conversationId (format: "custom-html:${sectionId}")
    const sectionId = conversationId.startsWith("custom-html:")
      ? conversationId.replace("custom-html:", "")
      : undefined;

    const { assistant, html } = await this.llmClient.generateResponse({
      context: conversation.messages,
      currentHtml,
      imageFile,
      sectionId,
    });

    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, assistant],
    };

    this.repository.save(updatedConversation);

    return {
      conversation: updatedConversation,
      assistant,
      html,
    };
  }
}

// Shared chat service instance for HTML generation.
export const htmlChatService = new ChatService();
