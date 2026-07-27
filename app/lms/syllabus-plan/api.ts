import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Syllabus Plan data layer (lmsSyllabusController, resource `lms_syllabus`).
 *
 *   GET    /lms/lms_syllabus?type=API&sub_institute_id                  → list (allData)
 *   POST   /lms/lms_syllabus            (type=API)                      → create → {status,message}
 *   POST   /lms/lms_syllabus/{id}       (type=API, _method=PUT)         → update → {status,message}
 *   DELETE /lms/lms_syllabus/{id}?type=API                             → delete → {status,message}
 *   GET    /api/get-curriculum-list?standard&subject&sub_institute_id   → curriculum options
 *
 * store/update/destroy already return is_mobile JSON for type=API and honour the
 * request sub_institute_id; getCurriculums now has a request fallback too.
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyllabusRow {
  id: string;
  gradeId: string;
  standardId: string;
  subjectId: string;
  curriculumId: string;
  standardName: string;
  subjectName: string;
  curriculumName: string;
  title: string;
  objectives: string;
  learningOutcomes: string;
  suggestedMaterials: string;
  assessmentPlan: string;
  progressTracking: number;
}

export interface CurriculumOption {
  id: string;
  name: string;
}

export interface SyllabusInput {
  gradeId: string;
  standardId: string;
  subjectId: string;
  curriculumId: string;
  title: string;
  objectives: string;
  learningOutcomes: string;
  suggestedMaterials: string;
  assessmentPlan: string;
  progressTracking: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchSyllabusList(signal?: AbortSignal): Promise<SyllabusRow[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lms_syllabus`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the syllabus list.`);
  const raw = toRecord(await readJson(res, 'Failed to load the syllabus list'));

  return toArray(raw.allData).map((entry) => {
    const r = toRecord(entry);
    return {
      id: readString(r.id),
      gradeId: readString(r.grade_id),
      standardId: readString(r.standard_id),
      subjectId: readString(r.subject_id),
      curriculumId: readString(r.curriculum_id),
      standardName: readString(r.standard_name),
      subjectName: readString(r.subject_name),
      curriculumName: readString(r.curriculum_name),
      title: readString(r.title),
      objectives: readString(r.objectives),
      learningOutcomes: readString(r.learning_outcomes),
      suggestedMaterials: readString(r.suggested_materials),
      assessmentPlan: readString(r.assessment_plan),
      progressTracking: readNumber(r.progress_tracking),
    };
  });
}

export async function fetchCurriculums(
  standardId: string,
  subjectId: string,
  signal?: AbortSignal
): Promise<CurriculumOption[]> {
  if (!standardId || !subjectId) return [];
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/api/get-curriculum-list`);
  url.searchParams.set('standard', standardId);
  url.searchParams.set('subject', subjectId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) return [];
  const raw = await readJson(res, 'Failed to load curriculums');
  return toArray(Array.isArray(raw) ? raw : toRecord(raw).data)
    .map((entry) => {
      const r = toRecord(entry);
      const id = readString(r.id);
      if (!id) return null;
      return { id, name: readString(r.curriculum_name) || `Curriculum ${id}` };
    })
    .filter((o): o is CurriculumOption => o !== null);
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

function buildBody(session: SessionContext, input: SyllabusInput): URLSearchParams {
  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('sub_institute_id', session.subInstituteId);
  body.set('syear', session.syear);
  body.set('grade', input.gradeId);
  body.set('standard', input.standardId);
  body.set('subject', input.subjectId);
  body.set('curriculum_id', input.curriculumId);
  body.set('syllabus_title', input.title);
  body.set('syllabus_objectives', input.objectives);
  body.set('learning_outcomes', input.learningOutcomes);
  body.set('suggested_materials', input.suggestedMaterials);
  body.set('assesment_plans', input.assessmentPlan); // Laravel field name (sic)
  body.set('progress_tracking', input.progressTracking || '0'); // NOT NULL column
  return body;
}

export async function saveSyllabus(input: SyllabusInput, id?: string): Promise<string> {
  const session = requireSession();
  const body = buildBody(session, input);
  const isUpdate = !!id;
  if (isUpdate) body.set('_method', 'PUT'); // Laravel method spoofing for resource update

  const target = isUpdate
    ? `${session.baseUrl}/lms/lms_syllabus/${encodeURIComponent(id)}`
    : `${session.baseUrl}/lms/lms_syllabus`;

  const res = await fetch(target, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to save the syllabus.`);
  const raw = toRecord(await readJson(res, 'Failed to save the syllabus'));
  // NOTE: Laravel returns status 0 when an update changes no rows (identical
  // values). Treat an explicit "0" as an error only when a message says so.
  if (normalizeApiStatus(raw) === '0' && !isUpdate) {
    throw new Error(readString(raw.message) || 'Failed to save the syllabus.');
  }
  return readString(raw.message) || (isUpdate ? 'Syllabus updated.' : 'Syllabus saved.');
}

export async function deleteSyllabus(id: string): Promise<string> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/lms_syllabus/${encodeURIComponent(id)}`);
  url.searchParams.set('type', 'API');

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to delete the syllabus.`);
  const raw = toRecord(await readJson(res, 'Failed to delete the syllabus'));
  return readString(raw.message) || 'Syllabus deleted.';
}
