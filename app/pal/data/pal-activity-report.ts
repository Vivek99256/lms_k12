import { buildSessionContext, readString, type SessionContext } from '@/lib/erp-client';

/**
 * PAL Student Activity & Performance Report — data layer.
 *
 * Backend: new endpoints under the SAME `api/pal/eso` base path pal-eso.ts
 * already calls for the Coverage/Attainment report (EsoEngineController's
 * route group, `pal.auth` JWT auth):
 *
 *   GET /api/pal/eso/reports/activity/{learnerId}            — one student, JSON
 *   GET /api/pal/eso/reports/activity/class                  — one class, JSON (aggregated, not itemized)
 *   GET /api/pal/eso/reports/activity/{learnerId}/download    — one student, .docx
 *   GET /api/pal/eso/reports/activity/class/download          — one class, .docx
 *
 * Query params are the backend's own snake_case (`subject_id`, `section_id`,
 * `from`, `to`, `standard_id`) — NOT the `standardId`/`subjectId` camelCase
 * fetchAttainmentReport() sends, because that is a different, older pair of
 * routes on this same controller family with its own param convention. The
 * two must not be conflated.
 *
 * Request/response handling mirrors pal-diagnostic.ts's private
 * session()/params()/headers() triplet in SHAPE (small local helpers rather
 * than inlining buildSessionContext()/createAuthHeaders() at every call
 * site), but the actual auth (Bearer token, no sub_institute_id/type=API) and
 * envelope (`{success, message, data}`, 401/403/422 messages) match
 * pal-eso.ts's esoFetch, because these routes live on that same controller.
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function session(): SessionContext {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  if (!ctx.token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return ctx;
}

interface ActivityReportFilters {
  syear: string;
  subjectId?: string;
  sectionId?: string;
  from?: string;
  to?: string;
}

/** The backend's own snake_case query params — see the file header note. */
function params(filters: ActivityReportFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.syear) search.set('syear', filters.syear);
  if (filters.subjectId) search.set('subject_id', filters.subjectId);
  if (filters.sectionId) search.set('section_id', filters.sectionId);
  if (filters.from) search.set('from', filters.from);
  if (filters.to) search.set('to', filters.to);
  return search;
}

function headers(ctx: SessionContext): HeadersInit {
  return {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    Authorization: `Bearer ${ctx.token}`,
  };
}

/**
 * Low-level JSON GET against this controller's envelope, matching
 * pal-eso.ts's esoFetch error handling exactly — same backend, same shape.
 * Kept local (not imported from pal-eso.ts) because that helper is private
 * there too; duplicating a dozen lines here is cheaper than exporting it
 * purely for one more file to share.
 */
async function fetchJson(path: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const ctx = session();
  const response = await fetch(`${ctx.baseUrl}/${path.replace(/^\//, '')}`, {
    headers: headers(ctx),
    signal,
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
    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to view this report.');
    }
    if (response.status === 422) {
      throw new Error(serverMessage || 'That request was rejected — check the required fields.');
    }
    throw new Error(serverMessage || 'This feature is not available right now. Please try again later.');
  }

  if (record.success === false) {
    throw new Error(readString(record.message) || 'Couldn’t load the report.');
  }

  return toRecord('data' in record ? record.data : payload);
}

// --- shared types ------------------------------------------------------

export interface ActivityReportScope {
  learnerId: string | null;
  learnerName: string | null;
  standardId: string | null;
  standardName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  syear: string | null;
  from: string | null;
  to: string | null;
}

export interface ActivityMasteryByChapter {
  chapterId: string;
  chapterName: string;
  mastered: number;
  learning: number;
  unseen: number;
}

export interface ActivityMasteryOverview {
  /** 'learner_node_state' — where this read came from. */
  source: string;
  nodesTotal: number;
  mastered: number;
  learning: number;
  unseen: number;
  misconceptionFlagged: number;
  masteryEstimateAvg: number;
  byChapter: ActivityMasteryByChapter[];
}

export interface ActivityDiagnosticTrendPoint {
  date: string;
  percentage: number;
}

export interface ActivityDiagnosticPerformance {
  attemptsCount: number;
  avgPercentage: number;
  trend: ActivityDiagnosticTrendPoint[];
  byDifficultyBand: Record<string, number>;
}

