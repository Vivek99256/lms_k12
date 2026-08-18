import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';

/**
 * New PAL → Gamification — data layer.
 *
 * Mirrors the Laravel routes registered under `/api/pal/new/gamification/*`
 * (App\Http\Controllers\api\PAL\NewPalGamificationController), same
 * `{ success, data }` envelope and same `pal.auth` JWT as the rest of PAL.
 *
 * Two things about this module are worth knowing before changing anything here.
 *
 * 1. NOTHING in this file is content. There is no badge list, no pathway list,
 *    no threshold and no sample record. The badge catalogue, the mastery tiers,
 *    the challenge types, the career stages and the visibility matrix all
 *    arrive from the API, which reads them from config/pal_gamification.php.
 *    A change to the specification is a backend-only change.
 *
 * 2. The server decides what an audience may see (§9 visibility matrix), so a
 *    field being absent from a response is a decision, not a bug. The readers
 *    below therefore treat every section as optional and the pages render an
 *    explicit "not visible to you" rather than an empty shell.
 *
 * Absent numbers are read as `null`, never as 0 — an unmeasured fluency and a
 * fluency of zero are very different things to show a child.
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

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

async function callApi(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    query?: Record<string, string | number | undefined | null>;
    signal?: AbortSignal;
  } = {}
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const method = init.method ?? 'GET';

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const suffix = search.toString() ? `?${search.toString()}` : '';

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}${suffix}`, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(init.body ?? {}),
    signal: init.signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverMessage = readString(toRecord(payload).message);

    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      // A 403 here is usually the visibility matrix doing its job, and the
      // server names the reason — so surface it verbatim rather than a generic
      // "forbidden", which would read as a bug.
      throw new Error(serverMessage || 'This part of Gamification is not visible to you.');
    }
    if (response.status === 422) {
      throw new Error(serverMessage || 'The server rejected that request.');
    }
    if (response.status === 404) {
      throw new Error(
        serverMessage ||
          'The Gamification API is not available on this server. It ships with the New PAL module — the backend may not be deployed yet.'
      );
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the Gamification API is unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'Gamification request failed.');
  }
  return 'data' in record ? record.data : payload;
}

/** Every call is learner-scoped; a student's own id is resolved server-side. */
export interface LearnerScope {
  learnerId?: string | number | null;
  audience?: string;
}

function scopeQuery(scope: LearnerScope = {}): Record<string, string | undefined> {
  return {
    learner_id: scope.learnerId ? String(scope.learnerId) : undefined,
    audience: scope.audience || undefined,
  };
}

// --- shared types ----------------------------------------------------------

export type MasteryTierKey = string;

export interface MasteryTier {
  key: MasteryTierKey;
  label: string;
  minMastery: number;
  studentMessage: string;
  count: number;
}

export interface ConceptRecord {
  conceptRef: string;
  conceptLabel: string;
  subjectName: string;
  mastery: number;
  masterySource: string;
  tier: MasteryTierKey;
  tierLabel: string;
  sessions: number;
  bestNetFluency: number | null;
  latestNetFluency: number | null;
  lastSeenAt: string | null;
}

export interface MasterySection {
  conceptsTracked: number;
  tierCounts: Record<string, number>;
  tiers: MasteryTier[];
  concepts: ConceptRecord[];
  headline: string;
}

function readConcept(raw: unknown): ConceptRecord {
  const record = toRecord(raw);
  return {
    conceptRef: readString(record.concept_ref),
    conceptLabel: readString(record.concept_label),
    subjectName: readString(record.subject_name),
    mastery: readNumber(record.mastery),
    masterySource: readString(record.mastery_source),
    tier: readString(record.tier),
    tierLabel: readString(record.tier_label),
    sessions: readNumber(record.sessions),
    bestNetFluency: readNullableNumber(record.best_net_fluency),
    latestNetFluency: readNullableNumber(record.latest_net_fluency),
    lastSeenAt: readNullableString(record.last_seen_at),
  };
}

function readMastery(raw: unknown): MasterySection | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);
  return {
    conceptsTracked: readNumber(record.concepts_tracked),
    tierCounts: Object.fromEntries(
      Object.entries(toRecord(record.tier_counts)).map(([k, v]) => [k, readNumber(v)])
    ),
    tiers: toArray(record.tiers).map((tier) => {
      const t = toRecord(tier);
      return {
        key: readString(t.key),
        label: readString(t.label),
        minMastery: readNumber(t.min_mastery),
        studentMessage: readString(t.student_message),
        count: readNumber(t.count),
      };
    }),
    concepts: toArray(record.concepts).map(readConcept),
    headline: readString(record.headline),
  };
}

// --- personal best ---------------------------------------------------------

export interface PersonalBestRecord {
  metricKey: string;
  label: string;
  format: string;
  direction: 'higher' | 'lower' | string;
  scopeLabel: string | null;
  bestValue: number;
  bestAchievedAt: string | null;
  previousValue: number | null;
  improvementPct: number | null;
}

export interface PersonalBestGroup {
  group: string;
  label: string;
  records: PersonalBestRecord[];
}

