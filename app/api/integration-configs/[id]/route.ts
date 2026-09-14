import { NextRequest, NextResponse } from 'next/server';

type IntegrationConfig = {
  id: number;
  provider_key: string;
  display_name: string;
  category: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string | number | boolean | null>;
  last_tested_at: string | null;
  last_tested_by: string | null;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_at: string | null;
};

declare global {
  var integrationRecords: IntegrationConfig[];
  var integrationNextId: number;
}

if (typeof globalThis.integrationRecords === 'undefined') {
  globalThis.integrationRecords = [];
  globalThis.integrationNextId = 1;
}

function authHeader(request: NextRequest): string | null {
  return request.headers.get('authorization');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const record = globalThis.integrationRecords.find((r) => r.id === Number(id));

  if (!record) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: 1,
    message: 'OK',
    data: record,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const index = globalThis.integrationRecords.findIndex((r) => r.id === Number(id));

  if (index === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  globalThis.integrationRecords[index] = {
    ...globalThis.integrationRecords[index],
    provider_key: String(body.provider_key || globalThis.integrationRecords[index].provider_key),
    display_name: String(body.display_name || globalThis.integrationRecords[index].display_name),
    category: String(body.category ?? globalThis.integrationRecords[index].category),
    description: body.description !== undefined ? String(body.description) : globalThis.integrationRecords[index].description,
    status: body.status === 'active' ? 'active' : body.status === 'error' ? 'error' : 'inactive',
    config: body.config || globalThis.integrationRecords[index].config,
    last_updated_at: now,
    last_updated_by: null,
  };

  return NextResponse.json({
    status: 1,
    message: 'Configuration updated.',
    data: globalThis.integrationRecords[index],
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const index = globalThis.integrationRecords.findIndex((r) => r.id === Number(id));

  if (index === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  globalThis.integrationRecords.splice(index, 1);

  return NextResponse.json({
    status: 1,
    message: 'Configuration removed.',
  });
}
