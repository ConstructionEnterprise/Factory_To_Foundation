// Same PrismaPg driver-adapter pattern as prisma/seed.ts. This file (not
// prisma.config.ts) is what the running server actually imports, and it's
// launched directly via tsx — not through the Prisma CLI — so it needs its
// own dotenv/config import, exactly the gap seed.ts had until Phase 2's
// live-verification pass found and fixed it.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// RDS enforces SSL by default (confirmed live: a plain connection gets
// "no pg_hba.conf entry ... no encryption"); local Docker Postgres has no
// SSL support at all. `pg` doesn't negotiate SSL unless told to, so this
// has to be conditional on which database DATABASE_URL actually points at.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ...(isLocalDb ? {} : { ssl: { rejectUnauthorized: false } }),
});

export const prisma = new PrismaClient({ adapter });