export interface PersonalBestEventRow {
  id: number;
  metricKey: string;
  label: string;
  format: string;
  scopeLabel: string | null;
  value: number;
  previousValue: number | null;
  improvementPct: number | null;
  achievedAt: string | null;
  message: string;
}

export interface PersonalBestBoard {
  totalRecords: number;
  headline: string;
  groups: PersonalBestGroup[];
  recent: PersonalBestEventRow[];
}

function readPersonalBestRecord(raw: unknown): PersonalBestRecord {
  const record = toRecord(raw);
  return {
    metricKey: readString(record.metric_key),
    label: readString(record.label),
    format: readString(record.format),
    direction: readString(record.direction),
    scopeLabel: readNullableString(record.scope_label),
    bestValue: readNumber(record.best_value),
    bestAchievedAt: readNullableString(record.best_achieved_at),
    previousValue: readNullableNumber(record.previous_value),
    improvementPct: readNullableNumber(record.improvement_pct),
  };
}

function readPersonalBestEvent(raw: unknown): PersonalBestEventRow {
  const record = toRecord(raw);
  return {
    id: readNumber(record.id),
    metricKey: readString(record.metric_key),
    label: readString(record.label),
    format: readString(record.format),
    scopeLabel: readNullableString(record.scope_label),
    value: readNumber(record.value),
    previousValue: readNullableNumber(record.previous_value),
    improvementPct: readNullableNumber(record.improvement_pct),
    achievedAt: readNullableString(record.achieved_at),
    message: readString(record.message),
  };
}

function readPersonalBestBoard(raw: unknown): PersonalBestBoard | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);
  return {
    totalRecords: readNumber(record.total_records),
    headline: readString(record.headline),
    groups: toArray(record.groups).map((group) => {
      const g = toRecord(group);
      return {
        group: readString(g.group),
        label: readString(g.label),
        records: toArray(g.records).map(readPersonalBestRecord),
      };
    }),
    recent: toArray(record.recent).map(readPersonalBestEvent),
  };
}

// --- streak ----------------------------------------------------------------

export interface StreakDayRow {
  date: string;
  productiveMinutes: number;
  qualifyingEvents: number;
  qualifyingActivities: string[];
  conceptCount: number;
  qualified: boolean;
  shortfall: string | null;
}

export interface StreakRule {
  key: string;
  label: string;
  minCount: number;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  longestStreakEndedOn: string | null;
  currentStartedOn: string | null;
  lastActiveDate: string | null;
  totalActiveDays: number;
  activeToday: boolean;
  graceAvailable: boolean;
  graceUsedOn: string | null;
  headline: string;
  minProductiveMinutes: number;
  qualifyingActivities: StreakRule[];
  gracePeriodDays: number;
  milestones: { days: number; reached: boolean }[];
  nearMisses: StreakDayRow[];
}

function readStreakDay(raw: unknown): StreakDayRow {
  const record = toRecord(raw);
  return {
    date: readString(record.date),
    productiveMinutes: readNumber(record.productive_minutes),
    qualifyingEvents: readNumber(record.qualifying_events),
    qualifyingActivities: toArray(record.qualifying_activities).map((v) => readString(v)),
    conceptCount: readNumber(record.concept_count),
    qualified: readBoolean(record.qualified),
    shortfall: readNullableString(record.shortfall),
  };
}

function readStreak(raw: unknown): StreakSummary | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);
  const rules = toRecord(record.rules);
  return {
    currentStreak: readNumber(record.current_streak),
    longestStreak: readNumber(record.longest_streak),
    longestStreakEndedOn: readNullableString(record.longest_streak_ended_on),
    currentStartedOn: readNullableString(record.current_started_on),
    lastActiveDate: readNullableString(record.last_active_date),
    totalActiveDays: readNumber(record.total_active_days),
    activeToday: readBoolean(record.active_today),
    graceAvailable: readBoolean(record.grace_available),
    graceUsedOn: readNullableString(record.grace_used_on),
    headline: readString(record.headline),
    minProductiveMinutes: readNumber(rules.min_productive_minutes),
    qualifyingActivities: toArray(rules.qualifying_activities).map((activity) => {
      const a = toRecord(activity);
      return {
        key: readString(a.key),
        label: readString(a.label),
        minCount: readNumber(a.min_count),
      };
    }),
    gracePeriodDays: readNumber(rules.grace_period_days),
    milestones: toArray(record.milestones).map((milestone) => {
      const m = toRecord(milestone);
      return { days: readNumber(m.days), reached: readBoolean(m.reached) };
    }),
    nearMisses: toArray(record.near_misses).map(readStreakDay),
  };
}

export interface StreakHistory {
  from: string;
  to: string;
  days: StreakDayRow[];
  qualifiedDays: number;
  activeDays: number;
}

// --- badges ----------------------------------------------------------------

export interface BadgeAward {
  scopeKey: string;
  awardedAt: string | null;
  studentMessage: string | null;
}

export interface BadgeEntry {
  badgeId: string;
  name: string;
  category: string;
  categoryLabel: string;
  description: string | null;
  rarity: string;
  scope: string;
  challengeModeOnly: boolean;
  hpcDomain: string | null;
  caselDomain: string | null;
  ncdgGoal: string | null;
  hpcEvidenceWeight: number;
  earned: boolean;
  timesEarned: number;
  awards: BadgeAward[];
}

