import { NextResponse } from 'next/server';

/**
 * SERVER ONLY. A small fixed-window rate limiter for routes that cost money
 * (LLM calls) or can be abused (password reset, sign-in).
 *
 * Counts live in this process's memory, so each server instance limits
 * independently and counts reset on restart. That is enough to stop a single
 * client hammering a route; a shared store (Redis) or the edge/WAF limit is the
 * server-side follow-up for multi-instance deployments.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

/** The client's address as the nearest proxy reports it. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function hitRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Apply a limit to a request. Returns a 429 response to send back, or null to carry on.
 * `scope` names the route so different routes never share a budget.
 */
export function rateLimit(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number; key?: string },
): NextResponse | null {
  const key = `${scope}:${options.key ?? clientIp(request)}`;
  const result = hitRateLimit(key, options.limit, options.windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { status: '0', message: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
