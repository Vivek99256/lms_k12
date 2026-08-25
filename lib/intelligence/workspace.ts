import { API_BASE_URL } from "@/app/components/utils/api_url";
import type { AiEnvelope, GenerationOutcome, GraphNodeRecord } from "./types";

/**
 * Client for the unified AI Workspace endpoints.
 *
 * Kept separate from `client.ts` because these calls all share one thing: they carry
 * the current route so the backend can resolve which module and record the user is
 * looking at. Everything the workspace does is context-first.
 *
 * The route is the only page-supplied input that matters, and it cannot widen access —
 * the backend derives tenant scope from the JWT and re-checks every lookup. At worst a
 * wrong route shows the wrong suggestions.
 */

export type Capability =
  | "conversational"
  | "generative"
  | "agent"
  | "workflow"
  | "ontology";

export interface WorkspaceSession {
  token?: string | null;
  baseUrl?: string | null;
  instituteId?: string | number | null;
  academicYear?: string | number | null;
  termId?: string | number | null;
}

/**
 * The backend's normalised view of what the page reported.
 *
 * The panel sends `page_data` loosely shaped and gets this back capped and typed. It is
 * the version worth forwarding to the conversation, because it is the one the
 * suggestion engine reasoned over — the two stay in agreement about what is on screen.
 */
export interface WorkspacePageSnapshot {
  title: string | null;
  type: 'dashboard' | 'list' | 'detail' | 'form' | 'report' | 'settings' | null;
  filters: Array<{ key: string; label: string; value: string }>;
  search_query: string | null;
  metrics: Array<{
    key: string;
    label: string;
    value: string;
    unit: string | null;
    trend: string | null;
  }>;
  records: Array<{ id: unknown; label: string | null; attributes: Record<string, string> }>;
  record_count: number;
  available_actions: Array<{ key: string; label: string }>;
}

export interface WorkspaceContext {
  user_id: number;
  role: string;
  is_admin: boolean;
  module: string | null;
  module_label: string | null;
  route: string;
  route_params: Record<string, string>;
  entity_type: string | null;
  entity_id: number | string | null;
  entity_label: string | null;
  entity_attributes: Record<string, unknown>;
  selected_records: Array<{ entity: string | null; id: unknown }>;
  page_data: Record<string, unknown>;
  page: WorkspacePageSnapshot;
  /** dashboard | report | list | detail | form | settings — drives which tabs appear. */
  page_type: 'dashboard' | 'report' | 'list' | 'detail' | 'form' | 'settings';
  capabilities: Record<Capability, boolean>;
  academic_year: number | null;
  term_id: number | null;
}

export interface WorkspaceSuggestion {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  action_type: "prompt" | "generate" | "analyse" | "run_agent" | "start_workflow" | "ontology_view";
  action_ref: string | null;
  prompt?: string | null;
  payload?: Record<string, unknown>;
  requires_entity: boolean;
  /** Agent suggestions only — what the agent is licensed to do. */
  max_verb?: string;
  may_execute?: boolean;
  /** Workflow suggestions only. */
  trigger_type?: string;
  requires_approval?: boolean;
  is_consequential?: boolean;
}

export interface PendingRecommendationSummary {
  id: number;
  reference: string;
  title: string;
  action_type: string;
  risk_level: string;
  confidence: number | null;
  requires_approval: boolean;
  case_id: number | null;
}

