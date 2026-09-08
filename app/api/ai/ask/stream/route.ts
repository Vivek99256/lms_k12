import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { askUiChunks } from '@/lib/intelligence/ask-stream';
import type { AskUIMessage } from '@/lib/intelligence/ui-messages';

/**
 * The conversational tab's transport, and nothing else.
 *
 * Laravel already runs the whole twelve-stage lifecycle and already streams what each
 * stage did over SSE. This route does not think about any of that. It forwards the
 * question upstream and translates one SSE dialect into another: Laravel's named
 * events (`stage`, `token`, `done`, `error`) into the AI SDK's UI message chunks, so
 * `useChat` can own the message protocol, the streaming state and the abort.
 *
 * Three rules keep it a proxy rather than a second brain:
 *
 *   1. **No model, no tools, no prompt.** Nothing here decides anything about the
 *      answer. If this file ever needs to know what a stage means, the reasoning has
 *      leaked out of the governed pipeline and into a place with no audit trail.
 *   2. **The upstream host comes from the server's own environment**, never from the
 *      request. A client that could name the upstream could point this route at any
 *      host it liked and have the browser's credentials forwarded there.
 *   3. **Scope travels on the caller's token.** This route adds no authority: it
 *      passes the bearer token through and Laravel derives the tenant from it, exactly
 *      as it does for a direct call.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * How long this function may hold a stream open.
 *
 * A cohort scan runs three detectors over a live database, so the platform default is
 * far too short — it cut the sweep off mid-flight, which reads as a broken agent
 * rather than a slow one. But the ceiling is set by two limits below this file, not by
 * how long the work would like to take:
 *
 *   1. **The host.** On Vercel this export *is* the supported mechanism (route segment
 *      config in the App Router); a `vercel.json` `functions` block is an alternative
 *      way to say the same thing, not an additional permission. What it cannot do is
 *      exceed the plan's cap — a Hobby project will not deploy a value above it. When
 *      self-hosting behind `next start`, the export is ignored entirely.
 *   2. **The upstream.** Laravel dies at its own 60s `max_execution_time` on a full
 *      cohort scan and writes an HTML error page into the middle of the SSE frames —
 *      measured, not assumed. Budgeting more time here buys nothing, because there is
 *      nothing left upstream to wait for.
 *
 * So 60 is the honest number: at or below the tightest plan cap, and matching the
 * point at which the backend stops producing. Raising it is only meaningful once
 * Laravel's limit is raised too — do both, or neither.
 */
export const maxDuration = 60;

function upstreamBaseUrl() {
  // A server-to-server URL may legitimately differ from the browser-facing one — a
  // container name, an internal load balancer — so it can be set separately. The
  // browser-facing base is the fallback because in every simple deployment they match.
  return (process.env.AI_UPSTREAM_BASE_URL || API_BASE_URL || '').trim().replace(/\/$/, '');
}

export async function POST(request: Request) {
  const baseUrl = upstreamBaseUrl();

  if (!baseUrl) {
    return Response.json(
      { error: 'The assistant API base URL is not configured.' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const authorization = request.headers.get('authorization');
  const institute = request.headers.get('x-mcp-institute-id');

  let upstream: Response;

  try {
    upstream = await fetch(`${baseUrl}/api/ai/ask/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(institute ? { 'X-MCP-Institute-Id': institute } : {}),
      },
      body,
      // The user's abort travels the whole way. Without this the browser stops
      // listening while Laravel keeps running a lifecycle turn that may write.
      signal: request.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (request.signal.aborted) {
      // The user cancelled. There is nobody left to answer.
      return new Response(null, { status: 499 });
    }

    console.error('The assistant stream could not be reached.', error);

    return Response.json({ error: 'The assistant is unreachable.' }, { status: 502 });
  }

  // Validation and scope failures happen before a byte is streamed and come back as
  // ordinary JSON. Passing them through with their status keeps `useChat`'s error
  // state honest instead of surfacing a 200 with an error buried in the stream.
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();

    return new Response(detail || JSON.stringify({ error: 'The question could not be answered.' }), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  }

  const stream = createUIMessageStream<AskUIMessage>({
    onError: (error) => {
      // Never the upstream's words: a provider or query detail must not reach a
      // browser. The lifecycle trace is the diagnostic surface.
      console.error('The assistant stream failed.', error);

      return 'The assistant could not finish that answer.';
    },
    // The whole translation, and the only thing this route does with the response.
    execute: async ({ writer }) => {
      for await (const chunk of askUiChunks(upstream.body!)) {
        writer.write(chunk);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
