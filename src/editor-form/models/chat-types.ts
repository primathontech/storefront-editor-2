/**
 * Chat domain models for the editor AI features.
 *
 * Defines lightweight types for chat messages and conversations that can be
 * reused across editor components and services.
 */

/**
 * Role of a chat message.
 *
 * Kept string-based to align with external APIs (Anthropic uses "user"/"assistant"/"system").
 */
export const ChatRole = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
} as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

/**
 * Single chat message in a conversation.
 *
 * - `content` is the plain text representation we show in UI and send to LLM.
 * - Optional flags like `appliedToEditor` and `hasImage` are for UI/state only.
 *   They are not required for LLM calls but help us render and manage the chat.
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string; // ISO string for easy (de)serialization

  /**
   * Optional: whether this assistant message has been applied to the HTML editor.
   * Useful if later we support "Apply this message" instead of auto-apply.
   */
  appliedToEditor?: boolean;

  /**
   * Optional: indicates that this user message was sent with an image attached.
   * The actual image data will be handled separately in services.
   */
  hasImage?: boolean;
}

/**
 * Conversation is a simple container of messages for a given logical thread.
 *
 * For Custom HTML chat we plan to use:
 *   conversationId = `custom-html:${sectionId}`
 *
 * This keeps a 1:1 mapping between a section instance and its chat history.
 */
export interface Conversation {
  conversationId: string;
  messages: ChatMessage[];
}

/**
 * Small factory helpers to keep message creation consistent and
 * avoid sprinkling role strings + timestamp logic across the codebase.
 */
export const ChatMessageFactory = {
  user(content: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: ChatRole.USER,
      content,
      timestamp: new Date().toISOString(),
    };
  },

  assistant(content: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: ChatRole.ASSISTANT,
      content,
      timestamp: new Date().toISOString(),
    };
  },

  system(content: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: ChatRole.SYSTEM,
      content,
      timestamp: new Date().toISOString(),
    };
  },
} as const;

/**
 * Helper to create a new empty conversation.
 *
 * Kept as a function, not a class, to stay close to the existing
 * models style (pure data + helpers).
 */
export function createConversation(
  conversationId: string,
  messages: ChatMessage[] = []
): Conversation {
  return {
    conversationId,
    messages,
  };
}
