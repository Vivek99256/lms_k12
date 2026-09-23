// ---------------------------------------------------------------------------
// Data access for LMS > Exam > Exam Evaluation.
//
// Everything here talks to /api/exam-evaluation on the ERP. The exam list is
// deliberately borrowed from the Question paper templates module rather than
// duplicated — a paper you can print is a paper you can scan, and two lists
// that could disagree about which exams exist would be a bug waiting to
// happen.
//
// The scans themselves are never fetched as JSON: they are a child's answer
// sheet, so they come back through an authenticated endpoint as a blob and are
// shown from an object URL that the caller revokes.
// ---------------------------------------------------------------------------

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type { AnswerKeySummary, BatchDetail, EvaluationBatch, MarkEdit, SheetDetail } from './types';

export { fetchExamPapers, type ExamPaperOption } from '../_question-paper-templates/api';

function requireSession(): SessionContext {
  const session = buildSessionContext();

  if (!session.subInstituteId) {
    throw new Error('Your session is missing the school id. Please sign in again.');
  }

  return session;
}

async function readJson(response: Response): Promise<ApiEnvelope & { data?: unknown }> {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as ApiEnvelope) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'The evaluation service returned a response we could not read.'
        : `Request failed with status ${response.status}`
    );
  }
}

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

function url(session: SessionContext, path: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  if (session.userId) {
    params.set('user_id', session.userId);
  }

  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, value));

  return `${session.baseUrl}/api/exam-evaluation/${path}?${params.toString()}`;
}

/** Common body fields every write needs, so the ERP can scope and attribute it. */
function baseBody(session: SessionContext): Record<string, unknown> {
  return {
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
  };
}

async function get<T>(path: string, fallback: string, extra?: Record<string, string>): Promise<T> {
  const session = requireSession();
  const response = await fetch(url(session, path, extra), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  return unwrap<T>((await readJson(response)) as never, fallback);
}

async function post<T>(path: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const session = requireSession();
  const response = await fetch(url(session, path), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ ...baseBody(session), ...body }),
  });

  return unwrap<T>((await readJson(response)) as never, fallback);
}

// -- Reads -------------------------------------------------------------------

export async function fetchBatches(): Promise<EvaluationBatch[]> {
  const data = await get<{ batches: EvaluationBatch[] }>('batches', 'Unable to load evaluations.');

  return data.batches ?? [];
}

export async function fetchBatch(batchId: number): Promise<BatchDetail> {
  return get<BatchDetail>(`batches/${batchId}`, 'Unable to load this evaluation.');
}

export async function fetchSheet(sheetId: number): Promise<SheetDetail> {
  return get<SheetDetail>(`sheets/${sheetId}`, 'Unable to load this answer sheet.');
}

export async function fetchAnswerKey(paperId: number): Promise<AnswerKeySummary> {
  return get<AnswerKeySummary>(`answer-key/${paperId}`, 'Unable to read this paper as a marking key.');
}

// -- Writes ------------------------------------------------------------------

export async function createBatch(paperId: number, name: string): Promise<BatchDetail> {
  return post<BatchDetail>('batches', { question_paper_id: paperId, name }, 'Unable to start this evaluation.');
}

export async function deleteBatch(batchId: number): Promise<void> {
  const session = requireSession();
  const response = await fetch(url(session, `batches/${batchId}`), {
    method: 'DELETE',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  const payload = await readJson(response);
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || 'Unable to remove this evaluation.');
  }
}

/**
 * Uploads a set of scans in one request.
 *
 * multipart, not JSON, and therefore NOT through post() — the body carries
 * files and the browser has to set its own Content-Type boundary, so the JSON
 * header createAuthHeaders() would otherwise add is left off deliberately.
 */
export async function uploadSheets(batchId: number, files: File[]): Promise<BatchDetail> {
  const session = requireSession();
  const form = new FormData();

  form.append('sub_institute_id', session.subInstituteId);
  form.append('syear', session.syear);
  form.append('user_id', session.userId);
  files.forEach((file) => form.append('sheets[]', file, file.name));

  const response = await fetch(url(session, `batches/${batchId}/sheets`), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session),
    body: form,
  });

  return unwrap<BatchDetail>((await readJson(response)) as never, 'Unable to upload these answer sheets.');
}

/**
 * One teacher pass over a sheet: who it belongs to, what the marks are, and
 * whether it is signed off. `approve` copies any untouched AI mark into the
 * teacher's own column on the server, so an approved sheet no longer moves.
 */
export async function reviewSheet(
  sheetId: number,
  input: { studentId?: number | null; marks?: MarkEdit[]; approve?: boolean; unapprove?: boolean }
): Promise<SheetDetail> {
  const body: Record<string, unknown> = {};

  if (input.studentId !== undefined) {
    body.student_id = input.studentId ?? 0;
  }

  if (input.marks) {
    body.marks = input.marks.map((mark) => ({
      question_no: mark.question_no,
      teacher_marks: mark.teacher_marks,
    }));
  }

  if (input.approve) {
    body.approve = true;
  }

  if (input.unapprove) {
    body.unapprove = true;
  }

  return post<SheetDetail>(`sheets/${sheetId}/review`, body, 'Unable to save this review.');
}

export async function reprocessSheet(sheetId: number): Promise<SheetDetail> {
  return post<SheetDetail>(`sheets/${sheetId}/reprocess`, {}, 'Unable to re-run this sheet.');
}

export async function deleteSheet(sheetId: number): Promise<void> {
  const session = requireSession();
  const response = await fetch(url(session, `sheets/${sheetId}`), {
    method: 'DELETE',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  const payload = await readJson(response);
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || 'Unable to remove this answer sheet.');
  }
}

export async function publishBatch(batchId: number): Promise<{ published: number; skipped: number; message: string }> {
  const session = requireSession();
  const response = await fetch(url(session, `batches/${batchId}/publish`), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(baseBody(session)),
  });

  const payload = await readJson(response);
  const data = unwrap<{ published: number; skipped: number }>(payload as never, 'Unable to publish this evaluation.');

  return { ...data, message: payload?.message || '' };
}

/**
 * The scan, or the marked-up copy of it, as an object URL.
 *
 * Fetched rather than linked because the endpoint needs the session headers —
 * an <img src> or <iframe src> would arrive unauthenticated. The caller owns
 * the returned URL and must revokeObjectURL() it when the viewer closes.
 */
export async function fetchSheetFileUrl(sheetId: number, annotated: boolean): Promise<string> {
  const session = requireSession();
  const response = await fetch(
    url(session, `sheets/${sheetId}/file`, annotated ? { annotated: '1' } : undefined),
    { method: 'GET', cache: 'no-store', headers: createAuthHeaders(session) }
  );

  if (!response.ok) {
    const payload = await readJson(response).catch(() => null);
    throw new Error(payload?.message || 'That file could not be opened.');
  }

  return URL.createObjectURL(await response.blob());
}
