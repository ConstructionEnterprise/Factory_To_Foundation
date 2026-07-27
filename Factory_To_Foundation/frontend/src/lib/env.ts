// Real env-driven service base URLs (Phase 3 portability rewrite) —
// replaces ~19 hardcoded `localhost:PORT` string literals that were
// scattered across the frontend, one per call site, with a single real
// source of truth. Vite exposes any `VITE_`-prefixed var from
// `frontend/.env` via `import.meta.env` automatically — no vite.config.ts
// change needed. Defaults match this repo's existing local-dev ports, so
// nothing breaks for anyone running without a frontend/.env file at all
// (Phase 5 will point these at the real deployed addresses instead).
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4300";
export const TWIN_BRIDGE_URL = import.meta.env.VITE_TWIN_BRIDGE_URL ?? "http://localhost:4100";
export const BLENDER_BRIDGE_URL = import.meta.env.VITE_BLENDER_BRIDGE_URL ?? "http://localhost:4200";
