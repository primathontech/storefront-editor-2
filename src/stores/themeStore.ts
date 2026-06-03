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

  setTheme: (theme: ThemeStructure) => void;
  setAssets: (
    schemas: WidgetRegistry,
    sections: AvailableSectionRegistry,
  ) => void;
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

  setTheme: (theme) => set({ theme }),
  setAssets: (schemas, sections) =>
    set({ schemas, sections, assetsStatus: "ready" }),
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
    }),
}));
