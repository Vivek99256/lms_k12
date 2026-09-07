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

/**
 * The shared readNumber()/readString() turn null into a confident `0` / `''`.
 *
 * That is exactly wrong for this screen. The PAL engines now return null for
 * anything they cannot actually measure -- an unassessed learner's velocity, a
 * rural/urban context that has no source table at all, a Bloom level where no
 * question carried a Bloom tag -- and coercing those to 0 renders identically
 * to a real measurement of zero. On a learner-risk dashboard that is worse
 * than a blank: it reads as "measured, and bad".
 *
 * Use these for any field the backend may legitimately report as unmeasurable,
 * and render the null as "Not tracked" rather than as a number.
 */
function readNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNullableString(value: unknown): string | null {
  if (value == null) return null;
  const stringValue = readString(value);
  return stringValue === '' ? null : stringValue;
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
  hasData: boolean;
  masteryScore: number | null;
  bloomLevel: number | null;
  knowledgeGaps: number;
  activeMisconceptions: V4Misconception[];
  conceptDependencies: number;
  learningVelocity: number | null;
  proficiencyTrend: string | null;
}

export interface V4Dimension {
  label: string;
  /** null => the backend has no source for this dimension at all. */
  value: number | null;
  /** 0-100 for a bar; undefined => no bar. */
  percent?: number;
}

export interface V4LearnerState {
  hasData: boolean;
  competency: V4Competency;
  social: V4Dimension[];
  socialHasData: boolean;
  metacognition: V4Dimension[];
  metacognitionHasData: boolean;
  contextual: {
    hasData: boolean;
    preferredDevice: string[];
    bandwidthQuality: string | null;
    languagePreference: string | null;
    ruralUrbanContext: string | null;
  };
  updatedAt: string;
}

function mapDimensions(
  record: Record<string, unknown>,
  fields: { key: string; label: string; percent?: boolean }[]
): V4Dimension[] {
  return fields.map((field) => {
    const value = readNullableNumber(record[field.key]);
    return {
      label: field.label,
      value,
      // No bar at all when there is nothing to measure -- a 0-width bar reads
      // as a measured zero.
      percent: field.percent && value !== null ? Math.min(100, Math.max(0, value)) : undefined,
    };
  });
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

  const hasCompetency = competency.has_data === true;

  return {
    hasData: hasCompetency,
    competency: {
      hasData: hasCompetency,
      // Only a learner with competency rows has a mastery score. Without them
      // this used to render 0%, i.e. "knows nothing" rather than "never tested".
      masteryScore: hasCompetency ? readNullableNumber(competency.mastery_score) : null,
      bloomLevel: readNullableNumber(competency.bloom_level),
      knowledgeGaps: toArray(competency.knowledge_gaps).length,
      activeMisconceptions: toArray(competency.active_misconceptions).map((entry) => {
        const record = toRecord(entry);
        return {
          id: readNumber(record.id),
          pattern: readString(record.pattern),
          severity: readNumber(record.severity),
        };
      }),
      conceptDependencies: toArray(competency.concept_dependencies).length,
      learningVelocity: readNullableNumber(competency.learning_velocity),
      // No 'stable' fallback: that asserted a flat trend for every learner the
      // engine could not actually measure.
      proficiencyTrend: readNullableString(competency.proficiency_trend),
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
    socialHasData: social.has_data === true,
    metacognitionHasData: metacognition.has_data === true,
    contextual: {
      hasData: contextual.has_data === true,
      preferredDevice: toStringArray(contextual.preferred_device),
      // These three had hard-coded fallbacks ('unknown' / 'en' / 'urban') that
      // rendered as measured facts. 'urban' in particular was shown for every
      // learner in the estate while no rural/urban column exists anywhere in
      // the schema. Null now, and the UI labels it "Not tracked".
      bandwidthQuality: readNullableString(contextual.bandwidth_quality),
      languagePreference: readNullableString(contextual.language_preference),
      ruralUrbanContext: readNullableString(contextual.rural_urban_context),
    },
    updatedAt: readString(data.updated_at),
  };
}

// --- velocity / plateau / regression ---------------------------------------

export interface V4Velocity {
  period: string;
  hasData: boolean;
  asOf: string | null;
  daysSinceEvidence: number | null;
  conceptsMastered: number | null;
  velocity: number | null;
  /** Rank against the cohort; the classification band is derived from this. */
  velocityPercentile: number | null;
  cohortSize: number | null;
  velocityChangePercent: number | null;
  retentionStability: number | null;
  remediationCycles: number | null;
  bloomGrowth: number | null;
  timeToProficiencyHours: number | null;
  classification: string | null;
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
    hasData: data.has_data === true,
    // The window these figures cover. Competency evidence is backdated to the
    // answers that produced it, so the backend anchors each learner's window
    // to their OWN last evidence rather than to today -- `asOf` is that
    // anchor, and `daysSinceEvidence` says how stale it is.
    asOf: readNullableString(data.as_of),
    daysSinceEvidence: readNullableNumber(data.days_since_evidence),
    conceptsMastered: readNullableNumber(data.concepts_mastered),
    velocity: readNullableNumber(data.velocity),
    velocityPercentile: readNullableNumber(data.velocity_percentile),
    cohortSize: readNullableNumber(data.cohort_size),
    velocityChangePercent: readNullableNumber(data.velocity_change_percent),
    retentionStability: readNullableNumber(data.retention_stability),
    remediationCycles: readNullableNumber(data.remediation_cycles),
    bloomGrowth: readNullableNumber(data.bloom_growth),
    timeToProficiencyHours: readNullableNumber(data.time_to_proficiency_hours),
    // No 'struggling' fallback -- an unassessed learner is not a slow one, and
    // this label drives intervention.
    classification: readNullableString(data.classification),
  };
}

