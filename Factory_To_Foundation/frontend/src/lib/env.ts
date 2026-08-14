// Real env-driven service base URLs (Phase 3 portability rewrite) —
// replaces ~19 hardcoded `localhost:PORT` string literals that were
// scattered across the frontend, one per call site, with a single real
// source of truth. Vite exposes any `VITE_`-prefixed var from
// `frontend/.env` via `import.meta.env` automatically — no vite.config.ts
// change needed. Defaults match this repo's existing local-dev ports, so
// nothing breaks for anyone running without a frontend/.env file at all
// (Phase 5 will point these at the real deployed addresses instead).
// §31 API Namespace Rule (CLAUDE.md) -- every application API now lives
// under /api/*, mounted alongside (not replacing, during the compatibility
// window) the backend's original bare-path routes. This is the single
// place that needs to know that: every API client in this app builds its
// request URL as `${BACKEND_URL}${path}` (path itself still just "/assets",
// "/schedule-tasks", etc., unchanged), so appending /api here is enough to
// move the entire frontend without touching any individual client file.
export const BACKEND_URL = `${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4300"}/api`;
export const TWIN_BRIDGE_URL = import.meta.env.VITE_TWIN_BRIDGE_URL ?? "http://localhost:4100";
export const BLENDER_BRIDGE_URL = import.meta.env.VITE_BLENDER_BRIDGE_URL ?? "http://localhost:4200";
