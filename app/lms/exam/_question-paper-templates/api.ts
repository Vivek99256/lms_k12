// ---------------------------------------------------------------------------
// Data access for LMS > Exam > Question paper templates.
//
// Templates come from /api/question-paper-templates (blueprints stored per
// school in `template_master`); the papers to render come from the Exam
// module's own /api/question-paper endpoints. Nothing here invents content:
// the school comes from the signed-in session, and every exam, question and
// mark is read back from the ERP.
// ---------------------------------------------------------------------------

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type {
  Blueprint,
  PaperContext,
  QuestionPaperTemplate,
  SchoolBranding,
  TemplateIndex,
} from './types';

export type ExamPaperOption = {
  id: number;
  paperName: string;
  paperDesc: string;
  examType: string;
  standardName: string;
  subjectName: string;
  gradeName: string;
  totalMarks: number;
  totalQuestions: number;
};

function unwrap<T>(payload: (ApiEnvelope & { data?: T }) | null, fallbackMessage: string): T {
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || fallbackMessage);
  }

  if (payload?.data == null) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload.data;
}

async function readJson(response: Response): Promise<ApiEnvelope & { data?: unknown }> {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as ApiEnvelope) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'The exam service returned a response we could not read.'
        : `Request failed with status ${response.status}`
    );
  }
}

function requireSession(): SessionContext {
  const session = buildSessionContext();

  if (!session.subInstituteId) {
    throw new Error('Your session is missing the school id. Please sign in again.');
  }

  return session;
}

/**
 * The signed-in school's own name and logo — the same values the sidebar and
 * header read, so a printed paper is stamped with whatever the school has set
 * in its profile and nothing is hardcoded here.
 */
export function readSchoolBranding(): SchoolBranding {
  if (typeof window === 'undefined') {
    return { name: '', logoUrl: null };
  }

  try {
    const stored = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const name = readString(
      stored.school_name ?? stored.institute_name ?? stored.organisation_name ?? ''
    ).trim();
    const logo = readString(stored.logo ?? '').trim();
    const host = readString(stored.host_name ?? '').replace(/\/$/, '');

    const logoUrl = logo
      ? logo.startsWith('http')
        ? logo
        : host
          ? `${host}/admin_dep/images/${logo}`
          : null
      : null;

    return { name, logoUrl };
  } catch {
    return { name: '', logoUrl: null };
  }
}

export async function fetchTemplateIndex(): Promise<TemplateIndex> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(
    `${session.baseUrl}/api/question-paper-templates?${params.toString()}`,
    { method: 'GET', cache: 'no-store', headers: createAuthHeaders(session) }
  );

  const payload = await readJson(response);

  return unwrap<TemplateIndex>(payload as never, 'Unable to load question paper templates.');
}

export type SaveTemplateInput = {
  id: number | null;
  name: string;
  description: string;
  presetKey: string | null;
  blueprint: Blueprint;
};

export async function saveTemplate(input: SaveTemplateInput): Promise<QuestionPaperTemplate> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const url = input.id
    ? `${session.baseUrl}/api/question-paper-templates/${input.id}?${params.toString()}`
    : `${session.baseUrl}/api/question-paper-templates?${params.toString()}`;

  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      name: input.name,
      description: input.description,
      preset_key: input.presetKey,
      blueprint: input.blueprint,
    }),
  });

  const payload = await readJson(response);

  return unwrap<QuestionPaperTemplate>(payload as never, 'Unable to save the template.');
}

export async function deleteTemplate(id: number): Promise<void> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(
    `${session.baseUrl}/api/question-paper-templates/${id}?${params.toString()}`,
    { method: 'DELETE', cache: 'no-store', headers: createAuthHeaders(session) }
  );

  const payload = await readJson(response);
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || 'Unable to remove the template.');
  }
}

/** One paper with its questions, type names and options — the render feed. */
export async function fetchPaperContext(paperId: number): Promise<PaperContext> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(
    `${session.baseUrl}/api/question-paper-templates/paper/${paperId}?${params.toString()}`,
    { method: 'GET', cache: 'no-store', headers: createAuthHeaders(session) }
  );

  const payload = await readJson(response);

  return unwrap<PaperContext>(payload as never, 'Unable to load the question paper.');
}

type ApiPaperRow = {
  id?: number | string;
  paper_name?: string | null;
  paper_desc?: string | null;
  exam_type?: string | null;
  standard_name?: string | number | null;
  subject_name?: string | null;
  grade_name?: string | null;
  total_marks?: number | string | null;
  total_ques?: number | string | null;
};

/** The profile the Exam module filters its own listings by. */
function readUserProfileName(): string {
  if (typeof window === 'undefined') return '';

  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;

    return readString(menuContext.user_profile_name ?? userData.user_profile_name).trim();
  } catch {
    return '';
  }
}

/**
 * The exams a teacher can print, from the Exam module's existing listing
 * endpoint. `user_profile_name` is passed along because that endpoint narrows
 * a teacher to their own papers — leaving it out would list papers the Exams
 * tab does not show, and the two screens would disagree.
 */
export async function fetchExamPapers(): Promise<ExamPaperOption[]> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const profileName = readUserProfileName();

  if (profileName) {
    params.set('user_profile_name', profileName);
  }

  if (session.userId) {
    params.set('user_id', session.userId);
  }

  const response = await fetch(`${session.baseUrl}/api/question-paper?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  const payload = await readJson(response);
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || 'Unable to load exams.');
  }

  const rows = Array.isArray(payload?.data) ? (payload.data as ApiPaperRow[]) : [];

  return rows
    .map((row) => ({
      id: Number(row.id) || 0,
      paperName: readString(row.paper_name).trim(),
      paperDesc: readString(row.paper_desc).trim(),
      examType: readString(row.exam_type).trim(),
      standardName: readString(row.standard_name).trim(),
      subjectName: readString(row.subject_name).trim(),
      gradeName: readString(row.grade_name).trim(),
      totalMarks: Number(row.total_marks) || 0,
      totalQuestions: Number(row.total_ques) || 0,
    }))
    .filter((row) => row.id > 0);
}
