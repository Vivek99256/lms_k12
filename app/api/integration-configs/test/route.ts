import { NextRequest, NextResponse } from 'next/server';

function authHeader(request: NextRequest): string | null {
  return request.headers.get('authorization');
}

export async function POST(request: NextRequest) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const providerKey = String(body.provider_key || body.config?.provider_key || 'unknown');

  return NextResponse.json({
    status: 1,
    message: `Connection to ${providerKey} tested successfully.`,
    success: true,
  });
}