export interface ActivityAdaptivePerformance {
  responsesCount: number;
  accuracy: number;
  ruleFiredBreakdown: Record<string, number>;
}

export interface ActivityTopMisconception {
  tag: string;
  description: string;
  correctiveAction: string;
  detectionCount: number;
}

export interface ActivityMisconceptionAnalysis {
  activeCount: number;
  topMisconceptions: ActivityTopMisconception[];
}

export interface ActivityStreak {
  currentStreak: number | null;
  longestStreak: number | null;
  totalActiveDays: number | null;
  lastActiveDate: string | null;
}

export interface ActivityBadge {
  badgeId: string;
  name: string;
  category: string | null;
  scopeKey: string | null;
  awardedAt: string | null;
}

export interface ActivityGamification {
  hasSufficientData: boolean;
  streak: ActivityStreak | null;
  badges: ActivityBadge[];
  /** Only present on the class-report shape — e.g. "3 of 25 students have gamification data". */
  message: string | null;
  studentsWithData?: number;
  studentsTotal?: number;
}

export interface ActivityEngagement {
  hasSufficientData: boolean;
  message: string;
}

// --- learning intelligence (student-report only) ------------------------
//
// Added by a parallel backend task under the SAME envelope this file already
// parses — present only on the per-student report (never on the class
// report: the backend's class-report path has no cohort-level version of
// any of these engines). Field names below are the backend's own stated
// shape but are read defensively (same null-safe toRecord/toArray/num/
// readString helpers as every other readXxx() in this file) since the
// backend task may still adjust minor details.

export type ActivityRiskKind = 'disengagement' | 'failure' | 'burnout';

export interface ActivityRiskSignal {
  label: string;
  value: number;
}

export interface ActivityRiskAssessment {
  hasData: boolean;
  riskScore: number | null;
  riskLevel: string | null;
  signals: ActivityRiskSignal[];
  recommendedActions: string[];
}

export interface ActivityRisk {
  disengagement: ActivityRiskAssessment;
  failure: ActivityRiskAssessment;
  burnout: ActivityRiskAssessment;
}

export interface ActivityVelocity {
  hasData: boolean;
  asOf: string | null;
  daysSinceEvidence: number | null;
  conceptsMastered: number | null;
  velocity: number | null;
  velocityPercentile: number | null;
  classification: string | null;
}

export interface ActivityPlateau {
  hasData: boolean;
  asOf: string | null;
  isPlateau: boolean | null;
  daysInPlateau: number | null;
  recommendedActions: string[];
}

export interface ActivityRegression {
  hasData: boolean;
  asOf: string | null;
  isRegressing: boolean | null;
  declinePercent: number | null;
  recommendedActions: string[];
}

export interface ActivityRemediation {
  tag: string;
  contentExcerpt: string;
}

export interface ActivityIntelligence {
  stalenessNote: string;
  velocity: ActivityVelocity;
  plateau: ActivityPlateau;
  regression: ActivityRegression;
  risk: ActivityRisk;
  remediation: ActivityRemediation | null;
}

interface ActivityReportBase {
  scope: ActivityReportScope;
  masteryOverview: ActivityMasteryOverview;
  diagnosticPerformance: ActivityDiagnosticPerformance;
  adaptivePerformance: ActivityAdaptivePerformance;
  misconceptionAnalysis: ActivityMisconceptionAnalysis;
  gamification: ActivityGamification;
  engagement: ActivityEngagement;
}

export interface StudentActivityReport extends ActivityReportBase {
  recommendations: string[];
  /**
   * Only ever set on the student report — the backend's class-report path
   * has no cohort-level version of velocity/plateau/regression/risk, so this
   * stays undefined there rather than being inherited via ActivityReportBase.
   */
  intelligence?: ActivityIntelligence;
}

export interface ClassActivityReport extends ActivityReportBase {
  actionItems: string[];
}

// --- parsing -------------------------------------------------------------

