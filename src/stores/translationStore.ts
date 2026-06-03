import { create } from "zustand";
import {
  deepMerge,
  flattenPaths,
  setValueByPath,
} from "../editor-form/utils/translation-utils";

// Translation-scoped editing data — data layer for translationSessionMachine
// and the static-template lane. Self-contained: no imports from
// useEditorState or dualTranslationStore. Sync setters only; async
// fetch / save lives in machine actor bodies (TranslationEditor.tsx
// .provide()), matching templateStore's contract.

export interface TranslationStore {
  // ---- Data ----
  // `language` lives in themeStore (theme-level per Lakshya contract).
  // Translation slices below are written by fetchTranslations and
  // updateTranslation; consumers compose translation lookups against
  // themeStore.language.
  commonTranslations: Record<string, unknown>;
  templateTranslations: Record<string, unknown>;
  // Derived from commonTranslations + templateTranslations merged.
  // Updated alongside both source slices so the UI never sees a stale
  // merged view.
  translations: Record<string, unknown>;
  // Per-leaf-path provenance — tells updateTranslation whether to write
  // back to commonTranslations or templateTranslations.
  translationSourceMap: Map<string, "common" | "template">;
  hasUnsavedChanges: boolean;

  // ---- Setters ----
  // Called by the fetchTranslations actor with the freshly-fetched
  // common + template slices. Recomputes the merged view and source
  // map; clears hasUnsavedChanges.
  setTranslationData: (args: {
    common: Record<string, unknown>;
    template: Record<string, unknown>;
  }) => void;
  updateTranslation: (path: string[], value: unknown) => void;
  // Called by the saveTranslations actor on success.
  markSaved: () => void;
  reset: () => void;
}

const initialState = {
  commonTranslations: {},
  templateTranslations: {},
  translations: {},
  translationSourceMap: new Map<string, "common" | "template">(),
  hasUnsavedChanges: false,
};

export const useTranslationStore = create<TranslationStore>((set) => ({
  ...initialState,

  setTranslationData: ({ common, template }) => {
    const merged = deepMerge(common, template);
    const sourceMap = new Map<string, "common" | "template">();
    flattenPaths(common).forEach((path) =>
      sourceMap.set(path.join("."), "common"),
    );
    flattenPaths(template).forEach((path) =>
      sourceMap.set(path.join("."), "template"),
    );
    set({
      commonTranslations: common,
      templateTranslations: template,
      translations: merged,
      translationSourceMap: sourceMap,
      hasUnsavedChanges: false,
    });
  },

  updateTranslation: (path, value) =>
    set((state) => {
      const pathKey = path.join(".");
      const source = state.translationSourceMap.get(pathKey) ?? "template";
      const newCommon =
        source === "common"
          ? setValueByPath(state.commonTranslations, path, value)
          : state.commonTranslations;
      const newTemplate =
        source === "template"
          ? setValueByPath(state.templateTranslations, path, value)
          : state.templateTranslations;
      return {
        commonTranslations: newCommon,
        templateTranslations: newTemplate,
        translations: deepMerge(newCommon, newTemplate),
        hasUnsavedChanges: true,
      };
    }),

  markSaved: () => set({ hasUnsavedChanges: false }),

  // Clears the data slices. Language is no longer here — it lives in
  // themeStore and survives lane / template switches by being outside
  // this scope.
  reset: () => set(initialState),
}));
