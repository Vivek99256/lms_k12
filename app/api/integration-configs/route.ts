import { NextRequest, NextResponse } from 'next/server';

import { callerOf, nextId, present, records, type IntegrationConfig } from './_store';

export async function GET(request: NextRequest) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  return NextResponse.json({
    status: 1,
    message: 'OK',
    data: { configs: records().filter((r) => r.tenant_id === caller.tenantId).map(present) },
  });
}

export async function POST(request: NextRequest) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  const body = await request.json();
  const now = new Date().toISOString();

  const record: IntegrationConfig = {
    id: nextId(),
    tenant_id: caller.tenantId,
    provider_key: String(body.provider_key || ''),
    display_name: String(body.display_name || ''),
    category: String(body.category || ''),
    description: body.description ? String(body.description) : null,
    status: body.status === 'active' ? 'active' : 'inactive',
    config: body.config || {},
    last_tested_at: null,
    last_tested_by: null,
    last_updated_at: now,
    last_updated_by: caller.userId,
    created_at: now,
  };

  records().push(record);

  return NextResponse.json({
    status: 1,
    message: 'Configuration saved.',
    data: present(record),
  });
}
