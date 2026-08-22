import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Teacher Diary data layer.
 *
 * Maps to the Laravel "Teacher Diary" menu (tblmenumaster id 97 →
 * link `lessonplanningReport.index`), i.e. a read-only Lesson-Planning report.
 *
 *   GET /lessonplanningReport?type=API&sub_institute_id&syear
 *     → { status, message, data: [ ...lesson plans... ] }
 *
 * The controller now reads sub_institute_id from the request (headless fallback),
 * falling back to the session. NOTE: this route lives in routes/web.php which is
 * served on the deployed host; it is not reachable on a bare local dev server
 * that can't load web.php.
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

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

/** Treat MySQL zero-dates and dash placeholders as empty. */
function cleanDate(value: string): string {
  const v = value.trim();
  if (!v || v === '-' || v.startsWith('0000-00-00')) return '';
  return v;
}

export interface DiaryEntry {
  id: string;
  title: string;
  description: string;
  schoolDate: string;
  standard: string;
  division: string;
  subject: string;
  subjectCode: string;
  status: string;
  reason: string;
  executionDate: string;
}

export async function fetchTeacherDiary(signal?: AbortSignal): Promise<DiaryEntry[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/school_setup/lessonplanningReport`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the teacher diary.`);
  const raw = toRecord(await readJson(res, 'Failed to load the teacher diary'));

  return toArray(raw.data).map((entry) => {
    const r = toRecord(entry);
    const rawStatus = readString(r.lessonplan_status);
    const rawReason = readString(r.lessonplan_reason);
    const rawExec = readString(r.lessonplan_date);
    return {
      id: readString(r.id),
      title: readString(r.title),
      description: readString(r.description),
      schoolDate: cleanDate(readString(r.school_date)),
      standard: readString(r.standard_name),
      division: readString(r.division_name),
      subject: readString(r.subject_name),
      subjectCode: readString(r.subject_code),
      status: rawStatus === '-' ? '' : rawStatus,
      reason: rawReason === '-' ? '' : rawReason,
      executionDate: cleanDate(rawExec),
    };
  });
}
