import { getFeesSession } from '@/app/fees/_lib/fees-api';
import type { IntelligenceContext } from '@/lib/intelligence/client';
import type { WorkspaceSession } from '@/lib/intelligence/workspace';

/**
 * The signed-in session, in the shape each intelligence client wants.
 *
 * `getFeesSession()` is the one session reader every module already uses
 * (despite the name — see module-categories-api.ts) and both Knowledge Graph
 * entry points (the centralized AI console page and the per-module tab) read
 * it the same way, rather than inventing a third session mechanism for this
 * feature. `IntelligenceContext` and `WorkspaceSession` are structurally the
 * same five fields under different names, so one reading serves both.
 *
 * `baseUrl` prefers `NEXT_PUBLIC_GRAPH_API_BASE_URL` — a var `.env.local`
 * already stages for exactly this (comment there: "If you are running a
 * local Laravel backend on port 8000, use http://127.0.0.1:8000"), unused
 * by any code until now — over the RAW `session.hostName`. Deliberately not
 * `getApiBaseUrl(session)`: the AI backend can be a different host from the
 * rest of the ERP (see api_url.tsx's resolveAiBaseUrl() docblock, which
 * names this exact failure — a pre-resolved URL bypasses its
 * session-vs-AI-host preference and the panel reports "the intelligence API
 * returned a non-JSON response", the ERP host's own 404 HTML page for
 * `/api/ai/*`). Passing either value through as `sessionBaseUrl` lets
 * resolveAiBaseUrl() (called inside client.ts/workspace.ts) do the real
 * resolution, same as every other working `/api/ai/*` client in this app.
 */
export function readGraphSession(): IntelligenceContext & WorkspaceSession {
  const session = getFeesSession();

  return {
    token: session.token || null,
    baseUrl: process.env.NEXT_PUBLIC_GRAPH_API_BASE_URL || session.hostName || null,
    instituteId: session.subInstituteId || null,
    academicYear: session.academicYearId || null,
    termId: session.termId || null,
  };
}
