import { fromPromise, setup } from "xstate";
import type {
  Context,
  Events,
  Input,
  ThemeStructure,
  ThemeStructureTemplate,
} from "./types";

// Stubs throw; .provide() in ThemeSession.tsx supplies real bodies.
//
// No asset-listener actor here anymore — assets flow through the
// @shopkit/editor-bridge channel created inside TemplateEditor / (next)
// TranslationEditor, which write straight to useThemeStore.setAssets.
// The machine owns auth + theme structure; the iframe-scoped channel
// owns the message bus.
export const themeSessionMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
  },
  actors: {
    fetchThemeStructure: fromPromise<ThemeStructure, { themeId: string }>(
      async () => {
        throw new Error("fetchThemeStructure stub");
      },
    ),
  },
  actions: {
    setTheme: (_: unknown, _params: { theme: ThemeStructure }) => {
      throw new Error("setTheme stub");
    },
    selectDefaultTemplate: () => {
      throw new Error("selectDefaultTemplate stub");
    },
    clearTemplateScopedState: () => {
      throw new Error("clearTemplateScopedState stub");
    },
    setCurrentTemplate: (
      _: unknown,
      _params: { template: ThemeStructureTemplate },
    ) => {
      throw new Error("setCurrentTemplate stub");
    },
  },
}).createMachine({
  id: "themeSession",
  initial: "bootingTheme",
  context: ({ input }) => ({ input }),

  states: {
    bootingTheme: {
      invoke: {
        src: "fetchThemeStructure",
        input: ({ context }) => ({ themeId: context.input.merchant.themeId }),
        onDone: {
          target: "ready",
          // setTheme must run before selectDefaultTemplate reads it back.
          actions: [
            {
              type: "setTheme",
              params: ({ event }) => ({ theme: event.output }),
            },
            "selectDefaultTemplate",
          ],
        },
        onError: { target: "errorLoadingTheme" },
      },
    },
    errorLoadingTheme: {
      on: { RETRY: "bootingTheme" },
    },
    ready: {
      on: {
        SWITCH_TEMPLATE: {
          actions: [
            "clearTemplateScopedState",
            {
              type: "setCurrentTemplate",
              params: ({ event }) => ({ template: event.template }),
            },
          ],
        },
      },
    },
  },
});
