# node:22-slim (Debian/glibc), not alpine: argon2's prebuilt native binding
# only ships for glibc targets, not musl - alpine would need a full
# build toolchain (python3/make/g++) just to compile it from source.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generates the real Prisma client into node_modules/@prisma/client -
# needed before the server can import it. prisma.config.ts resolves
# DATABASE_URL even for a schema-only generate (no real connection made),
# so a placeholder here is fine - env_file's real value overrides this at
# container runtime, same as any other `docker run -e`/compose env var.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Runs the real TypeScript source directly via tsx (not `tsx watch` -
# no file-watching needed in a container that gets rebuilt/redeployed
# for changes, not hot-reloaded in place). tsx is a legitimate way to
# run TS in production, not exclusively a dev tool - avoided introducing
# a separate tsc-build step + fixing ESM import-extension resolution
# across the whole codebase (moduleResolution: "Bundler" in tsconfig.json
# doesn't map cleanly onto plain `node dist/*.js` without that work).
EXPOSE 4300
CMD ["npx", "tsx", "src/server.ts"]
