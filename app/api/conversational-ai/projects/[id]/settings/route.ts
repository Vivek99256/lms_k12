import type { NextRequest } from 'next/server';

import { adminContextFor, fail, ok, readJsonBody } from '@/app/api/conversational-ai/_lib/handler';
import { updateSettings } from '@/lib/ai/conversational-admin/service';
import type { ChannelSettingsInput } from '@/lib/ai/conversational-admin/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PUT /api/conversational-ai/projects/:id/settings — needs `update` on conversational_ai. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await readJsonBody<ChannelSettingsInput>(request);
    return ok(await updateSettings(adminContextFor(request), id, input));
  } catch (error) {
    return fail(error);
  }
}
