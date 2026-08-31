import { API_BASE_URL } from "@/app/components/utils/api_url";
import type {
  AgentRunResult,
  AiEnvelope,
  AskIntent,
  AskResult,
  CaseDetail,
  CaseRecord,
  ConversationTranscript,
  DecisionResult,
  GenerationOutcome,
  GraphTraversal,
  LifecycleModule,
  OntologyEntity,
  OntologyRelationship,
  PendingApproval,
  RecommendationRecord,
  SignalRecord,
  SubjectIntelligence,
  WorkflowRunSummary,
} from "./types";

/**
 * Client for the shared intelligence API.
 *
 * Mirrors `lib/ai/mcp-client.ts`: same base URL resolution, same bearer-token
 * handling, same envelope unwrapping. Reusing that shape rather than inventing a
 * second HTTP convention means the two AI surfaces behave identically when a token
 * expires or a tenant scope is refused.
 *
 * Scope is never sent from here. The backend derives it from the JWT via
 * McpContextHydrator, so a client cannot ask for another school's data by
 * constructing a different payload.
 */

export interface IntelligenceContext {
  token?: string | null;
  baseUrl?: string | null;
  instituteId?: string | number | null;
  academicYear?: string | number | null;
  termId?: string | number | null;
}

function normalizeBaseUrl(baseUrl?: string | null) {
  return (baseUrl || API_BASE_URL || "").trim().replace(/\/$/, "");
}

function buildHeaders(context: IntelligenceContext, extra?: HeadersInit): HeadersInit {
  return {
    Accept: "application/json",
    ...(context.token ? { Authorization: `Bearer ${context.token}` } : {}),
    // The institute header is a *selection* within the caller's allowed set, not a
    // grant. The backend rejects anything outside that set.
    ...(context.instituteId != null && `${context.instituteId}`.trim()
      ? { "X-MCP-Institute-Id": String(context.instituteId) }
      : {}),
    ...extra,
  };
}

function buildMeta(context: IntelligenceContext) {
  const meta: Record<string, number> = {};

  if (context.instituteId != null && `${context.instituteId}`.trim()) {
    meta.institute_id = Number(context.instituteId);
  }
  if (context.academicYear != null && `${context.academicYear}`.trim()) {
    meta.academic_year = Number(context.academicYear);
  }
  if (context.termId != null && `${context.termId}`.trim()) {
    meta.term_id = Number(context.termId);
  }

  return meta;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("The intelligence API returned a non-JSON response.");
  }
}

async function request<T>(
  context: IntelligenceContext,
  path: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = normalizeBaseUrl(context.baseUrl);

  if (!baseUrl) {
    throw new Error("The intelligence API base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/api/ai${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...buildHeaders(context, init?.headers),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const payload = (await readJson(response)) as unknown as AiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `Intelligence request failed (${response.status}).`
    );
  }

  return payload.data as T;
}

function get<T>(context: IntelligenceContext, path: string, query?: Record<string, unknown>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && `${value}` !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";

  return request<T>(context, `${path}${suffix}`);
}

function post<T>(context: IntelligenceContext, path: string, body: Record<string, unknown> = {}) {
  return request<T>(context, path, {
    method: "POST",
    body: JSON.stringify({ ...body, meta: buildMeta(context) }),
  });
}

// ---- Ask — the conversational front door -----------------------------------

/**
 * Ask a question.
 *
 * This is the only call that runs the whole architecture from a sentence, and the
 * only one that reports which of the twelve lifecycle stages ran. Everything the
 * console renders comes from this one response — including the approve and reject
 * buttons, which are just the next question with its subject pinned.
 *
 * `payload` exists so a button lands on the record the user was looking at rather
 * than on whatever was most recently mentioned. The sentence still drives the
 * intent; the payload only removes ambiguity about which record it applies to.
 *
 * `module` and `route` say where the question was asked from. Both are hints and
 * neither is required: the backend treats a declared module as authoritative and a
 * route as strong evidence, and falls back to reading the words. Sending them
 * matters because the module decides which tools the turn may select and how far
 * down the ladder it can go — a fees question asked on the fees screen should not
 * have to say the word "fees" to be routed there.
 */
export function ask(
  context: IntelligenceContext,
  question: string,
  options: {
    conversationId?: number | null;
    payload?: Partial<
      Record<"case_id" | "student_id" | "recommendation_id" | "workflow_approval_id", number>
    >;
    limit?: number;
    module?: string | null;
    route?: string | null;
  } = {}
) {
  return post<AskResult>(context, "/ask", {
    question,
    conversation_id: options.conversationId ?? null,
    payload: options.payload ?? {},
    limit: options.limit,
    module: options.module ?? null,
    route:
      options.route ??
      (typeof window === "undefined" ? null : window.location.pathname),
  });
}

/**
 * Which modules the lifecycle serves, and how deep each one goes.
 *
 * Every module reports all twelve stages. This says which of them can reach stage 10
 * and beyond, and names what is missing for the ones that cannot — so a panel can
 * tell a user "this module answers from real data but opens no cases" rather than
 * silently rendering a shorter ladder.
 */
