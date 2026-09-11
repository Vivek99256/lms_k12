import type { NextRequest } from 'next/server';

import { engineContextFor, fail, ok } from '@/app/api/agents/_lib/handler';
import { listRuns } from '@/lib/agents/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/agents/runs?module=&agent_id=&limit= — the caller's tenant's run log, newest first. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = Number(params.get('limit') || '');
    return ok(
      await listRuns(engineContextFor(request), {
        module: params.get('module') || undefined,
        agentId: params.get('agent_id') || undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
