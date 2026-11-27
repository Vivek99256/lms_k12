import type { IntelligenceContext } from '@/lib/intelligence/client';

/**
 * Client for the Users / Attendance sequential agent pipelines
 * (`/api/ai-pipeline/{module}` -> `/api/ai/{module}/agent/*`).
 *
 * Shapes mirror the backend `ModuleAgentPipeline` step payload and the agent descriptors in
 * `agents()`. Nothing here supplies data: every count, row and check is the backend's.
 */

export type PipelineModule = 'users' | 'attendance';

export interface PipelineGateCheck {
  status: 'passed' | 'failed';
  message: string;
}

export interface PipelineGate {
  gate: string;
  name: string;
  status: 'passed' | 'failed';
  score: number;
  passed_checks: number;
  total_checks: number;
  checks: Record<string, PipelineGateCheck>;
}

export interface PipelineAction {
  type: 'sql' | 'graph' | 'tool' | 'check';
  tool: string;
  rows?: number | null;
  tables?: string[];
  pattern?: string;
  duration_ms: number;
  success: boolean;
  summary?: string;
}

export interface PipelineTable {
  key: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
  total: number;
  note?: string | null;
}

export interface PipelineStepResult {
  step: number;
  agent_name: string;
  agent_id: string;
  tool: string;
  status: 'success' | 'failed';
  gate: string;
  gate_score: number;
  duration_ms: number;
  input: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  records: { fetched: number; processed: number; produced: number };
  metrics: Array<{ label: string; value: string | number }>;
  tables: PipelineTable[];
  findings: string[];
  sources: string[];
  actions: PipelineAction[];
  /** What the previous agent handed this one (null for Agent 1). */
  received?: PipelineHandoff | null;
  /** What this agent handed to the next one (null for the last). */
  passed_to_next?: PipelineHandoff | null;
}

export interface PipelineHandoff {
  from: number;
  to: number;
  valid: boolean;
  message: string;
  checks: Record<string, PipelineGateCheck>;
}

export interface PipelineFinalOutput {
  headline: string;
  next_action: string | null;
  severity?: Record<string, number>;
  status?: string;
  approval_note?: string;
  persist_error?: string;
  drafts?: PipelineDraft[];
  queue?: PipelineQueueItem[];
}

/** What one `step` request returns (`data.report`). */
export interface PipelineStepResponse {
  success: boolean;
  run_id: string;
  step: number;
  pipeline_status: string;
  academic_year?: number;
  academic_year_source?: string;
  step_result: PipelineStepResult;
  gate: PipelineGate;
  handoff?: PipelineHandoff;
  next?: { agent: number; name: string; message: string };
  report_complete?: boolean;
  note?: string | null;
  final_output?: PipelineFinalOutput | null;
  quality_scorecard?: { composite_score: number; overall_status: 'passed' | 'flagged'; gates_evaluated: number; quality_tier: string };
  total_duration_ms?: number;
}

export interface PipelineFailureDetails {
  run_id?: string;
  step_result?: PipelineStepResult;
  handoff?: PipelineHandoff;
  [gate: string]: unknown;
}

export interface PipelineFailure {
  failed_at_gate?: number;
  error?: string;
  details?: PipelineFailureDetails;
}

export interface PipelineAgentSpec {
  order: number;
  name: string;
  agent_id: string;
  gate_name: string;
  purpose: string;
  tasks: string[];
  tables: string[];
  graph: string[];
  tools: string[];
  receives: string;
  produces: string;
  stored: string;
  passes_to: string;
  validation: string[];
  safeguards: string[];
}

export interface PipelineEso {
  module: PipelineModule;
  agents: PipelineAgentSpec[];
  execution_order: string[];
  safety: string;
}

export interface PipelineAutomation {
  active: boolean;
  interval_seconds: number;
  started_at: string | null;
  started_by: { id: number; name: string | null } | null;
  stopped_at: string | null;
  stopped_by: { id: number; name: string | null } | null;
  options?: { days?: number; threshold?: number; limit?: number };
  last_cycle_at: string | null;
  last_cycle_status: string | null;
  last_cycle_run_id: string | null;
  last_error: string | null;
  next_run_at: string | null;
  cycles: number;
  cycle_running: boolean;
  running_run_id: string | null;
  server_time: string;
}

