import { createHash, randomBytes } from "node:crypto";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** The real, raw refresh token — held only by the client (httpOnly cookie) and briefly in memory server-side at issue/verify time. Never stored anywhere. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hex digest — what actually gets stored in RefreshToken.tokenHash, same "never store the raw credential" principle as password hashing. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
