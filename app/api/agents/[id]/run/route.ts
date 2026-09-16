import type { NextRequest } from 'next/server';

import { engineContextFor, fail, ok, readJsonBody } from '@/app/api/agents/_lib/handler';
import { runAgent } from '@/lib/agents/engine';
import type { RunAgentInput } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/:id/run { tool?, arguments? }
 *
 * Runs as the signed-in person named by the session headers; needs `update` on
 * agents.<module>. A refusal answers 403 *with* the `denied` run row the engine
 * wrote, so the attempt is on record either way.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await readJsonBody<RunAgentInput>(request);
    return ok(await runAgent(engineContextFor(request), id, input));
  } catch (error) {
    return fail(error);
  }
}
