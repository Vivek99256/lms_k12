import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { AI_API_BASE_URL } from '@/app/components/utils/api_url';
import { askUiChunks, askUiChunksFromResult } from '@/lib/intelligence/ask-stream';
import type { AskUIMessage } from '@/lib/intelligence/ui-messages';
import type { AskResult } from '@/lib/intelligence/types';

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
  // Three levels, narrowest first. A server-to-server URL may legitimately differ from
  // the browser-facing one — a container name, an internal load balancer — so it can be
  // set on its own. Failing that, the AI host, which is separately configurable because
  // the Laravel AI backend is not always deployed alongside the rest of the ERP. Only
  // then the general API host, which is correct for a single-host deployment.
  return (process.env.AI_UPSTREAM_BASE_URL || AI_API_BASE_URL || '').trim().replace(/\/$/, '');
}

/**
 * An upstream response this route will not forward as-is.
 *
 * A misconfigured base URL does not fail as a connection error — it succeeds against
 * the wrong host, which answers with its own 404 page. Forwarding that verbatim, with
 * its `text/html` content type, put a full HTML error document into the chat panel.
 * The status was right and the body was unusable, and nothing on screen said which
 * host had been asked.
 *
 * So a non-JSON error body is replaced with a JSON one that names the host and path
 * that answered. That sentence is a deployment fact, not a database or provider
 * detail, and it is the only thing that makes this class of failure diagnosable from
 * the browser.
 */
async function errorResponse(upstream: Response, url: string): Promise<Response> {
  const detail = (await upstream.text()).trim();
  const contentType = upstream.headers.get('content-type') ?? '';

  if (detail && contentType.includes('json')) {
    return new Response(detail, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.error(
    `The assistant API answered ${upstream.status} with ${contentType || 'no content type'} at ${url}.`
  );

  return Response.json(
    {
      error:
        upstream.status === 404
          ? `The assistant API has no /api/ai routes at ${new URL(url).origin}. Point the frontend at the host running the Laravel AI backend.`
          : `The assistant API answered ${upstream.status}.`,
    },
    { status: upstream.status }
  );
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

  const call = (path: string, accept: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: accept,
        ...(authorization ? { Authorization: authorization } : {}),
        ...(institute ? { 'X-MCP-Institute-Id': institute } : {}),
      },
      body,
      // The user's abort travels the whole way. Without this the browser stops
      // listening while Laravel keeps running a lifecycle turn that may write.
      signal: request.signal,
      cache: 'no-store',
    });

  const streamPath = '/api/ai/ask/stream';
  let upstream: Response;

  try {
    upstream = await call(streamPath, 'text/event-stream');

    // A backend that predates the streaming route answers 404 for it while still
    // serving `/ask` perfectly well — which is the state a deployment is in between
    // shipping the two. Both routes return the same payload, so falling back keeps the
    // panel working instead of failing on a route the answer never needed.
    if (upstream.status === 404 || upstream.status === 405) {
      const fallback = await call('/api/ai/ask', 'application/json');

      if (!fallback.ok) {
        // Neither route exists: this is a wrong host, not an old one. Report the
        // original path, since that is the one the panel is built to call.
        return errorResponse(fallback, `${baseUrl}${streamPath}`);
      }

      // Parsed defensively rather than with `.json()`: a proxy or a login redirect can
      // answer 200 with HTML, and letting that throw would surface as "unreachable",
      // which points the reader at the network instead of at the response.
      const raw = await fallback.text();
      let result: AskResult | null = null;

      try {
        result = ((JSON.parse(raw) as { data?: AskResult })?.data ?? null) as AskResult | null;
      } catch {
        result = null;
      }

      if (!result) {
        console.error(`The assistant API returned an unreadable answer at ${baseUrl}/api/ai/ask.`);

        return Response.json(
          { error: 'The assistant returned an answer this app could not read.' },
          { status: 502 }
        );
      }

      return createUIMessageStreamResponse({
        stream: createUIMessageStream<AskUIMessage>({
          onError: (error) => {
            console.error('The assistant reply could not be rendered.', error);

            return 'The assistant could not finish that answer.';
          },
          execute: async ({ writer }) => {
            for await (const chunk of askUiChunksFromResult(result)) {
              writer.write(chunk);
            }
          },
        }),
      });
    }
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
    return errorResponse(upstream, `${baseUrl}${streamPath}`);
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
