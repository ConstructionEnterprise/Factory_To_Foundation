/** Thrown by a service function when a request references a real project/site that doesn't exist — mapped to a real 404 by app.ts's error handler. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
