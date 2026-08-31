/**
 * Shapes returned by the shared intelligence API (`/api/ai/**`).
 *
 * These mirror the PHP side's response envelope and hydrators. They are hand-written
 * rather than generated because the two repos have no shared build; when the backend
 * changes a hydrator, this file is the other half of that change.
 */

export type Severity = "low" | "moderate" | "high" | "critical";

export type CaseStatus =
  | "open"
  | "analysing"
  | "awaiting_decision"
  | "approved"
  | "rejected"
  | "in_progress"
  | "closed"
  | "dismissed";

export type RecommendationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "superseded"
  | "expired"
  | "executed";

export type OutcomeStatus =
  | "pending"
  | "measuring"
  | "improved"
  | "unchanged"
  | "worsened"
  | "inconclusive";

export interface AiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
}

export interface EvidenceRecord {
  id: number;
  kind: string;
  summary: string;
  subject_entity_key: string;
  subject_id: number | string;
  source: {
    table: string | null;
    id: number | string | null;
    service: string | null;
  };
  observed_at: string | null;
  value: unknown;
  numeric_value: number | null;
  unit: string | null;
  confidence: number | null;
  /** Model output. Never citable as fact until verified. */
  is_generated: boolean;
  /** Only verified evidence may back a claim. */
  verified: boolean;
  role?: string;
  weight?: number;
}

export interface SignalRecord {
  id: number;
  signal_key: string;
  domain: string;
  subject_entity_key: string;
  subject_id: number | string;
  subject_label: string | null;
  score: number | null;
  severity: Severity;
  confidence: number | null;
  components: Record<string, unknown>;
  status: string;
  detected_at: string | null;
  resolved_at: string | null;
}

export interface GroundedClaim {
  claim: string;
  evidence_ids: number[];
  confidence?: number | null;
}

export interface ExplanationRecord {
  id: number;
  case_id: number;
  audience: string;
  narrative: string;
  claims: GroundedClaim[];
  is_generated: boolean;
  governance_passed: boolean;
  governance_report: GovernanceReport | null;
  generated_by_model: string | null;
  created_at: string | null;
}

export interface GovernanceReport {
  passed: boolean;
  verb: string | null;
  violations: Array<{ rule: string; message: string; context?: Record<string, unknown> }>;
  warnings: Array<{ rule: string; message: string }>;
  passed_rules: string[];
  checked_at: string;
}

export interface EsoBinding {
  objective?: string;
  strategy?: string;
  outcome?: {
    metric_key?: string;
    metric_label?: string;
    direction?: "increase" | "decrease" | "maintain";
    horizon_days?: number;
    target_value?: number | null;
  };
}

export interface RecommendationRecord {
  id: number;
  reference: string;
  case_id: number | null;
  explanation_id: number | null;
  domain: string;
  action_type: string;
  title: string;
  body: string | null;
  rationale: string | null;
  subject_entity_key: string;
  subject_id: number | string;
  confidence: number | null;
  risk_level: "low" | "medium" | "high";
  is_consequential: boolean;
  requires_approval: boolean;
  evidence_ids: number[];
  eso_binding: EsoBinding | null;
  governance_passed: boolean;
  governance_report: GovernanceReport | null;
  workflow_key: string | null;
  workflow_payload: Record<string, unknown> | null;
  status: RecommendationStatus;
  expires_at: string | null;
  created_at: string | null;
}

export interface HypothesisRecord {
  id: number;
  statement: string;
  rationale: string | null;
  confidence: number | null;
  status: "proposed" | "supported" | "refuted" | "inconclusive";
}

export interface CaseRecord {
  id: number;
  reference: string;
  case_type: string;
  domain: string;
  title: string;
  summary: string | null;
  subject_entity_key: string;
  subject_id: number | string;
  subject_label: string | null;
  severity: Severity;
  priority_score: number | null;
  status: CaseStatus;
  opened_at: string | null;
  closed_at: string | null;
  context: Record<string, unknown>;
}

export interface OutcomeRecord {
  id: number;
  case_id: number | null;
  recommendation_id: number | null;
  metric_key: string;
  metric_label: string | null;
  baseline_value: number | null;
  baseline_at: string | null;
  target_value: number | null;
  observed_value: number | null;
  observed_at: string | null;
  delta: number | null;
  status: OutcomeStatus;
  measure_after: string | null;
  detail: Record<string, unknown> | null;
}

export interface CaseDetail {
  case: CaseRecord;
  evidence: EvidenceRecord[];
  explanation: ExplanationRecord | null;
  recommendations: RecommendationRecord[];
  hypotheses: HypothesisRecord[];
  outcomes: OutcomeRecord[];
}

