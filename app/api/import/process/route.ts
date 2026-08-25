import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

async function forwardMultipart(path: string, request: NextRequest) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/api/${path}`;
  const formData = await request.formData();
  const upstreamFormData = new FormData();
  for (const [key, value] of formData.entries()) {
    upstreamFormData.append(key, value);
  }
  const cookie = request.headers.get('cookie');
  const referer = request.headers.get('referer');
  const authorization = request.headers.get('authorization');

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(referer ? { Referer: referer } : {}),
      },
      body: upstreamFormData,
      cache: 'no-store',
    });

    const payload = (await upstream.json().catch(() => ({}))) as unknown;
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Proxy request failed' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  return forwardMultipart('import/process', request);
}
