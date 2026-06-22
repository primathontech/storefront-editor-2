// SOURCE: apps/visual-editor/src/editor-form/services/chat/conversation-repository.ts
//
// LocalStorageConversationRepository is the SUT and runs for real against the
// suite's localStorage mock (setup.ts provides a real-backing-store mock, so
// round-trips actually persist). We assert the persistence contract and the
// defensive paths (missing key, malformed JSON, non-array messages).
import { describe, it, expect, vi } from "vitest";
import { LocalStorageConversationRepository } from "../../../editor-form/services/chat/conversation-repository";
import {
  ChatRole,
  createConversation,
  type ChatMessage,
} from "../../../editor-form/models/chat-types";

const KEY_PREFIX = "html-ai-conversation:";

function repo() {
  return new LocalStorageConversationRepository();
}

const msg = (content: string): ChatMessage => ({
  id: "m1",
  role: ChatRole.USER,
  content,
  timestamp: "t",
});

describe("LocalStorageConversationRepository", () => {
  it("returns null for an unknown conversation", () => {
    expect(repo().get("nope")).toBeNull();
  });

  it("persists a conversation and reads it back (messages only)", () => {
    const r = repo();
    const conversation = createConversation("custom-html:s1", [msg("hi")]);

    r.save(conversation);

    // Stored under the prefixed key, payload carries just the messages.
    const raw = window.localStorage.getItem(`${KEY_PREFIX}custom-html:s1`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ messages: [msg("hi")] });

    const loaded = r.get("custom-html:s1");
    expect(loaded).toEqual(conversation);
  });

  it("deletes a stored conversation", () => {
    const r = repo();
    r.save(createConversation("c1", [msg("x")]));
    expect(r.get("c1")).not.toBeNull();

    r.delete("c1");

    expect(r.get("c1")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    window.localStorage.setItem(`${KEY_PREFIX}bad`, "{not json");
    expect(repo().get("bad")).toBeNull();
  });

  it("coerces a missing/invalid messages field to an empty array", () => {
    window.localStorage.setItem(`${KEY_PREFIX}weird`, JSON.stringify({ messages: "oops" }));
    const loaded = repo().get("weird");
    expect(loaded).toEqual(createConversation("weird", []));
  });

  it("swallows storage write errors (history is non-critical)", () => {
    const r = repo();
    const spy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    // Must not throw — save is best-effort.
    expect(() => r.save(createConversation("c2", [msg("y")]))).not.toThrow();
    spy.mockRestore();
  });
});
