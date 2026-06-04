import {
  fromCallback,
  fromPromise,
  setup,
  type AnyEventObject,
} from "xstate";
import type { Context, Events } from "./types";

// Stubs throw; .provide() in TranslationEditor.tsx supplies real bodies.
//
// Twin of templateSessionMachine for the deprecated static-template lane,
// but materially simpler:
//   - No validateHtml — translation lane has no widgets to validate.
//   - No committing / commitFailed states — translation patches are
//     fire-and-forget channel.send (no /api/editor-preview/cache POST,
//     no settle round-trip).
//   - Single-stage save — only translations to persist.
//   - No committingInitial blocker — the iframe paints the un-flushed
//     template on first load; the 5s safety net on waitingForIframe
//     handles a missed `ready`.
export const translationSessionMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    fetchTranslations: fromPromise<void>(async () => {
      throw new Error("fetchTranslations stub");
    }),
    saveTranslations: fromPromise<void>(async () => {
      throw new Error("saveTranslations stub");
    }),
    currentTemplateWatcher: fromCallback<AnyEventObject>(() => {
      throw new Error("currentTemplateWatcher stub");
    }),
  },
}).createMachine({
  id: "translationSession",
  initial: "bootingTemplate",
  context: {},

  invoke: { src: "currentTemplateWatcher" },

  // TEMPLATE_CHANGED at machine root abandons any in-flight work (boot,
  // save) and re-enters the boot phase. Fired by the watcher on either
  // template or language change. Mirrors templateSessionMachine.
  on: {
    TEMPLATE_CHANGED: { target: ".bootingTemplate" },
  },

  states: {
    bootingTemplate: {
      invoke: {
        src: "fetchTranslations",
        onDone: { target: "editing" },
        onError: { target: "loadError" },
      },
    },

    loadError: {
      on: { RETRY: "bootingTemplate" },
    },

    // Concurrent concerns enabled only after translations are loaded.
    // Hierarchy makes save unrepresentable before the boot phase finishes.
    editing: {
      type: "parallel",
      states: {
        preview: {
          initial: "waitingForIframe",
          states: {
            // Iframe hasn't fired `ready` yet. Tagged `previewLoading`
            // so TranslationEditor draws an overlay over the iframe.
            // Two ways out:
            //   - IFRAME_LOADED arrives → idle (the bridge's onReady
            //     callback flushes translations via flushTranslationPatch
            //     BEFORE dispatching IFRAME_LOADED, so steady state
            //     starts with the override store populated)
            //   - 5s elapses with no signal → idle (best-effort; we
            //     lost observability of the bridge, but the iframe is
            //     visible — better than a stuck overlay)
            waitingForIframe: {
              tags: "previewLoading",
              on: { IFRAME_LOADED: "idle" },
              after: { 5000: "idle" },
            },
            // Steady state. The bridge's onReady callback (in
            // TranslationEditor.tsx) fires the initial flush via
            // flushTranslationPatch BEFORE dispatching IFRAME_LOADED,
            // so by the time we land here the override store is
            // populated. Live edits from then on flow through
            // debounced commitTranslationPatch — the iframe's override
            // store applies patches synchronously, no commit round-trip
            // to model here.
            idle: {},
          },
        },

        // Save sub-states tagged with saveSaving / saveSaved / saveFailed
        // so the UI can query a flat semantic group instead of enumerating
        // every leaf state. Matches templateSession's save lane.
        save: {
          initial: "idle",
          states: {
            idle: {
              on: { SAVE_REQUESTED: "saving" },
            },
            saving: {
              tags: "saveSaving",
              invoke: {
                src: "saveTranslations",
                onDone: { target: "saved" },
                onError: { target: "saveFailed" },
              },
            },
            saveFailed: {
              tags: "saveFailed",
              on: {
                DISMISS: "idle",
                RETRY: "saving",
                // Re-running Save from this state restarts the flow —
                // consistent recovery story so the Save button always
                // works the same way.
                SAVE_REQUESTED: "saving",
              },
            },
            saved: {
              tags: "saveSaved",
              after: { 2000: "idle" },
              on: { SAVE_REQUESTED: "saving" },
            },
          },
        },
      },
    },
  },
});
