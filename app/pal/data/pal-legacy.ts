import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';
import type { PalAttempt, PalLandingData, PalStudentSelection, PalSubject } from '@/app/pal/data/pal';
import type { ClassFilter, PalClassStudent } from '@/app/pal/data/pal-lookups';

/**
 * Legacy fallbacks used ONLY when the new PAL Workspace API
 * (`/api/pal/workspace/*`) is not deployed yet (the frontend gets a 404). These
 * reproduce the pre-refactor behaviour against endpoints that are already live:
 *   - students        POST /get_adminStudentList
 *   - subjects+chapters POST /api/lms-courses   (institute catalog, cached)
 *   - attempts        GET  /lms/pal?type=API
 *
 * Once the backend is deployed these are never reached — the primary path wins.
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

function readSessionExtras() {
  if (typeof window === 'undefined') return { userProfileName: '', userProfileId: '', clientId: '' };
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return {
      userProfileName: readString(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile),
      userProfileId: readString(menuContext.user_profile_id ?? userData.user_profile_id),
      clientId: readString(menuContext.client_id ?? userData.client_id),
    };
  } catch {
    return { userProfileName: '', userProfileId: '', clientId: '' };
  }
}

// ---------------------------------------------------------------------------
// Students — POST /get_adminStudentList
// ---------------------------------------------------------------------------

export async function legacyFetchStudents(
  filter: ClassFilter,
  signal?: AbortSignal
): Promise<PalClassStudent[]> {
  const session = requireSession();
  const form = new URLSearchParams();
  form.set('type', 'API');
  form.set('sub_institute_id', session.subInstituteId);
  form.set('syear', session.syear);
  if (session.token) form.set('token', session.token);
  if (filter.gradeId) form.set('grade_id', filter.gradeId);
  if (filter.standardId) form.set('standard_id', filter.standardId);
  if (filter.divisionId) form.set('division_id', filter.divisionId);

  const res = await fetch(`${session.baseUrl}/get_adminStudentList`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
    body: form.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load students.`);
  const payload = toRecord(await res.json());
  return toArray(payload.data).map((entry) => {
    const r = toRecord(entry);
    return {
      id: readString(r.id),
      name: readString(r.student_name).trim(),
      gradeId: readString(r.grade_id),
      standardId: readString(r.standard_id),
      divisionId: readString(r.division_id),
      standardName: readString(r.standard_name),
      divisionName: readString(r.division_name),
      enrollmentNo: readString(r.enrollment_no),
      rollNo: readString(r.roll_no),
    };
  });
}

// ---------------------------------------------------------------------------
// Subjects + chapters — POST /api/lms-courses (cached per session)
// ---------------------------------------------------------------------------

interface CatalogSubject {
  subjectId: string;
  subjectName: string;
  standardId: string;
  chapters: { id: string; name: string }[];
}

const catalogCache = new Map<string, Promise<CatalogSubject[]>>();

async function loadCatalog(session: SessionContext): Promise<CatalogSubject[]> {
  const extras = readSessionExtras();
  const res = await fetch(`${session.baseUrl}/api/lms-courses`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      type: 'API',
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      user_profile_name: extras.userProfileName,
      user_profile_id: extras.userProfileId,
      client_id: extras.clientId,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the subject catalog.`);
  const payload = toRecord(await res.json());
  const grouped = toRecord(payload.lms_subject);
  const deduped = new Map<string, CatalogSubject>();
  for (const arr of Object.values(grouped)) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const r = toRecord(entry);
      const subjectId = readString(r.subject_id);
      const standardId = readString(r.standard_id);
      if (!subjectId || !standardId) continue;
      const chapters = toArray(r.chapters)
        .map((c) => {
          const cr = toRecord(c);
          return { id: readString(cr.id ?? cr.chapter_id), name: readString(cr.chapter_name ?? cr.name) };
        })
        .filter((c) => c.id);
      const key = `${subjectId}_${standardId}`;
      const existing = deduped.get(key);
      if (!existing || (existing.chapters.length === 0 && chapters.length > 0)) {
        deduped.set(key, {
          subjectId,
          subjectName: readString(r.subject_name ?? r.display_name),
          standardId,
          chapters,
        });
      }
    }
  }
  return Array.from(deduped.values());
}

async function subjectsForStandard(standardId: string): Promise<CatalogSubject[]> {
  const session = requireSession();
  const key = `${session.subInstituteId}_${session.syear}`;
  let cached = catalogCache.get(key);
  if (!cached) {
    cached = loadCatalog(session).catch((error: unknown) => {
      catalogCache.delete(key);
      throw error;
    });
    catalogCache.set(key, cached);
  }
  const all = await cached;
  return all.filter((s) => s.standardId === standardId);
}

// ---------------------------------------------------------------------------
// Attempts — GET /lms/pal?type=API
// ---------------------------------------------------------------------------

interface LegacyAttempts {
  studentRow: Record<string, unknown>;
  attemptsByChapter: Record<string, PalAttempt[]>;
  attemptSubjectByChapter: Record<string, string>;
  perChapterQuiz: Record<string, unknown>;
}

async function legacyAttempts(learnerId: string, signal?: AbortSignal): Promise<LegacyAttempts> {
  const session = requireSession();
  const params = new URLSearchParams({ type: 'API' });
  if (session.subInstituteId) params.set('sub_institute_id', session.subInstituteId);
  if (session.syear) params.set('syear', session.syear);
  if (learnerId) params.set('user_id', learnerId);

  const res = await fetch(`${session.baseUrl}/lms/pal?${params.toString()}`, {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load PAL subjects.`);
  const payload = toRecord(await res.json());
  const attemptsByChapter: Record<string, PalAttempt[]> = {};
  const attemptSubjectByChapter: Record<string, string> = {};
  toArray(payload.attemptExams).forEach((entry) => {
    const r = toRecord(entry);
    const chapterId = readString(r.paper_desc);
    if (!chapterId) return;
    const totalRight = readNumber(r.total_right);
    const total = totalRight + readNumber(r.total_wrong);
    const percent = total > 0 ? Math.min(100, Math.round((totalRight / total) * 100)) : 0;
    (attemptsByChapter[chapterId] ??= []).push({ chapterId, totalRight, total, percent });
    const subjectId = readString(r.subject_id);
    if (subjectId) attemptSubjectByChapter[chapterId] = subjectId;
  });
  return {
    studentRow: toRecord(payload.studentDetails),
    attemptsByChapter,
    attemptSubjectByChapter,
    perChapterQuiz: toRecord(payload.perChapterQuiz),
  };
}

function assembleSubjects(
  catalog: CatalogSubject[],
  perChapterQuiz: Record<string, unknown>,
  attemptsByChapter: Record<string, PalAttempt[]>,
  attemptSubjectByChapter: Record<string, string>
): PalSubject[] {
  const subjects: PalSubject[] = catalog.map((s) => ({
    id: s.subjectId,
    name: s.subjectName,
    chapters: s.chapters.map((c) => ({ id: c.id, name: c.name, quizCount: readNumber(perChapterQuiz[c.id]) })),
  }));
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const known = new Set(subjects.flatMap((s) => s.chapters.map((c) => c.id)));
  Object.entries(attemptSubjectByChapter).forEach(([chapterId, subjectId]) => {
    if (known.has(chapterId)) return;
    const chapter = { id: chapterId, name: `Chapter #${chapterId}`, quizCount: readNumber(perChapterQuiz[chapterId]) };
    const existing = byId.get(subjectId);
    if (existing) existing.chapters.push(chapter);
    else {
      const created: PalSubject = { id: subjectId, name: `Subject #${subjectId}`, chapters: [chapter] };
      byId.set(subjectId, created);
      subjects.push(created);
    }
  });
  subjects.sort((a, b) => {
    const aHas = a.chapters.some((c) => attemptsByChapter[c.id]);
    const bHas = b.chapters.some((c) => attemptsByChapter[c.id]);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return subjects;
}

export async function legacyPalLanding(
  student: PalStudentSelection | undefined,
  signal?: AbortSignal
): Promise<PalLandingData> {
  const session = requireSession();
  const learnerId = student?.studentId || session.userId;
  const attempts = await legacyAttempts(learnerId, signal);
  const standardId = student?.standardId || readString(attempts.studentRow.standard_id);
  const catalog = standardId ? await subjectsForStandard(standardId) : [];
  const name =
    student?.name ||
    [attempts.studentRow.first_name, attempts.studentRow.middle_name, attempts.studentRow.last_name]
      .map((p) => readString(p).trim())
      .filter(Boolean)
      .join(' ');

  return {
    student: {
      studentId: learnerId,
      name,
      gradeId: student?.gradeId || readString(attempts.studentRow.grade_id),
      standardId,
      enrollmentNo: student?.enrollmentNo || readString(attempts.studentRow.enrollment_no),
    },
    subjects: assembleSubjects(catalog, attempts.perChapterQuiz, attempts.attemptsByChapter, attempts.attemptSubjectByChapter),
    attemptsByChapter: attempts.attemptsByChapter,
    message: '',
  };
}

export async function legacyPalPreview(
  opts: { standardId: string; gradeId?: string; divisionId?: string; signal?: AbortSignal }
): Promise<PalLandingData> {
  const catalog = await subjectsForStandard(opts.standardId);
  return {
    student: {
      studentId: '',
      name: 'Guest student',
      gradeId: opts.gradeId ?? '',
      standardId: opts.standardId,
      enrollmentNo: '',
    },
    subjects: assembleSubjects(catalog, {}, {}, {}),
    attemptsByChapter: {},
    message: '',
  };
}
