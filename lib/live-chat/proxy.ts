import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { rejectOversizedBody, upstreamFailure } from '@/lib/security/request-guards';

/**
 * Live chat is served by the Laravel API, which verifies the caller's token and
 * decides who they are. These routes only relay the request with the caller's
 * Authorization header; they never read or write the chat tables themselves and
 * never trust an identity sent in the body.
 */
export async function relayLiveChat(request: Request, resource: string): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const incoming = new URL(request.url);
  const target = `${API_BASE_URL.replace(/\/$/, '')}/api/live-chat/${resource}${incoming.search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let body: string | undefined;
  if (hasBody) {
    const tooLarge = rejectOversizedBody(request);
    if (tooLarge) return tooLarge;
    body = await request.text();
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Upstream error pages are not returned to the browser.
      payload = { error: 'Unexpected response from the server' };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return upstreamFailure('live-chat', err);
  }
}
