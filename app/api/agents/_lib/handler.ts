import { NextResponse } from 'next/server';

import { actingUserOf, laravelAuthorizer, readRequestSession } from '@/lib/agents/acting-user';
import { AgentEngineDenied, AgentEngineError, type EngineContext } from '@/lib/agents/engine';
import { getAgentStore } from '@/lib/agents/store';
import { checkSessionToken } from '@/lib/security/session-token';

/**
 * Shared plumbing for the /api/agents routes.
 *
 * Each route builds its engine context from the request's session headers and
 * lets the engine do the checking. The only decisions made here are how an
 * engine error becomes an HTTP status, and that a refused run still returns
 * the `denied` row it wrote — so the caller can show the audit reference.
 */

export function engineContextFor(request: Request): EngineContext {
  const session = readRequestSession(request);
  const actor = actingUserOf(session);

  // When the token's signature can be verified (LARAVEL_JWT_SECRET is set), its
  // claims decide who is calling: the institute header must match the token's own
  // institute, and the run log records the token's user, not a header's.
  const verified = checkSessionToken(session.token);
  if (verified?.verified) {
    const { sub_institute_id: tokenTenant, id: tokenUser } = verified.claims;
    if (tokenTenant && actor.tenant_id && tokenTenant !== actor.tenant_id) {
      throw new AgentEngineError('Your sign-in belongs to a different institute. Sign in again.', 403);
    }
    if (tokenUser) actor.user_id = tokenUser;
  }

  return {
    store: getAgentStore(),
    actor,
    authorize: laravelAuthorizer(session),
    // The credential a `read` tool needs to fetch live records as this person. It
    // reaches one backend call and is never stored: `actingUserOf` above is what the
    // run log gets, and it deliberately has no token in it.
    toolSession: {
      baseUrl: session.baseUrl,
      token: session.token,
      instituteId: session.tenant_id,
      academicYear: header(request, 'x-academic-year'),
      termId: header(request, 'x-term-id'),
    },
  };
}

function header(request: Request, name: string): string {
  return request.headers.get(name)?.trim() || '';
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ status: 1, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof AgentEngineDenied) {
    return NextResponse.json({ status: 0, message: error.message, run: error.run }, { status: 403 });
  }
  if (error instanceof AgentEngineError) {
    return NextResponse.json({ status: 0, message: error.message }, { status: error.status });
  }
  console.error('[agents]', error);
  return NextResponse.json(
    // Unexpected errors are logged above; their text can name files or hosts, so it stays server-side.
    { status: 0, message: 'The agent engine could not complete the request.' },
    { status: 500 },
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AgentEngineError('The request body must be JSON.', 400);
  }
}
