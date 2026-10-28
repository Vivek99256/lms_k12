import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { IntelligenceContext } from '@/lib/intelligence/client';

export interface ContentStats {
  total_tasks: number;
  total_generated: number;
  total_verified_existing: number;
  remaining_pending: number;
  is_all_completed: boolean;
}

export interface ContentTaskRecord {
  id: number;
  sub_institute_id: number;
  standard_id: number;
  standard_name: string;
  subject_id: number;
  subject_name: string;
  chapter_id: number;
  chapter_name: string;
  topic_id: number;
  topic_name: string;
  status: 'verified_existing' | 'generated_new' | 'pending' | 'failed' | string;
  content_id: number | null;
  concept_id: number | null;
  action_taken: 'verified_existing' | 'generated_content' | 'skipped' | string;
  content_title: string;
  content_preview: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface CatalogueAgentState {
  sub_institute_id: number;
  agent_key: string;
  is_active: boolean;
  auto_generate_content?: boolean;
  content_agent_status?: string;
  content_tasks_completed?: number;
  content_tasks_generated?: number;
  content_tasks_verified?: number;
  interval_seconds: number;
  last_run_at: string | null;
  last_run_status: string | null;
  next_run_at: string | null;
  last_heartbeat_at: string | null;
  daemon_pid: number | null;
  latest_hash: string | null;
  summary_counts: Record<string, number>;
  content_stats?: ContentStats;
}

export interface HierarchyCounts {
  standards_checked: number;
  subjects_checked: number;
  chapters_checked: number;
  topics_checked: number;
  intelligence_configs_checked: number;
  complete_hierarchies_validated: number;
  missing_subjects_count: number;
  missing_chapters_count: number;
  missing_topics_count: number;
  missing_intelligence_count: number;
  broken_mappings_count: number;
  total_issues_detected: number;
}

export interface HierarchyIssues {
  missing_subjects?: Array<{
    standard_id: number;
    standard_name: string;
    issue: string;
  }>;
  missing_chapters?: Array<{
    standard_id: number;
    standard_name: string;
    subject_id: number;
    subject_name: string;
    issue: string;
  }>;
  missing_topics?: Array<{
    standard_id: number;
    standard_name: string;
    subject_id: number;
    subject_name: string;
    chapter_id: number;
    chapter_title: string;
    issue: string;
  }>;
  missing_intelligence?: Array<{
    standard_id: number;
    standard_name: string;
    subject_id: number;
    subject_name: string;
    chapter_id: number;
    chapter_title: string;
    topic_id: number;
    topic_title: string;
    issue: string;
  }>;
  broken_mappings?: Array<{
    type?: string;
    topic_id?: number;
    topic_title?: string;
    chapter_id?: number;
    issue: string;
  }>;
}

export interface HierarchyValidationReport {
  id?: number;
  agent_key: string;
  agent_name: string;
  sub_institute_id: number;
  status: string;
  message?: string;
  data_hash: string;
  last_run_time: string;
  finished_at?: string;
  next_scheduled_run: string;
  duration_ms: number;
  counts: HierarchyCounts;
  summary?: Record<string, unknown>;
  issues?: HierarchyIssues;
  newly_discovered_issues?: unknown[];
  resolved_issues?: unknown[];
}

export interface CatalogueAgentStateResponse {
  state: CatalogueAgentState | null;
  latest_run: HierarchyValidationReport | null;
  server_time: string;
}

const DEV_TRIZ_BACKEND = 'https://dev.triz.co.in';

function resolveBaseUrl(context: IntelligenceContext): string {
  if (process.env.NEXT_PUBLIC_AI_BASE_URL) {
    return process.env.NEXT_PUBLIC_AI_BASE_URL.replace(/\/$/, '');
  }

  const candidate = (context.baseUrl || '').trim().replace(/\/$/, '');
  if (candidate && !candidate.includes('localhost') && !candidate.includes('127.0.0.1')) {
    return candidate;
  }

  const resolved = resolveAiBaseUrl(context.baseUrl);
  if (resolved && !resolved.includes('localhost') && !resolved.includes('127.0.0.1') && !resolved.includes('erp.triz.co.in')) {
    return resolved;
  }

  return DEV_TRIZ_BACKEND;
}

function resolveEndpoint(context: IntelligenceContext, action?: string): string {
  const baseUrl = resolveBaseUrl(context);
  const path = action === 'start' ? '/start'
    : action === 'stop' ? '/stop'
    : action === 'interval' ? '/interval'
    : action === 'run-now' ? '/run-now'
    : action === 'auto-generate-toggle' ? '/auto-generate/toggle'
    : action === 'auto-generate-batch' ? '/auto-generate/batch'
    : action === 'content-tasks' ? '/content-tasks'
    : '/state';
  return `${baseUrl}/api/ai/teach-learn/catalogue-agent${path}`;
}

function buildHeaders(context: IntelligenceContext): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(context.token ? { Authorization: `Bearer ${context.token}` } : {}),
    'X-MCP-Institute-Id': String(context.instituteId || '1'),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: { success?: boolean; message?: string; data?: T; errors?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from server (${res.status})`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return json.data as T;
}

/**
 * Fetch current continuous monitoring loop status and latest validation results.
 */
export async function getCatalogueAgentState(context: IntelligenceContext): Promise<CatalogueAgentStateResponse> {
  const url = resolveEndpoint(context);
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(context),
    cache: 'no-store',
  });
  return handleResponse<CatalogueAgentStateResponse>(res);
}

/**
 * Start the continuous background validation loop from the web interface.
 */
export async function startCatalogueAgentContinuous(
  context: IntelligenceContext,
  intervalSeconds = 60
): Promise<{ activation: unknown; state: CatalogueAgentState; server_time: string }> {
  const url = resolveEndpoint(context, 'start');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return handleResponse<{ activation: unknown; state: CatalogueAgentState; server_time: string }>(res);
}

/**
 * Stop or pause the continuous background validation loop from the web interface.
 */
export async function stopCatalogueAgentContinuous(
  context: IntelligenceContext
): Promise<{ deactivation: unknown; state: CatalogueAgentState; server_time: string }> {
  const url = resolveEndpoint(context, 'stop');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  return handleResponse<{ deactivation: unknown; state: CatalogueAgentState; server_time: string }>(res);
}

/**
 * Trigger an immediate on-demand full hierarchy validation sweep.
 */
export async function runCatalogueAgentValidationNow(
  context: IntelligenceContext
): Promise<{ report: HierarchyValidationReport; state: CatalogueAgentState; server_time: string }> {
  const url = resolveEndpoint(context, 'run-now');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  return handleResponse<{ report: HierarchyValidationReport; state: CatalogueAgentState; server_time: string }>(res);
}

/**
 * Update the validation interval without stopping the loop.
 */
export async function setCatalogueAgentInterval(
  context: IntelligenceContext,
  intervalSeconds: number
): Promise<{ state: CatalogueAgentState; server_time: string }> {
  const url = resolveEndpoint(context, 'interval');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return handleResponse<{ state: CatalogueAgentState; server_time: string }>(res);
}

/**
 * Toggle Content Agent automatic content generation for missing intelligence.
 */
export async function toggleAutoGenerateContent(
  context: IntelligenceContext,
  enabled: boolean
): Promise<{ state: CatalogueAgentState; server_time: string }> {
  const url = resolveEndpoint(context, 'auto-generate-toggle');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ enabled }),
    cache: 'no-store',
  });
  return handleResponse<{ state: CatalogueAgentState; server_time: string }>(res);
}

/**
 * Trigger Content Agent to process a batch of pending topics on demand.
 */
export async function runContentAgentBatch(
  context: IntelligenceContext,
  batchLimit = 10
): Promise<{ batch_result: unknown; report: HierarchyValidationReport; state: CatalogueAgentState; content_stats: ContentStats; server_time: string }> {
  const url = resolveEndpoint(context, 'auto-generate-batch');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ limit: batchLimit }),
    cache: 'no-store',
  });
  return handleResponse<{ batch_result: unknown; report: HierarchyValidationReport; state: CatalogueAgentState; content_stats: ContentStats; server_time: string }>(res);
}

/**
 * Fetch recent Content Agent tasks ledger records.
 */
export async function getContentTasksLedger(
  context: IntelligenceContext,
  limit = 50,
  status?: string
): Promise<{ tasks: ContentTaskRecord[]; stats: ContentStats; server_time: string }> {
  const baseUrl = resolveEndpoint(context, 'content-tasks');
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}limit=${encodeURIComponent(limit)}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(context),
    cache: 'no-store',
  });
  return handleResponse<{ tasks: ContentTaskRecord[]; stats: ContentStats; server_time: string }>(res);
}
