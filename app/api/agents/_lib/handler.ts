import { NextResponse } from 'next/server';

import { actingUserOf, laravelAuthorizer, readRequestSession } from '@/lib/agents/acting-user';
import { AgentEngineDenied, AgentEngineError, type EngineContext } from '@/lib/agents/engine';
import { getAgentStore } from '@/lib/agents/store';

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
  return {
    store: getAgentStore(),
    actor: actingUserOf(session),
    authorize: laravelAuthorizer(session),
  };
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
    { status: 0, message: error instanceof Error ? error.message : 'The agent engine could not complete the request.' },
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