function readScope(raw: unknown): ActivityReportScope {
  const r = toRecord(raw);
  const str = (key: string) => (r[key] == null ? null : readString(r[key]));
  return {
    learnerId: str('learner_id'),
    learnerName: str('learner_name'),
    standardId: str('standard_id'),
    standardName: str('standard_name'),
    sectionId: str('section_id'),
    sectionName: str('section_name'),
    subjectId: str('subject_id'),
    subjectName: str('subject_name'),
    syear: str('syear'),
    from: str('from'),
    to: str('to'),
  };
}

function readMasteryByChapter(raw: unknown): ActivityMasteryByChapter[] {
  return toArray(raw).map((entry) => {
    const row = toRecord(entry);
    return {
      chapterId: readString(row.chapter_id),
      chapterName: readString(row.chapter_name),
      mastered: num(row.mastered),
      learning: num(row.learning),
      unseen: num(row.unseen),
    };
  });
}

function readMasteryOverview(raw: unknown): ActivityMasteryOverview {
  const r = toRecord(raw);
  return {
    source: readString(r.source) || 'learner_node_state',
    nodesTotal: num(r.nodes_total),
    mastered: num(r.mastered),
    learning: num(r.learning),
    unseen: num(r.unseen),
    misconceptionFlagged: num(r.misconception_flagged),
    masteryEstimateAvg: num(r.mastery_estimate_avg),
    byChapter: readMasteryByChapter(r.by_chapter),
  };
}

function readTrend(raw: unknown): ActivityDiagnosticTrendPoint[] {
  return toArray(raw).map((entry) => {
    const row = toRecord(entry);
    return { date: readString(row.date), percentage: num(row.percentage) };
  });
}

function readNumberRecord(raw: unknown): Record<string, number> {
  const r = toRecord(raw);
  const out: Record<string, number> = {};
  Object.entries(r).forEach(([key, value]) => {
    out[key] = num(value);
  });
  return out;
}

function readDiagnosticPerformance(raw: unknown): ActivityDiagnosticPerformance {
  const r = toRecord(raw);
  return {
    attemptsCount: num(r.attempts_count),
    avgPercentage: num(r.avg_percentage),
    trend: readTrend(r.trend),
    byDifficultyBand: readNumberRecord(r.by_difficulty_band),
  };
}

function readAdaptivePerformance(raw: unknown): ActivityAdaptivePerformance {
  const r = toRecord(raw);
  return {
    responsesCount: num(r.responses_count),
    accuracy: num(r.accuracy),
    ruleFiredBreakdown: readNumberRecord(r.rule_fired_breakdown),
  };
}

function readTopMisconceptions(raw: unknown): ActivityTopMisconception[] {
  return toArray(raw).map((entry) => {
    const row = toRecord(entry);
    return {
      tag: readString(row.tag),
      description: readString(row.description),
      correctiveAction: readString(row.corrective_action),
      detectionCount: num(row.detection_count),
    };
  });
}

function readMisconceptionAnalysis(raw: unknown): ActivityMisconceptionAnalysis {
  const r = toRecord(raw);
  return {
    activeCount: num(r.active_count),
    topMisconceptions: readTopMisconceptions(r.top_misconceptions),
  };
}

function readStreak(raw: unknown): ActivityStreak | null {
  if (raw == null) return null;
  const r = toRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    currentStreak: r.current_streak == null ? null : num(r.current_streak),
    longestStreak: r.longest_streak == null ? null : num(r.longest_streak),
    totalActiveDays: r.total_active_days == null ? null : num(r.total_active_days),
    lastActiveDate: r.last_active_date == null ? null : readString(r.last_active_date),
  };
}

function readBadges(raw: unknown): ActivityBadge[] {
  return toArray(raw).map((entry) => {
    const row = toRecord(entry);
    return {
      badgeId: readString(row.badge_id),
      name: readString(row.name),
      category: row.category == null ? null : readString(row.category),
      scopeKey: row.scope_key == null ? null : readString(row.scope_key),
      awardedAt: row.awarded_at == null ? null : readString(row.awarded_at),
    };
  });
}

function readGamification(raw: unknown): ActivityGamification {
  const r = toRecord(raw);
  return {
    hasSufficientData: r.has_sufficient_data === true,
    streak: readStreak(r.streak),
    badges: readBadges(r.badges),
    message: r.message == null ? null : readString(r.message),
    studentsWithData: r.students_with_data == null ? undefined : num(r.students_with_data),
    studentsTotal: r.students_total == null ? undefined : num(r.students_total),
  };
}

