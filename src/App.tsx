import { useMachine } from "@xstate/react";
import { HTTPError } from "ky";
import { Toaster } from "react-hot-toast";
import { fromPromise, type AnyEventObject } from "xstate";
import { FullPageMessage } from "./components/FullPageMessage";
import { EditorAPI } from "./editor-form/services/api";
import {
  appBootMachine,
  AuthError,
  NetworkError,
  ServerError,
  type Input,
  type Session,
} from "./machines/appBoot";
import { useAuthStore } from "./stores/authStore";
import ThemeSession from "./ThemeSession";

const urlParams = new URLSearchParams(window.location.search);
const initialInput: Input = {
  mid: urlParams.get("mid"),
  token: urlParams.get("token"),
};

const providedAppBootMachine = appBootMachine.provide({
  actors: {
    authenticate: fromPromise<Session, Input>(async ({ input }) => {
      try {
        return await EditorAPI.authenticate(input);
      } catch (err) {
        if (err instanceof HTTPError) {
          if (err.response.status === 401) throw new AuthError();
          if (err.response.status >= 500) throw new ServerError();
        }
        if (err instanceof TypeError) throw new NetworkError();
        throw err;
      }
    }),
  },
  actions: {
    persistSession: (_, params) => {
      const { token, merchant } = (params as { session: Session }).session;
      useAuthStore.getState().setSession({ token, merchant });
    },
    clearSession: () => useAuthStore.getState().clear(),
  },
  guards: {
    hasCredentials: ({ context }) =>
      !!context.input.mid && !!context.input.token,
    isAuthError: ({ event }) =>
      (event as AnyEventObject & { error?: unknown }).error instanceof
      AuthError,
    isNetworkError: ({ event }) =>
      (event as AnyEventObject & { error?: unknown }).error instanceof
      NetworkError,
    isServerError: ({ event }) =>
      (event as AnyEventObject & { error?: unknown }).error instanceof
      ServerError,
  },
});

// Maps machine state to FullPageMessage props. Returns null once we're past
// the appBoot phase — then App renders ThemeSession.
const bootScreen = (
  state: ReturnType<typeof useMachine<typeof providedAppBootMachine>>[0],
  onRetry: () => void,
) => {
  if (state.matches("booting") || state.matches("authenticating")) {
    return { title: "Authenticating…", spinner: true };
  }
  if (state.matches({ unauthenticated: "missingToken" })) {
    return {
      title: "Editor session not started",
      subtitle: "Please open the editor from your Dashboard.",
    };
  }
  if (state.matches({ unauthenticated: "invalidToken" })) {
    return {
      title: "Unauthorized",
      subtitle:
        "Your session is not valid. Please reopen the editor from your Dashboard.",
    };
  }
  if (state.matches({ unauthenticated: "networkError" })) {
    return {
      title: "Can't reach the editor backend",
      subtitle: "Check your connection and try again.",
      onRetry,
    };
  }
  if (state.matches({ unauthenticated: "serverError" })) {
    return {
      title: "Something went wrong on our end",
      subtitle: "Please try again in a moment.",
      onRetry,
    };
  }
  if (state.matches({ unauthenticated: "unknown" })) {
    return {
      title: "Authentication failed",
      subtitle: "Please try again.",
      onRetry,
    };
  }
  return null;
};

const App = () => {
  const [state, send] = useMachine(providedAppBootMachine, {
    input: initialInput,
  });
  const screen = bootScreen(state, () => send({ type: "RETRY" }));

  return (
    <>
      <Toaster position="top-center" />
      {screen ? <FullPageMessage {...screen} /> : <ThemeSession />}
    </>
  );
};

export default App;
