'use client';

import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

import type {
  NotificationChange,
  NotificationPayload,
  PlatformRegistry,
  SchedulerPayload,
  ScheduledTaskChange,
  ScheduledTaskRow,
  WorkflowChain,
  WorkflowInput,
  WorkflowPayload,
} from './types';

/**
 * Browser client for the platform-services API.
 *
 * TALKS TO LARAVEL DIRECTLY, with no Next proxy in between, the way
 * app/hooks/usePermission.ts does. A proxy earns its place when the server has to
 * add something the browser must not hold — a service credential, a signature.
 * Here it would add nothing: the bearer token the browser already has is exactly
 * what the endpoint wants, and a hop that only forwards a header is a hop that
 * can go wrong on its own.
 *
 * IDENTITY AND TENANCY RIDE IN THE TOKEN, NEVER IN A BODY. The endpoints read
 * `sub_institute_id` off the decoded JWT and ignore anything a body says about
 * it, so there is no institute field to send and no way for this client to name
 * another school.
 *
 * ERRORS ARE SURFACED, NOT SWALLOWED. Every call throws `PlatformApiError` with
 * the server's own sentence and its status. That matters most for 403: the
 * message says *why* rights were refused, and a screen that turned it into an
 * empty list would be telling the operator there is nothing to configure when the
 * truth is that they may not configure it.
 */

export class PlatformApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PlatformApiError';
    this.status = status;
  }
}

function scopeQuery(scope?: { module?: string; component?: string }): string {
  const params = new URLSearchParams();
  if (scope?.module) params.set('module', scope.module);
  if (scope?.component) params.set('component', scope.component);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = buildSessionContext();

  if (!session.baseUrl) {
    throw new PlatformApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }

  const response = await fetch(`${session.baseUrl}/api/platform${path}`, {
    method: init.method ?? 'GET',
    headers: createAuthHeaders(session, init.body !== undefined ? 'application/json' : undefined),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  // Both halves matter: a 200 carrying `status_code: 0` is still a refusal, and
  // this API uses that shape for anything the caller can fix.
  if (!response.ok || (payload && payload.status_code === 0)) {
    const message =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : `The request failed (${response.status}).`;
    throw new PlatformApiError(message, response.status);
  }

  return (payload?.data ?? payload) as T;
}

/**
 * The module and component catalogue, plus anything wrong with it.
 *
 * `problems` sits outside `data` so a misconfigured registry still serves what is
 * valid — one typo in a config file should not black out a working screen.
 */
export async function fetchRegistry(): Promise<{ registry: PlatformRegistry; problems: string[] }> {
  const session = buildSessionContext();
  const response = await fetch(`${session.baseUrl}/api/platform/registry`, {
    headers: createAuthHeaders(session),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || (payload && payload.status_code === 0)) {
    const message =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : `The platform registry could not be loaded (${response.status}).`;
    throw new PlatformApiError(message, response.status);
  }

  return {
    registry: (payload?.data ?? {}) as PlatformRegistry,
    problems: Array.isArray(payload?.problems) ? (payload.problems as string[]) : [],
  };
}

// ── Communication ───────────────────────────────────────────────────────────

export function fetchNotifications(scope?: { module?: string; component?: string }): Promise<NotificationPayload> {
  return call<NotificationPayload>(`/notifications${scopeQuery(scope)}`);
}

/**
 * Save a batch of notification rows.
 *
 * The scope travels on the query string as well as in the body, because the
 * endpoint replies with the whole scope rather than only what changed — the
 * summary at the top of the screen depends on rows the operator did not touch,
 * and recomputing it from a partial reply shows a number that is quietly wrong.
 */
export function saveNotifications(
  changes: NotificationChange[],
  scope?: { module?: string; component?: string },
): Promise<NotificationPayload> {
  return call<NotificationPayload>(`/notifications${scopeQuery(scope)}`, {
    method: 'PUT',
    body: { changes },
  });
}

export function setChannelEnabled(channel: string, enabled: boolean): Promise<{ channels: NotificationPayload['channels'] }> {
  return call<{ channels: NotificationPayload['channels'] }>('/notifications/channels', {
    method: 'PUT',
    body: { channel, enabled },
  });
}

// ── Scheduler ───────────────────────────────────────────────────────────────

export function fetchScheduledTasks(scope?: { module?: string; component?: string }): Promise<SchedulerPayload> {
  return call<SchedulerPayload>(`/scheduler${scopeQuery(scope)}`);
}

export function saveScheduledTask(change: ScheduledTaskChange): Promise<{ task: ScheduledTaskRow }> {
  return call<{ task: ScheduledTaskRow }>('/scheduler', { method: 'PUT', body: change });
}

// ── Workflow ────────────────────────────────────────────────────────────────

export function fetchWorkflows(scope?: { module?: string; component?: string }): Promise<WorkflowPayload> {
  return call<WorkflowPayload>(`/workflow${scopeQuery(scope)}`);
}

export function createWorkflow(input: WorkflowInput): Promise<{ workflow: WorkflowChain }> {
  return call<{ workflow: WorkflowChain }>('/workflow', { method: 'POST', body: input });
}

export function updateWorkflow(id: number, input: WorkflowInput): Promise<{ workflow: WorkflowChain }> {
  return call<{ workflow: WorkflowChain }>(`/workflow/${id}`, { method: 'PUT', body: input });
}

export function deleteWorkflow(id: number): Promise<{ deleted: number }> {
  return call<{ deleted: number }>(`/workflow/${id}`, { method: 'DELETE' });
}