export interface BadgeCategorySummary {
  key: string;
  label: string;
  blurb: string;
  earned: number;
  total: number;
}

export interface BadgeCollection {
  totalEarned: number;
  totalAvailable: number;
  earned: BadgeEntry[];
  available: BadgeEntry[];
  categories: BadgeCategorySummary[];
}

function readBadge(raw: unknown): BadgeEntry {
  const record = toRecord(raw);
  return {
    badgeId: readString(record.badge_id),
    name: readString(record.name),
    category: readString(record.category),
    categoryLabel: readString(record.category_label),
    description: readNullableString(record.description),
    rarity: readString(record.rarity),
    scope: readString(record.scope),
    challengeModeOnly: readBoolean(record.challenge_mode_only),
    hpcDomain: readNullableString(record.hpc_domain),
    caselDomain: readNullableString(record.casel_domain),
    ncdgGoal: readNullableString(record.ncdg_goal),
    hpcEvidenceWeight: readNumber(record.hpc_evidence_weight),
    earned: readBoolean(record.earned),
    timesEarned: readNumber(record.times_earned),
    awards: toArray(record.awards).map((award) => {
      const a = toRecord(award);
      return {
        scopeKey: readString(a.scope_key),
        awardedAt: readNullableString(a.awarded_at),
        studentMessage: readNullableString(a.student_message),
      };
    }),
  };
}

function readBadgeCollection(raw: unknown): BadgeCollection | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);
  return {
    totalEarned: readNumber(record.total_earned),
    totalAvailable: readNumber(record.total_available),
    earned: toArray(record.earned).map(readBadge),
    available: toArray(record.available).map(readBadge),
    categories: toArray(record.categories).map((category) => {
      const c = toRecord(category);
      return {
        key: readString(c.key),
        label: readString(c.label),
        blurb: readString(c.blurb),
        earned: readNumber(c.earned),
        total: readNumber(c.total),
      };
    }),
  };
}

// --- team challenges -------------------------------------------------------

export interface ChallengeProgress {
  qualified: number;
  total: number;
  value: number;
  unit: string;
  percent: number;
  achieved: boolean;
  remaining: number;
  headline: string;
}

export interface TeamChallengeEntry {
  id: number;
  type: string;
  typeLabel: string;
  typeSummary: string;
  inclusive: boolean;
  title: string;
  description: string | null;
  conceptLabel: string | null;
  targetValue: number;
  targetTier: string | null;
  deadline: string | null;
  daysRemaining: number | null;
  status: string;
  reward: { title: string | null; description: string | null; approved: boolean };
  classProgress: ChallengeProgress;
  ownContribution: { contributed: boolean; detail: string | null; message: string } | null;
  /** Teacher/admin only — absent from a student payload by design (§4.3). */
  perLearner:
    | { learnerId: number; name: string; contributed: boolean; value: number; detail: string | null }[]
    | null;
}

export interface TeamChallengeType {
  key: string;
  label: string;
  summary: string;
  targetUnit: string;
  defaultTargetValue: number;
  requiresConcept: boolean;
  inclusive: boolean;
}

export interface TeamChallengeBoard {
  challenges: TeamChallengeEntry[];
  types: TeamChallengeType[];
  maxActivePerWeek: number;
}

function readChallenge(raw: unknown): TeamChallengeEntry {
  const record = toRecord(raw);
  const progress = toRecord(record.class_progress);
  const reward = toRecord(record.reward);
  const own = record.own_contribution === undefined ? null : toRecord(record.own_contribution);

  return {
    id: readNumber(record.id),
    type: readString(record.type),
    typeLabel: readString(record.type_label),
    typeSummary: readString(record.type_summary),
    inclusive: readBoolean(record.inclusive),
    title: readString(record.title),
    description: readNullableString(record.description),
    conceptLabel: readNullableString(record.concept_label),
    targetValue: readNumber(record.target_value),
    targetTier: readNullableString(record.target_tier),
    deadline: readNullableString(record.deadline),
    daysRemaining: readNullableNumber(record.days_remaining),
    status: readString(record.status),
    reward: {
      title: readNullableString(reward.title),
      description: readNullableString(reward.description),
      approved: readBoolean(reward.approved),
    },
    classProgress: {
      qualified: readNumber(progress.qualified),
      total: readNumber(progress.total),
      value: readNumber(progress.value),
      unit: readString(progress.unit),
      percent: readNumber(progress.percent),
      achieved: readBoolean(progress.achieved),
      remaining: readNumber(progress.remaining),
      headline: readString(progress.headline),
    },
    ownContribution: own
      ? {
          contributed: readBoolean(own.contributed),
          detail: readNullableString(own.detail),
          message: readString(own.message),
        }
      : null,
    perLearner:
      record.per_learner === undefined
        ? null
        : toArray(record.per_learner).map((entry) => {
            const e = toRecord(entry);
            return {
              learnerId: readNumber(e.learner_id),
              name: readString(e.name),
              contributed: readBoolean(e.contributed),
              value: readNumber(e.value),
              detail: readNullableString(e.detail),
            };
          }),
  };
}

