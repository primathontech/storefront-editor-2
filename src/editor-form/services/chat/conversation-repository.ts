import {
  type ChatMessage,
  type Conversation,
  createConversation,
} from "../../models/chat-types";

export interface ConversationRepository {
  get(conversationId: string): Conversation | null;
  save(conversation: Conversation): void;
  delete(conversationId: string): void;
}

/**
 * Simple localStorage-backed implementation.
 *
 * This keeps persistence concerns out of UI and LLM client code,
 * and can be swapped later if we add backend storage.
 */
export class LocalStorageConversationRepository implements ConversationRepository {
  private readonly storageKeyPrefix = "html-ai-conversation:";

  private key(id: string): string {
    return `${this.storageKeyPrefix}${id}`;
  }

  get(conversationId: string): Conversation | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.key(conversationId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      return createConversation(conversationId, messages);
    } catch {
      return null;
    }
  }

  save(conversation: Conversation): void {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        messages: conversation.messages,
      };
      window.localStorage.setItem(
        this.key(conversation.conversationId),
        JSON.stringify(payload)
      );
    } catch {
      // Ignore storage errors; chat history is a convenience, not critical path.
    }
  }

  delete(conversationId: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(this.key(conversationId));
    } catch {
      // Ignore storage errors
    }
  }
}
