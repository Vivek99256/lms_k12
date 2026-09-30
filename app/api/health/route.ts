import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness check for uptime monitors and load balancers.
 *
 * Answers from this process only — it says the Next.js app is up and which build
 * is serving, and deliberately does not call Laravel (a backend outage should
 * alert as its own check, not make every frontend instance look dead). It returns
 * no configuration, hostnames or secrets.
 */
export function GET() {
  return NextResponse.json(
    { status: 'ok', build: process.env.NEXT_PUBLIC_APP_BUILD_ID || null, time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
