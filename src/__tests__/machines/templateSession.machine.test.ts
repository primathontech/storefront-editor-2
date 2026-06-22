// Layer 2 — machine wiring. templateSessionMachine: the dynamic lane's
// parallel preview + save regions. Real bodies live in TemplateEditor.tsx.
import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise, fromCallback, waitFor } from "xstate";
import { templateSessionMachine } from "../../machines/templateSession";

function boot(opts: {
  fetchOk?: boolean;
  hasValidationErrors?: boolean;
} = {}) {
  const fetchOk = opts.fetchOk ?? true;
  const requestInitialCommit = vi.fn();
  const machine = templateSessionMachine.provide({
    actors: {
      fetchTemplateData: fromPromise(async () => {
        if (!fetchOk) throw new Error("load failed");
      }),
      validateHtml: fromPromise(async () => {}),
      saveTemplate: fromPromise(async () => {}),
      saveTranslations: fromPromise(async () => {}),
      // No-op watcher with a cleanup fn (the real one subscribes to themeStore).
      currentTemplateWatcher: fromCallback(() => () => {}),
    },
    actions: { requestInitialCommit },
    guards: {
      hasValidationErrors: () => opts.hasValidationErrors ?? false,
    },
  });
  const actor = createActor(machine);
  actor.start();
  return { actor, requestInitialCommit };
}

describe("templateSessionMachine — boot", () => {
  it("on load success enters editing, preview waiting for the iframe", async () => {
    const { actor } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    const snap = actor.getSnapshot();
    expect(snap.matches({ editing: { preview: "waitingForIframe" } })).toBe(true);
    expect(snap.hasTag("previewLoading")).toBe(true);
  });

  it("on load error enters loadError; RETRY re-boots", async () => {
    const { actor } = boot({ fetchOk: false });
    await waitFor(actor, (s) => s.matches("loadError"), { timeout: 2000 });
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("bootingTemplate")).toBe(true);
  });
});

describe("templateSessionMachine — preview commit lifecycle", () => {
  it("IFRAME_LOADED → committingInitial fires requestInitialCommit, then COMMIT_SETTLED → idle", async () => {
    const { actor, requestInitialCommit } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });

    actor.send({ type: "IFRAME_LOADED" });
    expect(
      actor.getSnapshot().matches({ editing: { preview: "committingInitial" } }),
    ).toBe(true);
    expect(requestInitialCommit).toHaveBeenCalledTimes(1);

    actor.send({ type: "COMMIT_SETTLED" });
    const snap = actor.getSnapshot();
    expect(snap.matches({ editing: { preview: "idle" } })).toBe(true);
    expect(snap.hasTag("previewLoading")).toBe(false);
  });

  it("a COMMIT_FIRED from idle moves to committing, COMMIT_SETTLED back to idle", async () => {
    const { actor } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "IFRAME_LOADED" });
    actor.send({ type: "COMMIT_SETTLED" }); // → idle
    actor.send({ type: "COMMIT_FIRED" });
    expect(actor.getSnapshot().matches({ editing: { preview: "committing" } })).toBe(true);
    actor.send({ type: "COMMIT_SETTLED" });
    expect(actor.getSnapshot().matches({ editing: { preview: "idle" } })).toBe(true);
  });
});

describe("templateSessionMachine — save lifecycle", () => {
  it("SAVE_REQUESTED with no validation errors runs through to saved", async () => {
    const { actor } = boot({ hasValidationErrors: false });
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "SAVE_REQUESTED" });
    await waitFor(actor, (s) => s.hasTag("saveSaved"), { timeout: 2000 });
    expect(actor.getSnapshot().hasTag("saveSaved")).toBe(true);
  });

  it("SAVE_REQUESTED with validation errors stops at validationFailed (saveFailed tag)", async () => {
    const { actor } = boot({ hasValidationErrors: true });
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "SAVE_REQUESTED" });
    await waitFor(actor, (s) => s.hasTag("saveFailed"), { timeout: 2000 });
    expect(
      actor.getSnapshot().matches({ editing: { save: "validationFailed" } }),
    ).toBe(true);
  });
});
