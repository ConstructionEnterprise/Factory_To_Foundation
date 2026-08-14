import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { REFRESH_TOKEN_TTL_MS } from "../lib/refreshToken";
import { ACCESS_TOKEN_COOKIE, authenticate, REFRESH_TOKEN_COOKIE } from "../middleware/auth";
import * as authService from "../services/authService";

const ACCESS_TOKEN_MAX_AGE_SEC = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SEC = REFRESH_TOKEN_TTL_MS / 1000;

// Real, env-driven per Phase 3 (public HTTPS access) — the app runs behind
// nginx TLS termination on the real deployed instance now, so cookies must
// actually set Secure there; local dev stays plain http, where Secure would
// silently prevent the browser from ever storing the cookie at all.
const COOKIES_SECURE = process.env.NODE_ENV === "production";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string },
  refreshCookiePath: string
) {
  reply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIES_SECURE,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SEC,
  });
  reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIES_SECURE,
    // Scoped to wherever /auth actually resolves for this registration —
    // this token never needs to leave the two routes that consume it,
    // unlike the access token. Fastify auto-prefixes route *paths* when a
    // plugin is registered with { prefix }, but never touches manually-set
    // cookie paths, so this has to be threaded through explicitly (§31
    // /api migration — authRoutes is now mounted at both "" and "/api"
    // during the compatibility window; a cookie set under one mount must
    // never be scoped to the other's path, or refresh silently breaks for
    // whichever mount didn't set it).
    path: refreshCookiePath,
    maxAge: REFRESH_TOKEN_MAX_AGE_SEC,
  });
}

function clearAuthCookies(reply: FastifyReply, refreshCookiePath: string) {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: refreshCookiePath });
}

export async function authRoutes(app: FastifyInstance, opts: { basePath?: string } = {}) {
  const refreshCookiePath = `${opts.basePath ?? ""}/auth`;

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const result = await authService.login(email, password);
    setAuthCookies(reply, result, refreshCookiePath);
    reply.send({ user: result.user });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const raw = request.cookies[REFRESH_TOKEN_COOKIE];
    if (!raw) {
      reply.code(401).send({ error: "No refresh token presented" });
      return;
    }
    const result = await authService.refresh(raw);
    setAuthCookies(reply, result, refreshCookiePath);
    reply.send({ user: result.user });
  });

  app.post("/auth/logout", async (request, reply) => {
    const raw = request.cookies[REFRESH_TOKEN_COOKIE];
    await authService.logout(raw);
    clearAuthCookies(reply, refreshCookiePath);
    reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const result = await authService.me(request.user!.id);
    reply.send(result);
  });
}
