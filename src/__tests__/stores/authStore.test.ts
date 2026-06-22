// Layer 3 — Unit. Session store written by appBootMachine actions.
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, type Merchant } from "../../stores/authStore";

const MERCHANT: Merchant = {
  id: "m-1",
  themeId: "momsco",
  previewOrigin: "http://localhost:4344",
};

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, merchant: null });
  });

  it("starts with no session", () => {
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.merchant).toBeNull();
  });

  it("setSession persists token and merchant", () => {
    useAuthStore.getState().setSession({ token: "abc123", merchant: MERCHANT });
    const s = useAuthStore.getState();
    expect(s.token).toBe("abc123");
    expect(s.merchant).toEqual(MERCHANT);
  });

  it("clear wipes the session back to null", () => {
    useAuthStore.getState().setSession({ token: "abc123", merchant: MERCHANT });
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.merchant).toBeNull();
  });
});
