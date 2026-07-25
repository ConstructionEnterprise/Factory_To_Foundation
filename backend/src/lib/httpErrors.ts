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
