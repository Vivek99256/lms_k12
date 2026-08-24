import {
  buildSessionContext,
  readNumber,
  readString,
} from '@/lib/erp-client';

/**
 * PAL V4 Intelligence API data layer.
 *
 * Mirrors the Laravel "PAL V4" engine (routes/pal_api.php -> PALAPIController).
 * These endpoints return the envelope `{ success: true, data: <payload> }` and
 * take path params (learnerId / conceptId / misconceptionId).
 *
 * AUTH: the `api/pal/*` routes are secured by the `pal.auth` middleware. Every
 * request must carry the signed-in user's JWT (sent as `Authorization: Bearer`
 * below) and is tenant/ownership scoped server-side: students may only read
 * their own learner record, staff/admins are scoped to their institute/client.
 *
 * NOTE: this engine reads the `pal_*` tables (separate from the legacy PAL quiz
 * tables). It requires the PAL V4 backend to be deployed with the corrected
 * controller namespace (App\Http\Controllers\api\PAL\PALAPIController).
 */

// --- helpers ---------------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => readString(item)).filter(Boolean);
  const single = readString(value);
  return single ? [single] : [];
}

/** Fetch a V4 endpoint and unwrap the `{success, data}` envelope. */
async function fetchV4Data(path: string, signal?: AbortSignal): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }

  if (!session.token) {
    throw new Error('Your session has expired. Please sign in again to view PAL intelligence.');
  }

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
    },
    signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = toRecord(payload);
    const serverMessage = readString(record.message);
    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to view this learner\'s PAL data.');
    }
    throw new Error(
      serverMessage ||
        `HTTP ${response.status}: the PAL V4 API is unavailable. Ensure the backend is deployed.`
    );
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'PAL V4 request failed.');
  }
  return 'data' in record ? record.data : payload;
}

/** Resolve the default learner id (the signed-in user). */
export function defaultLearnerId(): string {
  return buildSessionContext().userId;
}

// --- learner state ---------------------------------------------------------

export interface V4Misconception {
  id: number;
  pattern: string;
  severity: number;
}

export interface V4Competency {
  masteryScore: number;
  bloomLevel: number;
  knowledgeGaps: number;
  activeMisconceptions: V4Misconception[];
  learningVelocity: number;
  proficiencyTrend: string;
}

export interface V4Dimension {
  label: string;
  value: number;
  /** 0-100 for a bar; undefined => no bar. */
  percent?: number;
}

export interface V4LearnerState {
  competency: V4Competency;
  social: V4Dimension[];
  metacognition: V4Dimension[];
  contextual: {
    preferredDevice: string[];
    bandwidthQuality: string;
    languagePreference: string;
    ruralUrbanContext: string;
  };
  updatedAt: string;
}

function mapDimensions(
  record: Record<string, unknown>,
  fields: { key: string; label: string; percent?: boolean }[]
): V4Dimension[] {
  return fields.map((field) => ({
    label: field.label,
    value: readNumber(record[field.key]),
    percent: field.percent ? Math.min(100, Math.max(0, readNumber(record[field.key]))) : undefined,
  }));
}

