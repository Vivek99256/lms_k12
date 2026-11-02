import type { IntelligenceContext } from '@/lib/intelligence/client';

export interface CurriculumPlanningAgentState {
  id?: number;
  sub_institute_id: number;
  agent_key: string;
  is_active: boolean | number;
  interval_seconds: number;
  last_run_at?: string | null;
  last_run_time?: string | null;
  last_run_status: string | null;
  next_run_at?: string | null;
  next_scheduled_run?: string | null;
  last_heartbeat_at?: string | null;
  daemon_pid?: number | null;
  latest_hash?: string | null;
  counts?: {
    total_curricula?: number;
    total_lesson_plans?: number;
    total_periods?: number;
    behind_schedule_count?: number;
    draft_notes_count?: number;
    duration_ms?: number;
  };
  summary?: {
    status_label?: string;
  };
  recent_findings?: unknown[];
  latest_report?: CurriculumPlanningPipelineReport | null;
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

export interface CurriculumItem {
  curriculum_id: number;
  subject_id: number;
  subject_name: string;
  standard_id: number;
  standard_name: string;
  units: number;
  chapters: number;
  chapters_completed: number;
  coverage_pct: number;
}

export interface BehindSchedulePeriodItem {
  period_id: number;
  plan_id: number;
  chapter_id: number;
  chapter_name: string;
  concept_name: string;
  scheduled_date: string;
  period_slot: string;
  status: string;
  teacher_name: string;
}

export interface UpcomingPeriodItem {
  period_id: number;
  chapter_name: string;
  scheduled_date: string;
  period_slot: string;
  teacher_name: string;
}

export interface DraftAlignmentNote {
  id: string;
  category: string;
  subject: string;
  target_entity: string;
  evidence_summary: string;
  recommended_actions: string[];
  draft_body: string;
  status: string;
  max_verb: string;
  may_execute_actions: number;
  created_at: string;
}

export interface AgentEsoStructuredObject {
  knowledge: {
    summary: string;
    items: string[];
    tables_and_sources: string[];
  };
  activities: {
    summary: string;
    items: string[];
  };
  abilities: {
    summary: string;
    skills: string[];
    constraints_and_safeguards: string[];
  };
  usage: {
    summary: string;
    step_by_step_flow: string[];
    upstream_dependencies: string;
    downstream_handoff: string;
  };
}

export interface CurriculumPlanningEso {
  module: string;
  module_label: string;
  institute_id: number;
  agents: {
    agent_1: {
      agent_id: string;
      name: string;
      role: string;
      tool: string;
    } & AgentEsoStructuredObject;
    agent_2: {
      agent_id: string;
      name: string;
      role: string;
      tool: string;
    } & AgentEsoStructuredObject;
    agent_3: {
      agent_id: string;
      name: string;
      role: string;
      tool: string;
    } & AgentEsoStructuredObject;
  };
}

export interface CurriculumPlanningPipelineReport {
  status: string;
  sub_institute_id: number;
  standard_id?: number | null;
  standard_name?: string;
  duration_ms: number;
  timestamp: string;
  pipeline_execution: {
    steps: PipelineStepExecution[];
    total_steps: number;
    status: string;
  };
  validation_gates: PipelineValidationGate[];
  summary_metrics: {
    curricula_evaluated: number;
    total_units: number;
    total_chapters: number;
    average_coverage_pct: number;
    total_plans: number;
    total_periods: number;
    completed_periods: number;
    completion_rate_pct: number;
    behind_schedule_count: number;
    draft_notes_count: number;
  };
  findings: {
    curricula: CurriculumItem[];
    behind_schedule_periods: BehindSchedulePeriodItem[];
    upcoming_periods: UpcomingPeriodItem[];
    draft_notes: DraftAlignmentNote[];
  };
  executive_skill_object?: CurriculumPlanningEso;
}

export interface PipelineExecutionResponse {
  success: boolean;
  message: string;
  data: {
    report: CurriculumPlanningPipelineReport;
    server_time: string;
  };
}

function resolveHeaders(context?: IntelligenceContext): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (context?.token) {
    headers.Authorization = `Bearer ${context.token}`;
  }
  if (context?.instituteId) {
    headers['X-MCP-Institute-Id'] = String(context.instituteId);
  }

  return headers;
}

export async function getCurriculumPlanningAgentState(
  context?: IntelligenceContext
): Promise<{ success: boolean; state?: CurriculumPlanningAgentState; message?: string }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=state', {
      method: 'GET',
      headers: resolveHeaders(context),
      cache: 'no-store',
    });

    const data = await res.json();
    return {
      success: res.ok && (data.success ?? true),
      state: data.data?.state || data.state,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch Curriculum Planning state',
    };
  }
}

export async function startCurriculumPlanningMonitoring(
  intervalSeconds = 60,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: CurriculumPlanningAgentState }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=start', {
      method: 'POST',
      headers: resolveHeaders(context),
      body: JSON.stringify({ interval_seconds: intervalSeconds }),
    });

    const data = await res.json();
    return {
      success: res.ok && (data.success ?? true),
      message: data.message,
      state: data.data?.state || data.state,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start monitoring',
    };
  }
}

export async function stopCurriculumPlanningMonitoring(
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: CurriculumPlanningAgentState }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=stop', {
      method: 'POST',
      headers: resolveHeaders(context),
    });

    const data = await res.json();
    return {
      success: res.ok && (data.success ?? true),
      message: data.message,
      state: data.data?.state || data.state,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop monitoring',
    };
  }
}

export async function setCurriculumPlanningInterval(
  intervalSeconds: number,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: CurriculumPlanningAgentState }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=interval', {
      method: 'POST',
      headers: resolveHeaders(context),
      body: JSON.stringify({ interval_seconds: intervalSeconds }),
    });

    const data = await res.json();
    return {
      success: res.ok && (data.success ?? true),
      message: data.message,
      state: data.data?.state || data.state,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update interval',
    };
  }
}

export async function runCurriculumPlanningPipeline(
  options: Record<string, unknown> = {},
  context?: IntelligenceContext
): Promise<{ success: boolean; report?: CurriculumPlanningPipelineReport; message?: string }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=pipeline', {
      method: 'POST',
      headers: resolveHeaders(context),
      body: JSON.stringify(options),
    });

    const data = await res.json();
    const report = data.data?.report || data.report;
    return {
      success: res.ok && (data.success ?? true),
      report,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Pipeline run failed',
    };
  }
}

export async function getCurriculumPlanningEso(
  context?: IntelligenceContext
): Promise<{ success: boolean; eso?: CurriculumPlanningEso; message?: string }> {
  try {
    const res = await fetch('/api/curriculum-planning/agent-control?action=eso', {
      method: 'GET',
      headers: resolveHeaders(context),
      cache: 'no-store',
    });

    const data = await res.json();
    const eso = data.data?.eso || data.eso;
    return {
      success: res.ok && (data.success ?? true),
      eso,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch ESO',
    };
  }
}