function readChallengeTypes(raw: unknown): TeamChallengeType[] {
  return toArray(raw).map((entry) => {
    const t = toRecord(entry);
    return {
      key: readString(t.key),
      label: readString(t.label),
      summary: readString(t.summary),
      targetUnit: readString(t.target_unit),
      defaultTargetValue: readNumber(t.default_target_value),
      requiresConcept: readBoolean(t.requires_concept),
      inclusive: readBoolean(t.inclusive),
    };
  });
}

// --- career quest ----------------------------------------------------------

export interface RiasecType {
  type: string;
  label: string;
  blurb: string;
  signals: number;
  share: number;
}

export interface RiasecProfile {
  ready: boolean;
  reason: string | null;
  signalsTotal: number;
  signalsRequired: number;
  distinctTypes: number;
  distinctRequired: number;
  minGrade: number | null;
  types: RiasecType[];
  top: RiasecType | null;
}

export interface PathwaySuggestion {
  key: string;
  label: string;
  skillsBlurb: string;
  matchScore: number;
  riasecSignals: number;
  conceptsEngaged: number;
  why: string;
}

export interface SkillProgress {
  pathway: string;
  pathwayLabel: string;
  mastered: number;
  target: number;
  percent: number;
  targetSource: string;
  skills: { conceptRef: string; conceptLabel: string; mastered: boolean; tier: string }[];
}

export interface CareerQuest {
  available: boolean;
  reason: string | null;
  gradeNumber: number | null;
  gradeLabel: string;
  stage: {
    key: string;
    label: string;
    gradeMin: number | null;
    gradeMax: number | null;
    gradeKnown: boolean;
    showsRiasec: boolean;
    showsPathways: boolean;
    generatesPathwayReport: boolean;
  };
  questMessage: string;
  questLevel: number;
  islands: { key: string; label: string; flagPlanted: boolean }[];
  riasec: RiasecProfile;
  pathways: PathwaySuggestion[];
  primaryPathway: string | null;
  skillProgress: SkillProgress | null;
  careerExposure: { cluster: string; label: string; count: number; titles: string[] }[];
  interestDeclaration: {
    declared: string[];
    declaredAt: string | null;
    invited: boolean;
    scenariosCompleted: number;
    scenariosRequired: number;
  };
  report: { eligible: boolean; generatedAt: string | null };
}

function readCareerQuest(raw: unknown): CareerQuest | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);

  if (!readBoolean(record.available)) {
    return {
      available: false,
      reason: readNullableString(record.reason),
    } as CareerQuest;
  }

  const learner = toRecord(record.learner);
  const stage = toRecord(record.stage);
  const riasec = toRecord(record.riasec);
  const skill = record.skill_progress ? toRecord(record.skill_progress) : null;
  const interest = toRecord(record.interest_declaration);
  const report = toRecord(record.report);

  const readRiasecType = (value: unknown): RiasecType => {
    const t = toRecord(value);
    return {
      type: readString(t.type),
      label: readString(t.label),
      blurb: readString(t.blurb),
      signals: readNumber(t.signals),
      share: readNumber(t.share),
    };
  };

  return {
    available: true,
    reason: null,
    gradeNumber: readNullableNumber(learner.grade_number),
    gradeLabel: readString(learner.grade_label),
    stage: {
      key: readString(stage.key),
      label: readString(stage.label),
      gradeMin: readNullableNumber(stage.grade_min),
      gradeMax: readNullableNumber(stage.grade_max),
      gradeKnown: readBoolean(stage.grade_known),
      showsRiasec: readBoolean(stage.shows_riasec),
      showsPathways: readBoolean(stage.shows_pathways),
      generatesPathwayReport: readBoolean(stage.generates_pathway_report),
    },
    questMessage: readString(record.quest_message),
    questLevel: readNumber(record.quest_level),
    islands: toArray(record.islands).map((island) => {
      const i = toRecord(island);
      return {
        key: readString(i.key),
        label: readString(i.label),
        flagPlanted: readBoolean(i.flag_planted),
      };
    }),
    riasec: {
      ready: readBoolean(riasec.ready),
      reason: readNullableString(riasec.reason),
      signalsTotal: readNumber(riasec.signals_total),
      signalsRequired: readNumber(riasec.signals_required),
      distinctTypes: readNumber(riasec.distinct_types),
      distinctRequired: readNumber(riasec.distinct_required),
      minGrade: readNullableNumber(riasec.min_grade),
      types: toArray(riasec.types).map(readRiasecType),
      top: riasec.top ? readRiasecType(riasec.top) : null,
    },
    pathways: toArray(record.pathways).map((pathway) => {
      const p = toRecord(pathway);
      return {
        key: readString(p.key),
        label: readString(p.label),
        skillsBlurb: readString(p.skills_blurb),
        matchScore: readNumber(p.match_score),
        riasecSignals: readNumber(p.riasec_signals),
        conceptsEngaged: readNumber(p.concepts_engaged),
        why: readString(p.why),
      };
    }),
    primaryPathway: readNullableString(record.primary_pathway),
    skillProgress: skill
      ? {
          pathway: readString(skill.pathway),
          pathwayLabel: readString(skill.pathway_label),
          mastered: readNumber(skill.mastered),
          target: readNumber(skill.target),
          percent: readNumber(skill.percent),
          targetSource: readString(skill.target_source),
          skills: toArray(skill.skills).map((s) => {
            const item = toRecord(s);
            return {
              conceptRef: readString(item.concept_ref),
              conceptLabel: readString(item.concept_label),
              mastered: readBoolean(item.mastered),
              tier: readString(item.tier),
            };
          }),
        }
      : null,
    careerExposure: toArray(record.career_exposure).map((entry) => {
      const e = toRecord(entry);
      return {
        cluster: readString(e.cluster),
        label: readString(e.label),
        count: readNumber(e.count),
        titles: toArray(e.titles).map((t) => readString(t)),
      };
    }),
    interestDeclaration: {
      declared: toArray(interest.declared).map((d) => readString(d)),
      declaredAt: readNullableString(interest.declared_at),
      invited: readBoolean(interest.invited),
      scenariosCompleted: readNumber(interest.scenarios_completed),
      scenariosRequired: readNumber(interest.scenarios_required),
    },
    report: {
      eligible: readBoolean(report.eligible),
      generatedAt: readNullableString(report.generated_at),
    },
  };
}

