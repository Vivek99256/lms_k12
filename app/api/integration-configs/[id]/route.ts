import { NextRequest, NextResponse } from 'next/server';

import { callerOf, present, records, type Caller } from '../_store';

/** Index of the caller's own record, or -1 — another institute's id is simply "not found". */
function findIndex(caller: Caller, id: string) {
  return records().findIndex((r) => r.id === Number(id) && r.tenant_id === caller.tenantId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  const { id } = await params;
  const index = findIndex(caller, id);

  if (index === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 1,
    message: 'OK',
    data: present(records()[index]),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const index = findIndex(caller, id);

  if (index === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const store = records();
  store[index] = {
    ...store[index],
    provider_key: String(body.provider_key || store[index].provider_key),
    display_name: String(body.display_name || store[index].display_name),
    category: String(body.category ?? store[index].category),
    description: body.description !== undefined ? String(body.description) : store[index].description,
    status: body.status === 'active' ? 'active' : body.status === 'error' ? 'error' : 'inactive',
    config: body.config || store[index].config,
    last_updated_at: now,
    last_updated_by: caller.userId,
  };

  return NextResponse.json({
    status: 1,
    message: 'Configuration updated.',
    data: present(store[index]),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = callerOf(request);
  if (caller instanceof NextResponse) return caller;

  const { id } = await params;
  const index = findIndex(caller, id);

  if (index === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  records().splice(index, 1);

  return NextResponse.json({
    status: 1,
    message: 'Configuration removed.',
  });
}
