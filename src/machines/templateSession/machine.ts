import {
  fromCallback,
  fromPromise,
  setup,
  type AnyEventObject,
} from "xstate";
import type { Context, Events } from "./types";

// Stubs throw; .provide() in TemplateEditor.tsx supplies real bodies.
export const templateSessionMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    fetchTemplateData: fromPromise<void>(async () => {
      throw new Error("fetchTemplateData stub");
    }),
    validateHtml: fromPromise<void>(async () => {
      throw new Error("validateHtml stub");
    }),
    saveTemplate: fromPromise<void>(async () => {
      throw new Error("saveTemplate stub");
    }),
    saveTranslations: fromPromise<void>(async () => {
      throw new Error("saveTranslations stub");
    }),
    currentTemplateWatcher: fromCallback<AnyEventObject>(() => {
      throw new Error("currentTemplateWatcher stub");
    }),
  },
  actions: {
    // Fired on entry to `committingInitial` so the iframe never paints
    // visibly with the un-edited backend pageConfig — the bridge has
    // mounted, but we hold the overlay (`previewLoading` tag) until
    // this commit cycle settles. Real body in TemplateEditor.tsx.provide()
    // calls commitServer(useTemplateStore.getState().pageConfig).
    requestInitialCommit: () => {
      throw new Error("requestInitialCommit stub");
    },
  },
  guards: {
    hasValidationErrors: () => false,
  },
}).createMachine({
  id: "templateSession",
  initial: "bootingTemplate",
  context: {},

  invoke: { src: "currentTemplateWatcher" },

  // TEMPLATE_CHANGED at machine root abandons any in-flight work (commits,
  // saves) and re-enters the boot phase. Fired by the watcher on either
  // template or language change — actor bodies read fresh state each invoke.
  on: {
    TEMPLATE_CHANGED: { target: ".bootingTemplate" },
  },

  states: {
    bootingTemplate: {
      invoke: {
        src: "fetchTemplateData",
        onDone: { target: "editing" },
        onError: { target: "loadError" },
      },
    },

    loadError: {
      on: { RETRY: "bootingTemplate" },
    },

    // Concurrent concerns enabled only after data is loaded. Hierarchy
    // makes save / commit unrepresentable before the boot phase finishes.
    editing: {
      type: "parallel",
      states: {
        preview: {
          initial: "waitingForIframe",
          states: {
            // Iframe hasn't reported `ready` yet. Tagged `previewLoading`
            // so TemplateEditor draws an overlay over the iframe area —
            // the iframe is mounted (so it can load and fire ready) but
            // its content stays hidden.
            waitingForIframe: {
              tags: "previewLoading",
              on: { IFRAME_LOADED: "committingInitial" },
            },
            // Bridge is up; push our current pageConfig as the first
            // applyConfig so the iframe lands on ?previewKey=… before
            // it becomes visible. Without this gate the iframe would
            // paint the un-edited backend pageConfig once, with raw
            // t:-refs, before any user edit happened.
            committingInitial: {
              tags: "previewLoading",
              entry: "requestInitialCommit",
              on: {
                COMMIT_SETTLED: "idle",
                COMMIT_FAILED: "commitFailed",
              },
              after: { 8000: "commitFailed" },
            },
            idle: {
              on: { COMMIT_FIRED: "committing" },
            },
            committing: {
              on: {
                COMMIT_SETTLED: "idle",
                COMMIT_FAILED: "commitFailed",
                // Second edit while the first is still in flight: model
                // it as a fresh committing cycle. The iframe-side
                // AbortController in EditorHostInner ensures only the
                // latest cache POST survives to drive router.replace,
                // so this transition keeps the machine's view aligned
                // with what actually happens on the wire.
                COMMIT_FIRED: "committing",
              },
              // Timeout-as-failure: if no settle / no failure signal
              // arrives within the window, declare the commit failed.
              // Honest semantic — we lost observability, treat as failed.
              after: { 8000: "commitFailed" },
            },
            commitFailed: {
              // A fresh commit attempt clears the failure — the new
              // postMessage is the user's "retry" implicit signal.
              on: {
                DISMISS: "idle",
                COMMIT_FIRED: "committing",
              },
            },
          },
        },

        // Save sub-states are tagged with one of saveValidating /
        // saveSaving / saveSaved / saveFailed so the UI can query a flat
        // semantic group instead of enumerating every leaf state.
        save: {
          initial: "idle",
          states: {
            idle: {
              on: { SAVE_REQUESTED: "validating" },
            },
            validating: {
              tags: "saveValidating",
              invoke: {
                src: "validateHtml",
                onDone: [
                  {
                    guard: "hasValidationErrors",
                    target: "validationFailed",
                  },
                  { target: "savingTemplate" },
                ],
              },
            },
            validationFailed: {
              tags: "saveFailed",
              on: {
                DISMISS: "idle",
                SAVE_REQUESTED: "validating",
              },
            },
            savingTemplate: {
              tags: "saveSaving",
              invoke: {
                src: "saveTemplate",
                onDone: { target: "savingTranslations" },
                onError: { target: "templateSaveFailed" },
              },
            },
            templateSaveFailed: {
              tags: "saveFailed",
              on: {
                DISMISS: "idle",
                RETRY: "savingTemplate",
                // Re-running Save from this state restarts the full
                // flow (re-validate) — consistent recovery story so the
                // Save button always works.
                SAVE_REQUESTED: "validating",
              },
            },
            savingTranslations: {
              tags: "saveSaving",
              invoke: {
                src: "saveTranslations",
                onDone: { target: "saved" },
                onError: { target: "translationsSaveFailed" },
              },
            },
            translationsSaveFailed: {
              tags: "saveFailed",
              // Template already persisted at this point — DISMISS does
              // not roll back. RETRY re-fires only the translations save.
              // SAVE_REQUESTED restarts the full flow (re-validate, etc.)
              // for consistent Save-button semantics.
              on: {
                DISMISS: "idle",
                RETRY: "savingTranslations",
                SAVE_REQUESTED: "validating",
              },
            },
            saved: {
              tags: "saveSaved",
              after: { 2000: "idle" },
              on: { SAVE_REQUESTED: "validating" },
            },
          },
        },
      },
    },
  },
});
