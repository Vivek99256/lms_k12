import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { IntelligenceContext } from '@/lib/intelligence/client';

export interface ExamAssessmentAgentState {
  id?: number;
  sub_institute_id: number;
  agent_key: string;
  is_active: boolean | number;
  interval_seconds: number;
  last_run_at: string | null;
  last_run_status: string | null;
  next_run_at: string | null;
  last_heartbeat_at: string | null;
  daemon_pid: number | null;
  latest_hash?: string | null;
  summary_counts?: {
    exams_published?: number;
    attempts_recorded?: number;
    students_assessed?: number;
    average_score?: number | string | null;
    needs_attention?: number;
    total_assignments?: number;
    not_submitted?: number;
    draft_notes_count?: number;
  };
  metrics?: Record<string, unknown>;
}

export interface PipelineStepExecution {
  step: number;
  agent_name: string;
  agent_id: string;
  tool: string;
  status: string;
  duration_ms: number;
  input: Record<string, unknown>;
  output_summary: string;
}

export interface PipelineValidationGate {
  gate: number;
  name: string;
  status: 'passed' | 'failed' | string;
  [key: string]: unknown;
}

export interface AtRiskStudentItem {
  exam_id?: number;
  paper_id?: number;
  paper_name?: string;
  subject_name?: string;
  student_id: number;
  student_name?: string;
  obtained_marks: number;
  total_marks: number;
  percentage?: number;
  score_percent?: number;
  sub_institute_id?: number;
  attempt_date?: string;
}

export interface UnsubmittedWorkItem {
  assignment_id: number;
  student_id?: number;
  student_name?: string;
  title: string;
  work_type: string;
  subject_name?: string;
  standard_id?: number;
  division_id?: number;
  created_date?: string;
  submission_date?: string;
}

export interface DraftReviewNote {
  context_type?: string;
  type?: string;
  student_id?: number;
  student_name?: string;
  subject: string;
  draft_body: string;
  status: string;
  recommended_action?: string;
}

export interface ExamAssessmentPipelineReport {
  success: boolean;
  pipeline_status: string;
  mode?: 'single_standard' | 'all_standards_sweep';
  sub_institute_id: number;
  standard_id?: number | null;
  standard_name?: string;
  generated_at: string;
  total_duration_ms: number;
  exam_performance?: {
    exams_published: number;
    attempts_recorded: number;
    students_assessed: number;
    average_score: number | string | null;
    needs_attention_count: number;
    benchmark_percent: number;
    at_risk_sample: AtRiskStudentItem[];
  };
  assignment_status?: {
    total_work: number;
    by_work_type: Array<{
      work_type: string;
      total: number;
      submitted: number;
      reviewed: number;
      pending_review: number;
      not_submitted: number;
    }>;
    submitted: number;
    reviewed: number;
    not_submitted: number;
    not_submitted_sample: UnsubmittedWorkItem[];
  };
  draft_reviews?: {
    cohort_summary: string;
    student_drafts_count: number;
    student_drafts: DraftReviewNote[];
  };
  pipeline_execution?: {
    steps: PipelineStepExecution[];
    gates: PipelineValidationGate[];
  };
  summary?: {
    total_standards_scanned: number;
    standards_passed_all_gates: number;
    total_exams_published: number;
    total_attempts_recorded: number;
    total_at_risk_attempts: number;
    total_assignments_tracked: number;
    total_draft_reviews_prepared: number;
  };
  standards?: Array<{
    standard_id: number;
    standard_name: string;
    status: string;
    all_gates_passed: boolean;
    exams_published: number;
    attempts_recorded: number;
    average_score: number | string | null;
    at_risk_count: number;
    assignments_total: number;
    assignments_not_submitted: number;
    drafts_count: number;
    duration_ms: number;
  }>;
  failed_at_gate?: number;
  error?: string;
}

