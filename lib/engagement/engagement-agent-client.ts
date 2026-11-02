import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { IntelligenceContext } from '@/lib/intelligence/client';

export interface EngagementAgentState {
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
  summary_counts?: {
    total_flagged?: number;
    total_profiled?: number;
    draft_notes_count?: number;
    threshold_percent?: number;
    duration_ms?: number;
  };
  counts?: {
    flagged_students?: number;
    draft_interventions?: number;
    duration_ms?: number;
  };
  summary?: {
    status_label?: string;
  };
  recent_findings?: unknown[];
  latest_report?: EngagementPipelineReport | null;
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

export interface FlaggedStudentItem {
  student_id: number;
  student_name?: string;
  attendance?: number | null;
  homework?: number | null;
  assignments?: number | null;
  below_threshold?: string[];
}

export interface StudentProfileItem {
  student_id: number;
  student_name: string;
  attendance_percent: number | null;
  homework_percent: number | null;
  assignments_percent: number | null;
  total_activity_events: number;
  total_time_spent_seconds: number;
  activity_by_type: Record<string, number>;
  total_doubts: number;
  unanswered_doubts: number;
  detected_deficits: string[];
  primary_disengagement_vector: string;
  profiled_at: string;
}

export interface DraftInterventionNote {
  student_id: number;
  student_name: string;
  category: string;
  subject: string;
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

export interface EngagementEso {
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

export interface EngagementPipelineReport {
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
    students_scanned: number;
    flagged_students: number;
    critical_attention_count: number;
    draft_interventions: number;
    threshold_percent: number;
    window_days: number;
  };
  findings: {
    flagged_students: FlaggedStudentItem[];
    student_profiles: StudentProfileItem[];
    draft_interventions: DraftInterventionNote[];
  };
  executive_skill_object?: EngagementEso;
}

export interface PipelineExecutionResponse {
  success: boolean;
  message: string;
  data: {
    report: EngagementPipelineReport;
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

export async function getEngagementAgentState(
  context?: IntelligenceContext
): Promise<{ success: boolean; state?: EngagementAgentState; message?: string }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=state', {
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
      message: error instanceof Error ? error.message : 'Failed to fetch Engagement state',
    };
  }
}

export async function startEngagementMonitoring(
  intervalSeconds = 60,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: EngagementAgentState }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=start', {
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

export async function stopEngagementMonitoring(
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: EngagementAgentState }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=stop', {
      method: 'POST',
      headers: resolveHeaders(context),
      body: JSON.stringify({}),
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
      message: error instanceof Error ? error.message : 'Failed to pause monitoring',
    };
  }
}

export async function runEngagementPipeline(
  options: {
    standard_id?: number | null;
    standard_name?: string;
    threshold_percent?: number;
    days_back?: number;
    limit?: number;
  } = {},
  context?: IntelligenceContext
): Promise<{ success: boolean; report?: EngagementPipelineReport; message?: string }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=pipeline', {
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
      message: error instanceof Error ? error.message : 'Failed to execute Engagement pipeline',
    };
  }
}

export async function setEngagementInterval(
  intervalSeconds: number,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: EngagementAgentState }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=interval', {
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

export async function getEngagementEso(
  context?: IntelligenceContext
): Promise<{ success: boolean; eso?: EngagementEso; message?: string }> {
  try {
    const res = await fetch('/api/engagement/agent-control?action=eso', {
      method: 'GET',
      headers: resolveHeaders(context),
      cache: 'no-store',
    });

    const data = await res.json();
    return {
      success: res.ok && (data.success ?? true),
      eso: data.data?.eso || data.eso,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load Engagement ESO',
    };
  }
}

