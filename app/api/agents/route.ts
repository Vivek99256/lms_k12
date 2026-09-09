import type { NextRequest } from 'next/server';

import { engineContextFor, fail, ok, readJsonBody } from '@/app/api/agents/_lib/handler';
import { createAgent, listAgents } from '@/lib/agents/engine';
import type { AgentStatus, CreateAgentInput } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/agents?module=&status= — the caller's tenant's agents. */
export async function GET(request: NextRequest) {
  try {
    const moduleKey = request.nextUrl.searchParams.get('module') || undefined;
    const status = (request.nextUrl.searchParams.get('status') || undefined) as AgentStatus | undefined;
    return ok(await listAgents(engineContextFor(request), { module: moduleKey, status }));
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/agents — create; needs `create` on agents.<module>. */
export async function POST(request: NextRequest) {
  try {
    const input = await readJsonBody<CreateAgentInput>(request);
    return ok(await createAgent(engineContextFor(request), input), 201);
  } catch (error) {
    return fail(error);
  }
}
