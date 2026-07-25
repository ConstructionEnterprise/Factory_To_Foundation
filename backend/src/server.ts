/**
 * ============================================================================
 * NO AUTHENTICATION — TEMPORARY, Phase 3a only. Every route below is
 * completely open: no session, no JWT, no API key, nothing checks the real
 * RBAC tables (Module/Role/Permission/RolePermission/User) Phase 2 already
 * seeded. This is a deliberate, disclosed scope limit for this phase (the
 * first real API + first real persistence migration, proving the stack
 * works end to end before auth exists) — it is NOT a security decision and
 * must not be mistaken for one. Auth is separate, explicit future work:
 * "Phase 3b." Do not deploy this server anywhere reachable outside local
 * dev as-is.
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
