import type { Merchant } from "../../stores/authStore";
import type {
  ThemeStructure,
  ThemeStructureTemplate,
} from "../../editor-form/services/api";

export interface Input {
  merchant: Merchant;
}

export interface Context {
  input: Input;
}

export type Events =
  | { type: "SWITCH_TEMPLATE"; template: ThemeStructureTemplate }
  | { type: "RETRY" };

export type { ThemeStructure, ThemeStructureTemplate };