export interface SubjectIntelligence {
  entity: string;
  id: number;
  cases: CaseRecord[];
  signals: SignalRecord[];
  evidence: EvidenceRecord[];
  outcomes: OutcomeRecord[];
}

export interface DecisionResult {
  decision_id: number;
  recommendation_id: number;
  outcome_id: number | null;
}

export interface WorkflowRunSummary {
  run_id: number | null;
  status: string;
  message: string;
  current_step: string | null;
}

export interface AgentRunResult {
  run_id: number | null;
  status: "queued" | "running" | "completed" | "failed" | "rejected" | "timed_out" | "cancelled";
  summary: string;
  result: {
    students_at_risk?: number;
    signals_detected?: number;
    confidence?: number;
    message?: string;
    cases?: AgentCaseFinding[];
  };
  counters: {
    signals_detected: number;
    evidence_collected: number;
    cases_opened: number;
    recommendations_drafted: number;
  };
  error: string | null;
}

export interface AgentCaseFinding {
  case_id: number;
  student_id: number;
  student_name: string;
  severity: Severity;
  priority_score: number;
  placement: {
    standard_name: string | null;
    division_name: string | null;
  } | null;
  signals: Array<{
    signal_key: string;
    score: number;
    severity: Severity;
    headline: string;
    evidence_count: number;
  }>;
  /** What the agent inferred from the signals, not just what it measured. */
  hypotheses?: Array<{
    statement: string;
    rationale: string | null;
    confidence: number | null;
  }>;
  explanation: {
    narrative: string;
    governance_passed: boolean;
    reason_refused: string | null;
  };
  recommendation: {
    id: number | null;
    status: RecommendationStatus;
    governance_passed: boolean;
    reason_refused: string | null;
    title: string;
    requires_approval: boolean;
  } | null;
}

export interface GraphNodeRecord {
  entity: string;
  id: number | string | null;
  label: string;
  attributes: Record<string, unknown>;
  via: string | null;
  depth: number;
  /** Which store answered — the graph, or the relational fallback. */
  source: "sql" | "graph";
}

export interface GraphTraversal {
  start: GraphNodeRecord | null;
  nodes: GraphNodeRecord[];
  edges: Array<{
    from: string;
    to: string;
    relation: string;
    relationship_key: string;
    source: "sql" | "graph";
  }>;
  truncated: boolean;
  sources: { sql: number; graph: number };
}

export interface OntologyEntity {
  key: string;
  label: string;
  domain: string;
  category: string;
  description: string | null;
  source_table: string | null;
  is_virtual: boolean;
  is_tenant_scoped: boolean;
  queryable: boolean;
  attributes: Array<Record<string, unknown>>;
}

export interface OntologyRelationship {
  key: string;
  from: string;
  relation: string;
  to: string;
  cardinality: string;
  description: string | null;
  sql_traversable: boolean;
  graph_traversable: boolean;
  graph_relationship_type: string | null;
  traversal_cost: number;
}

export interface GenerationOutcome {
  succeeded: boolean;
  /** Always true. Generated content must stay distinguishable from fact. */
  is_generated: true;
  content: string | null;
  structured: Record<string, unknown> | null;
  request_id: number | null;
  output_id: number | null;
  provider: string | null;
  model: string | null;
  schema_valid: boolean;
  schema_errors: string[];
  safety_passed: boolean;
  requires_review: boolean;
  error: string | null;
  latency_ms: number | null;
}

export interface PendingApproval {
  id: number;
  run_id: number;
  workflow_key: string;
  step_key: string | null;
  approver_role: string | null;
  assigned_to: number | null;
  subject_entity_key: string | null;
  subject_id: number | string | null;
  recommendation_id: number | null;
  case_id: number | null;
  expires_at: string | null;
  created_at: string | null;
}

// ---- The conversational front door (`/ask`) ---------------------------------
//
// `/ask` is the only endpoint that runs the whole architecture from a sentence, and
// the only one that reports what each layer did. It returns two views of the same
// turn: `trace`, the fifteen-stage backend ladder used for diagnostics, and
// `lifecycle_trace`, the twelve-stage product lifecycle the console renders.

export type StageStatus = "ran" | "skipped" | "blocked" | "pending" | "not_reached";

/** One stage of the lifecycle, as it actually executed for one question. */
export interface TraceStage {
  key: string;
  order: number;
  layer: string;
  status: StageStatus;
  /** One plain sentence: what this stage did for this question. */
  summary: string;
  /** The class that genuinely does this work, so a reader can open it. */
  component: string;
  /** Where in the product a user sees the result of this stage. */
  surface: string;
  data: Record<string, unknown>;
  /** {table, ids} — the rows this stage wrote or read. */
  records: { table?: string; ids?: Array<number | string> } & Record<string, unknown>;
  /** {api, sql} — how to confirm by hand that this stage really ran. */
  verify: { api?: string; sql?: string } & Record<string, unknown>;
  duration_ms: number | null;
  /** Why a stage did not run. Present precisely when the summary cannot speak. */
  note: string | null;
}