export interface V4Plateau {
  hasData: boolean;
  asOf: string | null;
  /** null => not determinable, which is not the same as "no plateau". */
  isPlateau: boolean | null;
  daysInPlateau: number | null;
  recentVelocity: number | null;
  olderVelocity: number | null;
  triggerIntervention: boolean;
  recommendedActions: string[];
}

export async function fetchPlateau(learnerId: string, signal?: AbortSignal): Promise<V4Plateau> {
  const data = toRecord(await fetchV4Data(`api/pal/plateau/${encodeURIComponent(learnerId)}`, signal));
  const hasData = data.has_data === true;
  return {
    hasData,
    asOf: readNullableString(data.as_of),
    // Boolean(null) is false, which would claim "no plateau detected" for a
    // learner the engine could not assess at all.
    isPlateau: hasData ? Boolean(data.is_plateau) : null,
    daysInPlateau: readNullableNumber(data.days_in_plateau),
    recentVelocity: readNullableNumber(data.recent_velocity),
    olderVelocity: readNullableNumber(data.older_velocity),
    triggerIntervention: Boolean(data.trigger_intervention),
    recommendedActions: toStringArray(data.recommended_actions),
  };
}

export interface V4Regression {
  hasData: boolean;
  asOf: string | null;
  isRegressing: boolean | null;
  currentMastery: number | null;
  previousMastery: number | null;
  declinePercent: number | null;
  decliningConcepts: number;
  triggerSpacedReview: boolean;
  recommendedActions: string[];
}

