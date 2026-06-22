// Layer 2 — machine wiring. Drives appBootMachine with provided stub
// actors/guards (the real bodies live in App.tsx). Verifies the auth
// lifecycle: boot gate → authenticating → authenticated / error fan-out.
import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import {
  appBootMachine,
  AuthError,
  NetworkError,
  ServerError,
  type Input,
  type Session,
} from "../../machines/appBoot";

const SESSION: Session = {
  token: "tok",
  merchant: { id: "m1", themeId: "momsco", previewOrigin: "http://localhost:4344" },
};

// Boot eligibility = mid + GK-embedded iframe. Token is present but never
// gates boot (mirrors the real `canBoot` in App.tsx).
const CREDS: Input = { mid: "momsco", token: "tok", isEmbedded: true };

function boot(opts: {
  input: Input;
  authenticate: () => Promise<Session>;
}) {
  const persistSession = vi.fn();
  const clearSession = vi.fn();
  const machine = appBootMachine.provide({
    actors: {
      authenticate: fromPromise<Session, Input>(() => opts.authenticate()),
    },
    actions: { persistSession, clearSession },
    guards: {
      // Mirrors App.tsx: boot needs `mid` + an embedded iframe; token is
      // intentionally not consulted.
      canBoot: ({ context }) =>
        !!context.input.mid && context.input.isEmbedded,
      isAuthError: ({ event }) =>
        (event as { error?: unknown }).error instanceof AuthError,
      isNetworkError: ({ event }) =>
        (event as { error?: unknown }).error instanceof NetworkError,
      isServerError: ({ event }) =>
        (event as { error?: unknown }).error instanceof ServerError,
    },
  });
  const actor = createActor(machine, { input: opts.input });
  actor.start();
  return { actor, persistSession, clearSession };
}

describe("appBootMachine", () => {
  it("when boot is not allowed lands on unauthenticated.missingToken", () => {
    const { actor } = boot({
      input: { mid: null, token: null, isEmbedded: false },
      authenticate: async () => SESSION,
    });
    expect(actor.getSnapshot().matches({ unauthenticated: "missingToken" })).toBe(true);
  });

  it("when boot is allowed + successful auth reaches authenticated and persists the session", async () => {
    const { actor, persistSession } = boot({
      input: CREDS,
      authenticate: async () => SESSION,
    });
    await waitFor(actor, (s) => s.matches("authenticated"), { timeout: 2000 });
    expect(persistSession).toHaveBeenCalledTimes(1);
  });

  it("routes a 401 (AuthError) to unauthenticated.invalidToken", async () => {
    const { actor } = boot({
      input: CREDS,
      authenticate: async () => {
        throw new AuthError();
      },
    });
    await waitFor(actor, (s) => s.matches({ unauthenticated: "invalidToken" }), {
      timeout: 2000,
    });
    expect(actor.getSnapshot().matches({ unauthenticated: "invalidToken" })).toBe(true);
  });

  it("routes a ServerError to unauthenticated.serverError", async () => {
    const { actor } = boot({
      input: CREDS,
      authenticate: async () => {
        throw new ServerError();
      },
    });
    await waitFor(actor, (s) => s.matches({ unauthenticated: "serverError" }), {
      timeout: 2000,
    });
    expect(actor.getSnapshot().matches({ unauthenticated: "serverError" })).toBe(true);
  });

  it("routes an unclassified error to unauthenticated.unknown", async () => {
    const { actor } = boot({
      input: CREDS,
      authenticate: async () => {
        throw new Error("boom");
      },
    });
    await waitFor(actor, (s) => s.matches({ unauthenticated: "unknown" }), {
      timeout: 2000,
    });
    expect(actor.getSnapshot().matches({ unauthenticated: "unknown" })).toBe(true);
  });

  it("RETRY from a network error re-authenticates and can recover", async () => {
    let attempt = 0;
    const { actor } = boot({
      input: CREDS,
      authenticate: async () => {
        attempt += 1;
        if (attempt === 1) throw new NetworkError();
        return SESSION;
      },
    });
    await waitFor(actor, (s) => s.matches({ unauthenticated: "networkError" }), {
      timeout: 2000,
    });
    actor.send({ type: "RETRY" });
    await waitFor(actor, (s) => s.matches("authenticated"), { timeout: 2000 });
    expect(actor.getSnapshot().matches("authenticated")).toBe(true);
  });

  it("LOGOUT from authenticated clears the session and returns to unauthenticated", async () => {
    const { actor, clearSession } = boot({
      input: CREDS,
      authenticate: async () => SESSION,
    });
    await waitFor(actor, (s) => s.matches("authenticated"), { timeout: 2000 });
    actor.send({ type: "LOGOUT" });
    await waitFor(actor, (s) => s.matches("unauthenticated"), { timeout: 2000 });
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});
