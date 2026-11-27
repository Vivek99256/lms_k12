import { readGraphSession } from '@/app/_components/graph/graph-session';
import { resolveAiBaseUrl } from '@/app/components/utils/api_url';

/**
 * Client for the Teach/Learn "PAL Recommendation Intelligence" panel.
 *
 * Deliberately a small local client, same reasoning as
 * `fees-recommendation-api.ts`: this reads `PalRecommendationIntelligenceController`
 * (Neo4j coherence map + SQL predictive signals + the generic recommendation/agent
 * registries), not the SQL-based Brain contract — kept isolated so neither can
 * accidentally start sharing a code path with this one. PAL is NOT
 * academic-year-scoped, unlike Fees, so nothing here takes or sends a `syear`.
 */

export interface PalRecommendationCard {
  id: string;
  title: string;
  category: string;
  severity: string;
  available: boolean;
  reason: string | null;
  priority: 'Major' | 'Medium' | 'Minor';
  priority_reason: string;
  evidence: Record<string, unknown>;
}

export interface PalEvidenceRecord {
  id: number;
  summary: string | null;
  source: string | null;
  verified: boolean;
  is_generated: boolean;
}

export interface PalTopPick {
  source: 'recommendation' | 'case' | 'coherence_recommender';
  governed: boolean;
  /** Only present when `governed` is false — e.g. "Real-time suggestion, not yet reviewed by a person." */
  label?: string;
  id: number | null;
  title: string;
  risk_level: string | null;
  confidence: number | null;
  evidence_ids: number[];
  evidence_records?: PalEvidenceRecord[];
  recommendation_id: number | null;
  workflow_key: string | null;
  requires_approval: boolean | null;
  status: string;
  subject_entity_key: string;
  subject_id: number | string;
  /** Only present when `source` is 'coherence_recommender'. */
  action?: string;
  why?: Record<string, unknown>;
  concept?: { id: number; name: string; chapter?: string | null; [k: string]: unknown } | null;
}

export interface PalAgentManifest {
  id: number;
  key: string;
  name: string;
  domain: string;
  agent_type: string;
  purpose: string;
  allowed_tools: string[];
  allowed_entities: string[];
  max_verb: string;
  may_execute_actions: boolean;
  authorized_workflow_keys: string[];
  min_confidence: number;
  min_evidence_count: number;
  allowed_roles: string[];
}

export interface PalPendingRecommendation {
  id: number;
  title: string;
  body: string | null;
  rationale: string | null;
  risk_level: string | null;
  confidence: number | null;
  /** 'draft' | 'pending_approval' — both are approvable via DecisionGate. */
  status: string;
  subject_entity_key: string;
  subject_id: number | string;
  evidence_count: number;
  created_at: string;
}

export interface PalRecommendationIntelligencePayload {
  generated_at: string;
  sub_institute_id: number;
  learner_id: number | null;
  standard_id: number | null;
  subject_id: number | null;
  capabilities: {
    cross_module: { available: boolean; reason: string | null; cards: PalRecommendationCard[] };
    graph_reasoning: { available: boolean; reason: string | null; cards: PalRecommendationCard[] };
    predictive: { available: boolean; reason: string | null; cards: PalRecommendationCard[] };
    recommendation: { available: boolean; reason: string | null; top_pick: PalTopPick | null };
    agentic: {
      available: boolean;
      reason: string | null;
      agent_state: PalAgentManifest[];
      pending_recommendations: PalPendingRecommendation[];
      execution_note: string;
    };
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('The recommendation API returned a non-JSON response.');
  }
}

function sessionHeaders(session: ReturnType<typeof readGraphSession>): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(session.instituteId != null && `${session.instituteId}`.trim()
      ? { 'X-MCP-Institute-Id': String(session.instituteId) }
      : {}),
  };
}

export async function fetchPalRecommendationIntelligence(params?: {
  learnerId?: number;
  standardId?: number;
  subjectId?: number;
}): Promise<PalRecommendationIntelligencePayload> {
  const session = readGraphSession();
  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error('The intelligence API base URL is not configured.');
  }

  const query = new URLSearchParams();
  if (params?.learnerId != null) query.set('learner_id', String(params.learnerId));
  if (params?.standardId != null) query.set('standard_id', String(params.standardId));
  if (params?.subjectId != null) query.set('subject_id', String(params.subjectId));
  const qs = query.toString();

  const response = await fetch(`${baseUrl}/api/ai/pal/recommendation-intelligence${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
    headers: sessionHeaders(session),
  });

  const payload = (await readJson(response)) as {
    success?: boolean;
    message?: string;
    data?: PalRecommendationIntelligencePayload;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'The PAL recommendation intelligence request failed.');
  }

  if (!payload.data) {
    throw new Error('The PAL recommendation intelligence request returned no data.');
  }

  return payload.data;
}

/* --------------------------------------------------- decisions and agent runs */

/**
 * `/api/ai/recommendations/{id}/*` (approve/reject/defer) and
 * `/api/ai/agents/{key}/run` — the existing generic decision and agent-run
 * endpoints, already live and used elsewhere in this app. One POST helper
 * covers all four: same envelope, same session/header resolution, and none
 * of the four need anything back beyond "did it work".
 */
async function postPal(path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const session = readGraphSession();
  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error('The intelligence API base URL is not configured.');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...sessionHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await readJson(response)) as {
    success?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'The request failed.');
  }

  return payload.data ?? {};
}