export async function fetchRegression(
  learnerId: string,
  signal?: AbortSignal
): Promise<V4Regression> {
  const data = toRecord(await fetchV4Data(`api/pal/regression/${encodeURIComponent(learnerId)}`, signal));
  const hasData = data.has_data === true;
  return {
    hasData,
    asOf: readNullableString(data.as_of),
    isRegressing: hasData ? Boolean(data.is_regressing) : null,
    currentMastery: readNullableNumber(data.current_mastery),
    previousMastery: readNullableNumber(data.previous_mastery),
    declinePercent: readNullableNumber(data.decline_percent),
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

/**
 * A misconception comes from one of two registries and their ids overlap, so
 * `source` is part of the identity, not decoration -- it must be sent back to
 * fetchRemediation(). See the backend's MisconceptionIntelligenceEngine.
 */
export type V4ClusterSource = 'library' | 'runtime';

export interface V4Cluster {
  id: number;
  source: V4ClusterSource;
  tag: string | null;
  pattern: string;
  category: string;
  rootCause: string;
  correctiveAction: string | null;
  frequency: number;
  prevalenceRate: number | null;
  severity: string | null;
  teacherConfirmed: boolean;
  /** 'draft' for all but one library row today -- surface it, don't hide it. */
  qualityStatus: string | null;
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
      source: readString(record.source) === 'library' ? 'library' : 'runtime',
      tag: readNullableString(record.tag),
      pattern: readString(record.pattern),
      category: readString(record.category),
      rootCause: readString(record.root_cause),
      correctiveAction: readNullableString(record.corrective_action),
      frequency: readNumber(record.frequency),
      prevalenceRate: readNullableNumber(record.prevalence_rate),
      severity: readNullableString(record.severity),
      teacherConfirmed: record.teacher_confirmed === true,
      qualityStatus: readNullableString(record.quality_status),
    };
  });
}

export interface V4RemediationItem {
  id: number;
  type: string;
  content: string;
  pedagogy: string;
  /** null until this corrective has actually been served to someone. */
  effectiveness: number | null;
  servedCount: number | null;
  qualityStatus: string | null;
}

export interface V4Remediation {
  found: boolean;
  source: V4ClusterSource;
  aiContent: string;
  preDefined: V4RemediationItem[];
  alternativePedagogies: { type: string; reason: string }[];
  recommendedSequence: number[];
}

export async function fetchRemediation(
  learnerId: string,
  misconceptionId: string,
  source: V4ClusterSource = 'runtime',
  signal?: AbortSignal
): Promise<V4Remediation> {
  // `source` disambiguates the two registries -- without it the backend
  // defaults to 'runtime' and a library misconception id resolves to the wrong
  // row (or to nothing at all).
  const data = toRecord(
    await fetchV4Data(
      `api/pal/remediation/${encodeURIComponent(learnerId)}/${encodeURIComponent(misconceptionId)}` +
        `?source=${encodeURIComponent(source)}`,
      signal
    )
  );

  if (readString(data.error)) {
    return {
      found: false,
      source,
      aiContent: '',
      preDefined: [],
      alternativePedagogies: [],
      recommendedSequence: [],
    };
  }

  const ai = toRecord(data.ai_generated);
  return {
    found: true,
    source: readString(data.source) === 'library' ? 'library' : 'runtime',
    aiContent: readString(ai.content),
    preDefined: toArray(data.pre_defined_remediations).map((entry) => {
      const record = toRecord(entry);
      return {
        id: readNumber(record.id),
        // Library correctives carry `format`/`title`/`body`; runtime ones
        // carry `type`/`content`. Read both so one mapper serves both shapes.
        type: readString(record.type) || readString(record.format),
        content: readString(record.content) || readString(record.body) || readString(record.title),
        pedagogy: readString(record.pedagogy) || readString(record.h5p_type),
        effectiveness: readNullableNumber(
          record.effectiveness != null ? record.effectiveness : record.resolution_rate
        ),
        servedCount: readNullableNumber(record.served_count),
        qualityStatus: readNullableString(record.quality_status),
      };
    }),
    alternativePedagogies: toArray(data.alternative_pedagogies).map((entry) => {
      const record = toRecord(entry);
      return { type: readString(record.type), reason: readString(record.reason) };
    }),
    recommendedSequence: toArray(data.recommended_sequence).map((id) => readNumber(id)),
  };
}
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
