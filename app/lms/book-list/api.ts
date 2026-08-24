import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Book List data layer (front_desk\book_list\book_listController).
 *
 *   GET    /frontdesk/book_list?type=API&sub_institute_id&syear&user_profile&user_id   → list
 *   POST   /frontdesk/book_list      (multipart: file field `attechment`)              → create
 *   DELETE /frontdesk/book_list/{id}?type=API                                          → delete
 *   GET    /lms/ajax_LMS_SubjectwiseChapterForBooklist?std_id&sub_id                   → chapters
 *   GET    /lms/ajax_LMS_ChapterwiseTopic?chapter_id                                    → topics
 *
 * The controller now reads tenant/user from the request (headless fallback) and
 * returns JSON for type=API. Subjects come from the shared SearchDropdown.
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

function userProfileName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return readString(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookListRow {
  id: string;
  standard: string;
  subject: string;
  chapter: string;
  topic: string;
  title: string;
  message: string;
  fileName: string;
  filePath: string;
  link: string;
  date: string;
}

export interface Option {
  id: string;
  label: string;
}

export interface BookListInput {
  gradeId: string;
  standardId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  date: string;
  title: string;
  message: string;
  link: string;
  file: File | null;
}

/** Fixed title options from the Laravel Blade. */
export const BOOK_TITLE_OPTIONS = ['NCERT/CBSE Textbook', 'Other Book', 'Practice Worksheet'];

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchBookList(signal?: AbortSignal): Promise<BookListRow[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/frontdesk/book_list`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('user_id', session.userId);
  url.searchParams.set('user_profile', userProfileName());

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the book list.`);
  const raw = toRecord(await readJson(res, 'Failed to load the book list'));

  return toArray(raw.data).map((entry) => {
    const r = toRecord(entry);
    return {
      id: readString(r.id),
      standard: readString(r.std_name),
      subject: readString(r.subject_name),
      chapter: readString(r.chapter_name),
      topic: readString(r.topic_name),
      title: readString(r.title),
      message: readString(r.message),
      fileName: readString(r.file_name),
      filePath: readString(r.file_name_path),
      link: readString(r.link),
      date: readString(r.date_),
    };
  });
}

// ---------------------------------------------------------------------------
// Cascades (subject → chapter → topic)
// ---------------------------------------------------------------------------

export async function fetchChapters(
  standardId: string,
  subjectId: string,
  signal?: AbortSignal
): Promise<Option[]> {
  if (!standardId || !subjectId) return [];
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/ajax_LMS_SubjectwiseChapterForBooklist`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('std_id', standardId);
  url.searchParams.set('sub_id', subjectId);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) return [];
  const raw = await readJson(res, 'Failed to load chapters');
  return toArray(Array.isArray(raw) ? raw : toRecord(raw).data)
    .map((entry) => {
      const r = toRecord(entry);
      const id = readString(r.id);
      if (!id) return null;
      return { id, label: readString(r.chapter_name) || `Chapter ${id}` };
    })
    .filter((o): o is Option => o !== null);
}

export async function fetchTopics(chapterId: string, signal?: AbortSignal): Promise<Option[]> {
  if (!chapterId) return [];
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/ajax_LMS_ChapterwiseTopic`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('chapter_id', chapterId);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) return [];
  const raw = await readJson(res, 'Failed to load topics');
  return toArray(Array.isArray(raw) ? raw : toRecord(raw).data)
    .map((entry) => {
      const r = toRecord(entry);
      const id = readString(r.id);
      if (!id) return null;
      return { id, label: readString(r.name) || `Topic ${id}` };
    })
    .filter((o): o is Option => o !== null);
}

// ---------------------------------------------------------------------------
// Create (multipart, with optional file) + Delete
// ---------------------------------------------------------------------------

export async function createBookList(input: BookListInput): Promise<string> {
  const session = requireSession();

  const form = new FormData();
  form.set('type', 'API');
  form.set('sub_institute_id', session.subInstituteId);
  form.set('syear', session.syear);
  form.set('user_id', session.userId);
  form.set('section_id', input.gradeId);
  form.set('standard', input.standardId);
  form.set('subject', input.subjectId);
  form.set('chapter', input.chapterId);
  form.set('topic', input.topicId);
  form.set('date_', input.date);
  form.set('title', input.title);
  form.set('message', input.message);
  form.set('link', input.link);
  if (input.file) form.set('attechment', input.file, input.file.name);

  // Multipart: do NOT set Content-Type (the browser adds the boundary).
  const res = await fetch(`${session.baseUrl}/frontdesk/book_list`, {
    method: 'POST',
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to save the book list entry.`);
  const raw = toRecord(await readJson(res, 'Failed to save the book list entry'));
  if (normalizeApiStatus(raw) === '0') throw new Error(readString(raw.message) || 'Failed to save.');
  return readString(raw.message) || 'Book list entry added.';
}

export async function deleteBookList(id: string): Promise<string> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/frontdesk/book_list/${encodeURIComponent(id)}`);
  url.searchParams.set('type', 'API');

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to delete the entry.`);
  const raw = toRecord(await readJson(res, 'Failed to delete the entry'));
  return readString(raw.message) || 'Entry deleted.';
}
