'use client';

/**
 * Teacher Learning Insights' data layer — composes three existing,
 * already-scoped PAL reporting endpoints (StudentActivityReportController),
 * all under ordinary pal.auth institute/class scoping (requireClassScope()),
 * following the same local-fetch-helper convention every other PAL data
 * module uses.
 */

import { buildSessionContext } from '@/lib/erp-client';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
    if (response.status === 403) throw new Error(serverMessage || 'You are not allowed to view this class.');
    if (response.status === 422) throw new Error(serverMessage || 'That request was rejected — check the required fields.');
    throw new Error(serverMessage || 'This feature is not available right now. Please try again later.');
  }

  if (record.success === false) {
    throw new Error(readString(record.message) || 'Teacher Insights request failed.');
  }

  return 'data' in record ? record.data : payload;
}

export interface ClassReportParams {
  standardId: string;
  syear: string;
  sectionId?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

function queryFor(params: ClassReportParams): string {
  const q = new URLSearchParams({ standard_id: params.standardId, syear: params.syear });
  if (params.sectionId) q.set('section_id', params.sectionId);
  if (params.subjectId) q.set('subject_id', params.subjectId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return q.toString();
}

export interface ChapterMastery {
  chapterId: number | null;
  chapterName: string;
  nodesTotal: number;
  mastered: number;
  learning: number;
  unseen: number;
  misconceptionFlagged: number;
  masteryEstimateAvg: number | null;
}

export interface MasteryOverview {
  nodesTotal: number;
  mastered: number;
  learning: number;
  unseen: number;
  misconceptionFlagged: number;
  masteryEstimateAvg: number | null;
  byChapter: ChapterMastery[];
}

function mapMasteryOverview(raw: unknown): MasteryOverview {
  const r = toRecord(raw);
  return {
    nodesTotal: num(r.nodes_total),
    mastered: num(r.mastered),
    learning: num(r.learning),
    unseen: num(r.unseen),
    misconceptionFlagged: num(r.misconception_flagged),
    masteryEstimateAvg: numOrNull(r.mastery_estimate_avg),
    byChapter: toArray(r.by_chapter).map((row) => {
      const c = toRecord(row);
      return {
        chapterId: numOrNull(c.chapter_id),
        chapterName: readString(c.chapter_name),
        nodesTotal: num(c.nodes_total),
        mastered: num(c.mastered),
        learning: num(c.learning),
        unseen: num(c.unseen),
        misconceptionFlagged: num(c.misconception_flagged),
        masteryEstimateAvg: numOrNull(c.mastery_estimate_avg),
      };
    }),
  };
}

export interface TopMisconception {
  id: number;
  tag: string;
  description: string | null;
  correctiveAction: string | null;
  detectionCount: number;
}

export interface MisconceptionAnalysis {
  activeCount: number;
  topMisconceptions: TopMisconception[];
}

function mapMisconceptionAnalysis(raw: unknown): MisconceptionAnalysis {
  const r = toRecord(raw);
  return {
    activeCount: num(r.active_count),
    topMisconceptions: toArray(r.top_misconceptions).map((row) => {
      const m = toRecord(row);
      return {
        id: num(m.id),
        tag: readString(m.tag),
        description: m.description == null ? null : readString(m.description),
        correctiveAction: m.corrective_action == null ? null : readString(m.corrective_action),
        detectionCount: num(m.detection_count),
      };
    }),
  };
}

export interface DiagnosticPerformance {
  attemptsCount: number;
  avgPercentage: number | null;
}

export interface AdaptivePerformance {
  responsesCount: number;
  accuracy: number | null;
}

export interface ClassReport {
  scope: { standardId: number; sectionId: number | null; subjectId: number | null; syear: string; studentCount: number };
  masteryOverview: MasteryOverview;
  misconceptionAnalysis: MisconceptionAnalysis;
  diagnosticPerformance: DiagnosticPerformance;
  adaptivePerformance: AdaptivePerformance;
  actionItems: string[];
}

export async function fetchClassReport(params: ClassReportParams, signal?: AbortSignal): Promise<ClassReport> {
  const data = toRecord(await fetchJson(`api/pal/eso/reports/activity/class?${queryFor(params)}`, signal));
  const scope = toRecord(data.scope);
  const diagnostic = toRecord(data.diagnostic_performance);
  const adaptive = toRecord(data.adaptive_performance);

  return {
    scope: {
      standardId: num(scope.standard_id),
      sectionId: numOrNull(scope.section_id),
      subjectId: numOrNull(scope.subject_id),
      syear: readString(scope.syear),
      studentCount: num(scope.student_count),
    },
    masteryOverview: mapMasteryOverview(data.mastery_overview),
    misconceptionAnalysis: mapMisconceptionAnalysis(data.misconception_analysis),
    diagnosticPerformance: { attemptsCount: num(diagnostic.attempts_count), avgPercentage: numOrNull(diagnostic.avg_percentage) },
    adaptivePerformance: { responsesCount: num(adaptive.responses_count), accuracy: numOrNull(adaptive.accuracy) },
    actionItems: toArray(data.action_items).map((s) => readString(s)),
  };
}

export type RosterBucket = 'not_started' | 'mastered' | 'declining' | 'stuck' | 'learning';

export interface RosterRow {
  studentId: number;
  name: string | null;
  masteredPct: number | null;
  bucket: RosterBucket;
}

const KNOWN_BUCKETS: RosterBucket[] = ['not_started', 'mastered', 'declining', 'stuck', 'learning'];

/**
 * The named-student counterpart to fetchClassReport() — one row per
 * student, bucketed mastered/learning/stuck/declining/not_started. See
 * StudentActivityReportService::buildCohortRoster() on the backend. This is
 * the real source for "students who are stuck or need intervention."
 */
export async function fetchClassRoster(params: ClassReportParams, signal?: AbortSignal): Promise<RosterRow[]> {
  const data = await fetchJson(`api/pal/eso/reports/activity/class/roster?${queryFor(params)}`, signal);
  return toArray(data).map((row) => {
    const r = toRecord(row);
    const bucket = readString(r.bucket);
    return {
      studentId: num(r.student_id),
      name: r.name == null ? null : readString(r.name),
      masteredPct: numOrNull(r.mastered_pct),
      bucket: (KNOWN_BUCKETS as string[]).includes(bucket) ? (bucket as RosterBucket) : 'not_started',
    };
  });
}

export interface StudentReportParams {
  learnerId: string;
  syear: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

export interface StudentReport {
  scope: { learnerId: number; learnerName: string | null; standardId: number | null; sectionId: number | null };
  masteryOverview: MasteryOverview;
  misconceptionAnalysis: MisconceptionAnalysis;
  diagnosticPerformance: DiagnosticPerformance;
  adaptivePerformance: AdaptivePerformance;
  recommendations: string[];
}

export async function fetchStudentReport(params: StudentReportParams, signal?: AbortSignal): Promise<StudentReport> {
  const q = new URLSearchParams({ syear: params.syear });
  if (params.subjectId) q.set('subject_id', params.subjectId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);

  const data = toRecord(await fetchJson(`api/pal/eso/reports/activity/${params.learnerId}?${q.toString()}`, signal));
  const scope = toRecord(data.scope);
  const diagnostic = toRecord(data.diagnostic_performance);
  const adaptive = toRecord(data.adaptive_performance);

  return {
    scope: {
      learnerId: num(scope.learner_id),
      learnerName: scope.learner_name == null ? null : readString(scope.learner_name),
      standardId: numOrNull(scope.standard_id),
      sectionId: numOrNull(scope.section_id),
    },
    masteryOverview: mapMasteryOverview(data.mastery_overview),
    misconceptionAnalysis: mapMisconceptionAnalysis(data.misconception_analysis),
    diagnosticPerformance: { attemptsCount: num(diagnostic.attempts_count), avgPercentage: numOrNull(diagnostic.avg_percentage) },
    adaptivePerformance: { responsesCount: num(adaptive.responses_count), accuracy: numOrNull(adaptive.accuracy) },
    recommendations: toArray(data.recommendations).map((s) => readString(s)),
  };
}
