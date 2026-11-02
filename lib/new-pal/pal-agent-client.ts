import type { IntelligenceContext } from '@/lib/intelligence/client';

export interface PalAgentState {
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
    pal_papers?: number;
    pal_attempts?: number;
    total_points?: number;
    flagged_learners?: number;
    draft_notes_count?: number;
    duration_ms?: number;
  };
  summary?: {
    status_label?: string;
  };
  recent_findings?: unknown[];
  latest_report?: PalPipelineReport | null;
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

export interface LearnerProfileItem {
  student_id: number;
  name: string;
  points: number;
  streak: number;
  badges: number;
}

export interface FlaggedLearnerItem {
  student_id: number;
  student_name: string;
  severity: string;
  stream_share: number;
  practised_concepts: number;
  stuck_concepts: string[];
}

export interface DraftAdaptiveInterventionNote {
  id: string;
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

export interface PalEso {
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

export interface PalPipelineReport {
  status: string;
  sub_institute_id: number;
  student_id?: number | null;
  learner_name?: string;
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
    total_points: number;
    current_streak: number;
    badges_count: number;
    chapters_evaluated: number;
    authored_models: number;
    flagged_learners: number;
    draft_notes_count: number;
  };
  findings: {
    learner_profile: LearnerProfileItem;
    flagged_learners: FlaggedLearnerItem[];
    draft_notes: DraftAdaptiveInterventionNote[];
  };
  executive_skill_object?: PalEso;
}

export interface PipelineExecutionResponse {
  success: boolean;
  message: string;
  data: {
    report: PalPipelineReport;
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

export async function getPalAgentState(
  context?: IntelligenceContext
): Promise<{ success: boolean; state?: PalAgentState; message?: string }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=state', {
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
      message: error instanceof Error ? error.message : 'Failed to fetch PAL state',
    };
  }
}

export async function startPalMonitoring(
  intervalSeconds = 60,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: PalAgentState }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=start', {
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

export async function stopPalMonitoring(
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: PalAgentState }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=stop', {
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

export async function setPalInterval(
  intervalSeconds: number,
  context?: IntelligenceContext
): Promise<{ success: boolean; message?: string; state?: PalAgentState }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=interval', {
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

export async function runPalPipeline(
  options: Record<string, unknown> = {},
  context?: IntelligenceContext
): Promise<{ success: boolean; report?: PalPipelineReport; message?: string }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=pipeline', {
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

export async function getPalEso(
  context?: IntelligenceContext
): Promise<{ success: boolean; eso?: PalEso; message?: string }> {
  try {
    const res = await fetch('/api/pal/agent-control?action=eso', {
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