export interface PipelineState {
  automation?: PipelineAutomation;
  sub_institute_id: number;
  academic_year: number | null;
  academic_year_source: string;
  live: Record<string, number | string | null>;
  knowledge_graph: { ok: boolean; ms: number; error: string | null };
  defaults: Record<string, number>;
  recent_runs: Array<{ id: number; run_reference: string; step: number; status: string; duration_ms: number | null; started_at: string | null }>;
}

export interface PipelineRunOptions {
  step: number;
  run_id?: string;
  academic_year?: number;
  days?: number;
  threshold?: number;
  limit?: number;
  persist?: boolean;
  /** A cycle of the continuous automation: takes the cycle lease and stops when Stop is pressed. */
  auto?: boolean;
}

/** Thrown when the pipeline stopped at a gate or handoff, so the UI can show which check failed. */
export class PipelineError extends Error {
  constructor(message: string, readonly failure: PipelineFailure | null, readonly status: number) {
    super(message);
  }
}

function headers(context: IntelligenceContext): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (context.token) {
    h.Authorization = context.token.startsWith('Bearer ') ? context.token : `Bearer ${context.token}`;
    h['x-laravel-token'] = context.token.replace(/^Bearer\s+/i, '');
  }
  if (context.baseUrl) {
    h['x-laravel-base-url'] = String(context.baseUrl);
    h['x-backend-url'] = String(context.baseUrl);
  }
  const inst = String(context.instituteId ?? '').trim();
  if (inst && inst !== '0') {
    h['X-MCP-Institute-Id'] = inst;
    h['x-sub-institute-id'] = inst;
  }
  return h;
}

async function read<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: { success?: boolean; message?: string; data?: T; errors?: PipelineFailure };
  try {
    json = JSON.parse(text);
  } catch {
    throw new PipelineError(`Non-JSON response from server (${res.status})`, null, res.status);
  }
  if (!res.ok || json.success === false) {
    throw new PipelineError(json.errors?.error || json.message || `Request failed with status ${res.status}`, json.errors ?? null, res.status);
  }
  return (json.data ?? json) as T;
}

export async function getPipelineState(module: PipelineModule, context: IntelligenceContext): Promise<PipelineState> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=state`, { method: 'GET', headers: headers(context), cache: 'no-store' });
  return (await read<{ state: PipelineState }>(res)).state;
}

export async function getPipelineEso(module: PipelineModule, context: IntelligenceContext): Promise<PipelineEso> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=eso`, { method: 'GET', headers: headers(context), cache: 'no-store' });
  return (await read<{ eso: PipelineEso }>(res)).eso;
}

export async function runPipelineStep(module: PipelineModule, context: IntelligenceContext, options: PipelineRunOptions): Promise<PipelineStepResponse> {
  const res = await fetch(`/api/ai-pipeline/${module}`, {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify(options),
    cache: 'no-store',
  });
  return (await read<{ report: PipelineStepResponse }>(res)).report;
}

// ---- Persisted final outputs and per-agent execution history (Admin Dashboard) ----------

export interface PipelineDraftStudent {
  student_id: number;
  name: string;
  class: string;
  rate_percent: string;
  present: number;
  absent: number;
  absent_streak: number;
  absent_last_7: number;
  severity: string;
  prior_term_percent: number | null;
  change_points: number | null;
}

export interface PipelineDraft {
  teacher_id: number;
  teacher: string;
  class: string;
  students: number;
  severity: string;
  message: string;
  student_rows: PipelineDraftStudent[];
  recommendation_id?: number;
  workflow_run_id?: number;
  workflow_status?: string;
  recommendation_status?: string | null;
  approval_id?: number | null;
  approval_status?: string | null;
  approval_expires_at?: string | null;
  approval_decided_by?: { id: number; name: string | null } | null;
  approval_decided_at?: string | null;
  approval_comment?: string | null;
  reused_pending_draft?: boolean;
  approval_error?: string;
}

