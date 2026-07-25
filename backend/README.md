# ff-backend

Real relational persistence for Factory » Foundation — PostgreSQL via
Prisma, plus (as of Phase 3a) a real Fastify API server. Phase 2 was
schema + migrations + seed data only; Phase 3a adds the first real API
routes and the first real frontend persistence cutover (Construction
sites). **No auth yet — every route is completely open, a deliberate,
disclosed scope limit for this phase, not a security decision. See
`src/server.ts`'s own banner comment.** See `schema.prisma`'s header
comment for Phase 2's original scope note.

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

- `GET /health` → `{ "status": "ok" }`
- `GET /construction-sites` → list all real `ConstructionSite` rows
- `GET /construction-sites/:projectId` → one site, real 404 if unset
- `PUT`/`PATCH /construction-sites/:projectId` → partial merge (body:
  `{ address?: string, coords?: { x: number, z: number } }`) — a
  coords-only patch never clobbers an existing address and vice versa
- `DELETE /construction-sites/:projectId` → clear a site (idempotent)

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

6. **Inspect it:**
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
