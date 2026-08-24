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
<<<<<<< HEAD
=======
export interface V4UluListItem {
  id: number;
  uluId: string;
  title: string;
  grade: number;
  subject: string;
  academicConcept: string;
  subConcept: string;
  status: string;
  difficulty: number;
  durationMinutes: number;
  pedagogyTag: string;
  h5pType: string;
  caselDomain: string;
  ngssPractice: string;
  riasecSignal: string;
  careerCluster: string;
  realSkillName: string;
  culturalContext: string;
  socialMode: string;
  updatedAt: string;
  analytics: Record<string, unknown>;
}

export interface V4UluListResponse {
  items: V4UluListItem[];
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

export interface V4UluFilters {
  search?: string;
  status?: string;
  subject?: string;
  grade?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface V4UluDetail extends V4UluListItem {
  language: string;
  masteryGate: number;
  ncdgGoal: string;
  academicCore: Record<string, unknown>;
  selLayer: Record<string, unknown>;
  stemLayer: Record<string, unknown>;
  careerLayer: Record<string, unknown>;
  realSkill: Record<string, unknown>;
  scenario: Record<string, unknown>;
  branches: Array<Record<string, unknown>>;
  reflections: Record<string, unknown>;
  delivery: Record<string, unknown>;
  qaChecks: Record<string, unknown>;
  optimizationFlags: Record<string, unknown>;
  crossDomainLinks: Array<Record<string, unknown>>;
}

export interface V4UluPreview {
  uluId: string;
  title: string;
  studentJourney: {
    context: string;
    academicHook: string;
    decisionPoint: string;
    paths: Array<Record<string, unknown>>;
    reflection: Record<string, unknown>;
    careerSignal: Record<string, unknown>;
    completion: Record<string, unknown>;
  };
}

export interface V4UluAnalytics {
  uluId: string;
  analytics: Record<string, unknown>;
  optimizationFlags: Record<string, unknown>;
  recommendations: string[];
}

export interface V4UluMutationInput {
  title: string;
  grade: number;
  subject: string;
  academic_concept: string;
  sub_concept: string;
  status: string;
  difficulty: number;
  duration_minutes: number;
  pedagogy_tag: string;
  h5p_type: string;
  casel_domain: string;
  ngss_practice: string;
  ncdg_goal: string;
  riasec_signal: string;
  career_cluster: string;
  real_skill_name: string;
  cultural_context: string;
  social_mode: string;
  language: string;
  mastery_gate: number;
  scenario: {
    context: string;
    academic_hook: string;
    decision_point: string;
    reflection: string;
  };
  reflections: {
    stream: string;
    mountain: string;
    sky: string;
  };
}

function mapUluItem(entry: unknown): V4UluListItem {
  const record = toRecord(entry);
  return {
    id: readNumber(record.id),
    uluId: readString(record.ulu_id),
    title: readString(record.title),
    grade: readNumber(record.grade),
    subject: readString(record.subject),
    academicConcept: readString(record.academic_concept),
    subConcept: readString(record.sub_concept),
    status: readString(record.status),
    difficulty: readNumber(record.difficulty),
    durationMinutes: readNumber(record.duration_minutes),
    pedagogyTag: readString(record.pedagogy_tag),
    h5pType: readString(record.h5p_type),
    caselDomain: readString(record.casel_domain),
    ngssPractice: readString(record.ngss_practice),
    riasecSignal: readString(record.riasec_signal),
    careerCluster: readString(record.career_cluster),
    realSkillName: readString(record.real_skill_name),
    culturalContext: readString(record.cultural_context),
    socialMode: readString(record.social_mode),
    updatedAt: readString(record.updated_at),
    analytics: toRecord(record.analytics),
  };
}

async function fetchV4Mutation(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again to continue.');

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
    },
    body: body == null ? undefined : JSON.stringify(body),
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
    throw new Error(readString(record.message) || `HTTP ${response.status}: the PAL V4 API request failed.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'PAL V4 mutation failed.');
  }

  return 'data' in record ? record.data : payload;
}

export async function fetchULUList(
  filters: V4UluFilters = {},
  signal?: AbortSignal
): Promise<V4UluListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.grade) params.set('grade', filters.grade);
  if (filters.sortBy) params.set('sort_by', filters.sortBy);
  if (filters.sortDirection) params.set('sort_direction', filters.sortDirection);
  if (filters.perPage) params.set('per_page', String(filters.perPage));
  if (filters.page) params.set('page', String(filters.page));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = toRecord(await fetchV4Data(`api/pal/ulu${suffix}`, signal));

  return {
    items: toArray(data.data).map(mapUluItem),
    total: readNumber(data.total),
    currentPage: readNumber(data.current_page),
    lastPage: readNumber(data.last_page),
    perPage: readNumber(data.per_page),
  };
}

export async function fetchULUDetail(id: number, signal?: AbortSignal): Promise<V4UluDetail> {
  const record = toRecord(await fetchV4Data(`api/pal/ulu/${id}`, signal));
  const item = mapUluItem(record);
  return {
    ...item,
    language: readString(record.language),
    masteryGate: readNumber(record.mastery_gate),
    ncdgGoal: readString(record.ncdg_goal),
    academicCore: toRecord(record.academic_core),
    selLayer: toRecord(record.sel_layer),
    stemLayer: toRecord(record.stem_layer),
    careerLayer: toRecord(record.career_layer),
    realSkill: toRecord(record.real_skill),
    scenario: toRecord(record.scenario),
    branches: toArray(record.branches).map((entry) => toRecord(entry)),
    reflections: toRecord(record.reflections),
    delivery: toRecord(record.delivery),
    qaChecks: toRecord(record.qa_checks),
    optimizationFlags: toRecord(record.optimization_flags),
    crossDomainLinks: toArray(record.cross_domain_links).map((entry) => toRecord(entry)),
  };
}

export async function createULU(input: V4UluMutationInput, signal?: AbortSignal): Promise<V4UluDetail> {
  const data = await fetchV4Mutation('api/pal/ulu', 'POST', input, signal);
  return fetchULUDetail(readNumber(toRecord(data).id), signal);
}

export async function updateULU(id: number, input: V4UluMutationInput, signal?: AbortSignal): Promise<V4UluDetail> {
  const data = await fetchV4Mutation(`api/pal/ulu/${id}`, 'PUT', input, signal);
  return fetchULUDetail(readNumber(toRecord(data).id), signal);
}

export async function duplicateULU(id: number, signal?: AbortSignal): Promise<V4UluDetail> {
  const data = await fetchV4Mutation(`api/pal/ulu/${id}/duplicate`, 'POST', undefined, signal);
  return fetchULUDetail(readNumber(toRecord(data).id), signal);
}

export async function approveULU(id: number, signal?: AbortSignal): Promise<V4UluDetail> {
  const data = await fetchV4Mutation(`api/pal/ulu/${id}/approve`, 'POST', undefined, signal);
  return fetchULUDetail(readNumber(toRecord(data).id), signal);
}

export async function archiveULU(id: number, signal?: AbortSignal): Promise<V4UluDetail> {
  const data = await fetchV4Mutation(`api/pal/ulu/${id}/archive`, 'POST', undefined, signal);
  return fetchULUDetail(readNumber(toRecord(data).id), signal);
}

export async function deleteULU(id: number, signal?: AbortSignal): Promise<void> {
  await fetchV4Mutation(`api/pal/ulu/${id}`, 'DELETE', undefined, signal);
}

export async function fetchULUPreview(id: number, signal?: AbortSignal): Promise<V4UluPreview> {
  const data = toRecord(await fetchV4Data(`api/pal/ulu/${id}/preview`, signal));
  const studentJourney = toRecord(data.student_journey);
  return {
    uluId: readString(data.ulu_id),
    title: readString(data.title),
    studentJourney: {
      context: readString(studentJourney.context),
      academicHook: readString(studentJourney.academic_hook),
      decisionPoint: readString(studentJourney.decision_point),
      paths: toArray(studentJourney.paths).map((entry) => toRecord(entry)),
      reflection: toRecord(studentJourney.reflection),
      careerSignal: toRecord(studentJourney.career_signal),
      completion: toRecord(studentJourney.completion),
    },
  };
}

export async function fetchULUAnalytics(id: number, signal?: AbortSignal): Promise<V4UluAnalytics> {
  const data = toRecord(await fetchV4Data(`api/pal/ulu/${id}/analytics`, signal));
  return {
    uluId: readString(data.ulu_id),
    analytics: toRecord(data.analytics),
    optimizationFlags: toRecord(data.optimization_flags),
    recommendations: toStringArray(data.recommendations),
  };
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
