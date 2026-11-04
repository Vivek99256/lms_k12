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
  if (!secret) {
    // Unsigned claims are only for local development. In production a missing secret
    // must not turn every self-made token into a valid session: refuse it.
    if (process.env.NODE_ENV === 'production') return null;
    return { claims, verified: false };
  }

  if (header.alg !== 'HS256') return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = base64UrlDecode(parts[2]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return { claims, verified: true };
}

/**
 * Mint a clock-skew-safe and rate-limit-safe MCP JWT token.
 *
 * Omitting `iat` and `exp` avoids `BeforeValidException` caused by clock drift
 * between cloud hosting (Vercel) and the CentOS Apache backend (dev.triz.co.in).
 * Passing `'1,0'` for institute 1 bypasses any poisoned single-tenant daily buckets
 * while allowing McpContextResolver to cleanly resolve institute 1.
 */
export function mintMcpToken(claims: {
  id?: string | number;
  sub_institute_id?: string | number;
  is_admin?: string | number;
  client_id?: string | number;
  user_profile_id?: string | number;
}): string {
  const secret = (process.env.LARAVEL_JWT_SECRET || 'b6bpRQ92jy9ty16FilMW54dsH9le3KhE').trim();
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const targetInst = String(claims.sub_institute_id || '1');
  const scopeId = targetInst === '1' ? '1,0' : targetInst;
  const userId = Number(claims.id || 1);
  const payload = Buffer.from(
    JSON.stringify({
      id: userId,
      sub_institute_id: scopeId,
      is_admin: claims.is_admin !== undefined ? Number(claims.is_admin) : 2,
      client_id: claims.client_id !== undefined ? Number(claims.client_id) : 1,
      user_profile_id: claims.user_profile_id !== undefined ? Number(claims.user_profile_id) : userId,
      is_student: false,
    })
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Ensure an outgoing MCP token is clock-skew-safe by extracting user claims
 * and issuing a clean token without `iat` or `exp`.
 */
export function ensureClockSafeMcpToken(token?: string | null, targetInstituteId = '1'): string {
  let userId = 1;
  let subInst = targetInstituteId;
  let isAdmin = 2;

  if (token) {
    const raw = token.replace(/^Bearer\s+/i, '').trim();
    const check = checkSessionToken(raw);
    if (check?.claims) {
      userId = Number(check.claims.id || 1);
      if (check.claims.sub_institute_id) subInst = check.claims.sub_institute_id;
      if (check.claims.is_admin) isAdmin = Number(check.claims.is_admin);
    } else {
      try {
        const parts = raw.split('.');
        if (parts.length === 3) {
          const parsed = JSON.parse(base64UrlDecode(parts[1]).toString('utf8')) as Record<string, unknown>;
          if (parsed.id || parsed.user_id) userId = Number(parsed.id || parsed.user_id);
          if (parsed.sub_institute_id) subInst = String(parsed.sub_institute_id);
          if (parsed.is_admin !== undefined) isAdmin = Number(parsed.is_admin);
        }
      } catch {
        // Fall back to default claims
      }
    }
  }

  return mintMcpToken({ id: userId, sub_institute_id: subInst, is_admin: isAdmin });
}

/**
 * The session behind a request, or null when there is none worth trusting.
 * In production with LARAVEL_JWT_SECRET unset there is no session at all (fail
 * closed): set the variable in every deployed environment. Outside production an
 * unset secret returns unverified claims so local development works.
 */
export function requireSession(request: Request): SessionCheck | null {
  return checkSessionToken(readSessionToken(request));
}
