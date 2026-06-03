import { create } from "zustand";

// Editor-wide UI preferences. Survive template switches (dynamic /
// static lane swaps) and the lane stores' resets — the user's viewport
// pick and edit/preview mode should persist across the whole session.
//
// Kept tiny on purpose: anything that's lane-scoped lives in
// templateStore or translationStore.

export type Device = "desktop" | "mobile" | "tablet" | "fullscreen";
export type Mode = "edit" | "preview";

export interface EditorUiStore {
  device: Device;
  mode: Mode;
  setDevice: (device: Device) => void;
  setMode: (mode: Mode) => void;
}

export const useEditorUiStore = create<EditorUiStore>((set) => ({
  device: "desktop",
  mode: "edit",
  setDevice: (device) => set({ device }),
  setMode: (mode) => set({ mode }),
}));
