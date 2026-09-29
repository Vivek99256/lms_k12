import { NextRequest, NextResponse } from 'next/server';

import { callerOf } from '../_store';

export async function POST(request: NextRequest) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  const body = await request.json();

  const providerKey = String(body.provider_key || body.config?.provider_key || 'unknown');

  // No live connection is attempted yet (the Laravel integration service does not
  // exist), so the message says what was actually checked rather than claiming a test.
  return NextResponse.json({
    status: 1,
    message: `Configuration for ${providerKey} is saved. A live connection test is not available yet.`,
    success: true,
  });
}
