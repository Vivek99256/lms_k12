import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBackendBaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim().replace(/\/$/, '');
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  return 'https://dev.triz.co.in';
}

function mintDevToken(): string {
  const secret = process.env.LARAVEL_JWT_SECRET || 'b6bpRQ92jy9ty16FilMW54dsH9le3KhE';
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: 1,
    sub_institute_id: '1',
    is_admin: 1,
    client_id: 1,
    user_profile_id: 1,
    is_student: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function resolveAuthHeader(request: NextRequest): string {
  const incoming = request.headers.get('authorization')?.trim();
  if (incoming && incoming.toLowerCase().startsWith('bearer ')) {
    return incoming;
  }
  return `Bearer ${mintDevToken()}`;
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendBaseUrl();
    const token = resolveAuthHeader(request);
    const instituteId = request.headers.get('x-mcp-institute-id') || request.headers.get('x-sub-institute-id') || '1';

    const action = request.nextUrl.searchParams.get('action');
    let endpoint = '/api/ai/teach-learn/catalogue-agent/state';
    if (action === 'content-tasks') {
      const limit = request.nextUrl.searchParams.get('limit') || '50';
      const status = request.nextUrl.searchParams.get('status');
      endpoint = `/api/ai/teach-learn/catalogue-agent/content-tasks?limit=${encodeURIComponent(limit)}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
    }

    const upstream = await fetch(`${backendUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'X-MCP-Institute-Id': instituteId,
      },
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Proxy failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = getBackendBaseUrl();
    const token = resolveAuthHeader(request);
    const instituteId = request.headers.get('x-mcp-institute-id') || request.headers.get('x-sub-institute-id') || '1';
    const body = await request.json().catch(() => ({}));
    const action = request.nextUrl.searchParams.get('action') || body.action || 'run-now';

    let endpoint = '/api/ai/teach-learn/catalogue-agent/run-now';
    if (action === 'start') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/start';
    } else if (action === 'stop') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/stop';
    } else if (action === 'interval') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/interval';
    } else if (action === 'auto-generate-toggle') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/auto-generate/toggle';
    } else if (action === 'auto-generate-batch') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/auto-generate/batch';
    }

    const upstream = await fetch(`${backendUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token,
        'X-MCP-Institute-Id': instituteId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Proxy failed' },
      { status: 500 }
    );
  }
}
