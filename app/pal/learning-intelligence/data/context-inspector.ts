'use client';

/**
 * Context Graph Inspector's single read — EsoEngineController::
 * contextInspector() on the backend, which composes conceptMasteryDetails(),
 * chapterKnowledgeMap() and the persisted decision-log rows in one round
 * trip rather than four. Follows the same local-fetch-helper convention
 * every other PAL data module uses (see pal-eso.ts's esoFetch) rather than
 * a shared wrapper.
 */

import { buildSessionContext } from '@/lib/erp-client';
import {
  parseConceptMasteryDetails,
  parseKnowledgeMap,
  mapAction,
  type ConceptMasteryDetails,
  type KnowledgeMap,
  type EsoAction,
} from '@/app/pal/data/pal-eso';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  const record = toRecord(payload);

  if (!response.ok) {
    const serverMessage = readString(record.message);
    if (response.status === 401) throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    if (response.status === 403) throw new Error(serverMessage || 'You are not allowed to view this learner\'s data.');
    if (response.status === 404) throw new Error(serverMessage || 'Unknown learner or concept.');
    throw new Error(serverMessage || 'This feature is not available right now. Please try again later.');
  }

  if (record.success === false) {
    throw new Error(readString(record.message) || 'Context Inspector request failed.');
  }

  return 'data' in record ? record.data : payload;
}

export interface DecisionLogEntry {
  id: number;
  nodeId: number | null;
  ruleFired: string;
  action: string;
  llmInstruction: string | null;
  stateSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

function mapDecisionLogEntry(raw: unknown): DecisionLogEntry {
  const r = toRecord(raw);
  return {
    id: num(r.id),
    nodeId: numOrNull(r.node_id),
    ruleFired: readString(r.rule_fired),
    action: readString(r.action),
    llmInstruction: r.llm_instruction == null ? null : readString(r.llm_instruction),
    stateSnapshot: r.state_snapshot == null ? null : toRecord(r.state_snapshot),
    createdAt: readString(r.created_at),
  };
}

export interface ContextInspectorData {
  concept: { id: number; name: string; chapterId: number };
  masteryDetails: ConceptMasteryDetails | null;
  knowledgeMap: KnowledgeMap | null;
  decisionLog: DecisionLogEntry[];
  latestDecision: DecisionLogEntry | null;
  /** Only populated when the viewer is the enrolled student themselves — see the backend method's own docblock. */
  liveNextAction: EsoAction | null;
}

export async function fetchContextInspector(learnerId: string, conceptId: number, signal?: AbortSignal): Promise<ContextInspectorData> {
  const data = toRecord(await fetchJson(`api/pal/eso/context-inspector/${learnerId}/${conceptId}`, signal));
  const concept = toRecord(data.concept);
  const decisionLog = Array.isArray(data.decision_log) ? data.decision_log.map(mapDecisionLogEntry) : [];

  return {
    concept: { id: num(concept.id), name: readString(concept.name), chapterId: num(concept.chapter_id) },
    masteryDetails: data.mastery_details == null ? null : parseConceptMasteryDetails(toRecord(data.mastery_details)),
    knowledgeMap: data.knowledge_map == null ? null : parseKnowledgeMap(toRecord(data.knowledge_map)),
    decisionLog,
    latestDecision: data.latest_decision == null ? null : mapDecisionLogEntry(data.latest_decision),
    liveNextAction: data.live_next_action == null ? null : mapAction(data.live_next_action),
  };
}

export interface UnifiedLearnerContextGraph {
  available: boolean;
  learner_id: number;
  user_context: {
    learner_id: number;
    name: string;
    admission_no: string;
    gender: string;
    sub_institute_id: number;
    institute_name: string;
    standard_id: number | null;
    standard_name: string;
    division_id: number | null;
    division_name: string;
    roll_no: string | null;
    syear: number | null;
    enrolled_subjects: Array<{ id: number; name: string }>;
    primary_subject_id: number | null;
  };
  learning_activities: {
    recent_diagnostics: Array<{ id: number; chapter_id: number; score: number; total_questions: number; status: string; attempted_at: string }>;
    recent_practice: Array<{ id: number; concept_id: number; accuracy: number; duration_seconds: number; practiced_at: string }>;
    total_engagement_events: number;
  };
  knowledge_graph: {
    available: boolean;
    standard_id?: number;
    subject_id?: number;
    nodes: any[];
    edges: any[];
    chapters?: any[];
    stats?: any;
    root_blockers: Array<{ id: number; name: string; mastery: number; gate: number; depth: number }>;
  };
  historical_context: {
    recent_competencies: Array<{ concept_id: number; mastery_score: number; confidence_score: number; attempts: number; last_updated: string }>;
    recent_engine_decisions: Array<{ id: number; concept_id: number; rule_fired: string; action: string; decided_at: string }>;
    recent_recommendations: Array<{ id: number; concept_id: number; pedagogy_type: string; rule: string; reason: string; recommended_at: string }>;
  };
  next_best_action: any | null;
  assembled_at: string;
}

export async function fetchUnifiedContextGraph(
  learnerId: string | number,
  subjectId?: number,
  signal?: AbortSignal
): Promise<UnifiedLearnerContextGraph> {
  const query = subjectId ? `?subject_id=${subjectId}` : '';
  const res = await fetchJson(`api/pal/context-graph/${learnerId}${query}`, signal);
  return toRecord(res) as unknown as UnifiedLearnerContextGraph;
}

