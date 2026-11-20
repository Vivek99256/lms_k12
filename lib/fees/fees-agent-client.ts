import type { IntelligenceContext } from '@/lib/intelligence/client';

/**
 * Client for the Fees sequential agent pipeline (`/api/fees/agent` -> `/api/ai/fees/agent/*`).
 * Shapes mirror the backend `FeesAgentPipelineService` report and `FeesEsoRegistry` object.
 */

export interface FeesGateCheck {
  status: 'passed' | 'failed';
  message: string;
}

export interface FeesGate {
  gate: string;
  name: string;
  status: 'passed' | 'failed';
  score: number;
  passed_checks: number;
  total_checks: number;
  checks: Record<string, FeesGateCheck>;
}

export interface FeesPipelineStep {
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
}

export interface FeesCandidate {
  student_id: number;
  student_name: string | null;
  enrollment_no: string | null;
  class: string | null;
  outstanding: number;
  actual_outstanding?: number;
  is_custom_amount?: boolean;
  custom_amount?: number;
  pending_items: number;
  evidence?: Array<Record<string, unknown>> | null;
  reason?: string;
  last_reminder?: {
    recorded_at?: string;
    channel?: string;
    batch?: string;
  };
}

export interface FeesPipelineReport {
  success: boolean;
  pipeline_status: string;
  sub_institute_id: number;
  academic_year: number;
  academic_year_source: string;
  generated_at: string;
  total_duration_ms: number;
  note: string | null;
  quality_scorecard: {
    composite_score: number;
    overall_status: 'passed' | 'flagged';
    gates_evaluated: number;
    quality_tier: string;
    gates: Record<string, FeesGate>;
  };
  ledger_position: {
    headline: string | null;
    total_demand: number | null;
    total_collected: number | null;
    total_outstanding: number | null;
    overdue_amount: number | null;
    collection_rate: string | null;
    students_owing: number | null;
    students_fully_paid: number | null;
    aging?: Record<string, unknown>;
    classes_with_most_pending: Array<{ standard_name: string; standard_id?: number; outstanding: number; students_owing: number; collection_rate?: string | null }>;
  };
  arrears_scan: {
    cohort_size: number;
    students_checked: number;
    truncated: boolean;
    defaulter_count: number;
    total_outstanding_in_scan: number;
    failed_lookups: number;
    candidates: FeesCandidate[];
  };
  evidence_analysis: {
    eligible: FeesCandidate[];
    held_back: FeesCandidate[];
    collection_in_period: { period: { label?: string } | null; total_collected: number | null; receipts: number | null };
  };
  reminder_draft: {
    attempted: boolean;
    available: boolean;
    message: string | null;
    channel: string | null;
    deadline: string | null;
    recipient_count: number;
    unreachable_count: number;
    total_outstanding: number;
    recipients: Array<{
      student_id: number;
      name: string;
      class: string | null;
      outstanding: number;
      actual_outstanding?: number;
      is_custom_amount?: boolean;
      outstanding_label?: string;
      actual_outstanding_label?: string;
      contact_masked: string;
      is_test_contact?: boolean;
      contact_destination?: string;
    }>;
    unreachable: Array<{ student_id: number; name: string; class: string | null; outstanding: number; reason: string }>;
    sample_message: string | null;
    warnings: string[];
    fingerprint: string | null;
    sent: number;
    next_action: string;
  };
  handoffs?: Record<string, { valid: boolean; message?: string; error?: string }>;
  pipeline_execution: { steps: FeesPipelineStep[]; gates: FeesGate[] };
}

export interface FeesPipelineFailure {
  failed_at_gate?: number;
  error?: string;
  run_id?: string;
  details?: { run_id?: string; gate_1?: FeesGate; gate_2?: FeesGate; gate_3?: FeesGate; steps?: FeesPipelineStep[]; step_result?: FeesStepResult };
}

export interface FeesPipelineOptions {
  academic_year?: number;
  standard_id?: number;
  student_ids?: number[];
  custom_amounts?: Record<number, number>;
  contact_overrides?: Record<number, { email?: string; sms?: string } | string>;
  min_amount?: number;
  limit?: number;
  evidence_limit?: number;
  cooldown_days?: number;
  period?: string;
  channel?: 'email' | 'sms' | 'whatsapp';
  deadline?: string;
  step?: 1 | 2 | 3 | '1' | '2' | '3' | 'all';
  run_id?: string;
}

export interface FeesRecentRun {
  id: number;
  run_reference: string;
  tool: string;
  step: number;
  status: string;
  duration_ms: number | null;
  started_at: string | null;
}

export interface FeesLiveSummaryCounts {
  total_demand?: number;
  total_collected?: number;
  total_outstanding?: number;
  collection_rate?: number;
  students_owing?: number;
  defaulters_count?: number;
  fee_accounts?: number;
  receipts_count?: number;
}

