import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * SERVER ONLY. Checks the Laravel session token a request carries.
 *
 * Laravel signs `user_token` as an HS256 JWT with its `JWT_SECRET`
 * (ApiLoginController → generationtux/jwt-artisan). When this server is given the
 * same secret as `LARAVEL_JWT_SECRET`, the signature is verified here and the
 * claims (user id, institute) can be trusted. Without it, a route can still insist
 * that a well-formed session token is present — enough to turn away anonymous
 * traffic — but cannot prove the token is genuine; `verified` says which.
 *
 * Set LARAVEL_JWT_SECRET in every deployed environment.
 */

export interface SessionClaims {
  id: string;
  sub_institute_id: string;
  is_admin: string;
  user_profile_id: string;
  exp?: number;
}

export interface SessionCheck {
  claims: SessionClaims;
  /** True only when the signature was checked against LARAVEL_JWT_SECRET. */
  verified: boolean;
}

function base64UrlDecode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function readClaims(payloadPart: string): SessionClaims | null {
  try {
    const raw = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id ?? raw.sub;
    if (id === undefined || id === null || id === '') return null;
    return {
      id: String(id),
      sub_institute_id: raw.sub_institute_id === undefined || raw.sub_institute_id === null ? '' : String(raw.sub_institute_id),
      is_admin: raw.is_admin === undefined || raw.is_admin === null ? '' : String(raw.is_admin),
      user_profile_id: raw.user_profile_id === undefined || raw.user_profile_id === null ? '' : String(raw.user_profile_id),
      exp: typeof raw.exp === 'number' ? raw.exp : undefined,
    };
  } catch {
    return null;
  }
}

/** Pull the token from `Authorization: Bearer`, then `x-laravel-token`. */
export function readSessionToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]?.trim();
  return bearer || request.headers.get('x-laravel-token')?.trim() || '';
}

export function checkSessionToken(token: string, now: number = Date.now()): SessionCheck | null {
  const parts = (token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  } catch {
    return null;
  }

  const claims = readClaims(parts[1]);
  if (!claims) return null;
  if (claims.exp !== undefined && claims.exp * 1000 <= now) return null;

  const secret = (process.env.LARAVEL_JWT_SECRET || '').trim();
  if (!secret) return { claims, verified: false };

  if (header.alg !== 'HS256') return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = base64UrlDecode(parts[2]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return { claims, verified: true };
}

/**
 * The session behind a request, or null when there is none worth trusting.
 * In production with LARAVEL_JWT_SECRET unset this still returns unverified
 * sessions, so a missing setting degrades protection rather than breaking the app.
 */
export function requireSession(request: Request): SessionCheck | null {
  return checkSessionToken(readSessionToken(request));
}
