import { create } from "zustand";
import type {
  AvailableSectionRegistry,
  WidgetRegistry,
} from "@shopkit/editor-bridge";
import type {
  ThemeStructure,
  ThemeStructureTemplate,
} from "../editor-form/services/api";

// Written by themeSessionMachine actions + the language switcher in the
// header. Consumers read theme + currentTemplate + language.
//
// `supportedLanguages` is per-template (backend declined the theme-level
// move). The selected `language` is single-valued and theme-session-
// scoped — survives template switches when the new template still
// supports it. setCurrentTemplate coerces language to the new template's
// first supported value when the current one isn't supported.
export interface ThemeStore {
  theme: ThemeStructure | null;
  schemas: WidgetRegistry;
  sections: AvailableSectionRegistry;
  currentTemplate: ThemeStructureTemplate | null;
  language: string;
  assetsStatus: "idle" | "ready";
  /** The previewed storefront wired EditorHost's fetchDataSourceOptions
   *  (advertised on the bridge `ready` handshake). False for storefronts that
   *  haven't adopted data-source editing yet → the editor hides the pickers. */
  dataSourceEditingSupported: boolean;
  /** The previewed storefront has the one-time preview-feature code sync in its
   *  repo (advertised on the bridge `ready` handshake). False until the iframe's
   *  EditorHost confirms it → the editor disables the shareable-preview button
   *  for storefronts that haven't run the sync yet. */
  previewCodeSync: boolean;

  setTheme: (theme: ThemeStructure) => void;
  setAssets: (
    schemas: WidgetRegistry,
    sections: AvailableSectionRegistry,
  ) => void;
  setDataSourceEditingSupported: (supported: boolean) => void;
  setPreviewCodeSync: (synced: boolean) => void;
  setCurrentTemplate: (template: ThemeStructureTemplate | null) => void;
  setLanguage: (language: string) => void;
  clear: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: null,
  schemas: {},
  sections: {},
  currentTemplate: null,
  language: "en",
  assetsStatus: "idle",
  dataSourceEditingSupported: false,
  previewCodeSync: false,

  setTheme: (theme) => set({ theme }),
  setAssets: (schemas, sections) =>
    set({ schemas, sections, assetsStatus: "ready" }),
  setDataSourceEditingSupported: (dataSourceEditingSupported) =>
    set({ dataSourceEditingSupported }),
  setPreviewCodeSync: (previewCodeSync) => set({ previewCodeSync }),
  setCurrentTemplate: (currentTemplate) =>
    set((state) => {
      if (!currentTemplate) {
        return { currentTemplate };
      }
      const supported = currentTemplate.supportedLanguages ?? ["en"];
      const langOk = state.language && supported.includes(state.language);
      return {
        currentTemplate,
        language: langOk ? state.language : (supported[0] ?? "en"),
      };
    }),
  setLanguage: (language) => set({ language }),
  clear: () =>
    set({
      theme: null,
      schemas: {},
      sections: {},
      currentTemplate: null,
      language: "en",
      assetsStatus: "idle",
      dataSourceEditingSupported: false,
      previewCodeSync: false,
    }),
}));
