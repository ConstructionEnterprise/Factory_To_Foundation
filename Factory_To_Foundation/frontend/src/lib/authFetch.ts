/**
 * Real fix for a real, confirmed gap: the access-token JWT (15-min TTL,
 * backend/src/routes/auth.ts) was never automatically refreshed anywhere in
 * the frontend. Once it lapsed, the SPA kept showing whatever "signed in"
 * state React already had (nothing re-checked it proactively) while any
 * FRESH request got a real 401 — confirmed live: Construction's per-project
 * document fetch (features/construction/ConstructionProjects.tsx, which
 * fetches all 4 projects immediately on mount) surfaced this as a real
 * "Not authenticated" error the moment it first ran after the token had
 * quietly expired, even though the avatar still showed a signed-in user.
 *
 * `authFetch` wraps every real authenticated call to the ff-backend
 * (AuthContext's fetchMe, constructionSiteStore.ts, projectFilesApi.ts —
 * the three real consumers, confirmed by grepping the whole src tree for
 * "localhost:4300") with one retry-after-refresh policy: a 401 triggers
 * exactly one real `POST /auth/refresh` (the existing real rotation
 * endpoint, backend/src/routes/auth.ts, using the httpOnly refresh-token
 * cookie); on success the original request is retried once and the caller
 * never sees the transient 401 at all. On failure (the refresh token
 * itself expired or was revoked), broadcasts SESSION_EXPIRED_EVENT so
 * AuthContext can flip to a real signed-out state — decoupled the same way
 * AuthContext's own AUTH_CHANGED_EVENT already is, so this file never needs
 * to import React or AuthContext directly (and AuthContext, which itself
 * needs to call authFetch, never has to import this module in a cycle
 * either way — it just listens for the event).
 */
import { BACKEND_URL } from "./env";

const API_BASE = BACKEND_URL;

export const SESSION_EXPIRED_EVENT = "ff:session-expired";

// Concurrent 401s (e.g. Construction's 4 parallel per-project document
// fetches all expiring at once) must share ONE real refresh call, not fire
// one each — real refresh-token rotation (§10: "the presented token is
// always revoked, whether or not a new one issues") means a second
// concurrent call would present an already-superseded cookie and fail.
let refreshInFlight: Promise<boolean> | null = null;

// Real defense-in-depth, added after a real infinite-loop bug was caught
// live (see AuthContext.tsx's handleSessionExpired comment for the full
// cycle): even with that root cause fixed, nothing here should ever be
// ABLE to hammer /auth/refresh in a tight loop, regardless of what other
// code triggers repeated calls in the future. Once a refresh genuinely
// fails, every 401 for this many ms is treated as "still dead" without a
// new network round-trip — a real, cheap circuit breaker, not just a
// polish detail.
const REFRESH_FAILURE_COOLDOWN_MS = 3000;
let refreshFailedUntil = 0;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) refreshFailedUntil = 0;
        return res.ok;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Drop-in replacement for fetch() against the real backend — always sends
 * credentials, and transparently retries once after a real refresh on a
 * 401. Never attempts a refresh for the auth endpoints themselves (login/
 * refresh/logout) — retrying those would either loop or "refresh" a
 * session that was never real to begin with.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const isAuthEndpoint = input.includes("/auth/refresh") || input.includes("/auth/login") || input.includes("/auth/logout");
  const res = await fetch(input, { credentials: "include", ...init });
  if (res.status !== 401 || isAuthEndpoint) return res;

  if (Date.now() < refreshFailedUntil) return res;

  const refreshed = await refreshSession();
  if (!refreshed) {
    refreshFailedUntil = Date.now() + REFRESH_FAILURE_COOLDOWN_MS;
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return res;
  }
  return fetch(input, { credentials: "include", ...init });
}
