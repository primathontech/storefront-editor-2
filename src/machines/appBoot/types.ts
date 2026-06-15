import type { EditorAPI } from "../../editor-form/services/api";

export type Session = Awaited<ReturnType<typeof EditorAPI.authenticate>>;

export interface Input {
  mid: string | null;
  token: string | null;
  /** True when the editor is loaded inside an iframe (the GK page-app embed).
   *  Interim boot signal while the GK token handoff is pending — see the
   *  `canBoot` guard. */
  isEmbedded: boolean;
}

export type ErrorKind = "auth" | "network" | "server" | "unknown";

export interface Context {
  input: Input;
}

export type Events =
  | { type: "RETRY" }
  | { type: "LOGOUT" }
  | { type: "TOKEN_EXPIRED" };