// --- challenge mode --------------------------------------------------------

export interface ChallengeModeScoreRow {
  id: number;
  weekStart: string | null;
  conceptLabel: string | null;
  score: number;
  accuracyPct: number;
  speedBonus: number;
  difficultyRating: number;
  items: number;
  submittedAt: string | null;
}

export interface LeaderboardEntry {
  position: number;
  displayName: string;
  score: number;
  isYou: boolean;
}

export interface ChallengeModeState {
  available: boolean;
  eligible: boolean;
  eligibilityReason: string | null;
  eligibilityMessage: string | null;
  minGrade: number;
  optedIn: boolean;
  optedInAt: string | null;
  weekStart: string | null;
  affectsMastery: boolean;
  minItemsToQualify: number;
  leaderboardTopN: number;
  ownScores: ChallengeModeScoreRow[];
  bestScore: number | null;
  leaderboard: {
    visible: boolean;
    reason: string | null;
    weekStart: string | null;
    participants: number;
    firstNamesOnly: boolean;
    entries: LeaderboardEntry[];
  } | null;
}

function readChallengeModeScore(raw: unknown): ChallengeModeScoreRow {
  const record = toRecord(raw);
  return {
    id: readNumber(record.id),
    weekStart: readNullableString(record.week_start),
    conceptLabel: readNullableString(record.concept_label),
    score: readNumber(record.score),
    accuracyPct: readNumber(record.accuracy_pct),
    speedBonus: readNumber(record.speed_bonus),
    difficultyRating: readNumber(record.difficulty_rating),
    items: readNumber(record.items),
    submittedAt: readNullableString(record.submitted_at),
  };
}

export function readLeaderboard(raw: unknown): ChallengeModeState['leaderboard'] {
  if (raw === undefined || raw === null) return null;
  const record = toRecord(raw);
  return {
    visible: readBoolean(record.visible),
    reason: readNullableString(record.reason),
    weekStart: readNullableString(record.week_start),
    participants: readNumber(record.participants),
    firstNamesOnly: readBoolean(record.first_names_only),
    entries: toArray(record.entries).map((entry) => {
      const e = toRecord(entry);
      return {
        position: readNumber(e.position),
        displayName: readString(e.display_name),
        score: readNumber(e.score),
        isYou: readBoolean(e.is_you),
      };
    }),
  };
}

function readChallengeMode(raw: unknown): ChallengeModeState | null {
  if (raw === undefined) return null;
  const record = toRecord(raw);
  const eligibility = toRecord(record.eligibility);
  const rules = toRecord(record.rules);

  return {
    available: readBoolean(record.available),
    eligible: readBoolean(eligibility.eligible),
    eligibilityReason: readNullableString(eligibility.reason),
    eligibilityMessage: readNullableString(eligibility.message),
    minGrade: readNumber(eligibility.min_grade ?? rules.min_grade),
    optedIn: readBoolean(record.opted_in),
    optedInAt: readNullableString(record.opted_in_at),
    weekStart: readNullableString(record.week_start),
    affectsMastery: readBoolean(rules.affects_mastery),
    minItemsToQualify: readNumber(rules.min_items_to_qualify),
    leaderboardTopN: readNumber(rules.leaderboard_top_n),
    ownScores: toArray(record.own_scores).map(readChallengeModeScore),
    bestScore: readNullableNumber(record.best_score),
    leaderboard: readLeaderboard(record.leaderboard),
  };
}

// --- session summary -------------------------------------------------------

