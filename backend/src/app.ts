// Same reasoning as lib/prisma.ts/lib/s3.ts: this file now reads
// process.env.ALLOWED_ORIGIN directly at module-load time, before any
// transitively-imported route/service/repository file is guaranteed to
// have loaded dotenv first — load it explicitly here too rather than
// relying on import-order luck.
import "dotenv/config";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { healthRoutes } from "./routes/health";
import { systemRoutes } from "./routes/system";
import { constructionSiteRoutes } from "./routes/constructionSites";
import { constructionRelationshipsRoutes } from "./routes/constructionRelationships";
import { projectFileRoutes } from "./routes/projectFiles";
import { logisticsDocumentRoutes } from "./routes/logisticsDocuments";
import { logisticsTruckRoutes } from "./routes/logisticsTrucks";
import { logisticsDriverRoutes } from "./routes/logisticsDrivers";
import { logisticsDispatchRoutes } from "./routes/logisticsDispatches";
import { logisticsMaterialRoutes } from "./routes/logisticsMaterials";
import { logisticsModuleRoutes } from "./routes/logisticsModules";
import { mileageRateRoutes } from "./routes/mileageRates";
import { logisticsKpiRoutes } from "./routes/logisticsKpis";
// Logistics Flow — point-to-point movement relationships (see
// flowPoints.ts's own doc comment for the 2026-08-14 domain-correction
// note: originally placed under manufacturing, moved here on review since
// the underlying model was confirmed domain-neutral).
import { flowPointRoutes } from "./routes/flowPoints";
import { flowConnectionRoutes } from "./routes/flowConnections";
import { manufacturingModelRoutes } from "./routes/manufacturingModel";
import { instructionExecutionRoutes } from "./routes/instructionExecutions";
import { userPreferenceRoutes } from "./routes/userPreferences";
import { rbacDirectoryRoutes } from "./routes/rbacDirectory";
import { userManagementRoutes } from "./routes/users";
import { complianceDocumentRoutes } from "./routes/complianceDocuments";
import { scheduleTaskRoutes } from "./routes/scheduleTasks";
import { networkRoutes } from "./routes/network";
import { syntheticDataProvenanceRoutes } from "./routes/syntheticDataProvenance";
import { assetRoutes } from "./routes/assets";
import { genealogyRoutes } from "./routes/genealogy";
import { inventoryItemRoutes } from "./routes/inventoryItems";
import { vehicleRoutes } from "./routes/vehicles";
import { authRoutes } from "./routes/auth";
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from "./lib/httpErrors";

// Matches twin-bridge's/blender-bridge's own ALLOWED_ORIGIN convention —
// one real dev frontend origin, not a wildcard. Env-driven so Phase 4/5
// can point this at the real deployed frontend origin without a code
// change; defaults to local dev so nothing breaks before that lands.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

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

  // /health stays unprefixed permanently, not part of the §31 /api
  // migration below -- ff-backend-tg-443's own target group health check
  // hits this exact path directly (confirmed via AWS: HealthCheckPath
  // "/health"), not through CloudFront/the app-level namespace at all.
  // Moving it would require a coordinated target-group change, a separate,
  // deliberate infra decision outside this namespace migration's scope.
  await app.register(healthRoutes);

  // §31 API Namespace Rule migration, compatibility window: every
  // application route is mounted at BOTH its existing bare path (unchanged
  // behavior, still what CloudFront/nginx route to today) and the new
  // canonical /api/* path (not yet reachable from outside until CloudFront
  // §31.4 Phase 4 is done). Bare-path registrations are removed only in a
  // later, separately-authorized cleanup phase -- this dual-mount is what
  // "preserve existing production behavior until /api/* is proven" means
  // in code. authRoutes takes an explicit basePath since Fastify prefixes
  // route paths automatically but never touches manually-set cookie paths.
  const namespacedPlugins = [
    systemRoutes,
    constructionSiteRoutes,
    constructionRelationshipsRoutes,
    projectFileRoutes,
    logisticsDocumentRoutes,
    logisticsTruckRoutes,
    logisticsDriverRoutes,
    logisticsDispatchRoutes,
    logisticsMaterialRoutes,
    logisticsModuleRoutes,
    mileageRateRoutes,
    logisticsKpiRoutes,
    flowPointRoutes,
    flowConnectionRoutes,
    manufacturingModelRoutes,
    instructionExecutionRoutes,
    userPreferenceRoutes,
    rbacDirectoryRoutes,
    userManagementRoutes,
    complianceDocumentRoutes,
    scheduleTaskRoutes,
    networkRoutes,
    syntheticDataProvenanceRoutes,
    assetRoutes,
    genealogyRoutes,
    inventoryItemRoutes,
    vehicleRoutes,
  ];

  await app.register(authRoutes);
  await app.register(authRoutes, { prefix: "/api", basePath: "/api" });

  for (const plugin of namespacedPlugins) {
    await app.register(plugin);
    await app.register(plugin, { prefix: "/api" });
  }

  return app;
}
