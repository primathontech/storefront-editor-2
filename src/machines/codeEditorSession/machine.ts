import {
  assign,
  fromCallback,
  fromPromise,
  setup,
  type AnyEventObject,
} from "xstate";
import type { Context, Events, SaveErrorInfo } from "./types";

// Duck-typed (no service import — machine stays dependency-free like
// templateSession). SourceApiError carries `code` + optional `issues`;
// anything else falls through to its message.
const toSaveError = (err: unknown): SaveErrorInfo => {
  const e = err as {
    code?: string;
    message?: string;
    issues?: SaveErrorInfo["issues"];
  } | null;
  if (e?.code === "validation") {
    return { message: "Validation failed.", issues: e.issues ?? [] };
  }
  if (e?.code === "stale") {
    return { message: "File changed elsewhere — reload file.", issues: [] };
  }
  if (e?.code === "forbidden") {
    return { message: "This file isn't editable.", issues: [] };
  }
  if (e?.code === "too_large") {
    return { message: "File is too large to save.", issues: [] };
  }
  return { message: e?.message || "Save failed.", issues: [] };
};

// Stubs throw; .provide() in CodeEditor.tsx supplies real bodies.
export const codeEditorSessionMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    fetchTree: fromPromise<void>(async () => {
      throw new Error("fetchTree stub");
    }),
    loadFile: fromPromise<void, { path: string }>(async () => {
      throw new Error("loadFile stub");
    }),
    saveFile: fromPromise<void>(async () => {
      throw new Error("saveFile stub");
    }),
    revertFile: fromPromise<void>(async () => {
      throw new Error("revertFile stub");
    }),
    // Callback actors: POST build-preview / publish, then poll
    // GET /builds/{id} every 2000ms, sending BUILD_* events back until a
    // terminal kind (ready / published / failed). Cleanup cancels polling.
    runPreviewBuild: fromCallback<AnyEventObject>(() => {
      throw new Error("runPreviewBuild stub");
    }),
    runPublishBuild: fromCallback<AnyEventObject>(() => {
      throw new Error("runPublishBuild stub");
    }),
  },
}).createMachine({
  id: "codeEditorSession",
  initial: "bootingTree",
  context: {
    pendingPath: null,
    saveError: null,
    previewUrl: null,
    prodUrl: null,
    buildError: null,
  },

  states: {
    bootingTree: {
      invoke: {
        src: "fetchTree",
        onDone: { target: "ready" },
        onError: { target: "loadError" },
      },
    },

    loadError: {
      on: { RETRY: "bootingTree" },
    },

    // Concurrent concerns enabled only after the tree is loaded —
    // mirrors templateSession's parallel `editing` region.
    ready: {
      type: "parallel",
      states: {
        file: {
          initial: "idle",
          // Selecting a file is legal from any file sub-state except the
          // in-flight ones; saving/reverting/loading don't handle it so
          // the selection waits for the in-flight call to settle.
          states: {
            idle: {
              on: {
                FILE_SELECTED: {
                  target: "loadingFile",
                  actions: assign({
                    pendingPath: ({ event }) => event.path,
                    saveError: null,
                  }),
                },
              },
            },
            loadingFile: {
              tags: "fileLoading",
              invoke: {
                src: "loadFile",
                input: ({ context }) => ({ path: context.pendingPath ?? "" }),
                onDone: { target: "opened" },
                onError: { target: "fileLoadError" },
              },
            },
            fileLoadError: {
              tags: "fileLoadFailed",
              on: {
                RETRY: "loadingFile",
                FILE_SELECTED: {
                  target: "loadingFile",
                  actions: assign({
                    pendingPath: ({ event }) => event.path,
                  }),
                },
              },
            },
            opened: {
              on: {
                FILE_SELECTED: {
                  target: "loadingFile",
                  actions: assign({
                    pendingPath: ({ event }) => event.path,
                    saveError: null,
                  }),
                },
                SAVE_REQUESTED: "saving",
                REVERT_REQUESTED: "reverting",
              },
            },
            saving: {
              tags: "saveSaving",
              invoke: {
                src: "saveFile",
                onDone: {
                  target: "saved",
                  actions: assign({ saveError: null }),
                },
                onError: {
                  target: "saveFailed",
                  actions: assign({
                    saveError: ({ event }) => toSaveError(event.error),
                  }),
                },
              },
            },
            saved: {
              tags: "saveSaved",
              after: { 2000: "opened" },
              on: {
                FILE_SELECTED: {
                  target: "loadingFile",
                  actions: assign({
                    pendingPath: ({ event }) => event.path,
                  }),
                },
                SAVE_REQUESTED: "saving",
                REVERT_REQUESTED: "reverting",
              },
            },
            saveFailed: {
              tags: "saveFailed",
              on: {
                DISMISS: {
                  target: "opened",
                  actions: assign({ saveError: null }),
                },
                // Save button stays clickable from failure — consistent
                // recovery story with templateSession.
                SAVE_REQUESTED: "saving",
                REVERT_REQUESTED: "reverting",
                FILE_SELECTED: {
                  target: "loadingFile",
                  actions: assign({
                    pendingPath: ({ event }) => event.path,
                    saveError: null,
                  }),
                },
              },
            },
            reverting: {
              tags: "fileReverting",
              invoke: {
                src: "revertFile",
                onDone: {
                  target: "opened",
                  actions: assign({ saveError: null }),
                },
                onError: {
                  target: "saveFailed",
                  actions: assign({
                    saveError: ({ event }) => toSaveError(event.error),
                  }),
                },
              },
            },
          },
        },

        build: {
          initial: "idle",
          states: {
            idle: {
              on: {
                BUILD_REQUESTED: "previewing",
                PUBLISH_REQUESTED: "publishing",
              },
            },
            previewing: {
              initial: "queued",
              entry: assign({ buildError: null, previewUrl: null }),
              invoke: { src: "runPreviewBuild" },
              on: {
                BUILD_PROGRESS: {
                  guard: ({ event }) => event.kind === "building",
                  target: ".building",
                },
                BUILD_READY: {
                  target: "ready",
                  actions: assign({
                    previewUrl: ({ event }) => event.previewUrl,
                  }),
                },
                BUILD_FAILED: {
                  target: "failed",
                  actions: assign({ buildError: ({ event }) => event.error }),
                },
              },
              states: {
                queued: { tags: "buildQueued" },
                building: { tags: "buildBuilding" },
              },
            },
            publishing: {
              initial: "queued",
              entry: assign({ buildError: null }),
              invoke: { src: "runPublishBuild" },
              on: {
                BUILD_PROGRESS: {
                  guard: ({ event }) => event.kind === "building",
                  target: ".building",
                },
                BUILD_PUBLISHED: {
                  target: "published",
                  actions: assign({ prodUrl: ({ event }) => event.prodUrl }),
                },
                BUILD_FAILED: {
                  target: "failed",
                  actions: assign({ buildError: ({ event }) => event.error }),
                },
              },
              states: {
                queued: { tags: "buildQueued" },
                building: { tags: "buildBuilding" },
              },
            },
            ready: {
              tags: "buildReady",
              on: {
                BUILD_REQUESTED: "previewing",
                PUBLISH_REQUESTED: "publishing",
                CLEAR: "idle",
              },
            },
            published: {
              tags: "buildPublished",
              on: {
                BUILD_REQUESTED: "previewing",
                PUBLISH_REQUESTED: "publishing",
                CLEAR: "idle",
              },
            },
            failed: {
              tags: "buildFailed",
              on: {
                BUILD_REQUESTED: "previewing",
                PUBLISH_REQUESTED: "publishing",
                DISMISS: {
                  target: "idle",
                  actions: assign({ buildError: null }),
                },
                CLEAR: {
                  target: "idle",
                  actions: assign({ buildError: null }),
                },
              },
            },
          },
        },
      },
    },
  },
});
