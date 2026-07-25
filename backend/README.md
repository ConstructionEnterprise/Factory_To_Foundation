# ff-backend

Real relational persistence for Factory » Foundation — PostgreSQL via
Prisma, a real Fastify API server (Phase 3a), and (Phase 3b) real
email/password auth with JWT sessions. Phase 2 was schema + migrations +
seed data only; Phase 3a added the first real API routes and the first
real frontend persistence cutover (Construction sites); Phase 3b added
real accounts, login, and RBAC enforcement on Construction's routes.
**Auth is real but opt-in per route, not a global gate — see
`src/server.ts`'s own comment for exactly what's open vs. protected and
why.** See `schema.prisma`'s header comment for Phase 2's original scope
note.

## Creating a real user account

```
npm run create-user
```

Interactive CLI (`scripts/create-user.ts`) — prompts for email, display
name, a masked password (never echoed), and a role selected from the 10
real seeded roles. This is the **only** intended way to create real
accounts — never add credentials to `prisma/seed.ts`, which is checked
into git.

## Auth endpoints

- `POST /auth/login` — `{ email, password }` → sets `ff_access_token`
  (httpOnly, ~15min) and `ff_refresh_token` (httpOnly, scoped to `/auth`,
  30 days) cookies, returns the real user.
- `POST /auth/refresh` — rotates the refresh token (the presented one is
  always revoked, a new one always issued on success) and reissues a
  fresh access token. No body needed.
- `POST /auth/logout` — revokes the real refresh token server-side and
  clears both cookies. No body needed.
- `GET /auth/me` — requires a valid access token; returns the real user +
  role + resolved `role_permission` grants (module → granted actions).

## Running the API server

```
npm run dev
```

Starts the Fastify server on **http://localhost:4300** (tsx watch mode —
same dev-time-only convention as `twin-bridge`/`blender-bridge`, run
manually alongside `npm run dev` in `frontend/`). Requires Postgres
running and migrated/seeded (see Setup below) — the server itself doesn't
check this at startup, so a route will fail with a real Prisma connection
error if the database isn't up yet.

- `GET /health` → `{ "status": "ok" }` (no auth — a health check gated on login defeats its own purpose)
- `GET /construction-sites` → list all real `ConstructionSite` rows — requires `construction:read`
- `GET /construction-sites/:projectId` → one site, real 404 if unset — requires `construction:read`
- `PUT`/`PATCH /construction-sites/:projectId` → partial merge (body:
  `{ address?: string, coords?: { x: number, z: number } }`) — a
  coords-only patch never clobbers an existing address and vice versa — requires `construction:update`
- `DELETE /construction-sites/:projectId` → clear a site (idempotent) — requires `construction:delete`

All four require a valid `ff_access_token` cookie (`POST /auth/login` first); a missing/expired token gets a real 401, a role lacking the grant gets a real 403 naming the exact missing permission.

Sibling directory to `Factory_To_Foundation`, `twin-bridge`, and
`blender-bridge` — same "not nested inside the frontend" convention those
two already use. Unlike them, this one has real npm dependencies
(Prisma needs the `prisma`/`@prisma/client` packages, a driver adapter,
etc.) rather than being zero-dependency — that's a deliberate difference,
not a drift from convention; `twin-bridge`/`blender-bridge` are thin
bridges to external processes, this is the actual application backend.

## Stack

- PostgreSQL 16, via Docker Compose for local dev.
- Prisma ORM 7 (the current major as of this pass — note Prisma 7 moved
  connection config out of `schema.prisma` into `prisma.config.ts`, and
  requires an explicit driver adapter; see both files' own comments for
  the real error this caused when following older Prisma docs).
- `@prisma/adapter-pg` as the real PostgreSQL driver adapter.

## Setup

1. **Start Postgres:**
   ```
   docker compose up -d
   ```
   Named volume `ff_postgres_data`, local-dev-only credentials (see
   `docker-compose.yml` / `.env.example` — not real secrets).

2. **Install dependencies** (already done if you're reading this after
   the initial scaffold, but for a fresh clone):
   ```
   npm install
   ```

3. **Copy the env file:**
   ```
   copy .env.example .env
   ```
   (or `cp` on macOS/Linux) — already matches `docker-compose.yml`'s
   defaults, no edits needed for local dev.

4. **Apply the migration:**
   ```
   npx prisma migrate dev
   ```
   The initial migration (`prisma/migrations/<timestamp>_init/`) was
   generated offline via `prisma migrate diff --from-empty --to-schema
   prisma/schema.prisma --script` (no live database was reachable in the
   environment this was built in — see the Phase 2 report for why). This
   command applies it for real against your running Postgres and records
   it in Prisma's `_prisma_migrations` table.

5. **Seed real reference data:**
   ```
   npx prisma db seed
   ```
   Seeds the 11 real modules, 6 real permission actions, 10 real roles,
   and the full role_permission grant matrix. See `prisma/seed.ts`'s own
   header comment for the two confirmed revisions from the original
   Phase 1 draft (CEO, Robotics Engineer) and one flagged interpretation
   call (Robotics Engineer + Administer — see that file).

6. **Create a real user account** (see "Creating a real user account" above):
   ```
   npm run create-user
   ```

7. **Inspect it:**
   ```
   npx prisma studio
   ```

## Commands

| Command | Does |
|---|---|
| `npm run prisma:validate` | Validates `schema.prisma` — no DB needed. |
| `npm run prisma:generate` | Regenerates the Prisma Client — no DB needed. |
| `npm run prisma:migrate` | `prisma migrate dev` — needs a running Postgres. |
| `npm run prisma:seed` | Runs `prisma/seed.ts` — needs a migrated Postgres. |
| `npm run prisma:studio` | Opens Prisma Studio — needs a running Postgres. |

## What's explicitly NOT in this schema

Per the Phase 1 investigation report: `northTexasCounties.ts`,
`usaStates.ts`, `northTexasElevation.ts`, the DH kinematics constants, and
the frontend's `--ff-*` design tokens. These are static reference/generated
assets bundled with the frontend build, not operational records — moving
them into Postgres would mean a runtime query for data that's deliberately
designed for zero runtime fetch. See `schema.prisma`'s header comment.
