// Prisma 7 moved connection config out of schema.prisma (the `url` field on
// the datasource block was removed — see schema.prisma's own comment there
// for the real P1012 error this caused). This file is the real replacement.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
