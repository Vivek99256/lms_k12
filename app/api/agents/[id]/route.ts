import type { NextRequest } from 'next/server';

import { engineContextFor, fail, ok, readJsonBody } from '@/app/api/agents/_lib/handler';
import { AgentEngineError, setAgentStatus, updateAgent } from '@/lib/agents/engine';
import type { AgentStatus, UpdateAgentInput } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: AgentStatus[] = ['draft', 'active', 'paused', 'archived'];

/** PATCH /api/agents/:id — updates status or full configuration. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<UpdateAgentInput & { status?: string }>(request);
    
    // If only status is passed
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0] === 'status') {
      const status = body.status as AgentStatus;
      if (!STATUSES.includes(status)) throw new AgentEngineError('status must be draft, active, paused or archived.', 400);
      return ok(await setAgentStatus(engineContextFor(request), id, status));
    }

    return ok(await updateAgent(engineContextFor(request), id, body));
  } catch (error) {
    return fail(error);
  }
}

/** PUT /api/agents/:id — update full agent configuration. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<UpdateAgentInput>(request);
    return ok(await updateAgent(engineContextFor(request), id, body));
  } catch (error) {
    return fail(error);
  }
}
