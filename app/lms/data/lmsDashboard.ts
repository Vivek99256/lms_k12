import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → LMS Dashboard data layer (student learning dashboard).
 *
 *   GET /lms/lmsdashboard?type=API&sub_institute_id&syear&user_id&user_profile
 *
 * The controller already honours type=API for tenant/user overrides; we also pass
 * user_profile (headless fallback). The response nests result data produced by
 * resultAPIController (previousData / selectedCurrentData). Those leaf shapes vary,
 * so everything here is parsed defensively and degrades to empty sections.
 *
 * For a teacher/admin, pick a student first (via the class student list) and pass
 * that student's id as `userId` with user_profile="Teacher".
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
/** Values of a record OR entries of an array — many result nodes use either. */
function toValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(record[key]).trim();
    if (value) return value;
  }
  return '';
}
function pickNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') return readNumber(record[key]);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardProfile {
  name: string;
  enrollmentNo: string;
  image: string;
}

export interface StandardTimelineEntry {
  standardName: string;
  syear: string;
}

export interface SubjectScore {
  name: string;
  obtain: number;
  total: number;
  percent: number;
}

export interface PastStandardGroup {
  label: string;
  subjects: SubjectScore[];
}

export interface ChapterRow {
  title: string;
  obtain: number;
  total: number;
  percent: number;
}

export interface CurrentSubject {
  name: string;
  percent: number;
  chapters: ChapterRow[];
}

export interface LmsDashboard {
  profile: DashboardProfile;
  standardCount: number;
  timeline: StandardTimelineEntry[];
  pastGroups: PastStandardGroup[];
  currentSubjects: CurrentSubject[];
}

export interface DashboardRequest {
  userId: string;
  userProfile: string;
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

function studentName(r: Record<string, unknown>): string {
  const composed = [r.first_name, r.middle_name, r.last_name]
    .map((v) => readString(v).trim())
    .filter(Boolean)
    .join(' ');
  return composed || readString(r.name).trim() || readString(r.student_name).trim();
}

function mapSubjectScore(entry: unknown): SubjectScore | null {
  const r = toRecord(entry);
  const name = pick(r, ['subjectname', 'subject_name', 'title', 'display_name']);
  if (!name) return null;
  const total = pickNumber(r, ['totalmarks', 'total_marks', 'total']);
  const obtain = pickNumber(r, ['totalobtain', 'total_obtain', 'obtain', 'obtain_marks']);
  return { name, obtain, total, percent: total > 0 ? clampPercent((obtain / total) * 100) : 0 };
}

function extractPastGroups(previousData: unknown): PastStandardGroup[] {
  const overall = toRecord(toRecord(previousData).previousdata).overallresult;
  const record = toRecord(overall);
  const groups: PastStandardGroup[] = [];
  for (const [key, value] of Object.entries(record)) {
    const subjects = toValues(value)
      .map(mapSubjectScore)
      .filter((s): s is SubjectScore => s !== null);
    if (subjects.length > 0) groups.push({ label: `Standard ${key}`, subjects });
  }
  // Some payloads deliver overallresult as a flat array instead of a std-keyed map.
  if (groups.length === 0 && Array.isArray(overall)) {
    const subjects = overall.map(mapSubjectScore).filter((s): s is SubjectScore => s !== null);
    if (subjects.length > 0) groups.push({ label: 'Overall', subjects });
  }
  return groups;
}

function mapChapter(entry: unknown): ChapterRow | null {
  const r = toRecord(entry);
  const title = pick(r, ['title', 'chapter_name', 'name']);
  if (!title) return null;
  const total = pickNumber(r, ['totalmarks', 'total_marks', 'total']);
  const obtain = pickNumber(r, ['totalobtain', 'total_obtain', 'obtain', 'obtain_marks']);
  return { title, obtain, total, percent: total > 0 ? clampPercent((obtain / total) * 100) : 0 };
}

function extractCurrentSubjects(selectedCurrentData: unknown): CurrentSubject[] {
  const currentRoot = toRecord(toRecord(selectedCurrentData).currentdata);
  const subjectData = toRecord(currentRoot.subjectdata);
  const subjects: CurrentSubject[] = [];

  for (const [subId, value] of Object.entries(subjectData)) {
    const node = toRecord(value);
    const meta = toRecord(node.subjectdata);
    const name = pick(meta, ['title', 'subjectname', 'subject_name', 'display_name']) || `Subject ${subId}`;

    // chapterdata may be keyed by subject id or delivered as a flat array.
    const chapterContainer = node.chapterdata ?? node.chapters;
    let chapterEntries: unknown[] = [];
    if (Array.isArray(chapterContainer)) {
      chapterEntries = chapterContainer;
    } else {
      const byId = toRecord(chapterContainer)[subId];
      chapterEntries = Array.isArray(byId) ? byId : toValues(chapterContainer).flatMap(toArray);
    }

    const chapters = chapterEntries.map(mapChapter).filter((c): c is ChapterRow => c !== null);
    const totSum = chapters.reduce((s, c) => s + c.total, 0);
    const obtSum = chapters.reduce((s, c) => s + c.obtain, 0);
    const percent = totSum > 0 ? clampPercent((obtSum / totSum) * 100) : 0;

    subjects.push({ name, percent, chapters });
  }
  return subjects;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchLmsDashboard(
  request: DashboardRequest,
  signal?: AbortSignal
): Promise<LmsDashboard> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsdashboard`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('user_id', request.userId);
  url.searchParams.set('user_profile', request.userProfile);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the dashboard.`);
  const raw = toRecord(await readJson(res, 'Failed to load the dashboard'));

  const studentRecord = toRecord(raw.studentData);
  const profile: DashboardProfile = {
    name: studentName(studentRecord),
    enrollmentNo: readString(studentRecord.enrollment_no),
    image: readString(studentRecord.image),
  };

  const timeline: StandardTimelineEntry[] = toArray(raw.standardData).map((entry) => {
    const r = toRecord(entry);
    return { standardName: readString(r.standardName), syear: readString(r.syear) };
  });

  return {
    profile,
    standardCount: readNumber(raw.standardCount) || timeline.length,
    timeline,
    pastGroups: extractPastGroups(raw.previousData),
    currentSubjects: extractCurrentSubjects(raw.selectedCurrentData),
  };
}