export function approvePalRecommendation(id: number, reason?: string) {
  return postPal(`/api/ai/recommendations/${id}/approve`, reason ? { reason } : {});
}

export function rejectPalRecommendation(id: number, reason?: string) {
  return postPal(`/api/ai/recommendations/${id}/reject`, reason ? { reason } : {});
}

export function deferPalRecommendation(id: number, reason?: string) {
  return postPal(`/api/ai/recommendations/${id}/defer`, reason ? { reason } : {});
}

/** PAL has no bespoke scheduler service — a manual "Run now" per agent, same route the AI Stack console uses. */
export function runPalAgent(agentKey: string) {
  return postPal(`/api/ai/agents/${agentKey}/run`, {});
}

/* ------------------------------------------------------------- display adapter */

export interface PalRecommendationDisplayCard {
  id: string;
  title: string;
  category: string;
  severity: string;
  available: boolean;
  reason: string | null;
  priority: 'Major' | 'Medium' | 'Minor';
  priorityReason: string;
  description: string | null;
  impactLine: string | null;
  evidencePoints: Array<{ label: string; value: string; note?: string | null }>;
  listItems: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  cross_module: 'Cross-module',
  graph_reasoning: 'Graph reasoning',
  predictive: 'Predictive',
};

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('en-IN').format(value);
  return String(value);
}

