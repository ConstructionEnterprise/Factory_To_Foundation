import { SignJWT, jwtVerify } from "jose";

// jose over jsonwebtoken: native ESM (matches this project's "type":
// "module"), built on the standard Web Crypto API (works the same in Node
// and any future edge/worker runtime, not a Node-only Buffer-based
// implementation), actively maintained, and a modern promise-based API —
// jsonwebtoken is CommonJS-first, callback-oriented, and its last major
// version predates the Web Crypto convergence most current JWT libraries
// (jose included) have settled on.

const ACCESS_TOKEN_TTL = "15m";

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET is not set — see .env.example");
  return new TextEncoder().encode(raw);
}

export type AccessTokenPayload = {
  sub: string;
  roleId: string;
  roleName: string;
};

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ roleId: payload.roleId, roleName: payload.roleName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

/** Throws (jose's own SignatureVerificationFailed/JWTExpired/etc.) on anything invalid — callers decide how to map that to a real 401. */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: payload.sub as string,
    roleId: payload.roleId as string,
    roleName: payload.roleName as string,
  };
}
