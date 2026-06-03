export type Events =
  | { type: "IFRAME_LOADED" }
  | { type: "TEMPLATE_CHANGED" }
  | { type: "SAVE_REQUESTED" }
  | { type: "DISMISS" }
  | { type: "RETRY" };

// Empty: themeId, currentTemplate, language, translations all live in
// stores (authStore, themeStore, dualTranslationStore). Actor bodies
// read them via getState() on each invocation.
export type Context = Record<string, never>;
