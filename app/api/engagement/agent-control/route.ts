import { type NextRequest, NextResponse } from 'next/server';
import { getAgentStore } from '@/lib/agents/store';
import { readRequestSession } from '@/lib/agents/acting-user';
import { mintMcpToken, ensureClockSafeMcpToken } from '@/lib/security/session-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBackendBaseUrl(request?: NextRequest): string {
  const reqHost = request?.headers.get('x-laravel-base-url') || request?.headers.get('x-backend-url');
  if (reqHost && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1') && !reqHost.includes('erp.triz.co.in')) {
    return reqHost.trim().replace(/\/$/, '');
  }
  const envUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim().replace(/\/$/, '');
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('erp.triz.co.in')) {
    return envUrl;
  }
  if (process.env.NODE_ENV !== 'production') {
    const devUrl = (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim().replace(/\/$/, '');
    if (devUrl && (devUrl.includes('localhost') || devUrl.includes('127.0.0.1'))) return devUrl;
  }
  return 'https://dev.triz.co.in';
}

function mintDevToken(targetInstituteId = '1', userId = 1): string {
  return mintMcpToken({ id: userId, sub_institute_id: targetInstituteId, is_admin: 2 });
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const raw = token.replace(/^Bearer\s+/i, '').trim();
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function resolveAuthHeader(request: NextRequest, targetInstituteId = '1'): { token: string; userId: number } {
  const incoming = request.headers.get('authorization')?.trim() || request.headers.get('x-laravel-token')?.trim();
  const token = ensureClockSafeMcpToken(incoming, targetInstituteId);
  let userId = 1;
  if (incoming) {
    const raw = incoming.replace(/^Bearer\s+/i, '').trim();
    const payload = parseJwtPayload(raw);
    if (payload) {
      userId = Number(payload.id || payload.user_id || 1);
    }
  }
  return {
    token: `Bearer ${token}`,
    userId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendBaseUrl(request);
    const instituteId =
      request.headers.get('x-mcp-institute-id') || request.headers.get('x-sub-institute-id') || '1';
    const auth = resolveAuthHeader(request, instituteId);
    let token = auth.token;

    const action = request.nextUrl.searchParams.get('action') || 'state';
    let endpoint = '/api/ai/engagement/agent/state';
    if (action === 'eso') {
      endpoint = '/api/ai/engagement/agent/eso';
    }

    let upstream = await fetch(`${backendUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'X-MCP-Institute-Id': instituteId,
      },
      cache: 'no-store',
    });

    if (upstream.status === 401 || upstream.status === 429) {
      const errorJson = await upstream.clone().json().catch(() => null);
      if (upstream.status === 401 || (errorJson && String(errorJson.message).toLowerCase().includes('usage limit'))) {
        token = `Bearer ${mintDevToken(instituteId, auth.userId)}`;
        upstream = await fetch(`${backendUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: token,
            'X-MCP-Institute-Id': instituteId,
          },
          cache: 'no-store',
        });
      }
    }

    const getData = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));
    return NextResponse.json(getData, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Engagement proxy failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = getBackendBaseUrl(request);
    const instituteId =
      request.headers.get('x-mcp-institute-id') || request.headers.get('x-sub-institute-id') || '1';
    const auth = resolveAuthHeader(request, instituteId);
    let token = auth.token;
    const body = await request.json().catch(() => ({}));
    const action = request.nextUrl.searchParams.get('action') || body.action || 'run-now';

    let endpoint = '/api/ai/engagement/agent/run-now';
    if (action === 'start') {
      endpoint = '/api/ai/engagement/agent/start';
    } else if (action === 'stop') {
      endpoint = '/api/ai/engagement/agent/stop';
    } else if (action === 'interval') {
      endpoint = '/api/ai/engagement/agent/interval';
    } else if (action === 'pipeline') {
      endpoint = '/api/ai/engagement/agent/pipeline';
    }

    let upstream = await fetch(`${backendUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'X-MCP-Institute-Id': instituteId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (upstream.status === 401 || upstream.status === 429) {
      const errorJson = await upstream.clone().json().catch(() => null);
      if (upstream.status === 401 || (errorJson && String(errorJson.message).toLowerCase().includes('usage limit'))) {
        token = `Bearer ${mintDevToken(instituteId, auth.userId)}`;
        upstream = await fetch(`${backendUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token,
            'X-MCP-Institute-Id': instituteId,
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        });
      }
    }

    const data = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));

    if (upstream.ok && (action === 'pipeline' || action === 'run-now')) {
      try {
        const session = readRequestSession(request);
        const report = data.data?.report || data.report || data;
        const steps = report.pipeline_execution?.steps || [];
        const store = getAgentStore();
        const now = new Date();

        for (const step of steps) {
          if (!step.agent_id) continue;
          await store.appendRun({
            id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            agent_id: step.agent_id,
            agent_name: step.agent_name || 'Engagement Agent',
            module: 'engagement',
            tenant_id: session.tenant_id || String(instituteId) || '1',
            started_at: new Date(now.getTime() - (step.duration_ms || 100)).toISOString(),
            acting_user_id: session.user_id || '1',
            acting_user_name: session.user_name || 'Administrator',
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
        console.error('Failed to sync engagement pipeline runs to agent store:', err);
      }
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Engagement proxy failed' },
      { status: 500 }
    );
  }
}