/** Turns a snake_case signal key (e.g. "engagement_score") into a readable label ("Engagement score"). */
function labelFromKey(key: string): string {
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turns one backend card into display-ready copy, per card id. Each id has a
 * different evidence shape (see `PalCrossModuleInsightEngine`,
 * `PalGraphReasoningEngine`, `PalPredictiveInsightReader`), so this is
 * intentionally a switch rather than one generic formatter — mirrors Fees'
 * own `toDisplayCard`, with `priority`/`priorityReason` passed through
 * untouched since every PAL card already carries its own.
 */
export function toDisplayCard(card: PalRecommendationCard): PalRecommendationDisplayCard {
  const evidence = card.evidence ?? {};
  const description = typeof evidence.description === 'string'
    ? evidence.description
    : typeof evidence.why === 'string'
      ? evidence.why
      : null;
  const impactLine = typeof evidence.expected_impact === 'string' ? evidence.expected_impact : null;

  const evidencePoints: PalRecommendationDisplayCard['evidencePoints'] = [];
  const listItems: string[] = [];

  const base = {
    id: card.id,
    title: card.title,
    category: CATEGORY_LABELS[card.category] ?? card.category,
    severity: card.severity,
    available: card.available,
    reason: card.reason,
    priority: card.priority,
    priorityReason: card.priority_reason,
    description,
    impactLine,
  };

  // Predictive cards carry a per-student dynamic id (`pal.predictive.student.<id>`),
  // so this is a prefix check rather than a switch case alongside the fixed ids below.
  if (card.id.startsWith('pal.predictive.student.')) {
    if (evidence.score !== undefined) {
      evidencePoints.push({ label: 'Risk score', value: fmt(evidence.score) });
    }
    if (evidence.distinct_chapters !== undefined) {
      evidencePoints.push({ label: 'Distinct chapters affected', value: fmt(evidence.distinct_chapters) });
    }
    if (evidence.root_blocker_count !== undefined) {
      evidencePoints.push({ label: 'Root blockers', value: fmt(evidence.root_blocker_count) });
    }
    if (evidence.confidence !== undefined) {
      evidencePoints.push({ label: 'Confidence', value: fmt(evidence.confidence) });
    }
    if (evidence.detected_at !== undefined) {
      evidencePoints.push({ label: 'Detected', value: fmt(evidence.detected_at) });
    }
    const recommendation = evidence.recommendation as { title?: string; status?: string } | null | undefined;
    if (recommendation?.title) {
      listItems.push(`Recommendation drafted: "${recommendation.title}" (${recommendation.status ?? 'pending'})`);
    }
    const evidenceRecords = Array.isArray(evidence.evidence_records)
      ? (evidence.evidence_records as Array<{ summary?: string | null }>)
      : [];
    for (const record of evidenceRecords) {
      if (record.summary) listItems.push(`Evidence: ${record.summary}`);
    }

    return { ...base, evidencePoints, listItems };
  }

  switch (card.id) {
    case 'pal.cross_module.attendance':
      if (evidence.weak_sampled !== undefined) {
        evidencePoints.push(
          { label: 'Weak-mastery students', value: fmt(evidence.weak_sampled) },
          { label: 'With attendance data', value: fmt(evidence.attendance_checked) },
          { label: 'Low attendance (≥20% absent)', value: fmt(evidence.weak_with_low_attendance) },
        );
      }
      break;

    case 'pal.cross_module.admissions':
      if (evidence.mobile_matchable !== undefined) {
        evidencePoints.push(
          { label: 'Weak-mastery students, mobile on file', value: fmt(evidence.mobile_matchable) },
          { label: 'Sharing a number with an open enquiry', value: fmt(evidence.weak_with_open_enquiry) },
        );
      }
      break;

    // Reused verbatim from the Fees side (FeesGraphRecommendationEngine) —
    // same evidence shape as Fees' own 'fees.academic_correlation' case.
    case 'fees.academic_correlation': {
      if (evidence.enrolled_total !== undefined) {
        evidencePoints.push(
          { label: 'Enrolled', value: fmt(evidence.enrolled_total) },
          { label: 'Paying', value: fmt(evidence.paying_total) },
          { label: 'Fee gap', value: fmt(evidence.gap_total) },
        );
      }
      if (evidence.gap_sampled !== undefined) {
        const sampled = Number(evidence.gap_sampled) || 0;
        const withEngagement = Number(evidence.gap_with_engagement) || 0;
        const withMastery = Number(evidence.gap_with_mastery_signal) || 0;
        evidencePoints.push(
          { label: 'Checked for signal', value: fmt(sampled) },
          { label: 'No engagement signal', value: fmt(sampled - withEngagement) },
          { label: 'No mastery signal', value: fmt(sampled - withMastery) },
        );
      }
      break;
    }

    case 'pal.graph_reasoning.health': {
      if (evidence.concepts !== undefined) {
        evidencePoints.push(
          { label: 'Concepts', value: fmt(evidence.concepts) },
          { label: 'Roots', value: fmt(evidence.roots) },
          { label: 'Without content', value: fmt(evidence.without_content) },
          { label: 'Without questions', value: fmt(evidence.without_questions) },
          { label: 'Acyclic', value: fmt(evidence.acyclic) },
          { label: 'Edges', value: fmt(evidence.edges) },
          { label: 'Max depth', value: fmt(evidence.max_depth) },
        );
      }
      const cycles = Array.isArray(evidence.cycles)
        ? (evidence.cycles as Array<{ id: number; name: string }>)
        : [];
      for (const cycle of cycles.slice(0, 8)) {
        listItems.push(`Cycle-involved concept: ${cycle.name || `Concept ${cycle.id}`}`);
      }
      if (cycles.length > 8) listItems.push(`+${cycles.length - 8} more`);
      break;
    }

    case 'pal.graph_reasoning.next_best_action': {
      const why = (evidence.why ?? {}) as Record<string, unknown>;
      if (why.depth !== undefined) {
        evidencePoints.push({ label: 'Hops', value: fmt(why.depth) });
      } else if (evidence.hops !== undefined) {
        evidencePoints.push({ label: 'Hops', value: fmt(evidence.hops) });
      }
      if (why.mastery !== undefined) {
        evidencePoints.push({ label: 'Mastery', value: fmt(why.mastery) });
      }
      if (why.gate !== undefined) {
        evidencePoints.push({ label: 'Gate', value: fmt(why.gate) });
      }
      if (typeof why.because === 'string') {
        listItems.push(why.because);
      }
      const connectedEntities = Array.isArray(evidence.connected_entities)
        ? (evidence.connected_entities as Array<{ name?: string; mastery?: number | null }>)
        : [];
      for (const entity of connectedEntities) {
        if (entity?.name) {
          listItems.push(
            `Prerequisite: ${entity.name}${entity.mastery != null ? ` (mastery ${fmt(entity.mastery)})` : ''}`,
          );
        }
      }
      const ragContext = evidence.rag_context as { assessing_questions?: unknown[] } | null | undefined;
      if (Array.isArray(ragContext?.assessing_questions)) {
        listItems.push(`${ragContext.assessing_questions.length} assessing question(s) available for this concept.`);
      }
      break;
    }

    case 'pal.predictive.disengagement':
    case 'pal.predictive.failure':
    case 'pal.predictive.burnout': {
      if (evidence.risk_score !== undefined && evidence.risk_score !== null) {
        evidencePoints.push({ label: 'Risk score', value: fmt(evidence.risk_score) });
      }
      if (typeof evidence.trigger_intervention === 'boolean') {
        evidencePoints.push({ label: 'Trigger intervention', value: fmt(evidence.trigger_intervention) });
      }
      const signals = evidence.signals && typeof evidence.signals === 'object'
        ? (evidence.signals as Record<string, number>)
        : {};
      for (const [key, value] of Object.entries(signals)) {
        evidencePoints.push({ label: labelFromKey(key), value: fmt(value) });
      }
      const recommendedActions = Array.isArray(evidence.recommended_actions)
        ? (evidence.recommended_actions as string[])
        : [];
      for (const action of recommendedActions) {
        listItems.push(action);
      }
      break;
    }

    default:
      break;
  }

  return { ...base, evidencePoints, listItems };
}