function readEngagement(raw: unknown): ActivityEngagement {
  const r = toRecord(raw);
  return {
    hasSufficientData: r.has_sufficient_data === true,
    message: readString(r.message),
  };
}

function humanizeSignalLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * PredictiveInterventionEngine returns `signals` as a flat object map
 * (`{success_rate_trend: 0, mastery_gaps: 0, ...}`), not an array of
 * {label, value} pairs — confirmed against a live engine call, where the
 * array-only parsing this started with silently dropped every signal
 * (`toArray()` only accepts actual arrays). Handles both shapes so a future
 * change to an array-of-pairs response still works.
 */
function readRiskSignals(raw: unknown): ActivityRiskSignal[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      const row = toRecord(entry);
      return { label: readString(row.label), value: num(row.value) };
    });
  }

  return Object.entries(toRecord(raw)).map(([key, value]) => ({
    label: humanizeSignalLabel(key),
    value: num(value),
  }));
}

function readRiskAssessment(raw: unknown): ActivityRiskAssessment {
  const r = toRecord(raw);
  return {
    hasData: r.has_data === true,
    riskScore: r.risk_score == null ? null : num(r.risk_score),
    riskLevel: r.risk_level == null ? null : readString(r.risk_level),
    signals: readRiskSignals(r.signals),
    recommendedActions: toArray(r.recommended_actions).map((a) => readString(a)).filter(Boolean),
  };
}

function readRisk(raw: unknown): ActivityRisk {
  const r = toRecord(raw);
  return {
    disengagement: readRiskAssessment(r.disengagement),
    failure: readRiskAssessment(r.failure),
    burnout: readRiskAssessment(r.burnout),
  };
}

function readVelocity(raw: unknown): ActivityVelocity {
  const r = toRecord(raw);
  return {
    hasData: r.has_data === true,
    asOf: r.as_of == null ? null : readString(r.as_of),
    daysSinceEvidence: r.days_since_evidence == null ? null : num(r.days_since_evidence),
    conceptsMastered: r.concepts_mastered == null ? null : num(r.concepts_mastered),
    velocity: r.velocity == null ? null : num(r.velocity),
    velocityPercentile: r.velocity_percentile == null ? null : num(r.velocity_percentile),
    classification: r.classification == null ? null : readString(r.classification),
  };
}

function readPlateau(raw: unknown): ActivityPlateau {
  const r = toRecord(raw);
  return {
    hasData: r.has_data === true,
    asOf: r.as_of == null ? null : readString(r.as_of),
    isPlateau: r.is_plateau == null ? null : r.is_plateau === true,
    daysInPlateau: r.days_in_plateau == null ? null : num(r.days_in_plateau),
    recommendedActions: toArray(r.recommended_actions).map((a) => readString(a)).filter(Boolean),
  };
}

function readRegression(raw: unknown): ActivityRegression {
  const r = toRecord(raw);
  return {
    hasData: r.has_data === true,
    asOf: r.as_of == null ? null : readString(r.as_of),
    isRegressing: r.is_regressing == null ? null : r.is_regressing === true,
    declinePercent: r.decline_percent == null ? null : num(r.decline_percent),
    recommendedActions: toArray(r.recommended_actions).map((a) => readString(a)).filter(Boolean),
  };
}

/** null when the backend sends nothing or an empty object — there is no active top misconception to remediate, which is not itself bad news worth a placeholder. */
function readRemediation(raw: unknown): ActivityRemediation | null {
  if (raw == null) return null;
  const r = toRecord(raw);
  if (Object.keys(r).length === 0) return null;
  const tag = readString(r.tag);
  const contentExcerpt = readString(r.content_excerpt);
  if (!tag && !contentExcerpt) return null;
  return { tag, contentExcerpt };
}

function readIntelligence(raw: unknown): ActivityIntelligence {
  const r = toRecord(raw);
  return {
    stalenessNote: readString(r.staleness_note),
    velocity: readVelocity(r.velocity),
    plateau: readPlateau(r.plateau),
    regression: readRegression(r.regression),
    risk: readRisk(r.risk),
    remediation: readRemediation(r.remediation),
  };
}