export function listLifecycleModules(context: IntelligenceContext) {
  return get<{
    pipeline: string;
    stages: Array<{
      key: string;
      order: number;
      layer: string;
      component: string;
      surface: string;
    }>;
    modules: LifecycleModule[];
  }>(context, "/ask/modules");
}

/**
 * Classification only — nothing runs and nothing is written.
 *
 * Use this to check that a rephrasing still lands on the intent you expect without
 * starting an analysis to find out.
 */
export function interpretQuestion(
  context: IntelligenceContext,
  question: string,
  memory?: Record<string, unknown>
) {
  return post<{ intent: AskIntent }>(context, "/ask/interpret", { question, memory });
}

/** The questions this module understands, for the console's starter chips. */
export function listIntents(context: IntelligenceContext) {
  return get<{ intents: Array<{ key: string; label: string; description: string; requires: string[] }> }>(
    context,
    "/ask/intents"
  );
}

/** The thread, oldest turn first — what the console renders on reload. */
export function getConversation(context: IntelligenceContext, conversationId: number) {
  return get<ConversationTranscript>(context, `/conversations/${conversationId}`);
}

// ---- Signals, cases, evidence ---------------------------------------------

export function listSignals(
  context: IntelligenceContext,
  options: { signalKey?: string; minSeverity?: string; limit?: number } = {}
) {
  return get<{ signals: SignalRecord[] }>(context, "/signals", {
    signal_key: options.signalKey,
    min_severity: options.minSeverity,
    limit: options.limit,
  });
}

export function listCases(
  context: IntelligenceContext,
  options: { caseType?: string; status?: string; minSeverity?: string; limit?: number } = {}
) {
  return get<{ cases: CaseRecord[] }>(context, "/cases", {
    case_type: options.caseType,
    status: options.status,
    min_severity: options.minSeverity,
    limit: options.limit,
  });
}

/** The whole chain for one case in a single request. */
export function getCase(context: IntelligenceContext, caseId: number) {
  return get<CaseDetail>(context, `/cases/${caseId}`);
}

export function getCaseEvidence(context: IntelligenceContext, caseId: number) {
  return get<{ evidence: CaseDetail["evidence"] }>(context, `/cases/${caseId}/evidence`);
}

export function getCaseExplanation(
  context: IntelligenceContext,
  caseId: number,
  audience = "teacher",
  includeHistory = false
) {
  return get<{ explanation: CaseDetail["explanation"]; history: CaseDetail["explanation"][] | null }>(
    context,
    `/cases/${caseId}/explanation`,
    { audience, include_history: includeHistory ? 1 : undefined }
  );
}

export function updateCaseStatus(context: IntelligenceContext, caseId: number, status: string) {
  return post<{ case: CaseRecord }>(context, `/cases/${caseId}/status`, { status });
}

/** Everything the intelligence layer knows about one record. */
export function getSubjectIntelligence(
  context: IntelligenceContext,
  entity: string,
  id: number,
  status?: string
) {
  return get<SubjectIntelligence>(context, `/subjects/${entity}/${id}`, { status });
}

// ---- Recommendations and the approval gate --------------------------------

export function listPendingRecommendations(context: IntelligenceContext, limit = 50) {
  return get<{ recommendations: RecommendationRecord[] }>(context, "/recommendations/pending", {
    limit,
  });
}

export function getRecommendation(context: IntelligenceContext, id: number) {
  return get<{ recommendation: RecommendationRecord; decisions: unknown[] }>(
    context,
    `/recommendations/${id}`
  );
}

/**
 * Approve a recommendation. This records the decision and, when the recommendation
 * names a workflow, starts it — but it does not itself execute anything.
 */
export function approveRecommendation(
  context: IntelligenceContext,
  id: number,
  options: {
    reason?: string;
    modifications?: Record<string, unknown>;
    decidedByName?: string;
    startWorkflow?: boolean;
  } = {}
) {
  return post<{
    decision: DecisionResult;
    recommendation: RecommendationRecord;
    workflow: WorkflowRunSummary | null;
  }>(context, `/recommendations/${id}/approve`, {
    reason: options.reason,
    modifications: options.modifications,
    decided_by_name: options.decidedByName,
    start_workflow: options.startWorkflow ?? true,
  });
}

export function rejectRecommendation(
  context: IntelligenceContext,
  id: number,
  reason?: string,
  decidedByName?: string
) {
  return post<{ decision: DecisionResult; recommendation: RecommendationRecord }>(
    context,
    `/recommendations/${id}/reject`,
    { reason, decided_by_name: decidedByName }
  );
}

export function deferRecommendation(context: IntelligenceContext, id: number, reason?: string) {
  return post<{ decision: DecisionResult }>(context, `/recommendations/${id}/defer`, { reason });
}

// ---- Agents ----------------------------------------------------------------

export function listAgents(context: IntelligenceContext, domain?: string) {
  return get<{ agents: Array<Record<string, unknown>> }>(context, "/agents", { domain });
}

