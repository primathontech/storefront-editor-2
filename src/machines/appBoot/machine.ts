import { fromPromise, setup } from "xstate";
import type { Context, Events, Input, Session } from "./types";

// Stubs throw; .provide() in App.tsx supplies real bodies.
export const appBootMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events,
    input: {} as Input,
  },
  actors: {
    authenticate: fromPromise<Session, Input>(async () => {
      throw new Error("authenticate stub");
    }),
  },
  actions: {
    persistSession: (_: unknown, _params: { session: Session }) => {
      throw new Error("persistSession stub");
    },
    clearSession: () => {
      throw new Error("clearSession stub");
    },
  },
  guards: {
    hasCredentials: () => false,
    isAuthError: () => false,
    isNetworkError: () => false,
    isServerError: () => false,
  },
}).createMachine({
  id: "appBoot",
  initial: "booting",
  context: ({ input }) => ({ input }),
  states: {
    booting: {
      always: [
        { guard: "hasCredentials", target: "authenticating" },
        { target: "unauthenticated.missingToken" },
      ],
    },
    authenticating: {
      invoke: {
        src: "authenticate",
        input: ({ context }) => context.input,
        onDone: {
          target: "authenticated",
          actions: {
            type: "persistSession",
            params: ({ event }) => ({ session: event.output }),
          },
        },
        onError: [
          { guard: "isAuthError", target: "unauthenticated.invalidToken" },
          { guard: "isNetworkError", target: "unauthenticated.networkError" },
          { guard: "isServerError", target: "unauthenticated.serverError" },
          { target: "unauthenticated.unknown" },
        ],
      },
    },
    authenticated: {
      on: {
        LOGOUT: "loggingOut",
        TOKEN_EXPIRED: "authenticating",
      },
    },
    loggingOut: {
      entry: "clearSession",
      always: "unauthenticated",
    },
    unauthenticated: {
      initial: "unknown",
      states: {
        missingToken: {},
        invalidToken: {},
        networkError: { on: { RETRY: "#appBoot.authenticating" } },
        serverError: { on: { RETRY: "#appBoot.authenticating" } },
        unknown: { on: { RETRY: "#appBoot.authenticating" } },
      },
    },
  },
});
