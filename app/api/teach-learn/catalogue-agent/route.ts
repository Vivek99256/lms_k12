import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { getAgentStore } from '@/lib/agents/store';
import { readRequestSession } from '@/lib/agents/acting-user';

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
    } else if (action === 'eso') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/eso';
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

    const getData = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));
    return NextResponse.json(getData, { status: upstream.status });
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
    } else if (action === 'pipeline') {
      endpoint = '/api/ai/teach-learn/catalogue-agent/pipeline';
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

    const postData = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));

    if (upstream.ok && (action === 'pipeline' || action === 'run-now')) {
      try {
        const session = readRequestSession(request);
        const report = postData.data?.report || postData.report || postData;
        const steps = report.pipeline_execution?.steps || [];
        const store = getAgentStore();
        const now = new Date();

        for (const step of steps) {
          if (!step.agent_id) continue;
          await store.appendRun({
            id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            agent_id: step.agent_id,
            agent_name: step.agent_name || 'Course catalogue reader',
            module: 'teach_learn',
            tenant_id: session.tenant_id || String(instituteId) || '1',
            started_at: new Date(now.getTime() - (step.duration_ms || 100)).toISOString(),
            acting_user_id: session.user_id || '7013',
            acting_user_name: session.user_name || 'Kalpesh1 Sheth1',
            acting_profile_id: session.profile_id || '1',
            acting_profile_name: session.profile_name || 'Admin',
            trigger: action === 'pipeline' ? 'pipeline' : 'manual',
            input: {
              tool: step.tool,
              arguments: step.input || {},
            },
            status: step.status === 'success' ? 'success' : 'failure',
            output: {
              tool: step.tool,
              result: {
                summary: step.output_summary,
                pipeline_step: step.step,
              },
            },
            tools_used: [step.tool],
            error: step.status === 'success' ? null : (step.error || 'Pipeline step failed'),
            finished_at: now.toISOString(),
            duration_ms: step.duration_ms || 100,
          });
        }
      } catch (err) {
        console.error('Failed to sync teach_learn pipeline runs to agent store:', err);
      }
    }

    return NextResponse.json(postData, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Proxy failed' },
      { status: 500 }
    );
  }
}
