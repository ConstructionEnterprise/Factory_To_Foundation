import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { healthRoutes } from "./routes/health";
import { constructionSiteRoutes } from "./routes/constructionSites";
import { NotFoundError } from "./lib/httpErrors";

// Matches twin-bridge's/blender-bridge's own ALLOWED_ORIGIN convention —
// one real dev frontend origin, not a wildcard.
const ALLOWED_ORIGIN = "http://localhost:5173";

function isPrismaKnownRequestError(err: unknown): err is { code: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    /^P\d{4}$/.test((err as { code: string }).code)
  );
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Pretty-printed for a human watching this terminal during `npm run
      // dev` — real structured (JSON) logs still ship whenever NODE_ENV is
      // production, since nothing else in this dev-only stack runs one.
      transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
    },
  });

  await app.register(cors, {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `No route: ${request.method} ${request.url}` });
  });

  // Real structured error handling: every failure gets a real JSON body
  // explaining what actually went wrong, never a bare/generic 500.
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof ZodError) {
      reply.code(400).send({ error: "Invalid request body", issues: err.issues });
      return;
    }
    if (err instanceof NotFoundError) {
      reply.code(404).send({ error: err.message });
      return;
    }
    if (isPrismaKnownRequestError(err)) {
      const status = err.code === "P2002" ? 409 : 400;
      reply.code(status).send({ error: `Database constraint violation (${err.code})`, meta: err.meta });
      return;
    }
    request.log.error(err);
    reply.code(500).send({ error: "Internal server error", message: err instanceof Error ? err.message : String(err) });
  });

  await app.register(healthRoutes);
  await app.register(constructionSiteRoutes);

  return app;
}