export async function fetchLearnerState(
  learnerId: string,
  signal?: AbortSignal
): Promise<V4LearnerState> {
  const data = toRecord(await fetchV4Data(`api/pal/learner-state/${encodeURIComponent(learnerId)}`, signal));
  const competency = toRecord(data.competency);
  const social = toRecord(data.social);
  const metacognition = toRecord(data.metacognition);
  const contextual = toRecord(data.contextual);

  return {
    competency: {
      masteryScore: readNumber(competency.mastery_score),
      bloomLevel: readNumber(competency.bloom_level),
      knowledgeGaps: toArray(competency.knowledge_gaps).length,
      activeMisconceptions: toArray(competency.active_misconceptions).map((entry) => {
        const record = toRecord(entry);
        return {
          id: readNumber(record.id),
          pattern: readString(record.pattern),
          severity: readNumber(record.severity),
        };
      }),
      learningVelocity: readNumber(competency.learning_velocity),
      proficiencyTrend: readString(competency.proficiency_trend) || 'stable',
    },
    social: mapDimensions(social, [
      { key: 'peer_collaboration_count', label: 'Peer collaborations' },
      { key: 'classroom_participation', label: 'Classroom participation', percent: true },
      { key: 'discussion_interactions', label: 'Discussion interactions' },
      { key: 'group_activity_performance', label: 'Group performance', percent: true },
      { key: 'social_learning_engagement', label: 'Social engagement', percent: true },
    ]),
    metacognition: mapDimensions(metacognition, [
      { key: 'reflection_count', label: 'Reflections' },
      { key: 'reflection_quality', label: 'Reflection quality', percent: true },
      { key: 'self_correction_ability', label: 'Self-correction', percent: true },
      { key: 'planning_behavior', label: 'Planning', percent: true },
      { key: 'strategy_awareness', label: 'Strategy awareness', percent: true },
    ]),
    contextual: {
      preferredDevice: toStringArray(contextual.preferred_device),
      bandwidthQuality: readString(contextual.bandwidth_quality) || 'unknown',
      languagePreference: readString(contextual.language_preference) || 'en',
      ruralUrbanContext: readString(contextual.rural_urban_context) || 'urban',
    },
    updatedAt: readString(data.updated_at),
  };
}

// --- velocity / plateau / regression ---------------------------------------

export interface V4Velocity {
  period: string;
  conceptsMastered: number;
  velocity: number;
  velocityChangePercent: number;
  retentionStability: number;
  remediationCycles: number;
  bloomGrowth: number;
  timeToProficiencyHours: number;
  classification: string;
}

export async function fetchVelocity(
  learnerId: string,
  period = 'week',
  signal?: AbortSignal
): Promise<V4Velocity> {
  const data = toRecord(
    await fetchV4Data(`api/pal/velocity/${encodeURIComponent(learnerId)}?period=${period}`, signal)
  );
  return {
    period: readString(data.period) || period,
    conceptsMastered: readNumber(data.concepts_mastered),
    velocity: readNumber(data.velocity),
    velocityChangePercent: readNumber(data.velocity_change_percent),
    retentionStability: readNumber(data.retention_stability),
    remediationCycles: readNumber(data.remediation_cycles),
    bloomGrowth: readNumber(data.bloom_growth),
    timeToProficiencyHours: readNumber(data.time_to_proficiency_hours),
    classification: readString(data.classification) || 'struggling',
  };
}

export interface V4Plateau {
  isPlateau: boolean;
  daysInPlateau: number;
  recentVelocity: number;
  olderVelocity: number;
  triggerIntervention: boolean;
  recommendedActions: string[];
}

export async function fetchPlateau(learnerId: string, signal?: AbortSignal): Promise<V4Plateau> {
  const data = toRecord(await fetchV4Data(`api/pal/plateau/${encodeURIComponent(learnerId)}`, signal));
  return {
    isPlateau: Boolean(data.is_plateau),
    daysInPlateau: readNumber(data.days_in_plateau),
    recentVelocity: readNumber(data.recent_velocity),
    olderVelocity: readNumber(data.older_velocity),
    triggerIntervention: Boolean(data.trigger_intervention),
    recommendedActions: toStringArray(data.recommended_actions),
  };
}

export interface V4Regression {
  isRegressing: boolean;
  currentMastery: number;
  previousMastery: number;
  declinePercent: number;
  decliningConcepts: number;
  triggerSpacedReview: boolean;
  recommendedActions: string[];
}

export async function fetchRegression(
  learnerId: string,
  signal?: AbortSignal
): Promise<V4Regression> {
  const data = toRecord(await fetchV4Data(`api/pal/regression/${encodeURIComponent(learnerId)}`, signal));
  return {
    isRegressing: Boolean(data.is_regressing),
    currentMastery: readNumber(data.current_mastery),
    previousMastery: readNumber(data.previous_mastery),
    declinePercent: readNumber(data.decline_percent),
    decliningConcepts: toArray(data.declining_concepts).length,
    triggerSpacedReview: Boolean(data.trigger_spaced_review),
    recommendedActions: toStringArray(data.recommended_actions),
  };
}

