import { AI_API_BASE_URL } from '@/app/components/utils/api_url';

/**
 * Fixed wording the page builds itself, translated to match the answer beside it.
 *
 * A thin forwarder to the Laravel AI backend with the person's own credentials. It translates
 * nothing itself and keeps nothing.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const baseUrl = (process.env.AI_UPSTREAM_BASE_URL || AI_API_BASE_URL || '').trim().replace(/\/$/, '');

  if (!baseUrl) {
    return Response.json({ error: 'The assistant API base URL is not configured.' }, { status: 500 });
  }

  const body = await request.text();
  const authorization = request.headers.get('authorization');
  const institute = request.headers.get('x-mcp-institute-id');

  try {
    const upstream = await fetch(`${baseUrl}/api/ai/ask/localize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(institute ? { 'X-MCP-Institute-Id': institute } : {}),
      },
      body,
      signal: request.signal,
      cache: 'no-store',
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    return Response.json({ error: 'The assistant is unreachable.' }, { status: 502 });
  }
}
