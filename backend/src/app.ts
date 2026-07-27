import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { healthRoutes } from "./routes/health";
import { constructionSiteRoutes } from "./routes/constructionSites";
import { projectFileRoutes } from "./routes/projectFiles";
import { logisticsDocumentRoutes } from "./routes/logisticsDocuments";
import { logisticsTruckRoutes } from "./routes/logisticsTrucks";
import { logisticsDriverRoutes } from "./routes/logisticsDrivers";
import { logisticsDispatchRoutes } from "./routes/logisticsDispatches";
import { authRoutes } from "./routes/auth";
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from "./lib/httpErrors";

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
    // Real auth cookies only ever flow with credentialed requests — a
    // wildcard origin can't be paired with this (the browser will refuse
    // it), which is exactly why ALLOWED_ORIGIN above is one real origin,
    // never "*".
    credentials: true,
  });

  await app.register(cookie);

  // Real fix for a real failure found live: POST /auth/refresh and
  // /auth/logout take no body at all (they only read cookies), but some
  // real HTTP clients (confirmed: PowerShell's Invoke-RestMethod) still
  // send a Content-Type header on a bodyless POST — Fastify's default
  // parser set only recognizes 'application/json' and rejects anything
  // else with a real 415, which surfaced as a bodyless refresh call
  // failing outright. This catch-all only fills the gap for content types
  // with no parser already registered — 'application/json' keeps using
  // Fastify's own default parser for every route that actually needs one.
  app.addContentTypeParser("*", (_request, _payload, done) => done(null, undefined));

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
    if (err instanceof AuthError) {
      reply.code(401).send({ error: err.message });
      return;
    }
    if (err instanceof ForbiddenError) {
      reply.code(403).send({ error: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      reply.code(400).send({ error: err.message });
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
  await app.register(authRoutes);
  await app.register(constructionSiteRoutes);
  await app.register(projectFileRoutes);
  await app.register(logisticsDocumentRoutes);
  await app.register(logisticsTruckRoutes);
  await app.register(logisticsDriverRoutes);
  await app.register(logisticsDispatchRoutes);

  return app;
}
