export type Events =
  | { type: "IFRAME_LOADED" }
  | { type: "COMMIT_FIRED" }
  | { type: "COMMIT_SETTLED" }
  | { type: "COMMIT_FAILED" }
  | { type: "TEMPLATE_CHANGED" }
  | { type: "SAVE_REQUESTED" }
  | { type: "DISMISS" }
  | { type: "RETRY" };

// Empty: themeId, currentTemplate, language, pageConfig, translations all
// live in stores. Actor bodies read them via getState() on each invocation.
export type Context = Record<string, never>;
