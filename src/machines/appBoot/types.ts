import type { EditorAPI } from "../../editor-form/services/api";

export type Session = Awaited<ReturnType<typeof EditorAPI.authenticate>>;

export interface Input {
  mid: string | null;
  token: string | null;
}

export type ErrorKind = "auth" | "network" | "server" | "unknown";

export interface Context {
  input: Input;
}

export type Events =
  | { type: "RETRY" }
  | { type: "LOGOUT" }
  | { type: "TOKEN_EXPIRED" };
