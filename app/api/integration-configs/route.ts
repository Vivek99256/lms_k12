import { NextRequest, NextResponse } from 'next/server';

type IntegrationConfig = {
  id: number;
  provider_key: string;
  display_name: string;
  category: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string | number | boolean | null>;
  last_tested_at: string | null;
  last_tested_by: string | null;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_at: string | null;
};

const records: IntegrationConfig[] = [];
let nextId = 1;

function authHeader(request: NextRequest): string | null {
  return request.headers.get('authorization');
}

export async function GET(request: NextRequest) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 1,
    message: 'OK',
    data: { configs: records },
  });
}

export async function POST(request: NextRequest) {
  const authorization = authHeader(request);
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const now = new Date().toISOString();

  const record: IntegrationConfig = {
    id: nextId++,
    provider_key: String(body.provider_key || ''),
    display_name: String(body.display_name || ''),
    category: String(body.category || ''),
    description: body.description ? String(body.description) : null,
    status: body.status === 'active' ? 'active' : 'inactive',
    config: body.config || {},
    last_tested_at: null,
    last_tested_by: null,
    last_updated_at: now,
    last_updated_by: null,
    created_at: now,
  };

  records.push(record);

  return NextResponse.json({
    status: 1,
    message: 'Configuration saved.',
    data: record,
  });
}