export interface ExamAssessmentEso {
  overview: {
    system_name: string;
    module: string;
    sub_institute_id: number;
    architecture: string;
    generated_at: string;
    total_agents: number;
    status: string;
  };
  database_resources: {
    primary_tables: string[];
    live_metrics: {
      exams_published: number;
      attempts_recorded: number;
      assignments_created: number;
      worksheets_created: number;
      projects_created: number;
    };
  };
  agents: Record<
    string,
    {
      order: number;
      name: string;
      agent_id: string;
      backend_key: string;
      module: string;
      role_description: string;
      primary_tables: string[];
      validation_gate: {
        gate: number;
        name: string;
        enforcement: string;
      };
      input_schema?: Record<string, unknown>;
      safety_guardrails?: Record<string, unknown>;
    }
  >;
  synchronization_pipeline: {
    name: string;
    description: string;
    gates_enforced: Array<{
      gate: number;
      name: string;
      criteria: string;
      failure_mode: string;
    }>;
  };
}

function resolveProxyEndpoint(action?: string): string {
  const base = '/api/exam-assessment/agent-control';
  return action ? `${base}?action=${encodeURIComponent(action)}` : base;
}

function buildHeaders(context: IntelligenceContext): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (context.token) {
    headers.Authorization = context.token.startsWith('Bearer ') ? context.token : `Bearer ${context.token}`;
  }
  const instId =
    context.instituteId ||
    (context as unknown as Record<string, unknown>).selectedInstituteId ||
    '195';
  headers['X-MCP-Institute-Id'] = String(instId);
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }
  return (json.data ?? json) as T;
}

/**
 * Fetch current continuous monitoring loop status and live metrics.
 */
export async function getExamAssessmentAgentState(
  context: IntelligenceContext
): Promise<{ state: ExamAssessmentAgentState; server_time: string }> {
  const url = resolveProxyEndpoint('state');
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(context),
    cache: 'no-store',
  });
  return handleResponse<{ state: ExamAssessmentAgentState; server_time: string }>(res);
}

/**
 * Start continuous background monitoring loop.
 */
export async function startExamAssessmentMonitoring(
  context: IntelligenceContext,
  intervalSeconds = 60
): Promise<{ activation: unknown; state: ExamAssessmentAgentState; server_time: string }> {
  const url = resolveProxyEndpoint('start');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return handleResponse<{ activation: unknown; state: ExamAssessmentAgentState; server_time: string }>(res);
}

/**
 * Pause / Stop continuous background monitoring loop.
 */
export async function stopExamAssessmentMonitoring(
  context: IntelligenceContext
): Promise<{ deactivation: unknown; state: ExamAssessmentAgentState; server_time: string }> {
  const url = resolveProxyEndpoint('stop');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  return handleResponse<{ deactivation: unknown; state: ExamAssessmentAgentState; server_time: string }>(res);
}

/**
 * Update the continuous monitoring interval.
 */
export async function setExamAssessmentInterval(
  context: IntelligenceContext,
  intervalSeconds: number
): Promise<{ state: ExamAssessmentAgentState; server_time: string }> {
  const url = resolveProxyEndpoint('interval');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
    cache: 'no-store',
  });
  return handleResponse<{ state: ExamAssessmentAgentState; server_time: string }>(res);
}

/**
 * Trigger immediate synchronized 3-agent pipeline execution.
 */
export async function runExamAssessmentPipeline(
  context: IntelligenceContext,
  options: {
    standard_id?: number | null;
    standard_name?: string;
    subject_id?: number | null;
    student_id?: number | null;
    at_risk_percent?: number;
    limit?: number;
  } = {}
): Promise<{ report: ExamAssessmentPipelineReport; server_time: string }> {
  const url = resolveProxyEndpoint('pipeline');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(context),
    body: JSON.stringify(options),
    cache: 'no-store',
  });
  return handleResponse<{ report: ExamAssessmentPipelineReport; server_time: string }>(res);
}

/**
 * Fetch Expert System Overview (ESO).
 */
export async function getExamAssessmentEso(
  context: IntelligenceContext
): Promise<{ eso: ExamAssessmentEso; server_time: string }> {
  const url = resolveProxyEndpoint('eso');
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(context),
    cache: 'no-store',
  });
  return handleResponse<{ eso: ExamAssessmentEso; server_time: string }>(res);
}

