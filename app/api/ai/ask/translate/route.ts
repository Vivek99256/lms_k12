import { AI_API_BASE_URL } from '@/app/components/utils/api_url';

/**
 * A Hindi or Gujarati sentence in English, for the chat panel's own page navigation.
 *
 * "Open admissions" is recognised in the browser, against the live tab registry, in English. A
 * sentence in another language has to be turned into English first, and the model that does that
 * is on the Laravel AI backend. This route only forwards the request with the person's own
 * credentials; it translates nothing itself and keeps no copy of what was said.
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
    const upstream = await fetch(`${baseUrl}/api/ai/ask/translate`, {
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

    const text = await upstream.text();

    return new Response(text, {
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