function readActivityBase(data: Record<string, unknown>): ActivityReportBase {
  return {
    scope: readScope(data.scope),
    masteryOverview: readMasteryOverview(data.mastery_overview),
    diagnosticPerformance: readDiagnosticPerformance(data.diagnostic_performance),
    adaptivePerformance: readAdaptivePerformance(data.adaptive_performance),
    misconceptionAnalysis: readMisconceptionAnalysis(data.misconception_analysis),
    gamification: readGamification(data.gamification),
    engagement: readEngagement(data.engagement),
  };
}

// --- reads -----------------------------------------------------------------

export async function fetchStudentActivityReport(
  studentId: string,
  syear: string,
  opts: { subjectId?: string; from?: string; to?: string; signal?: AbortSignal } = {}
): Promise<StudentActivityReport> {
  const search = params({ syear, subjectId: opts.subjectId, from: opts.from, to: opts.to });
  const data = await fetchJson(
    `api/pal/eso/reports/activity/${studentId}?${search.toString()}`,
    opts.signal
  );
  const base: StudentActivityReport = {
    ...readActivityBase(data),
    recommendations: toArray(data.recommendations).map((r) => readString(r)).filter(Boolean),
  };
  // Optional on purpose: an older backend (or the class-report shape, if this
  // function were ever pointed at it) has no `intelligence` key at all, and
  // producing a bogus empty object for that case would be indistinguishable
  // from a real "no data in any dimension" reading.
  if (data.intelligence != null) {
    base.intelligence = readIntelligence(data.intelligence);
  }
  return base;
}

export async function fetchClassActivityReport(
  standardId: string,
  syear: string,
  opts: { sectionId?: string; subjectId?: string; from?: string; to?: string; signal?: AbortSignal } = {}
): Promise<ClassActivityReport> {
  const search = params({
    syear,
    subjectId: opts.subjectId,
    sectionId: opts.sectionId,
    from: opts.from,
    to: opts.to,
  });
  search.set('standard_id', standardId);
  const data = await fetchJson(`api/pal/eso/reports/activity/class?${search.toString()}`, opts.signal);
  return {
    ...readActivityBase(data),
    actionItems: toArray(data.action_items).map((r) => readString(r)).filter(Boolean),
  };
}

// --- download ----------------------------------------------------------

/**
 * The server-generated .docx for either scope. `targetId` is the learner id
 * for `scope: 'student'`, or the standard id for `scope: 'class'` — matching
 * which one is a URL segment and which is a query param on the JSON reads
 * above.
 *
 * Deliberately does NOT reuse headers()/fetchJson() above: this is a binary
 * response, not JSON, so it sends only `Authorization` (no `Accept:
 * application/json`) and resolves to a Blob rather than a parsed envelope —
 * per lib/erp-client.ts's own note, createAuthHeaders() is JSON-only and must
 * not be reused for a non-JSON response.
 */
export async function fetchActivityReportDocx(
  scope: 'student' | 'class',
  targetId: string,
  syear: string,
  opts: {
    subjectId?: string;
    sectionId?: string;
    from?: string;
    to?: string;
    signal?: AbortSignal;
  } = {}
): Promise<Blob> {
  const ctx = session();
  const search = params({
    syear,
    subjectId: opts.subjectId,
    sectionId: scope === 'class' ? opts.sectionId : undefined,
    from: opts.from,
    to: opts.to,
  });

  const path =
    scope === 'class'
      ? 'api/pal/eso/reports/activity/class/download'
      : `api/pal/eso/reports/activity/${targetId}/download`;
  if (scope === 'class') {
    search.set('standard_id', targetId);
  }

  const response = await fetch(`${ctx.baseUrl}/${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
    signal: opts.signal,
  });

  if (!response.ok) {
    let message = `Couldn’t prepare the document (${response.status}).`;
    try {
      const text = await response.text();
      const parsed = toRecord(JSON.parse(text));
      const serverMessage = readString(parsed.message);
      if (serverMessage) message = serverMessage;
    } catch {
      // The server returned a non-JSON error body (e.g. a plain 500 page) —
      // the generic message above is the honest thing to show.
    }
    throw new Error(message);
  }

  return response.blob();
}
