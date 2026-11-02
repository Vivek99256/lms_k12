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
  return resolveAiBaseUrl(context.baseUrl);
}

function resolveEndpoint(context: IntelligenceContext, action?: string): string {
  const base = '/api/teach-learn/catalogue-agent';
  if (!action || action === 'state') return base;
  return `${base}?action=${encodeURIComponent(action)}`;
}

function buildHeaders(context: IntelligenceContext): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (context.token) {
    headers.Authorization = context.token.startsWith('Bearer ') ? context.token : `Bearer ${context.token}`;
  }
  headers['X-MCP-Institute-Id'] = String(context.instituteId || '1');
  return headers;
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

export interface PipelineStep {
  step: number;
  agent_name: string;
  agent_id: string;
  tool: string;
  status: 'success' | 'failed';
  duration_ms: number;
  input: Record<string, unknown>;
  output_summary: string;
}

export interface PipelineGate {
  gate: number;
  name: string;
  status: 'passed' | 'failed';
  [key: string]: unknown;
}

export interface UnifiedTeachLearnReport {
  success: boolean;
  pipeline_status: 'completed' | 'failed';
  sub_institute_id: number;
  generated_at: string;
  total_duration_ms: number;
  standard: {
    id: number;
    name: string;
    total_subjects: number;
    total_chapters: number;
  };
  curriculum: {
    subjects: Array<{ subject_id: number; subject_name: string; category: string; chapter_count: number }>;
    chapters_sample: Array<{ chapter_id: number; chapter_name: string; subject_id: number; subject_name: string }>;
    total_chapters: number;
  };
  activity_timeline: {
    total_activities: number;
    window: string;
    activities: Array<{
      id: number | null;
      kind: string;
      title: string;
      subject: string;
      date: string | null;
      status: string;
      when: string;
    }>;
  };
  content_readiness: {
    total_chapters_analyzed: number;
    fully_covered: number;
    partially_covered: number;
    missing_components_summary: Record<string, number>;
    four_type_model: Record<string, unknown>;
    chapter_details: Array<{
      id: number;
      name: string;
      standard: string;
      subject: string;
      concepts_count: number;
      status: string;
      coverage_pct: number;
      missing: string[];
      covered: string[];
    }>;
  };
  pipeline_execution: {
    steps: PipelineStep[];
    gates: PipelineGate[];
  };
}

export interface RunPipelineOptions {
  standard_name?: string;
  standard_id?: number;
  subject_id?: number;
  days_back?: number;
  days_ahead?: number;
  limit?: number;
  content_limit?: number;
}

/**
 * Execute the complete 3-agent synchronized Teach/Learn pipeline:
 *   1. Course Catalogue Agent -> Gate 1
 *   2. Activity Timeline Agent -> Gate 2
 *   3. Content Model Coverage Agent -> Gate 3 -> Unified Teach/Learn Report
 */
export async function runTeachLearnPipeline(
  context: IntelligenceContext,
  options: RunPipelineOptions = {}
): Promise<{ report: UnifiedTeachLearnReport; server_time: string }> {
  const url = resolveEndpoint(context, 'pipeline');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify(options),
    cache: 'no-store',
  });
  return handleResponse<{ report: UnifiedTeachLearnReport; server_time: string }>(res);
}

export interface AgentEsoStructuredObject {
  knowledge: {
    summary: string;
    items: string[];
    tables_and_sources?: string[];
  };
  activities: {
    summary: string;
    items: string[];
  };
  abilities: {
    summary: string;
    skills: string[];
    constraints_and_safeguards?: string[];
  };
  usage: {
    summary: string;
    step_by_step_flow: string[];
    upstream_dependencies?: string;
    downstream_handoff?: string;
  };
}

export interface AgentEsoDetail {
  order: number;
  name: string;
  agent_id: string;
  backend_key: string;
  module: string;
  status: string;
  trigger: string;
  tool_key: string;
  tool_alias: string;
  role_description: string;
  knowledge_requirements: Record<string, unknown>;
  database_resources: {
    primary_tables: string[];
    live_metrics: Record<string, number>;
  };
  input_schema: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  inputs_received_from_upstream?: Record<string, string>;
  outputs: Record<string, string>;
  validation_rules: {
    gate: number;
    name: string;
    enforcement: string;
    rules: string[];
  };
  eso?: AgentEsoStructuredObject;
}

export interface ExpertSystemOverviewData {
  overview: {
    system_name: string;
    module: string;
    sub_institute_id: number;
    architecture: string;
    generated_at: string;
    total_agents: number;
    status: string;
  };
  agents: {
    agent_1: AgentEsoDetail;
    agent_2: AgentEsoDetail;
    agent_3: AgentEsoDetail;
  };
  execution_workflow: {
    pattern: string;
    execution_order: string[];
    data_flow: Record<string, string>;
    isolation_and_safety: Record<string, boolean>;
  };
}

/**
 * Fetch the live Executive Skill Object (ESO) for all three Teach/Learn agents.
 */
export async function getExpertSystemOverview(
  context: IntelligenceContext
): Promise<{ eso: ExpertSystemOverviewData; server_time: string }> {
  const url = resolveEndpoint(context, 'eso');
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(context),
    cache: 'no-store',
  });
  return handleResponse<{ eso: ExpertSystemOverviewData; server_time: string }>(res);
}
