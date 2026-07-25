// Same PrismaPg driver-adapter pattern as prisma/seed.ts. This file (not
// prisma.config.ts) is what the running server actually imports, and it's
// launched directly via tsx — not through the Prisma CLI — so it needs its
// own dotenv/config import, exactly the gap seed.ts had until Phase 2's
// live-verification pass found and fixed it.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
