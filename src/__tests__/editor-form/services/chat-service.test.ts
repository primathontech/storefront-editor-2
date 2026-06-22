// SOURCE: apps/visual-editor/src/editor-form/services/chat/chat-service.ts
//
// ChatService is the SUT and runs for real. Its constructor takes repository
// + llmClient overrides, so we inject in-memory fakes (NOT mocks of the SUT)
// to exercise the orchestration without touching localStorage or the network:
// load-or-create, append user → call LLM → append assistant → persist, the
// sectionId extraction from the conversationId, and the pending prompt/image
// stashes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChatService,
} from "../../../editor-form/services/chat/chat-service";
import type { ConversationRepository } from "../../../editor-form/services/chat/conversation-repository";
import type { LLMClient } from "../../../editor-form/services/chat/llm-client";
import {
  ChatRole,
  createConversation,
  type ChatMessage,
  type Conversation,
} from "../../../editor-form/models/chat-types";

// In-memory repository fake — a Map standing in for persistence.
class FakeRepository implements ConversationRepository {
  store = new Map<string, Conversation>();
  get = vi.fn((id: string) => this.store.get(id) ?? null);
  save = vi.fn((c: Conversation) => {
    this.store.set(c.conversationId, c);
  });
  delete = vi.fn((id: string) => {
    this.store.delete(id);
  });
}

// LLM fake that records the params it was called with and returns a canned
// assistant message + html.
function fakeLLM(): { client: LLMClient; calls: Array<unknown> } {
  const calls: unknown[] = [];
  const assistant: ChatMessage = {
    id: "a1",
    role: ChatRole.ASSISTANT,
    content: "done",
    timestamp: "t",
  };
  const client: LLMClient = {
    generateResponse: vi.fn(async (params) => {
      calls.push(params);
      return { assistant, html: "<div>x</div>" };
    }),
  };
  return { client, calls };
}

let repository: FakeRepository;

beforeEach(() => {
  repository = new FakeRepository();
});

describe("ChatService.getConversation", () => {
  it("returns the stored conversation when present", () => {
    const existing = createConversation("c1", [
      { id: "u", role: ChatRole.USER, content: "hi", timestamp: "t" },
    ]);
    repository.store.set("c1", existing);
    const svc = new ChatService({ repository, llmClient: fakeLLM().client });
    expect(svc.getConversation("c1")).toEqual(existing);
  });

  it("returns a fresh empty conversation when absent", () => {
    const svc = new ChatService({ repository, llmClient: fakeLLM().client });
    expect(svc.getConversation("new")).toEqual(createConversation("new", []));
  });
});

describe("ChatService.sendMessage", () => {
  it("appends user → assistant and persists the result", async () => {
    const { client, calls } = fakeLLM();
    const svc = new ChatService({ repository, llmClient: client });

    const result = await svc.sendMessage({
      conversationId: "custom-html:hero",
      userInput: "make it blue",
      currentHtml: "<p>old</p>",
    });

    // Returned conversation has the user message then the assistant reply.
    const roles = result.conversation.messages.map((m) => m.role);
    expect(roles).toEqual([ChatRole.USER, ChatRole.ASSISTANT]);
    expect(result.conversation.messages[0].content).toBe("make it blue");
    expect(result.assistant.content).toBe("done");
    expect(result.html).toBe("<div>x</div>");

    // Persisted via the repository.
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.store.get("custom-html:hero")).toEqual(result.conversation);

    // LLM saw the user message in context + the current html.
    const llmParams = calls[0] as { context: ChatMessage[]; currentHtml: string };
    expect(llmParams.currentHtml).toBe("<p>old</p>");
    expect(llmParams.context.at(-1)!.content).toBe("make it blue");
  });

  it("extracts sectionId from a custom-html conversationId", async () => {
    const { client, calls } = fakeLLM();
    const svc = new ChatService({ repository, llmClient: client });

    await svc.sendMessage({
      conversationId: "custom-html:section-7",
      userInput: "go",
      currentHtml: "",
    });

    expect((calls[0] as { sectionId?: string }).sectionId).toBe("section-7");
  });

  it("passes sectionId=undefined for a non custom-html conversationId", async () => {
    const { client, calls } = fakeLLM();
    const svc = new ChatService({ repository, llmClient: client });

    await svc.sendMessage({
      conversationId: "freeform",
      userInput: "go",
      currentHtml: "",
    });

    expect((calls[0] as { sectionId?: string }).sectionId).toBeUndefined();
  });

  it("continues an existing conversation rather than starting fresh", async () => {
    repository.store.set(
      "custom-html:hero",
      createConversation("custom-html:hero", [
        { id: "u0", role: ChatRole.USER, content: "earlier", timestamp: "t" },
      ]),
    );
    const { client } = fakeLLM();
    const svc = new ChatService({ repository, llmClient: client });

    const result = await svc.sendMessage({
      conversationId: "custom-html:hero",
      userInput: "next",
      currentHtml: "",
    });

    // earlier + new user + assistant = 3.
    expect(result.conversation.messages.map((m) => m.content)).toEqual([
      "earlier",
      "next",
      "done",
    ]);
  });

  it("forwards an attached image to the LLM client", async () => {
    const { client, calls } = fakeLLM();
    const svc = new ChatService({ repository, llmClient: client });
    const imageFile = new File([new Uint8Array([1])], "p.png", {
      type: "image/png",
    });

    await svc.sendMessage({
      conversationId: "custom-html:s",
      userInput: "use this",
      currentHtml: "",
      imageFile,
    });

    expect((calls[0] as { imageFile?: File }).imageFile).toBe(imageFile);
  });
});

describe("ChatService pending prompt / image stashes", () => {
  it("stashes and clears a pending prompt by sectionId", () => {
    const svc = new ChatService({ repository, llmClient: fakeLLM().client });
    svc.setPendingPrompt("sec1", "draft prompt");

    expect(svc.getAndClearPendingPrompt("sec1")).toBe("draft prompt");
    // Cleared after read.
    expect(svc.getAndClearPendingPrompt("sec1")).toBeUndefined();
  });

  it("returns undefined for a section with no pending prompt", () => {
    const svc = new ChatService({ repository, llmClient: fakeLLM().client });
    expect(svc.getAndClearPendingPrompt("missing")).toBeUndefined();
  });

  it("stashes and clears a pending image by sectionId", () => {
    const svc = new ChatService({ repository, llmClient: fakeLLM().client });
    const file = new File([new Uint8Array([1])], "p.png", { type: "image/png" });
    svc.setPendingImage("sec2", file);

    expect(svc.getAndClearPendingImage("sec2")).toBe(file);
    expect(svc.getAndClearPendingImage("sec2")).toBeUndefined();
  });
});
