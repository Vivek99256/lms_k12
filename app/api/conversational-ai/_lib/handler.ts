import { NextResponse } from 'next/server';

import { actingUserOf, laravelAuthorizer, readRequestSession } from '@/lib/agents/acting-user';
import { ConversationalAdminError, type AdminContext } from '@/lib/ai/conversational-admin/service';
import { getConversationalAdminStore } from '@/lib/ai/conversational-admin/store';

/**
 * Shared plumbing for /api/conversational-ai/*, in the shape of app/api/agents/_lib.
 *
 * Every route needs a signed-in caller: these are administration screens, and an
 * anonymous request has no business reading which projects exist or what their
 * tokens end in. Writes are then checked against Laravel inside the service.
 */

export function adminContextFor(request: Request): AdminContext {
  const session = readRequestSession(request);
  if (!session.token) throw new ConversationalAdminError('Your session has no token. Sign in again.', 401);
  return {
    store: getConversationalAdminStore(),
    actor: actingUserOf(session),
    authorize: laravelAuthorizer(session),
  };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ status: 1, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ConversationalAdminError) {
    return NextResponse.json({ status: 0, message: error.message }, { status: error.status });
  }
  console.error('[conversational-ai]', error);
  return NextResponse.json(
    { status: 0, message: error instanceof Error ? error.message : 'The request could not be completed.' },
    { status: 500 },
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ConversationalAdminError('The request body must be JSON.', 400);
  }
}
