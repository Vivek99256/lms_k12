import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return NextResponse.json({ message: 'Missing path parameter' }, { status: 400 });
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/${targetPath.replace(/^\//, '')}`;

  let body: string | undefined;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await request.text();
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}
