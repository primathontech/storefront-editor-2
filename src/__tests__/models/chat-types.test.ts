// Layer 3 — Unit. Chat domain factories.
import { describe, it, expect } from "vitest";
import {
  ChatRole,
  ChatMessageFactory,
  createConversation,
} from "../../editor-form/models/chat-types";

describe("ChatMessageFactory", () => {
  it("user() stamps role, content, a uuid id and an ISO timestamp", () => {
    const msg = ChatMessageFactory.user("hello");
    expect(msg.role).toBe(ChatRole.USER);
    expect(msg.content).toBe("hello");
    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(msg.timestamp))).toBe(false);
  });

  it("assistant() and system() set their respective roles", () => {
    expect(ChatMessageFactory.assistant("a").role).toBe(ChatRole.ASSISTANT);
    expect(ChatMessageFactory.system("s").role).toBe(ChatRole.SYSTEM);
  });

  it("gives each message a distinct id", () => {
    const a = ChatMessageFactory.user("x");
    const b = ChatMessageFactory.user("x");
    expect(a.id).not.toBe(b.id);
  });
});

describe("createConversation", () => {
  it("defaults to an empty message list", () => {
    expect(createConversation("custom-html:hero-1")).toEqual({
      conversationId: "custom-html:hero-1",
      messages: [],
    });
  });

  it("preserves provided messages", () => {
    const msgs = [ChatMessageFactory.user("hi")];
    const convo = createConversation("c1", msgs);
    expect(convo.conversationId).toBe("c1");
    expect(convo.messages).toBe(msgs);
  });
});