export interface FeesAgentState {
  id?: number;
  sub_institute_id: number;
  agent_key?: string;
  is_active?: boolean | number;
  interval_seconds?: number;
  last_run_at?: string | null;
  last_run_status?: string | null;
  next_run_at?: string | null;
  last_heartbeat_at?: string | null;
  daemon_pid?: number | null;
  academic_year?: number | null;
  academic_year_source?: string;
  recent_runs: FeesRecentRun[];
  summary_counts?: FeesLiveSummaryCounts;
}

export interface FeesEsoAgent {
  order: number;
  name: string;
  agent_id: string;
  tool_key: string;
  role_description: string;
  validation_rules: { gate: string; name: string; rules: string[] };
  database_resources: { primary_tables: string[]; live_metrics: Record<string, number | null> };
  ek: { summary: string; schemas_and_relationships: string[]; tables_and_sources: string[] };
  ea: { skills: string[]; capabilities: string[]; constraints_and_safeguards: string[] };
  er: { must_do: string[]; must_not_do: string[]; stopping_conditions: string[]; handoff_rules: string; dependencies: string };
  eq: { applicable_gates: string[]; quality_rules: string[]; scoring_formula: string };
  outputs: string;
  eso: {
    activities: { summary: string; items: string[] };
    usage: { summary: string; step_by_step_flow: string[]; upstream_dependencies: string; downstream_handoff: string };
  };
}

export interface FeesEso {
  overview: {
    system_name: string;
    architecture: string;
    academic_year: number | null;
    status: string;
    capability_summary: { total_capabilities: number; fully_implemented: number; partially_implemented: number; readiness_percentage: number };
  };
  agents: Record<'agent_1' | 'agent_2' | 'agent_3', FeesEsoAgent>;
  execution_workflow: {
    pattern: string;
    execution_order: string[];
    data_flow: Record<string, string>;
    isolation_and_safety: Record<string, string | boolean>;
  };
  capability_registry: { items: Array<{ agent: string; capability: string; tool: string; status: string; note?: string }> };
}

