import type { NextRequest } from 'next/server';

import { adminContextFor, fail, ok } from '@/app/api/conversational-ai/_lib/handler';
import { rotateServiceToken } from '@/lib/ai/conversational-admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/conversational-ai/projects/:id/token — rotate; needs `update` on
 * conversational_ai. The reply carries the plaintext exactly once.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return ok(await rotateServiceToken(adminContextFor(request), id), 201);
  } catch (error) {
    return fail(error);
  }
}