// --- risk predictions ------------------------------------------------------

export type V4RiskKind = 'disengagement' | 'failure' | 'burnout';

export interface V4Risk {
  kind: V4RiskKind;
  riskScore: number;
  riskLevel: string;
  signals: { label: string; value: number }[];
  triggerIntervention: boolean;
  recommendedActions: string[];
  predictedDaysUntilDisengage?: number;
}

const RISK_ENDPOINT: Record<V4RiskKind, string> = {
  disengagement: 'disengagement-risk',
  failure: 'failure-risk',
  burnout: 'burnout-risk',
};

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export async function fetchRisk(
  learnerId: string,
  kind: V4RiskKind,
  signal?: AbortSignal
): Promise<V4Risk> {
  const data = toRecord(
    await fetchV4Data(`api/pal/${RISK_ENDPOINT[kind]}/${encodeURIComponent(learnerId)}`, signal)
  );
  const signals = toRecord(data.signals);
  return {
    kind,
    riskScore: readNumber(data.risk_score),
    riskLevel: readString(data.risk_level) || 'low',
    signals: Object.entries(signals).map(([key, value]) => ({
      label: humanizeKey(key),
      value: readNumber(value),
    })),
    triggerIntervention: Boolean(data.trigger_intervention),
    recommendedActions: toStringArray(data.recommended_actions),
    predictedDaysUntilDisengage:
      data.predicted_days_until_disengage != null
        ? readNumber(data.predicted_days_until_disengage)
        : undefined,
  };
}

// --- misconception cluster + remediation -----------------------------------

export interface V4Cluster {
  id: number;
  pattern: string;
  category: string;
  rootCause: string;
  frequency: number;
}

export async function fetchMisconceptionCluster(
  conceptId: string,
  signal?: AbortSignal
): Promise<V4Cluster[]> {
  const data = await fetchV4Data(`api/pal/misconception/cluster/${encodeURIComponent(conceptId)}`, signal);
  return toArray(data).map((entry) => {
    const record = toRecord(entry);
    return {
      id: readNumber(record.id),
      pattern: readString(record.pattern),
      category: readString(record.category),
      rootCause: readString(record.root_cause),
      frequency: readNumber(record.frequency),
    };
  });
}

export interface V4Remediation {
  found: boolean;
  aiContent: string;
  preDefined: { id: number; type: string; content: string; pedagogy: string; effectiveness: number }[];
  alternativePedagogies: { type: string; reason: string }[];
  recommendedSequence: number[];
}

export async function fetchRemediation(
  learnerId: string,
  misconceptionId: string,
  signal?: AbortSignal
): Promise<V4Remediation> {
  const data = toRecord(
    await fetchV4Data(
      `api/pal/remediation/${encodeURIComponent(learnerId)}/${encodeURIComponent(misconceptionId)}`,
      signal
    )
  );

  if (readString(data.error)) {
    return {
      found: false,
      aiContent: '',
      preDefined: [],
      alternativePedagogies: [],
      recommendedSequence: [],
    };
  }

  const ai = toRecord(data.ai_generated);
  return {
    found: true,
    aiContent: readString(ai.content),
    preDefined: toArray(data.pre_defined_remediations).map((entry) => {
      const record = toRecord(entry);
      return {
        id: readNumber(record.id),
        type: readString(record.type),
        content: readString(record.content),
        pedagogy: readString(record.pedagogy),
        effectiveness: readNumber(record.effectiveness),
      };
    }),
    alternativePedagogies: toArray(data.alternative_pedagogies).map((entry) => {
      const record = toRecord(entry);
      return { type: readString(record.type), reason: readString(record.reason) };
    }),
    recommendedSequence: toArray(data.recommended_sequence).map((id) => readNumber(id)),
  };
}