export interface PipelineQueueItem {
  category: string;
  severity: string;
  count: number;
  examples: string;
  action: string;
  approver: string;
  found_by_agent: number;
  accounts: Array<{ id: number; name: string }>;
}

export interface PipelineOutput {
  audit_id: number;
  pipeline_run_id: string | null;
  generated_at: string;
  started_by: { id: number | null; name: string | null };
  status: string;
  academic_year: number | null;
  duration_ms: number | null;
  agent_run_ids: Record<string, number | null>;
  gates: Record<string, { name: string; status: string; score: number }>;
  final: {
    headline?: string;
    next_action?: string | null;
    status?: string;
    approval_note?: string;
    persist_error?: string;
    severity?: Record<string, number>;
    window?: { start: string; end: string; days: number };
    threshold_percent?: number;
    at_risk_students?: number;
    unassigned_classes?: Array<{ class: string; students: number; action: string }>;
    drafts?: PipelineDraft[];
    queue?: PipelineQueueItem[];
    active_accounts?: number;
  };
  steps: Array<{
    step: number;
    agent_id: string;
    agent_name: string;
    status: string;
    started_at: string;
    duration_ms: number | null;
    records: { fetched: number; processed: number; produced: number } | null;
    gate_score: number | null;
    tool: string | null;
    agent_run_id: number | null;
    tables_read: string[];
    checks: Record<string, PipelineGateCheck>;
  }>;
}

export interface PipelineRosterAgent {
  order: number;
  agent_id: string;
  name: string;
  purpose: string;
  tables: string[];
  graph: string[];
  tools: string[];
  passes_to: string;
  gate_name: string;
  runs: number;
  first_run_at: string | null;
  last_run_at: string | null;
  last_status: 'completed' | 'failed' | 'never_run';
  last_duration_ms?: number | null;
  last_records?: { fetched: number; processed: number; produced: number } | null;
  last_gate?: { score: number | null; status: string | null; checks: Record<string, PipelineGateCheck> } | null;
  last_started_by?: { id: number | null; name: string | null };
  last_pipeline_run_id?: string | null;
  last_tables_read?: string[];
  last_summary?: Array<{ label: string; value: string | number }>;
}

export interface PipelineOutputs {
  module: PipelineModule;
  outputs: PipelineOutput[];
  roster: PipelineRosterAgent[];
}

export async function getPipelineOutputs(module: PipelineModule, context: IntelligenceContext, limit = 5): Promise<PipelineOutputs> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=outputs&limit=${limit}`, { method: 'GET', headers: headers(context), cache: 'no-store' });
  return read<PipelineOutputs>(res);
}

export async function startPipelineAutomation(module: PipelineModule, context: IntelligenceContext, intervalSeconds?: number, options: { days?: number; threshold?: number; limit?: number } = {}): Promise<PipelineAutomation> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=start`, { method: 'POST', headers: headers(context), body: JSON.stringify({ interval_seconds: intervalSeconds, ...options }), cache: 'no-store' });
  return (await read<{ automation: PipelineAutomation }>(res)).automation;
}

export async function stopPipelineAutomation(module: PipelineModule, context: IntelligenceContext): Promise<PipelineAutomation> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=stop`, { method: 'POST', headers: headers(context), body: JSON.stringify({}), cache: 'no-store' });
  return (await read<{ automation: PipelineAutomation }>(res)).automation;
}

export async function setPipelineInterval(module: PipelineModule, context: IntelligenceContext, intervalSeconds: number): Promise<PipelineAutomation> {
  const res = await fetch(`/api/ai-pipeline/${module}?action=interval`, { method: 'POST', headers: headers(context), body: JSON.stringify({ interval_seconds: intervalSeconds }), cache: 'no-store' });
  return (await read<{ automation: PipelineAutomation }>(res)).automation;
}