export interface SessionSummary {
  available: boolean;
  reason: string | null;
  message: string | null;
  date: string | null;
  attempts: number;
  items: number;
  minutes: number;
  conceptsWorked: string[];
  progress: {
    conceptRef: string;
    conceptLabel: string;
    subjectName: string;
    masteryBefore: number | null;
    masteryAfter: number | null;
    delta: number | null;
    tierBefore: string | null;
    tierAfter: string | null;
    tierChanged: boolean;
    items: number;
    accuracy: number;
  }[];
  specificPraise: string | null;
  nextConcept: { conceptLabel: string; tier: string } | null;
  reviewDue: { conceptLabel: string; daysSince: number } | null;
  streakHeadline: string;
  currentStreak: number;
  badgesEarned: BadgeEntry[];
  personalBests: { metricKey: string; scopeLabel: string | null; value: number; improvementPct: number | null }[];
  celebration: { level: string; kind: string; title: string; message: string } | null;
  careerPathwayLabel: string | null;
  careerSkillProgress: SkillProgress | null;
}

function readSessionSummary(raw: unknown): SessionSummary {
  const record = toRecord(raw);

  if (!readBoolean(record.available)) {
    return {
      available: false,
      reason: readNullableString(record.reason),
      message: readNullableString(record.message),
      date: readNullableString(record.date),
      attempts: 0,
      items: 0,
      minutes: 0,
      conceptsWorked: [],
      progress: [],
      specificPraise: null,
      nextConcept: null,
      reviewDue: null,
      streakHeadline: '',
      currentStreak: 0,
      badgesEarned: [],
      personalBests: [],
      celebration: null,
      careerPathwayLabel: null,
      careerSkillProgress: null,
    };
  }

  const session = toRecord(record.session);
  const upcoming = toRecord(record.upcoming);
  const streak = toRecord(record.streak);
  const career = toRecord(record.career_quest);
  const celebration = toRecord(record.celebration);
  const primary = celebration.primary ? toRecord(celebration.primary) : null;
  const next = upcoming.next_concept ? toRecord(upcoming.next_concept) : null;
  const review = upcoming.review_due ? toRecord(upcoming.review_due) : null;
  const skill = career.skill_progress ? toRecord(career.skill_progress) : null;

  return {
    available: true,
    reason: null,
    message: null,
    date: readNullableString(record.date),
    attempts: readNumber(session.attempts),
    items: readNumber(session.items),
    minutes: readNumber(session.minutes),
    conceptsWorked: toArray(session.concepts_worked).map((c) => readString(c)),
    progress: toArray(record.progress).map((entry) => {
      const p = toRecord(entry);
      return {
        conceptRef: readString(p.concept_ref),
        conceptLabel: readString(p.concept_label),
        subjectName: readString(p.subject_name),
        masteryBefore: readNullableNumber(p.mastery_before),
        masteryAfter: readNullableNumber(p.mastery_after),
        delta: readNullableNumber(p.delta),
        tierBefore: readNullableString(p.tier_before),
        tierAfter: readNullableString(p.tier_after),
        tierChanged: readBoolean(p.tier_changed),
        items: readNumber(p.items),
        accuracy: readNumber(p.accuracy),
      };
    }),
    specificPraise: readNullableString(record.specific_praise),
    nextConcept: next ? { conceptLabel: readString(next.concept_label), tier: readString(next.tier) } : null,
    reviewDue: review
      ? { conceptLabel: readString(review.concept_label), daysSince: readNumber(review.days_since) }
      : null,
    streakHeadline: readString(streak.headline),
    currentStreak: readNumber(streak.current_streak),
    badgesEarned: toArray(record.badges_earned).map(readBadge),
    personalBests: toArray(record.personal_bests).map((entry) => {
      const e = toRecord(entry);
      return {
        metricKey: readString(e.metric_key),
        scopeLabel: readNullableString(e.scope_label),
        value: readNumber(e.value),
        improvementPct: readNullableNumber(e.improvement_pct),
      };
    }),
    celebration: primary
      ? {
          level: readString(primary.level),
          kind: readString(primary.kind),
          title: readString(primary.title),
          message: readString(primary.message),
        }
      : null,
    careerPathwayLabel: readNullableString(career.pathway_label),
    careerSkillProgress: skill
      ? {
          pathway: readString(skill.pathway),
          pathwayLabel: readString(skill.pathway_label),
          mastered: readNumber(skill.mastered),
          target: readNumber(skill.target),
          percent: readNumber(skill.percent),
          targetSource: readString(skill.target_source),
          skills: [],
        }
      : null,
  };
}

// --- overview --------------------------------------------------------------

export interface GamificationOverview {
  available: boolean;
  reason: string | null;
  audience: string;
  learner: {
    learnerId: number;
    name: string;
    firstName: string;
    gradeNumber: number | null;
    standardName: string;
    divisionName: string;
  } | null;
  mastery: MasterySection | null;
  personalBests: PersonalBestBoard | null;
  streak: StreakSummary | null;
  badges: BadgeCollection | null;
  teamChallenges: TeamChallengeEntry[] | null;
  careerQuest: CareerQuest | null;
  challengeMode: ChallengeModeState | null;
  classAggregate: {
    available: boolean;
    classSize: number;
    learnersWithActivity: number;
    tierCounts: Record<string, number>;
    note: string;
  } | null;
  unreadNotifications: number;
  dataSources: {
    palAttempts: number;
    firstAttemptAt: string | null;
    lastAttemptAt: string | null;
    tables: string[];
  };
  visibility: Record<string, string>;
}

