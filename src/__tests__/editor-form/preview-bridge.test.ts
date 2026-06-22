// Layer 2 — wiring. The editor side of the dynamic-lane bridge. The
// @shopkit/editor-bridge channel is mocked so we can assert exactly what
// goes over the wire (send) and drive inbound messages (the captured
// handlers) without a real iframe.
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { createChannel } from "@shopkit/editor-bridge";
import {
  registerPreviewBridge,
  unregisterPreviewBridge,
  commitClientWidget,
  commitClientSection,
  focusSection,
  commitServer,
} from "../../editor-form/preview-bridge";

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

// Identity translation service — t:-ref resolution is a passthrough here.
const ts = { translateObject: (o: unknown) => o } as never;

function reg() {
  const cbs = {
    onSelect: vi.fn(),
    onCommitFired: vi.fn(),
    onCommitSettled: vi.fn(),
    onCommitFailed: vi.fn(),
    onAssets: vi.fn(),
    onReady: vi.fn(),
  };
  registerPreviewBridge({
    iframeWindow: {} as Window,
    previewOrigin: "http://localhost:4344",
    getTs: () => ts,
    ...cbs,
  });
  return cbs;
}

beforeEach(() => {
  ch = makeChannel();
  (createChannel as Mock).mockReturnValue(ch);
});

afterEach(() => {
  unregisterPreviewBridge();
  vi.clearAllMocks();
});

describe("registerPreviewBridge — inbound wiring", () => {
  it("opens a channel pinned to the preview origin", () => {
    reg();
    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOrigins: ["http://localhost:4344"],
        targetOrigin: "http://localhost:4344",
      }),
    );
  });

  it("routes 'select' to onSelect with the target", () => {
    const { onSelect } = reg();
    ch.emit("select", { target: { sectionId: "s1" } });
    expect(onSelect).toHaveBeenCalledWith({ sectionId: "s1" });
  });

  it("calls onCommitSettled only when rendering.pending is false", () => {
    const { onCommitSettled } = reg();
    ch.emit("rendering", { pending: true });
    expect(onCommitSettled).not.toHaveBeenCalled();
    ch.emit("rendering", { pending: false });
    expect(onCommitSettled).toHaveBeenCalledTimes(1);
  });

  it("routes commitFailed / assets / ready to their callbacks", () => {
    const { onCommitFailed, onAssets, onReady } = reg();
    ch.emit("commitFailed", { reason: "boom" });
    ch.emit("assets", { widgetSchemas: {}, availableSections: {} });
    ch.emit("ready", { version: 1 });
    expect(onCommitFailed).toHaveBeenCalledTimes(1);
    expect(onAssets).toHaveBeenCalledWith({ widgetSchemas: {}, availableSections: {} });
    expect(onReady).toHaveBeenCalledWith({ version: 1 });
  });

  it("closes the previous channel when re-registering", () => {
    reg();
    const first = ch;
    ch = makeChannel();
    (createChannel as Mock).mockReturnValue(ch);
    reg();
    expect(first.close).toHaveBeenCalledTimes(1);
  });
});

describe("outbound fast lane (synchronous patches)", () => {
  it("commitClientWidget sends patchWidget with resolved settings", () => {
    reg();
    commitClientWidget("s1", "w1", { title: "Hi" });
    expect(ch.send).toHaveBeenCalledWith("patchWidget", {
      sectionId: "s1",
      widgetId: "w1",
      settings: { title: "Hi" },
    });
  });

  it("commitClientSection sends patchSection", () => {
    reg();
    commitClientSection("s1", { padding: 8 });
    expect(ch.send).toHaveBeenCalledWith("patchSection", {
      sectionId: "s1",
      settings: { padding: 8 },
    });
  });

  it("focusSection includes widgetId only when given", () => {
    reg();
    focusSection("s1", "w1");
    expect(ch.send).toHaveBeenCalledWith("focusSection", { sectionId: "s1", widgetId: "w1" });
    ch.send.mockClear();
    focusSection("s1");
    expect(ch.send).toHaveBeenCalledWith("focusSection", { sectionId: "s1" });
  });
});

describe("outbound commit lane (debounced applyConfig)", () => {
  it("debounces, then fires onCommitFired + sends applyConfig", () => {
    vi.useFakeTimers();
    const { onCommitFired } = reg();
    commitServer({ sections: [{ widgets: [{ settings: { a: 1 } }] }] });
    expect(onCommitFired).not.toHaveBeenCalled();
    expect(ch.send).not.toHaveBeenCalledWith("applyConfig", expect.anything());

    vi.advanceTimersByTime(150);
    expect(onCommitFired).toHaveBeenCalledTimes(1);
    expect(ch.send).toHaveBeenCalledWith(
      "applyConfig",
      expect.objectContaining({ pageConfig: expect.any(Object) }),
    );
    vi.useRealTimers();
  });

  it("collapses rapid commits into a single applyConfig", () => {
    vi.useFakeTimers();
    reg();
    commitServer({ sections: [] });
    commitServer({ sections: [] });
    commitServer({ sections: [] });
    vi.advanceTimersByTime(150);
    const applyCalls = ch.send.mock.calls.filter((c) => c[0] === "applyConfig");
    expect(applyCalls).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe("unregisterPreviewBridge", () => {
  it("closes the channel and makes subsequent commits no-ops", () => {
    reg();
    unregisterPreviewBridge();
    expect(ch.close).toHaveBeenCalledTimes(1);
    ch.send.mockClear();
    commitClientWidget("s1", "w1", { title: "x" });
    expect(ch.send).not.toHaveBeenCalled();
  });
});
