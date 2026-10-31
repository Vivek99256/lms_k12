import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 8 * 1024;

/**
 * Receives Content-Security-Policy violation reports from the report-only policy in next.config.ts.
 *
 * The policy never blocks anything yet; these reports show what a real `script-src` would have
 * stopped, so it can be tightened from evidence instead of guesswork. Anonymous by nature (the
 * browser posts it), so it is rate limited, size capped and only ever logs a trimmed, single-line
 * summary — it stores nothing and returns nothing.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, 'csp-report', { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const text = (await request.text()).slice(0, MAX_BODY);
  try {
    const parsed = JSON.parse(text) as Record<string, Record<string, unknown> | undefined>;
    const report = parsed['csp-report'] ?? (parsed as Record<string, unknown>);
    const pick = (key: string) => String(report?.[key] ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);
    console.warn(
      `[csp-report] directive=${pick('violated-directive') || pick('effectiveDirective')} blocked=${pick('blocked-uri') || pick('blockedURL')} page=${pick('document-uri') || pick('documentURL')}`,
    );
  } catch {
    // Not JSON: ignore. Reports are best-effort.
  }

  return new NextResponse(null, { status: 204 });
}
