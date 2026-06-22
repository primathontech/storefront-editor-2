// Layer 2 — machine wiring. translationSessionMachine: the static lane's
// simpler twin (no validate/commit). Real bodies live in TranslationEditor.tsx.
import { describe, it, expect } from "vitest";
import { createActor, fromPromise, fromCallback, waitFor } from "xstate";
import { translationSessionMachine } from "../../machines/translationSession";

function boot(opts: { saveOk?: boolean } = {}) {
  let saveAttempt = 0;
  const machine = translationSessionMachine.provide({
    actors: {
      fetchTranslations: fromPromise(async () => {}),
      saveTranslations: fromPromise(async () => {
        saveAttempt += 1;
        // saveOk:false fails the first attempt only, so RETRY can recover.
        if (opts.saveOk === false && saveAttempt === 1) {
          throw new Error("save failed");
        }
      }),
      currentTemplateWatcher: fromCallback(() => () => {}),
    },
  });
  const actor = createActor(machine);
  actor.start();
  return { actor };
}

describe("translationSessionMachine", () => {
  it("on load success enters editing, preview waiting for the iframe", async () => {
    const { actor } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    const snap = actor.getSnapshot();
    expect(snap.matches({ editing: { preview: "waitingForIframe" } })).toBe(true);
    expect(snap.hasTag("previewLoading")).toBe(true);
  });

  it("IFRAME_LOADED moves preview to idle (overlay lifts)", async () => {
    const { actor } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "IFRAME_LOADED" });
    const snap = actor.getSnapshot();
    expect(snap.matches({ editing: { preview: "idle" } })).toBe(true);
    expect(snap.hasTag("previewLoading")).toBe(false);
  });

  it("SAVE_REQUESTED runs the single-stage save through to saved", async () => {
    const { actor } = boot();
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "SAVE_REQUESTED" });
    await waitFor(actor, (s) => s.hasTag("saveSaved"), { timeout: 2000 });
    expect(actor.getSnapshot().hasTag("saveSaved")).toBe(true);
  });

  it("a failed save lands on saveFailed; RETRY recovers to saved", async () => {
    const { actor } = boot({ saveOk: false });
    await waitFor(actor, (s) => s.matches("editing"), { timeout: 2000 });
    actor.send({ type: "SAVE_REQUESTED" });
    await waitFor(actor, (s) => s.hasTag("saveFailed"), { timeout: 2000 });
    actor.send({ type: "RETRY" });
    await waitFor(actor, (s) => s.hasTag("saveSaved"), { timeout: 2000 });
    expect(actor.getSnapshot().hasTag("saveSaved")).toBe(true);
  });
});
