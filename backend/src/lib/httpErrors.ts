/** Thrown by a service function when a request references a real project/site that doesn't exist — mapped to a real 404 by app.ts's error handler. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown when a request has no valid access token (missing, malformed, expired, or wrong credentials at login) — mapped to a real 401. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Thrown when a real, authenticated user's role genuinely lacks the required module+action grant — mapped to a real 403, never a silent pass-through. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown for a real business-rule violation on an otherwise well-shaped request — e.g. an illegal LogisticsDispatch status transition (Phase 7's chain-of-custody rules). Distinct from Zod's shape-validation 400s: the request body was valid JSON matching the schema, but the real state machine rejects the specific transition requested. Mapped to a real 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