/** One label/value pair, as AnswerComposer::keyValues emits them. */
export interface KeyValueItem {
  label: string;
  value: string;
}

/**
 * One evidence row, as AnswerComposer::evidence emits it.
 *
 * `source` is a **string** — "attendance_student #4821", or "computed" when the value
 * was derived rather than read. It is deliberately pre-formatted by the backend rather
 * than left as an object, because the provenance is the claim: a row that cannot name
 * where it came from is an assertion, and the backend is the layer that knows the
 * difference.
 */
export interface EvidenceItem {
  id: number | string | null;
  kind: string | null;
  summary: string;
  value: string | null;
  source: string;
  observed_at: string | null;
  verified: boolean;
  is_generated: boolean;
}

export type AnswerSection =
  | { type: "text"; title: string; body: string }
  | { type: "records"; title: string; items: Array<Record<string, unknown>> }
  | { type: "key_values"; title: string; items: KeyValueItem[] }
  | { type: "evidence"; title: string; items: EvidenceItem[] }
  | { type: "steps"; title: string; items: Array<Record<string, unknown>> }
  | { type: "comparison"; title: string; items: Array<Record<string, unknown>> };

/**
 * An offered action is the next question with its subject pinned — so a button and a
 * typed sentence go down the same code path and produce the same trace shape.
 */
export interface AnswerAction {
  key: string;
  label: string;
  intent: string;
  utterance: string;
  payload: Record<string, number>;
  style: string;
}

export interface AnswerPayload {
  headline: string;
  sections: AnswerSection[];
  actions: AnswerAction[];
  follow_ups: string[];
}

export interface AskIntent {
  key: string;
  label: string;
  confidence: number;
  slots: Record<string, unknown>;
  matched?: Record<string, unknown>;
  suggestions?: string[];
}

/**
 * A module the lifecycle serves, and how deep it goes.
 *
 * Every module reports all twelve stages. `reaches_recommendation` and
 * `reaches_action` say whether stages 10-12 can do anything for this module, and
 * `depth_reason` is the sentence to show when they cannot — "no agent owns the fees
 * domain yet" rather than a silent gap.
 */
export interface LifecycleModule {
  key: string;
  label: string;
  entity_key: string | null;
  capabilities: Partial<
    Record<"conversational" | "generative" | "agent" | "workflow" | "ontology", boolean>
  >;
  mcp_tools: string[];
  agent_key: string | null;
  workflow_key: string | null;
  case_type: string | null;
  reaches_recommendation: boolean;
  reaches_action: boolean;
  depth_reason?: string;
  /** How the backend decided this question belonged to this module. */
  resolved_by?: string;
}

export interface AskResult {
  conversation: {
    id: number | null;
    reference: string | null;
    turn_id: number | null;
    turn: number;
  };
  question: string;
  intent: AskIntent;
  answer: AnswerPayload;
  /**
   * The stage ladder.
   *
   * Under the standardised pipeline this is the same twelve stages as
   * `lifecycle_trace`. Turns answered by the previous pipeline carry its
   * fifteen-stage backend ladder here instead, which is why both keys exist and why
   * the console reads `lifecycle_trace`.
   */
  trace: TraceStage[];
  ladder: string[];
  stage_counts: Partial<Record<StageStatus, number>>;
  /** The twelve-stage product lifecycle: Conversational AI → Action. */
  lifecycle_trace: TraceStage[];
  lifecycle_stage_counts: Partial<Record<StageStatus, number>>;
  /** Which module answered, and how deep it was able to go. */
  module?: LifecycleModule;
  /** The highest stage number this turn reached. */
  depth_reached?: number;
  /** Which pipeline answered: "lifecycle_v2" or "ask_service_v1". */
  pipeline?: string;
  links: Record<string, unknown>;
  duration_ms: number;
}

export interface ConversationTurn {
  id: number;
  sequence: number;
  question: string;
  intent: { key: string; confidence: number | null; slots: Record<string, unknown> };
  answer: AnswerPayload;
  trace: TraceStage[];
  stage_counts: Partial<Record<StageStatus, number>>;
  lifecycle_trace: TraceStage[];
  lifecycle_stage_counts: Partial<Record<StageStatus, number>>;
  links: Record<string, number>;
  duration_ms: number | null;
  status: string;
  asked_at: string | null;
}

export interface ConversationTranscript {
  conversation: {
    id: number;
    reference: string;
    module_key: string;
    title: string | null;
    memory: Record<string, unknown>;
    turn_count: number;
    started_at: string | null;
    last_turn_at: string | null;
  } | null;
  turns: ConversationTurn[];
}
