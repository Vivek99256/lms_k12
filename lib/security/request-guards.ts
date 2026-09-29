import { NextResponse } from 'next/server';

/**
 * SERVER ONLY. Small checks shared by the routes that relay requests to Laravel.
 */

/**
 * A relay path must stay a plain path on the configured backend: no `..`
 * segments (which step out of a base path), no scheme or `//host`, no
 * backslashes, no encoded dots or slashes that decode into either.
 */
export function isSafeRelayPath(path: string): boolean {
  if (!path) return false;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (/[\\\u0000-\u001f]/.test(decoded)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) return false;
  return !decoded.split('/').some((segment) => segment === '..' || segment === '.');
}

/** Largest request body a relay or upload route accepts (MAX_UPLOAD_BYTES, default 50 MB). */
export function maxUploadBytes(): number {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 50 * 1024 * 1024;
}

/**
 * A 413 response when the declared body is larger than allowed, else null.
 * Checked before the body is read, so an oversized upload is never buffered.
 */
export function rejectOversizedBody(request: Request, limit: number = maxUploadBytes()): NextResponse | null {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    return NextResponse.json(
      { status: '0', message: `The upload is too large. The limit is ${Math.floor(limit / (1024 * 1024))} MB.` },
      { status: 413 },
    );
  }
  return null;
}

/**
 * A client-safe error body for a failed upstream call. The detail (which can name
 * internal hosts) goes to the server log with a reference the user can quote.
 */
export function upstreamFailure(scope: string, error: unknown, status = 502): NextResponse {
  const reference = Math.random().toString(36).slice(2, 10);
  console.error(`[${scope}] upstream request failed (ref ${reference})`, error);
  return NextResponse.json(
    { status: '0', message: `The server could not be reached. Please try again. (ref ${reference})` },
    { status },
  );
}
