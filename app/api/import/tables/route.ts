import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

async function forwardJson(path: string, init: RequestInit = {}) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/api/${path}`;
  const cookie = init.headers instanceof Headers ? (init.headers as Headers).get('cookie') : undefined;
  const referer = init.headers instanceof Headers ? (init.headers as Headers).get('referer') : undefined;

  try {
    const upstream = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(referer ? { Referer: referer } : {}),
        ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers),
      },
      cache: 'no-store',
    });

    const payload = (await upstream.json().catch(() => ({}))) as unknown;
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Proxy request failed' }, { status: 502 });
  }
}

export async function GET() {
  return forwardJson('import/tables');
}
