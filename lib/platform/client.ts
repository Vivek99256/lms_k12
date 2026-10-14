'use client';

import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

import type {
  AuditEntry,
  AuditSummary,
  IntegrationInput,
  IntegrationTestResult,
  PageMeta,
  PlatformIntegration,
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

// ── Shared helpers for the endpoints that carry paging metadata ─────────────

/**
 * Like `call`, but returns the whole envelope.
 *
 * `call` unwraps `data`, which is right for most endpoints and wrong for the
 * paginated ones: the page counts travel beside `data` as `meta`, and unwrapping
 * would throw them away.
 */
async function callEnvelope<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ data: T; meta?: PageMeta; extra: Record<string, unknown> }> {
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

  if (!response.ok || (payload && payload.status_code === 0)) {
    const message =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : `The request failed (${response.status}).`;
    throw new PlatformApiError(message, response.status);
  }

  return { data: (payload?.data ?? null) as T, meta: payload?.meta as PageMeta | undefined, extra: payload ?? {} };
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Fetch a binary body with the session token and hand it to the browser as a download. */
async function download(path: string, fallbackName: string): Promise<void> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new PlatformApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }

  const response = await fetch(`${session.baseUrl}/api/platform${path}`, {
    headers: createAuthHeaders(session),
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const message =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : `The download failed (${response.status}).`;
    throw new PlatformApiError(message, response.status);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const named = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = named ? decodeURIComponent(named) : fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditFilters {
  module?: string;
  component?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

export async function fetchAudit(filters: AuditFilters): Promise<{ rows: AuditEntry[]; meta: PageMeta }> {
  const result = await callEnvelope<AuditEntry[]>(`/audit${query({ ...filters })}`);
  return {
    rows: result.data ?? [],
    meta: result.meta ?? { page: 1, per_page: result.data?.length ?? 0, total: result.data?.length ?? 0, last_page: 1 },
  };
}

export function fetchAuditSummary(filters: Omit<AuditFilters, 'page' | 'per_page'>): Promise<AuditSummary> {
  return call<AuditSummary>(`/audit/summary${query({ ...filters })}`);
}

// ── Integrations ────────────────────────────────────────────────────────────

export function fetchIntegrations(): Promise<PlatformIntegration[]> {
  return call<PlatformIntegration[]>('/integrations');
}

export function createIntegration(input: IntegrationInput): Promise<PlatformIntegration> {
  return call<PlatformIntegration>('/integrations', { method: 'POST', body: input });
}

export function updateIntegration(id: number, input: Partial<IntegrationInput>): Promise<PlatformIntegration> {
  return call<PlatformIntegration>(`/integrations/${id}`, { method: 'PUT', body: input });
}

export function deleteIntegration(id: number): Promise<{ deleted: number }> {
  return call<{ deleted: number }>(`/integrations/${id}`, { method: 'DELETE' });
}

export function testIntegration(id: number): Promise<IntegrationTestResult> {
  return call<IntegrationTestResult>(`/integrations/${id}/test`, { method: 'POST', body: {} });
}


// ── Engines: approval runs, delivery log, run now, template PDF, files ───────

export interface WorkflowRunStep {
  id: number;
  order: number;
  name: string;
  approver_type: string;
  approver: string;
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped' | 'escalated';
  assignee_user_id: number | null;
  acted_by_name: string | null;
  acted_at: string | null;
  comment: string | null;
  due_at: string | null;
  escalated_at: string | null;
  allow_delegate: boolean;
  require_comment: boolean;
}

export interface WorkflowRun {
  id: number;
  flow_key: string;
  entity_type: string;
  entity_id: string;
  title: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  current_step: number;
  requested_by_name: string | null;
  is_sample: boolean;
  created_at: string;
  completed_at: string | null;
  steps: WorkflowRunStep[];
}

export async function fetchWorkflowRuns(filters: { status?: string; scope?: string } = {}): Promise<WorkflowRun[]> {
  return call<WorkflowRun[]>(`/workflow/runs${query({ ...filters })}`);
}

export async function actOnWorkflowRun(
  id: number,
  action: 'approve' | 'reject' | 'delegate',
  body: { comment?: string; delegate_to?: number } = {},
): Promise<WorkflowRun> {
  return call<WorkflowRun>(`/workflow/runs/${id}/${action}`, { method: 'POST', body });
}

export interface NotificationLogRow {
  id: number;
  event_key: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  is_sample: boolean | number;
}

export async function fetchNotificationLog(
  filters: { status?: string; channel?: string; page?: number; per_page?: number } = {},
): Promise<{ rows: NotificationLogRow[]; meta: PageMeta }> {
  const result = await callEnvelope<NotificationLogRow[]>(`/notifications/log${query({ ...filters })}`);
  return { rows: result.data ?? [], meta: result.meta as PageMeta };
}

export async function runScheduledTaskNow(taskKey: string): Promise<{ status: string; message: string }> {
  return call<{ status: string; message: string }>('/scheduler/run-now', { method: 'POST', body: { task_key: taskKey } });
}

/** Render a template to PDF with the merge values already resolved, and download it. */
export async function downloadTemplatePdf(id: number, values: Record<string, string>, fileName: string): Promise<void> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new PlatformApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }
  const response = await fetch(`${session.baseUrl}/api/platform/templates/${id}/pdf`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ values }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    throw new PlatformApiError(
      typeof payload?.message === 'string' ? payload.message : `The PDF could not be made (${response.status}).`,
      response.status,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface AttachedFile {
  id: number;
  entity_type: string;
  entity_id: string;
  name: string;
  mime: string | null;
  size: number;
  version: number;
  uploaded_by_name: string | null;
  created_at: string;
  is_sample: boolean;
}

export async function fetchFiles(entityType: string, entityId: string): Promise<AttachedFile[]> {
  return call<AttachedFile[]>(`/files${query({ entity_type: entityType, entity_id: entityId })}`);
}

export async function uploadFile(entityType: string, entityId: string, file: File): Promise<AttachedFile> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new PlatformApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }
  const form = new FormData();
  form.set('entity_type', entityType);
  form.set('entity_id', entityId);
  form.set('file', file);
  // No Content-Type: the browser must set the multipart boundary itself.
  const response = await fetch(`${session.baseUrl}/api/platform/files`, {
    method: 'POST',
    headers: createAuthHeaders(session),
    body: form,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || (payload && payload.status_code === 0)) {
    throw new PlatformApiError(
      typeof payload?.message === 'string' ? payload.message : `The upload failed (${response.status}).`,
      response.status,
    );
  }
  return payload?.data as AttachedFile;
}

export async function downloadFile(file: AttachedFile): Promise<void> {
  return download(`/files/${file.id}/download`, file.name);
}

export async function deleteFile(id: number): Promise<void> {
  await call<{ deleted: number }>(`/files/${id}`, { method: 'DELETE' });
}

// ── Reporting engine and dashboard engine ───────────────────────────────────

export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  module: string;
  columns: Record<string, string>;
  filters: string[];
}

export interface ReportSchedule {
  id: number;
  report_key: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: 'ok' | 'failed' | null;
  last_run_message: string | null;
  last_file_id: number | null;
  is_sample: boolean;
}

export async function fetchReports(): Promise<ReportDefinition[]> {
  return call<ReportDefinition[]>('/reports');
}

export async function exportReport(key: string, filters: { from?: string; to?: string } = {}): Promise<void> {
  return download(`/reports/${encodeURIComponent(key)}/export${query({ ...filters })}`, `${key}.csv`);
}

export async function fetchReportSchedules(): Promise<ReportSchedule[]> {
  return call<ReportSchedule[]>('/reports/schedules');
}

export async function createReportSchedule(input: {
  report_key: string;
  name: string;
  frequency: string;
  recipients: string[];
}): Promise<ReportSchedule> {
  return call<ReportSchedule>('/reports/schedules', { method: 'POST', body: input });
}

export async function setReportScheduleEnabled(id: number, enabled: boolean): Promise<void> {
  await call<{ enabled: boolean }>(`/reports/schedules/${id}`, { method: 'PUT', body: { enabled } });
}

export async function deleteReportSchedule(id: number): Promise<void> {
  await call<{ deleted: number }>(`/reports/schedules/${id}`, { method: 'DELETE' });
}

export async function runReportSchedule(id: number): Promise<{ status: string; message: string }> {
  return call<{ status: string; message: string }>(`/reports/schedules/${id}/run-now`, { method: 'POST', body: {} });
}

export interface DashboardWidget {
  key: string;
  title: string;
  module: string;
  kind: 'count' | 'list';
  description: string;
  hidden: boolean;
  data: {
    value?: number;
    href?: string;
    items?: Array<{ label: string; meta?: string; at?: string }>;
  } | null;
}

export async function fetchDashboard(): Promise<DashboardWidget[]> {
  return call<DashboardWidget[]>('/dashboard');
}

export async function saveDashboardLayout(layout: Array<{ key: string; hidden: boolean }>): Promise<void> {
  await call<{ saved: boolean }>('/dashboard/layout', { method: 'PUT', body: { layout } });
}
