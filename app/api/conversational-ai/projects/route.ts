import type { NextRequest } from 'next/server';

import { adminContextFor, fail, ok } from '@/app/api/conversational-ai/_lib/handler';
import { listProjects } from '@/lib/ai/conversational-admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/conversational-ai/projects — every registered adapter with its settings and token summary. */
export async function GET(request: NextRequest) {
  try {
    return ok(await listProjects(adminContextFor(request)));
  } catch (error) {
    return fail(error);
  }
}