export interface WorkflowRunSummaryRow {
  id: number;
  reference: string;
  workflow_key: string;
  status: string;
  current_step_key: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface OntologyViewSummary {
  key: string;
  label: string;
  description: string | null;
  steps: string[];
}

export interface WorkspacePayload {
  context: WorkspaceContext;
  suggestions: Partial<Record<Capability, WorkspaceSuggestion[]>>;
  active: {
    workflow_runs: WorkflowRunSummaryRow[];
    pending_recommendations: PendingRecommendationSummary[];
  };
  ontology_views: OntologyViewSummary[];
  /** Derived stage of the intelligence chain for the current record. */
  flow: FlowState;
}

export interface PlannedStep {
  key: string;
  label: string;
  type: string | null;
  sequence: number;
  status:
    | "pending"
    | "current"
    | "running"
    | "completed"
    | "failed"
    | "skipped"
    | "awaiting_approval"
    | "rejected";
  is_current: boolean;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  output: Record<string, unknown> | null;
  requires_approval: boolean;
}

export interface WorkflowRunDetail {
  id: number;
  reference: string;
  workflow_key: string;
  status: string;
  current_step_key: string | null;
  recommendation_id: number | null;
  case_id: number | null;
  subject_entity_key: string | null;
  subject_id: number | string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  planned_steps: PlannedStep[];
  progress: { total: number; completed: number };
  approvals: Array<{
    id: number;
    step_key: string | null;
    approver_role: string | null;
    assigned_to: number | null;
    status: string;
    comment: string | null;
    decided_at: string | null;
    expires_at: string | null;
  }>;
}

export interface OntologyViewResult {
  found: boolean;
  view: { key: string; label: string; description: string | null } | null;
  root: { entity: string; id: number | string; label: string | null } | null;
  hops: Array<{
    label: string;
    entity: string | null;
    relation: string;
    available: boolean;
    reason?: string;
    total: number;
    source?: "sql" | "graph" | null;
    items: Array<Pick<GraphNodeRecord, "entity" | "id" | "label" | "attributes">>;
  }>;
  sources: { sql: number; graph: number };
}

export interface AgentRunOutcome {
  run_id: number | null;
  status: string;
  summary: string;
  result: Record<string, unknown> & {
    students_at_risk?: number;
    cases?: Array<Record<string, unknown>>;
  };
  counters: {
    signals_detected: number;
    evidence_collected: number;
    cases_opened: number;
    recommendations_drafted: number;
  };
  error: string | null;
}

function normalizeBaseUrl(baseUrl?: string | null) {
  return (baseUrl || API_BASE_URL || "").trim().replace(/\/$/, "");
}

async function post<T>(
  session: WorkspaceSession,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const baseUrl = normalizeBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error("The AI workspace base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/api/ai/workspace${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(session.instituteId != null && `${session.instituteId}`.trim()
        ? { "X-MCP-Institute-Id": String(session.instituteId) }
        : {}),
    },
    body: JSON.stringify({
      ...body,
      meta: {
        ...(session.instituteId ? { institute_id: Number(session.instituteId) } : {}),
        ...(session.academicYear ? { academic_year: Number(session.academicYear) } : {}),
        ...(session.termId ? { term_id: Number(session.termId) } : {}),
      },
    }),
  });

  const text = await response.text();
  let payload: AiEnvelope<T>;

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as AiEnvelope<T>;
  } catch {
    throw new Error("The AI workspace returned a non-JSON response.");
  }

  if (!response.ok || payload.success === false) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `AI workspace request failed (${response.status}).`
    );
  }

  return payload.data as T;
}

/** The single call the panel makes on open, and on every route change. */
export function fetchWorkspaceContext(
  session: WorkspaceSession,
  input: {
    route: string;
    entity_type?: string | null;
    entity_id?: string | number | null;
    selected_records?: Array<{ entity?: string; id: unknown }>;
    page_data?: Record<string, unknown>;
  }
) {
  return post<WorkspacePayload>(session, "/context", input);
}

/** Step-by-step status of the workflows attached to the current record. */
export function fetchWorkflowStatus(
  session: WorkspaceSession,
  input: { route: string; entity_type?: string | null; entity_id?: string | number | null; run_id?: number }
) {
  return post<{ runs: WorkflowRunDetail[] }>(session, "/workflow-status", input);
}

export function runWorkspaceAgent(
  session: WorkspaceSession,
  agentKey: string,
  input: { route: string; entity_type?: string | null; entity_id?: string | number | null; limit?: number }
) {
  return post<AgentRunOutcome>(session, `/agents/${agentKey}/run`, input);
}

export function generateForContext(
  session: WorkspaceSession,
  input: {
    route: string;
    template_key: string;
    entity_type?: string | null;
    entity_id?: string | number | null;
    variables?: Record<string, unknown>;
  }
) {
  return post<GenerationOutcome>(session, "/generate", input);
}

export function fetchOntologyView(
  session: WorkspaceSession,
  viewKey: string,
  input: { route: string; entity_type?: string | null; entity_id?: string | number | null }
) {
  return post<OntologyViewResult>(session, `/ontology-views/${viewKey}`, input);
}

export function startWorkspaceWorkflow(
  session: WorkspaceSession,
  workflowKey: string,
  input: {
    route: string;
    entity_type?: string | null;
    entity_id?: string | number | null;
    input?: Record<string, unknown>;
  }
) {
  return post<{ run_id: number | null; status: string; message: string; current_step: string | null }>(
    session,
    `/workflows/${workflowKey}/start`,
    input
  );
}

// ---- Flow state -------------------------------------------------------------

export type FlowStageKey =
  | 'signal'
  | 'evidence'
  | 'case'
  | 'explanation'
  | 'recommendation'
  | 'decision'
  | 'action'
  | 'outcome';

export interface FlowStage {
  key: FlowStageKey;
  label: string;
  status: 'complete' | 'current' | 'pending';
  summary: string;
  data: Record<string, unknown> | null;
}

export interface FlowNextAction {
  capability: Capability;
  label: string;
  hint: string;
  action_type: 'run_agent' | 'approve' | 'track_workflow' | 'view_outcome';
  recommendation_id?: number | null;
  requires_approval?: boolean;
}

/**
 * Where the current record sits in Signal → … → Outcome.
 *
 * `applicable` is false on list pages: a flow describes one record, and there is no
 * single record to describe.
 */
export interface FlowState {
  applicable: boolean;
  stage: FlowStageKey | null;
  stages: FlowStage[];
  next: FlowNextAction | null;
  refs: {
    case_id: number | null;
    recommendation_id: number | null;
    workflow_run_id: number | null;
    outcome_id: number | null;
  };
}

export function fetchFlowState(
  session: WorkspaceSession,
  input: { route: string; entity_type?: string | null; entity_id?: string | number | null }
) {
  return post<{ flow: FlowState }>(session, '/flow', input);
}
