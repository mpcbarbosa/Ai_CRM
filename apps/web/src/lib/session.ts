// Helpers for the JWT-based session cookie (A3 in docs/revisao-geral.md).
// Used by:
//   - apps/web/src/middleware.ts   (verify)
//   - apps/web/src/app/api/auth/login/route.ts   (sign)
//   - apps/web/src/app/api/proxy/[[...path]]/route.ts   (verify + extract userName)
//
// Why jose instead of jsonwebtoken: jose works in Edge runtime (the Next.js
// middleware), which doesn't have access to Node's `crypto` module.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ALG = 'HS256';

function getSecretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userName: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error('SESSION_SECRET not configured — cannot sign session');
  }
  return await new SignJWT({ userName: payload.userName })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const key = getSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const userName = typeof payload.userName === 'string' ? payload.userName : '';
    if (!userName) return null;
    return { userName };
  } catch {
    // Invalid signature, expired, malformed — all treated as "not logged in".
    return null;
  }
}
