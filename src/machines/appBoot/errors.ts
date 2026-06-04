// Typed error classes thrown by the appBootMachine's `authenticate` actor.
// Used by the actor (to classify ky failures) and by the machine guards
// (to fan onError into the right `unauthenticated.*` substate).

export class AuthError extends Error {
  readonly kind = "auth" as const;
}

export class NetworkError extends Error {
  readonly kind = "network" as const;
}

export class ServerError extends Error {
  readonly kind = "server" as const;
}