export async function fetchOverview(
  scope: LearnerScope = {},
  signal?: AbortSignal
): Promise<GamificationOverview> {
  const data = toRecord(await callApi('api/pal/new/gamification/overview', { query: scopeQuery(scope), signal }));

  if (!readBoolean(data.available)) {
    return {
      available: false,
      reason: readNullableString(data.reason),
      audience: readString(data.audience),
      learner: null,
      mastery: null,
      personalBests: null,
      streak: null,
      badges: null,
      teamChallenges: null,
      careerQuest: null,
      challengeMode: null,
      classAggregate: null,
      unreadNotifications: 0,
      dataSources: { palAttempts: 0, firstAttemptAt: null, lastAttemptAt: null, tables: [] },
      visibility: {},
    };
  }

  const learner = toRecord(data.learner);
  const sources = toRecord(data.data_sources);
  const aggregate = data.class_aggregate === undefined ? null : toRecord(data.class_aggregate);

  return {
    available: true,
    reason: null,
    audience: readString(data.audience),
    learner: {
      learnerId: readNumber(learner.learner_id),
      name: readString(learner.name),
      firstName: readString(learner.first_name),
      gradeNumber: readNullableNumber(learner.grade_number),
      standardName: readString(learner.standard_name),
      divisionName: readString(learner.division_name),
    },
    mastery: readMastery(data.mastery),
    personalBests: readPersonalBestBoard(data.personal_bests),
    streak: readStreak(data.streak),
    badges: readBadgeCollection(data.badges),
    teamChallenges: data.team_challenges === undefined ? null : toArray(data.team_challenges).map(readChallenge),
    careerQuest: readCareerQuest(data.career_quest),
    challengeMode: readChallengeMode(data.challenge_mode),
    classAggregate: aggregate
      ? {
          available: readBoolean(aggregate.available),
          classSize: readNumber(aggregate.class_size),
          learnersWithActivity: readNumber(aggregate.learners_with_activity),
          tierCounts: Object.fromEntries(
            Object.entries(toRecord(aggregate.tier_counts)).map(([k, v]) => [k, readNumber(v)])
          ),
          note: readString(aggregate.note),
        }
      : null,
    unreadNotifications: readNumber(data.unread_notifications),
    dataSources: {
      palAttempts: readNumber(sources.pal_attempts),
      firstAttemptAt: readNullableString(sources.first_attempt_at),
      lastAttemptAt: readNullableString(sources.last_attempt_at),
      tables: toArray(sources.tables).map((t) => readString(t)),
    },
    visibility: Object.fromEntries(
      Object.entries(toRecord(data.visibility)).map(([k, v]) => [k, readString(v)])
    ),
  };
}

// --- per-section fetchers --------------------------------------------------

export async function fetchPersonalBest(scope: LearnerScope = {}, signal?: AbortSignal): Promise<PersonalBestBoard> {
  return readPersonalBestBoard(
    await callApi('api/pal/new/gamification/personal-best', { query: scopeQuery(scope), signal })
  ) as PersonalBestBoard;
}

export async function fetchPersonalBestHistory(
  scope: LearnerScope = {},
  limit = 50,
  signal?: AbortSignal
): Promise<PersonalBestEventRow[]> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/personal-best/history', {
      query: { ...scopeQuery(scope), limit },
      signal,
    })
  );
  return toArray(data.events).map(readPersonalBestEvent);
}

export async function fetchBadges(scope: LearnerScope = {}, signal?: AbortSignal): Promise<BadgeCollection> {
  return readBadgeCollection(
    await callApi('api/pal/new/gamification/badges', { query: scopeQuery(scope), signal })
  ) as BadgeCollection;
}

export async function fetchStreak(scope: LearnerScope = {}, signal?: AbortSignal): Promise<StreakSummary> {
  return readStreak(await callApi('api/pal/new/gamification/streak', { query: scopeQuery(scope), signal })) as StreakSummary;
}

export async function fetchStreakHistory(
  scope: LearnerScope = {},
  days = 120,
  signal?: AbortSignal
): Promise<StreakHistory> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/streak/history', { query: { ...scopeQuery(scope), days }, signal })
  );
  return {
    from: readString(data.from),
    to: readString(data.to),
    days: toArray(data.days).map(readStreakDay),
    qualifiedDays: readNumber(data.qualified_days),
    activeDays: readNumber(data.active_days),
  };
}

export async function fetchTeamChallenges(
  scope: LearnerScope & { standardId?: string | number | null; divisionId?: string | number | null } = {},
  signal?: AbortSignal
): Promise<TeamChallengeBoard> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/team-challenges', {
      query: {
        ...scopeQuery(scope),
        standard_id: scope.standardId ? String(scope.standardId) : undefined,
        division_id: scope.divisionId ? String(scope.divisionId) : undefined,
      },
      signal,
    })
  );

  return {
    challenges: toArray(data.challenges).map(readChallenge),
    types: readChallengeTypes(data.types),
    maxActivePerWeek: readNumber(toRecord(data.rules).max_active_per_class_per_week),
  };
}

