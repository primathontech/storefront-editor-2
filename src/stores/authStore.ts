import { create } from "zustand";

export interface Merchant {
  id: string;
  themeId: string;
  previewOrigin: string;
}

interface AuthStore {
  token: string | null;
  merchant: Merchant | null;
  setSession: (s: { token: string; merchant: Merchant }) => void;
  clear: () => void;
}

// Future: a `user` field (identity of the GK-authed person) will land here
// alongside `token` once we surface it in UI.
export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  merchant: null,
  setSession: ({ token, merchant }) => set({ token, merchant }),
  clear: () => set({ token: null, merchant: null }),
}));
