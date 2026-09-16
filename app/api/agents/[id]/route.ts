import type { NextRequest } from 'next/server';

import { engineContextFor, fail, ok, readJsonBody } from '@/app/api/agents/_lib/handler';
import { AgentEngineError, setAgentStatus } from '@/lib/agents/engine';
import type { AgentStatus } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: AgentStatus[] = ['draft', 'active', 'paused', 'archived'];

/** PATCH /api/agents/:id { status } — needs `update` on agents.<module>. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<{ status?: string }>(request);
    const status = body.status as AgentStatus;
    if (!STATUSES.includes(status)) throw new AgentEngineError('status must be draft, active, paused or archived.', 400);
    return ok(await setAgentStatus(engineContextFor(request), id, status));
  } catch (error) {
    return fail(error);
  }
}