export async function createTeamChallenge(input: Record<string, unknown>): Promise<TeamChallengeEntry> {
  return readChallenge(await callApi('api/pal/new/gamification/team-challenges', { method: 'POST', body: input }));
}

export async function endTeamChallenge(challengeId: number, reason: string): Promise<TeamChallengeEntry> {
  return readChallenge(
    await callApi(`api/pal/new/gamification/team-challenges/${challengeId}/end`, {
      method: 'POST',
      body: { reason },
    })
  );
}

export async function fetchCareerQuest(scope: LearnerScope = {}, signal?: AbortSignal): Promise<CareerQuest> {
  return readCareerQuest(
    await callApi('api/pal/new/gamification/career-quest', { query: scopeQuery(scope), signal })
  ) as CareerQuest;
}

export async function declareCareerInterest(
  interests: string[],
  scope: LearnerScope = {}
): Promise<{ declared: string[]; declaredAt: string | null }> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/career-quest/interest', {
      method: 'POST',
      body: { interests, ...scopeQuery(scope) },
    })
  );
  return {
    declared: toArray(data.declared).map((d) => readString(d)),
    declaredAt: readNullableString(data.declared_at),
  };
}

export async function chooseCareerPathway(pathway: string, scope: LearnerScope = {}): Promise<string | null> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/career-quest/pathway', {
      method: 'POST',
      body: { pathway, ...scopeQuery(scope) },
    })
  );
  return readNullableString(data.primary_pathway);
}

export async function generateCareerReport(scope: LearnerScope = {}): Promise<void> {
  await callApi('api/pal/new/gamification/career-quest/report', {
    method: 'POST',
    body: { ...scopeQuery(scope) },
  });
}

export async function fetchChallengeMode(
  scope: LearnerScope = {},
  signal?: AbortSignal
): Promise<ChallengeModeState> {
  return readChallengeMode(
    await callApi('api/pal/new/gamification/challenge-mode', { query: scopeQuery(scope), signal })
  ) as ChallengeModeState;
}

export async function setChallengeModeOptIn(optedIn: boolean, scope: LearnerScope = {}): Promise<boolean> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/challenge-mode/opt-in', {
      method: 'POST',
      body: { opted_in: optedIn, ...scopeQuery(scope) },
    })
  );
  return readBoolean(data.opted_in);
}

export async function fetchLeaderboard(
  scope: LearnerScope = {},
  signal?: AbortSignal
): Promise<ChallengeModeState['leaderboard']> {
  return readLeaderboard(
    await callApi('api/pal/new/gamification/challenge-mode/leaderboard', { query: scopeQuery(scope), signal })
  );
}

export async function fetchSessionSummary(
  scope: LearnerScope & { date?: string } = {},
  signal?: AbortSignal
): Promise<SessionSummary> {
  return readSessionSummary(
    await callApi('api/pal/new/gamification/session-summary', {
      query: { ...scopeQuery(scope), date: scope.date },
      signal,
    })
  );
}

export interface GamificationNotificationRow {
  id: number;
  type: string;
  level: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string | null;
}

export async function fetchNotifications(
  scope: LearnerScope = {},
  signal?: AbortSignal
): Promise<{ items: GamificationNotificationRow[]; unread: number }> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/notifications', { query: scopeQuery(scope), signal })
  );
  return {
    items: toArray(data.items).map((item) => {
      const n = toRecord(item);
      return {
        id: readNumber(n.id),
        type: readString(n.type),
        level: readString(n.level),
        title: readString(n.title),
        body: readNullableString(n.body),
        read: readBoolean(n.read),
        createdAt: readNullableString(n.created_at),
      };
    }),
    unread: readNumber(data.unread),
  };
}

export async function markNotificationsRead(ids: number[], scope: LearnerScope = {}): Promise<number> {
  const data = toRecord(
    await callApi('api/pal/new/gamification/notifications/read', {
      method: 'POST',
      body: { ids, ...scopeQuery(scope) },
    })
  );
  return readNumber(data.marked_read);
}

// --- formatting ------------------------------------------------------------

/**
 * Format a personal-best value for its metric's declared format. The format
 * comes from the API, so adding a metric never needs a change here.
 */
export function formatMetric(value: number | null, format: string): string {
  if (value === null) return '—';
  switch (format) {
    case 'ratio':
      return value.toFixed(2);
    case 'days':
      return `${Math.round(value)} day${Math.round(value) === 1 ? '' : 's'}`;
    case 'minutes':
      return `${Math.round(value)} min`;
    case 'sessions':
      return `${Math.round(value)} session${Math.round(value) === 1 ? '' : 's'}`;
    default:
      return String(Math.round(value));
  }
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Tier accent classes. Stream is never styled as a failure state. */
export function tierTone(tier: string | null | undefined): {
  chip: string;
  bar: string;
  text: string;
} {
  switch (tier) {
    case 'sky':
      return { chip: 'bg-sky-50 text-sky-700 ring-sky-200', bar: 'bg-sky-500', text: 'text-sky-700' };
    case 'mountain':
      return {
        chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
      };
    default:
      return {
        chip: 'bg-slate-100 text-slate-600 ring-slate-200',
        bar: 'bg-slate-400',
        text: 'text-slate-600',
      };
  }
}
