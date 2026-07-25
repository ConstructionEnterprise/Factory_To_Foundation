# Factory » Foundation — Construction Enterprise OS

A React + TypeScript + Vite frontend covering 11 real modules —
Manufacturing, Factory, Robotics, Logistics, Construction, Genealogy,
Scheduling, Assets, Analytics, Reports, Administration — built against
real data wherever a real source exists, with honestly-disclosed
illustrative/placeholder states where it doesn't. See `CLAUDE.md` in this
directory for the full, detailed build history and standing engineering
discipline — this file is just what's needed to run the whole stack
locally.

## Running the full stack

This app is one piece of a multi-process local stack. Each piece runs in
its own terminal, all at once, for everything to actually connect:

| Process | Directory | Command | Port |
|---|---|---|---|
| Postgres | `backend/` | `docker compose up -d` | 5432 |
| Backend API (auth + real persistence) | `backend/` | `npm run dev` | 4300 |
| Frontend (this app) | `Factory_To_Foundation/frontend/` | `npm run dev` | 5173 |
| twin-bridge (digital twin telemetry) | `twin-bridge/` | `node server.mjs` | 4100 |
| blender-bridge (model conversion) | `blender-bridge/` | `node server.mjs` | 4200 |

The frontend and backend are required for the app itself to load and for
auth/Construction-site persistence to work. twin-bridge and blender-bridge
are optional — without twin-bridge running, Factory's digital twin panel
honestly shows "Twin Offline" rather than fabricating data.

**First-time setup** (Postgres + backend): see `backend/README.md` for the
full sequence — start Postgres, install deps, copy `.env.example` to
`.env`, apply the migration, seed real reference data, then create a real
user account with `npm run create-user` (there is no default login —
accounts only exist once created this way).

**Starting the digital twin itself** (not just the bridge): once
twin-bridge is running, `POST http://localhost:4100/twin-control/start`
launches the actual headless simulation
(`twin-bridge/twin_headless_driver.py`) against the real
`Construction_Enterprises` project. `GET .../twin-control/status` reports
whether it's running and its current real frame count.

## Auth

Every real account is created via `backend/`'s `npm run create-user` —
never hardcoded, never seeded. Access tokens (httpOnly cookie) expire
after ~15 minutes by design; you'll be returned to the login screen
periodically and need to sign back in.

## Stack

- React 19, TypeScript, Vite, Tailwind, react-three-fiber/drei/three for
  every 3D viewport, react-router-dom.
- No React Compiler, no extra lint config beyond what's already in
  `eslint.config.js` — this isn't a from-scratch template anymore, see
  `CLAUDE.md` for what's actually been built and why.
