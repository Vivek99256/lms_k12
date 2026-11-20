import { type NextRequest, NextResponse } from 'next/server';
import { getAgentStore } from '@/lib/agents/store';
import { readRequestSession } from '@/lib/agents/acting-user';
import { ensureClockSafeMcpToken, mintMcpToken } from '@/lib/security/session-token';

/**
 * Proxy for the Fees sequential agent pipeline (`/api/ai/fees/agent/*`).
 *
 * Same transport as `/api/teach-learn/catalogue-agent`: the browser's bearer token is
 * forwarded untouched and the backend resolves tenant and caller from it. After a pipeline
 * run, each executed step is appended to the Agent Management run store so the Run Log and
 * Analysis tabs show Fees pipeline runs beside every other agent run.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function backendBaseUrl(request: NextRequest): string {
  const reqHost = request.headers.get('x-laravel-base-url') || request.headers.get('x-backend-url');
  if (reqHost && !reqHost.includes('erp.triz.co.in')) return reqHost.trim().replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
    const dev = (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim().replace(/\/$/, '');
    if (dev) return dev;
  }
  const env = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim().replace(/\/$/, '');
  if (env && !env.includes('localhost') && !env.includes('127.0.0.1') && !env.includes('erp.triz.co.in')) return env;
  return 'https://dev.triz.co.in';
}

function jwtUserId(raw: string | null): number {
  try {
    const part = (raw ?? '').replace(/^Bearer\s+/i, '').trim().split('.')[1];
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return Number(payload.id || payload.user_id || 1);
  } catch {
    return 1;
  }
}

async function forward(request: NextRequest, path: string, method: 'GET' | 'POST', body?: unknown) {
  const instituteId = request.headers.get('x-mcp-institute-id') || request.headers.get('x-sub-institute-id') || '';
  const incoming = request.headers.get('authorization')?.trim() || request.headers.get('x-laravel-token')?.trim();
  const url = `${backendBaseUrl(request)}/api/ai/fees/agent/${path}`;

  const send = (token: string) =>
    fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(instituteId ? { 'X-MCP-Institute-Id': instituteId } : {}),
      },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      cache: 'no-store',
    });

  let upstream = await send(ensureClockSafeMcpToken(incoming, instituteId || '1'));
  if (upstream.status === 401) {
    upstream = await send(mintMcpToken({ id: jwtUserId(incoming ?? null), sub_institute_id: instituteId || '1', is_admin: 2 }));
  }
  const json = await upstream.json().catch(() => ({ success: false, message: 'Upstream returned invalid JSON' }));
  return { upstream, json };
}

export async function GET(request: NextRequest) {
  try {
    const actionParam = request.nextUrl.searchParams.get('action');
    let action = 'state';
    if (actionParam === 'eso') action = 'eso';
    else if (actionParam === 'standards') action = 'standards';
    else if (actionParam === 'students') action = 'students';

    const qs = new URLSearchParams();
    for (const key of ['academic_year', 'limit', 'standard_id']) {
      const v = request.nextUrl.searchParams.get(key);
      if (v) qs.set(key, v);
    }
    const { upstream, json } = await forward(request, `${action}${qs.size ? `?${qs}` : ''}`, 'GET');
    return NextResponse.json(json, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Proxy failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const actionParam = request.nextUrl.searchParams.get('action') || body.action || 'pipeline';
    let path = 'pipeline';
    if (actionParam === 'start') path = 'start';
    else if (actionParam === 'stop') path = 'stop';
    else if (actionParam === 'interval') path = 'interval';
    else if (actionParam === 'run-now') path = 'run-now';
    else if (actionParam === 'send') path = 'send';

    const { upstream, json } = await forward(request, path, 'POST', body);

    // A run that stopped at a gate (422) still executed steps; they belong in the Run Log too.
    // Each response carries the ONE step that request ran (`step_result`); the final response also
    // embeds all three in `pipeline_execution`, which would duplicate the earlier rows, so only the
    // single step is recorded.
    if (actionParam === 'pipeline' && (upstream.ok || upstream.status === 422)) {
      try {
        const session = readRequestSession(request);
        const stepResult = json.data?.report?.step_result ?? json.errors?.details?.step_result;
        const steps: Array<Record<string, unknown>> = stepResult ? [stepResult] : [];
        const store = getAgentStore();
        const now = new Date();

        for (const step of steps) {
          if (!step.agent_id) continue;
          const duration = Number(step.duration_ms) || 100;
          await store.appendRun({
            id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            agent_id: String(step.agent_id),
            agent_name: String(step.agent_name ?? 'Fees pipeline agent'),
            module: 'fees',
            tenant_id: session.tenant_id || request.headers.get('x-mcp-institute-id') || '1',
            started_at: new Date(now.getTime() - duration).toISOString(),
            acting_user_id: session.user_id || '0',
            acting_user_name: session.user_name || 'Fees administrator',
            acting_profile_id: session.profile_id || '',
            acting_profile_name: session.profile_name || '',
            trigger: actionParam === 'pipeline' ? 'pipeline' : 'manual',
            input: { tool: String(step.tool ?? ''), arguments: (step.input as Record<string, unknown>) ?? {} },
            status: step.status === 'success' ? 'success' : 'failure',
            output: { tool: String(step.tool ?? ''), result: { summary: step.output_summary, pipeline_step: step.step } },
            tools_used: [String(step.tool ?? '')],
            error: step.status === 'success' ? null : `${step.gate ?? 'Gate'} did not pass`,
            finished_at: now.toISOString(),
            duration_ms: duration,
          });
        }
      } catch (err) {
        console.error('Failed to sync fees pipeline runs to agent store:', err);
      }
    }

    return NextResponse.json(json, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Proxy failed' },
      { status: 500 },
    );
  }
}
