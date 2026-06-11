import type { SourceValidationIssue } from "../../editor-form/services/api";

export type SaveErrorInfo = {
  message: string;
  issues: SourceValidationIssue[];
};

export type Events =
  // UI intents
  | { type: "RETRY" }
  | { type: "FILE_SELECTED"; path: string }
  | { type: "SAVE_REQUESTED" }
  | { type: "REVERT_REQUESTED" }
  | { type: "BUILD_REQUESTED" }
  | { type: "PUBLISH_REQUESTED" }
  | { type: "DISMISS" }
  | { type: "CLEAR" }
  // Sent back by the build-runner callback actors (POST + 2s polling)
  | { type: "BUILD_PROGRESS"; kind: "queued" | "building" }
  | { type: "BUILD_READY"; previewUrl: string }
  | { type: "BUILD_PUBLISHED"; prodUrl: string }
  | { type: "BUILD_FAILED"; error: string };

// File content / tree live in codeEditorStore (actor bodies read it via
// getState(), matching templateSession). Context keeps only what the
// machine itself owns: the in-flight selection and surfaced errors/URLs.
export interface Context {
  pendingPath: string | null;
  saveError: SaveErrorInfo | null;
  previewUrl: string | null;
  prodUrl: string | null;
  buildError: string | null;
}