export function runAgent(
  context: IntelligenceContext,
  agentKey: string,
  input: { subject_id?: number; student_ids?: number[]; limit?: number } = {}
) {
  return post<AgentRunResult>(context, `/agents/${agentKey}/run`, input);
}

export function listAgentRuns(context: IntelligenceContext, agentKey?: string, limit = 50) {
  return get<{ runs: Array<Record<string, unknown>> }>(context, "/agent-runs", {
    agent_key: agentKey,
    limit,
  });
}

// ---- Workflows -------------------------------------------------------------

export function listWorkflows(context: IntelligenceContext) {
  return get<{ workflows: Array<Record<string, unknown>> }>(context, "/workflows");
}

export function getWorkflowRun(context: IntelligenceContext, runId: number) {
  return get<{ run: Record<string, unknown> }>(context, `/workflow-runs/${runId}`);
}

export function listWorkflowRuns(
  context: IntelligenceContext,
  options: { status?: string; workflowKey?: string; limit?: number } = {}
) {
  return get<{ runs: Array<Record<string, unknown>> }>(context, "/workflow-runs", {
    status: options.status,
    workflow_key: options.workflowKey,
    limit: options.limit,
  });
}

export function listPendingApprovals(context: IntelligenceContext, limit = 50) {
  return get<{ approvals: PendingApproval[] }>(context, "/approvals/pending", { limit });
}

export function resolveApproval(
  context: IntelligenceContext,
  approvalId: number,
  decision: "approved" | "rejected",
  comment?: string
) {
  return post<WorkflowRunSummary>(context, `/approvals/${approvalId}/resolve`, {
    decision,
    comment,
  });
}

// ---- Ontology and Knowledge Graph -----------------------------------------

export function listOntologyEntities(context: IntelligenceContext, domain?: string) {
  return get<{ entities: OntologyEntity[] }>(context, "/ontology/entities", { domain });
}

export function listOntologyRelationships(context: IntelligenceContext, from?: string) {
  return get<{ relationships: OntologyRelationship[] }>(context, "/ontology/relationships", {
    from,
  });
}

export function resolveEntity(
  context: IntelligenceContext,
  entity: string,
  search?: string,
  limit = 25
) {
  return post<{ entity: string; results: Array<Record<string, unknown>> }>(
    context,
    "/ontology/resolve",
    { entity, search, limit }
  );
}

export function candidateEntities(context: IntelligenceContext, text: string) {
  return post<{ candidates: Array<{ entity: string; label: string; score: number }> }>(
    context,
    "/ontology/candidates",
    { text }
  );
}

/** Walk the graph — the query behind "why is this student at risk?". */
export function queryKnowledgeGraph(
  context: IntelligenceContext,
  spec: {
    entity: string;
    id: number | string;
    path?: string[];
    relations?: string[];
    max_depth?: number;
    limit?: number;
    prefer_graph?: boolean;
  }
) {
  return post<GraphTraversal>(context, "/knowledge-graph/query", spec);
}

export function availableRelations(context: IntelligenceContext, entity: string) {
  return get<{ entity: string; relations: Array<Record<string, unknown>> }>(
    context,
    `/knowledge-graph/relations/${entity}`
  );
}

// ---- Generation ------------------------------------------------------------

export function listTemplates(context: IntelligenceContext, category?: string) {
  return get<{ templates: Array<Record<string, unknown>> }>(context, "/templates", { category });
}

export function generate(
  context: IntelligenceContext,
  input: {
    template_key: string;
    purpose: string;
    variables?: Record<string, unknown>;
    domain?: string;
    subject_entity_key?: string;
    subject_id?: number;
    case_id?: number;
  }
) {
  return post<GenerationOutcome>(context, "/generate", input);
}

export function reviewGeneratedOutput(
  context: IntelligenceContext,
  outputId: number,
  status: "accepted" | "edited" | "rejected",
  note?: string
) {
  return post<null>(context, `/generated-outputs/${outputId}/review`, { status, note });
}

// ---- Outcomes and audit ----------------------------------------------------

export function listOutcomes(context: IntelligenceContext, status?: string, limit = 50) {
  return get<{ outcomes: CaseDetail["outcomes"] }>(context, "/outcomes", { status, limit });
}

export function measureDueOutcomes(context: IntelligenceContext) {
  return post<{
    measured: number;
    improved: number;
    worsened: number;
    unchanged: number;
    inconclusive: number;
  }>(context, "/outcomes/measure-due");
}

export function outcomeEffectiveness(context: IntelligenceContext, caseType?: string) {
  return get<{ by_action_type: Record<string, unknown> }>(context, "/outcomes/effectiveness", {
    case_type: caseType,
  });
}

export function listAuditLogs(
  context: IntelligenceContext,
  options: { eventType?: string; outcome?: string; subjectId?: number; limit?: number } = {}
) {
  return get<{ logs: Array<Record<string, unknown>> }>(context, "/audit-logs", {
    event_type: options.eventType,
    outcome: options.outcome,
    subject_id: options.subjectId,
    limit: options.limit,
  });
}