export interface FeesStandard {
  id: number;
  name: string;
  code?: string;
  standard_id?: number;
  standard_name?: string;
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

/** Thrown for a pipeline that stopped at a gate, so the UI can show which check failed. */
export class FeesPipelineError extends Error {
  constructor(message: string, readonly failure: FeesPipelineFailure | null) {
    super(message);
  }
}

async function read<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: { success?: boolean; message?: string; data?: T; errors?: FeesPipelineFailure };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from server (${res.status})`);
  }
  if (!res.ok || json.success === false) {
    throw new FeesPipelineError(json.errors?.error || json.message || `Request failed with status ${res.status}`, json.errors ?? null);
  }
  return (json.data ?? json) as T;
}

/** The academic year the browser has selected, only when it is a plain four-digit year. */
export function sessionAcademicYear(context: IntelligenceContext): number | undefined {
  const year = Number(context.academicYear);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined;
}

export interface FeesAgentStateResponse {
  success?: boolean;
  state?: FeesAgentState;
}

export async function getFeesAgentState(context: IntelligenceContext): Promise<FeesAgentStateResponse & FeesAgentState> {
  const year = sessionAcademicYear(context);
  const res = await fetch(`/api/fees/agent?action=state${year ? `&academic_year=${year}` : ''}`, {
    method: 'GET',
    headers: headers(context),
    cache: 'no-store',
  });
  return read<FeesAgentStateResponse & FeesAgentState>(res);
}

export async function startFeesAgentMonitoring(
  context: IntelligenceContext,
  intervalSeconds = 60
): Promise<{ success: boolean; state: FeesAgentState }> {
  const res = await fetch('/api/fees/agent?action=start', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return read<{ success: boolean; state: FeesAgentState }>(res);
}

export async function stopFeesAgentMonitoring(
  context: IntelligenceContext
): Promise<{ success: boolean; state: FeesAgentState }> {
  const res = await fetch('/api/fees/agent?action=stop', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  return read<{ success: boolean; state: FeesAgentState }>(res);
}

export async function setFeesAgentInterval(
  context: IntelligenceContext,
  intervalSeconds: number
): Promise<{ success: boolean; state: FeesAgentState }> {
  const res = await fetch('/api/fees/agent?action=interval', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return read<{ success: boolean; state: FeesAgentState }>(res);
}

export async function runFeesPipeline(
  context: IntelligenceContext,
  options: FeesPipelineOptions = {},
): Promise<{ report: FeesPipelineReport; server_time: string }> {
  const res = await fetch('/api/fees/agent', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify({ academic_year: sessionAcademicYear(context), ...options }),
    cache: 'no-store',
  });
  return read<{ report: FeesPipelineReport; server_time: string }>(res);
}

export async function getFeesEso(context: IntelligenceContext): Promise<{ eso: FeesEso }> {
  const year = sessionAcademicYear(context);
  const res = await fetch(`/api/fees/agent?action=eso${year ? `&academic_year=${year}` : ''}`, {
    method: 'GET',
    headers: headers(context),
    cache: 'no-store',
  });
  return read<{ eso: FeesEso }>(res);
}

export async function fetchFeesStandards(context: IntelligenceContext): Promise<FeesStandard[]> {
  const res = await fetch('/api/fees/agent?action=standards', {
    method: 'GET',
    headers: headers(context),
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  const json = await res.json().catch(() => ({}));
  const data = json.data || json;
  return data.standards || [];
}

export interface FeesDefaulterStudent {
  student_id: number;
  name: string;
  enrollment_no: string | null;
  standard_name: string | null;
  outstanding: number;
  email: string | null;
  email_masked: string | null;
  mobile: string | null;
  mobile_masked: string | null;
  has_email: boolean;
  has_mobile: boolean;
  channels: Array<'email' | 'sms' | 'whatsapp'>;
}

export async function fetchFeesDefaulterStudents(
  context: IntelligenceContext,
  standardId?: number | 'all',
  limit = 50,
): Promise<FeesDefaulterStudent[]> {
  const stdParam = standardId && standardId !== 'all' ? `&standard_id=${standardId}` : '';
  const res = await fetch(`/api/fees/agent?action=students${stdParam}&limit=${limit}`, {
    method: 'GET',
    headers: headers(context),
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  const json = await res.json().catch(() => ({}));
  const data = json.data || json;
  return data.students || [];
}

export interface FeesSendPayload {
  fingerprint: string;
  channel: 'email' | 'sms' | 'whatsapp';
  deadline: string;
  student_ids?: number[];
  custom_amounts?: Record<number, number>;
  contact_overrides?: Record<number, { email?: string; sms?: string } | string>;
  standard_id?: number;
  message?: string;
}

export interface FeesSendResultItem {
  student_id: number;
  name: string;
  outstanding: number;
  actual_outstanding?: number;
  is_custom_amount?: boolean;
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
}

export interface FeesSendResult {
  reference: string;
  channel: string;
  channel_label: string;
  deadline: string;
  sent: number;
  failed: number;
  skipped: number;
  results: FeesSendResultItem[];
}

export async function sendApprovedFeesReminders(
  context: IntelligenceContext,
  payload: FeesSendPayload,
): Promise<{ result: FeesSendResult }> {
  const res = await fetch('/api/fees/agent?action=send', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return read<{ result: FeesSendResult }>(res);
}

// ───────────────────────── Step-wise execution ─────────────────────────
// Each agent is its own request, exactly as Teach/Learn runs its agents. The server keeps the
// handover between agents under `run_id`; the browser only carries the id.

/** One thing the agent did while running: a tool call, a local check, or a gate evaluation. */
export interface FeesAction {
  type: 'tool' | 'check' | 'gate';
  tool?: string;
  arguments?: Record<string, unknown>;
  duration_ms?: number;
  success: boolean;
  summary: string;
}

/** What one agent reported back for its own step (Agent 1, 2 or 3). */
export interface FeesStepResult extends FeesPipelineStep {
  actions: FeesAction[];
  output: Record<string, unknown> & {
    candidates?: FeesCandidate[];
    eligible?: FeesCandidate[];
    held_back?: FeesCandidate[];
  };
}

export interface FeesHandoff {
  valid: boolean;
  message?: string;
  error?: string;
}

export interface FeesStepResponse {
  success: boolean;
  run_id: string;
  step?: number;
  pipeline_status: string;
  step_result: FeesStepResult;
  gate?: FeesGate;
  handoff?: FeesHandoff;
  next: { agent: number; name: string; message: string } | null;
  /** Present on the final response only: the unified report assembled from all three steps. */
  report_complete?: boolean;
}

export type FeesFinalStepResponse = FeesStepResponse & FeesPipelineReport;

export async function runFeesPipelineStep(
  context: IntelligenceContext,
  step: 1 | 2 | 3,
  options: FeesPipelineOptions = {},
  runId?: string,
): Promise<FeesStepResponse | FeesFinalStepResponse> {
  const res = await fetch('/api/fees/agent?action=pipeline', {
    method: 'POST',
    headers: headers(context),
    body: JSON.stringify({ academic_year: sessionAcademicYear(context), ...options, step, ...(runId ? { run_id: runId } : {}) }),
    cache: 'no-store',
  });
  const data = await read<{ report: FeesStepResponse | FeesFinalStepResponse }>(res);
  return data.report;
}
