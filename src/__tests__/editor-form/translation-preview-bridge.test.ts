// Layer 2 — wiring. Editor side of the deprecated static-template lane
// bridge. Channel mocked; asserts the patchTranslations / focusTranslationKey
// wire traffic and the debounced-vs-flush distinction.
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { createChannel } from "@shopkit/editor-bridge";
import {
  registerTranslationBridge,
  unregisterTranslationBridge,
  commitTranslationPatch,
  flushTranslationPatch,
  focusTranslationKey,
} from "../../editor-form/translation-preview-bridge";

vi.mock("@shopkit/editor-bridge", () => ({ createChannel: vi.fn() }));

type Handler = (payload: unknown) => void;
function makeChannel() {
  const handlers = new Map<string, Handler>();
  return {
    on: vi.fn((name: string, h: Handler) => {
      handlers.set(name, h);
      return () => handlers.delete(name);
    }),
    send: vi.fn(),
    close: vi.fn(),
    emit: (name: string, payload: unknown) => handlers.get(name)?.(payload),
  };
}

let ch: ReturnType<typeof makeChannel>;

function reg() {
  const cbs = { onReady: vi.fn(), onSelectTranslationKey: vi.fn() };
  registerTranslationBridge({
    iframeWindow: {} as Window,
    previewOrigin: "http://localhost:4344",
    ...cbs,
  });
  return cbs;
}

beforeEach(() => {
  ch = makeChannel();
  (createChannel as Mock).mockReturnValue(ch);
});
afterEach(() => {
  unregisterTranslationBridge();
  vi.clearAllMocks();
});

describe("registerTranslationBridge — inbound", () => {
  it("routes ready and selectTranslationKey to callbacks", () => {
    const { onReady, onSelectTranslationKey } = reg();
    ch.emit("ready", { version: 1 });
    ch.emit("selectTranslationKey", { key: "hero.title" });
    expect(onReady).toHaveBeenCalledWith({ version: 1 });
    expect(onSelectTranslationKey).toHaveBeenCalledWith("hero.title");
  });
});

describe("commitTranslationPatch — debounced", () => {
  it("sends patchTranslations after the debounce window", () => {
    vi.useFakeTimers();
    reg();
    commitTranslationPatch("en", { "hero.title": "Hi" });
    expect(ch.send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(ch.send).toHaveBeenCalledWith("patchTranslations", {
      language: "en",
      translations: { "hero.title": "Hi" },
    });
    vi.useRealTimers();
  });

  it("collapses rapid edits into the latest single patch", () => {
    vi.useFakeTimers();
    reg();
    commitTranslationPatch("en", { k: "a" });
    commitTranslationPatch("en", { k: "b" });
    vi.advanceTimersByTime(150);
    expect(ch.send).toHaveBeenCalledTimes(1);
    expect(ch.send).toHaveBeenCalledWith("patchTranslations", {
      language: "en",
      translations: { k: "b" },
    });
    vi.useRealTimers();
  });
});

describe("flushTranslationPatch — immediate", () => {
  it("sends synchronously (no debounce wait)", () => {
    reg();
    flushTranslationPatch("fr", { greeting: "Bonjour" });
    expect(ch.send).toHaveBeenCalledWith("patchTranslations", {
      language: "fr",
      translations: { greeting: "Bonjour" },
    });
  });

  it("is a no-op once unregistered", () => {
    reg();
    unregisterTranslationBridge();
    ch.send.mockClear();
    flushTranslationPatch("fr", { x: "y" });
    expect(ch.send).not.toHaveBeenCalled();
  });
});

describe("focusTranslationKey", () => {
  it("sends the focused key (or null)", () => {
    reg();
    focusTranslationKey("hero.title");
    expect(ch.send).toHaveBeenCalledWith("focusTranslationKey", { key: "hero.title" });
    focusTranslationKey(null);
    expect(ch.send).toHaveBeenCalledWith("focusTranslationKey", { key: null });
  });
});
