import argon2 from "argon2";

import { AuthError } from "../lib/httpErrors";
import { signAccessToken } from "../lib/jwt";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "../lib/refreshToken";
import * as permissionRepo from "../repositories/permissionRepository";
import * as refreshTokenRepo from "../repositories/refreshTokenRepository";
import * as userRepo from "../repositories/userRepository";

// Real, precomputed argon2 hash of a fixed dummy password — verified
// against on every login attempt for an email that doesn't exist, so an
// unknown-email attempt takes the same real argon2.verify() time as a
// known-email/wrong-password one. Without this, response timing itself
// leaks which real emails have accounts (a real, well-known side channel,
// not a hypothetical one) — the login failure message is already
// deliberately generic for the same reason.
const DUMMY_HASH = "$argon2id$v=19$m=65536,p=4,t=3$uMxcArVLdIEAz0mcrlicgw$n9WVbqcqe4jw3oDlFAkOxR+A2r+i4S5mFZDE0xx2iuk";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type UserWithRole = { id: string; email: string; displayName: string; roleId: string; role: { name: string } };

function toAuthUser(user: UserWithRole): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, roleId: user.roleId, roleName: user.role.name };
}

async function issueTokens(user: UserWithRole): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({ sub: user.id, roleId: user.roleId, roleName: user.role.name });
  const refreshToken = generateRefreshToken();
  await refreshTokenRepo.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await userRepo.findByEmail(email);
  const validPassword = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!user || !validPassword) throw new AuthError("Invalid email or password");

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: toAuthUser(user) };
}

/** Real rotation: the presented refresh token is always revoked here, whether or not a new one is successfully issued — a used-once token, exactly like a real one-time credential. */
export async function refresh(rawRefreshToken: string): Promise<AuthResult> {
  const stored = await refreshTokenRepo.findByHash(hashRefreshToken(rawRefreshToken));
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthError("Invalid or expired refresh token");
  }

  await refreshTokenRepo.revoke(stored.id);

  const { accessToken, refreshToken } = await issueTokens(stored.user);
  return { accessToken, refreshToken, user: toAuthUser(stored.user) };
}

/** Idempotent: revoking an already-revoked or unknown token is a real no-op, not an error — a logout call should never itself fail. */
export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const stored = await refreshTokenRepo.findByHash(hashRefreshToken(rawRefreshToken));
  if (stored && !stored.revokedAt) await refreshTokenRepo.revoke(stored.id);
}

export async function me(userId: string): Promise<{ user: AuthUser; permissions: Record<string, string[]> }> {
  const user = await userRepo.findById(userId);
  if (!user) throw new AuthError("User no longer exists");
  const permissions = await permissionRepo.resolvePermissions(user.roleId);
  return { user: toAuthUser(user), permissions };
}
