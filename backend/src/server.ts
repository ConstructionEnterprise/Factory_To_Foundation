/**
 * ============================================================================
 * REAL AUTH, Phase 3b — but opt-in per route, not a global gate. There is
 * no top-level "everything requires login" hook: each route explicitly
 * lists `authenticate` (verifies the JWT access-token cookie, real 401 if
 * missing/invalid) and, where relevant, `requirePermission(module, action)`
 * (real role_permission check, real 403 if the caller's role lacks it) in
 * its own `preHandler` array — see routes/constructionSites.ts for the
 * first real consumer. A route with no preHandler array is genuinely open.
 *
 * Deliberately open by design, not oversight: GET /health (a health check
 * gated on auth defeats its own purpose) and POST /auth/login (you can't
 * require a valid session to obtain one). GET /auth/me requires
 * `authenticate` only — no specific permission, just "is this a real,
 * logged-in user."
 *
 * Any future route added to this server starts open by default and stays
 * that way until its own preHandler array says otherwise — adding a new
 * feature's persistence here means explicitly wiring its own RBAC
 * requirement, the same way Construction's routes were this phase, not
 * something inherited automatically.
 * ============================================================================
 */
import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 4300);

const app = await buildApp();

app.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
