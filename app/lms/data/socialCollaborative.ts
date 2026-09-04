import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS Engagement -> Social & Collaborative data layer.
 *
 * Talks to the K12 REST API added for this module (Laravel:
 * App\Http\Controllers\api\lms\LmsSocialCollaborativeApiController):
 *
 *   GET  /api/lms/social-collaborative                  the discussion feed
 *   GET  /api/lms/social-collaborative/{id}             one thread + replies
 *   POST /api/lms/social-collaborative                  raise a discussion
 *   POST /api/lms/social-collaborative/{id}/comments    reply
 *   GET  /api/lms/social-collaborative/lookups/*        subject/chapter/topic
 *
 * Identity, tenant and academic year come from the bearer JWT server-side.
 * There is intentionally no edit or delete: the ERP has never supported one.
 */

export interface ScAuthor {
  userId: number;
  name: string;
  type: 'student' | 'user';
  className: string;
  avatarUrl: string;
}

export interface ScComment {
  id: number;
  doubtId: number;
  message: string;
  createdAt: string;
  author: ScAuthor;
}

export interface ScPost {
  id: number;
  title: string;
  description: string;
  visibility: string;
  subjectId: number | null;
  chapterId: number | null;
  topicId: number | null;
  attachmentUrl: string;
  createdAt: string;
  totalDays: number;
  commentCount: number;
  author: ScAuthor;
  comments?: ScComment[];
}

export interface ScFeedFilters {
  search?: string;
  subjectId?: string;
  visibility?: string;
  mine?: boolean;
  page?: number;
  perPage?: number;
}

export interface ScFeedPage {
  items: ScPost[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface ScOption {
  id: number;
  name: string;
}

export interface ScNewPost {
  subjectId: string;
  chapterId: string;
  topicId: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  file?: File | null;
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

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

function apiUrl(session: SessionContext, path: string, params: Record<string, string | undefined> = {}): URL {
  const url = new URL(`${session.baseUrl}/api/lms/social-collaborative${path}`);
  if (session.syear) url.searchParams.set('syear', session.syear);
  if (session.termId) url.searchParams.set('term_id', session.termId);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  return url;
}

/** First validation message from the API's `errors` bag, if any. */
function firstFieldError(errors: unknown): string {
  const bag = toRecord(errors);
  for (const messages of Object.values(bag)) {
    const list = toArray(messages);
    if (list.length > 0) return readString(list[0]);
  }
  return '';
}

async function request(
  url: URL,
  session: SessionContext,
  init: RequestInit = {},
  fallback = 'Unable to load the discussions.'
): Promise<Record<string, unknown>> {
  const res = await fetch(url.toString(), {
    ...init,
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest', ...(init.headers ?? {}) },
  });

  const text = (await res.text()).trim();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = toRecord(JSON.parse(text));
    } catch {
      throw new Error(`The server returned an unexpected response (HTTP ${res.status}).`);
    }
  }

  if (!res.ok || body.success === false) {
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(firstFieldError(body.errors) || readString(body.message) || `${fallback} (HTTP ${res.status})`);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapAuthor(value: unknown): ScAuthor {
  const row = toRecord(value);
  return {
    userId: readNumber(row.user_id),
    name: readString(row.name) || 'Unknown user',
    type: readString(row.type) === 'student' ? 'student' : 'user',
    className: readString(row.class),
    avatarUrl: readString(row.avatar_url),
  };
}

function mapComment(value: unknown): ScComment {
  const row = toRecord(value);
  return {
    id: readNumber(row.id),
    doubtId: readNumber(row.doubt_id),
    message: readString(row.message),
    createdAt: readString(row.created_at),
    author: mapAuthor(row.author),
  };
}

function mapPost(value: unknown): ScPost {
  const row = toRecord(value);
  const comments = row.comments;

  return {
    id: readNumber(row.id),
    title: readString(row.title),
    description: readString(row.description),
    visibility: readString(row.visibility),
    subjectId: row.subject_id == null ? null : readNumber(row.subject_id),
    chapterId: row.chapter_id == null ? null : readNumber(row.chapter_id),
    topicId: row.topic_id == null ? null : readNumber(row.topic_id),
    attachmentUrl: readString(row.attachment_url),
    createdAt: readString(row.created_at),
    totalDays: readNumber(row.total_days),
    commentCount: readNumber(row.comment_count),
    author: mapAuthor(row.author),
    ...(Array.isArray(comments) ? { comments: comments.map(mapComment) } : {}),
  };
}

function mapOptions(value: unknown, idKey = 'id'): ScOption[] {
  return toArray(value).map((entry) => {
    const row = toRecord(entry);
    return { id: readNumber(row[idKey]), name: readString(row.name) };
  });
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchFeed(filters: ScFeedFilters = {}, signal?: AbortSignal): Promise<ScFeedPage> {
  const session = requireSession();
  const url = apiUrl(session, '', {
    search: filters.search,
    subject_id: filters.subjectId,
    visibility: filters.visibility,
    mine: filters.mine ? '1' : undefined,
    page: String(filters.page ?? 1),
    per_page: String(filters.perPage ?? 10),
  });

  const body = await request(url, session, { signal });
  const meta = toRecord(body.meta);

  return {
    items: toArray(body.data).map(mapPost),
    page: readNumber(meta.current_page) || 1,
    perPage: readNumber(meta.per_page) || 10,
    total: readNumber(meta.total),
    lastPage: readNumber(meta.last_page) || 1,
  };
}

export async function fetchThread(id: number, signal?: AbortSignal): Promise<ScPost> {
  const session = requireSession();
  const body = await request(apiUrl(session, `/${id}`), session, { signal }, 'Unable to open this discussion.');
  return mapPost(body.data);
}

export async function createPost(input: ScNewPost): Promise<ScPost> {
  const session = requireSession();

  const form = new FormData();
  form.set('title', input.title);
  form.set('description', input.description);
  form.set('visibility', input.visibility);
  if (input.subjectId) form.set('subject_id', input.subjectId);
  if (input.chapterId) form.set('chapter_id', input.chapterId);
  if (input.topicId) form.set('topic_id', input.topicId);
  if (input.file) form.set('file', input.file);

  const body = await request(
    apiUrl(session, ''),
    session,
    { method: 'POST', body: form },
    'Unable to post this discussion.'
  );

  return mapPost(body.data);
}

export async function createComment(id: number, message: string): Promise<ScComment> {
  const session = requireSession();

  const form = new FormData();
  form.set('message', message);

  const body = await request(
    apiUrl(session, `/${id}/comments`),
    session,
    { method: 'POST', body: form },
    'Unable to post your reply.'
  );

  return mapComment(body.data);
}

export async function fetchSubjects(signal?: AbortSignal): Promise<ScOption[]> {
  const session = requireSession();
  const body = await request(apiUrl(session, '/lookups/subjects'), session, { signal }, 'Unable to load subjects.');
  return mapOptions(body.data, 'subject_id');
}

export async function fetchChapters(subjectId: string, signal?: AbortSignal): Promise<ScOption[]> {
  const session = requireSession();
  const body = await request(
    apiUrl(session, '/lookups/chapters', { subject_id: subjectId }),
    session,
    { signal },
    'Unable to load chapters.'
  );
  return mapOptions(body.data);
}

export async function fetchTopics(chapterId: string, signal?: AbortSignal): Promise<ScOption[]> {
  const session = requireSession();
  const body = await request(
    apiUrl(session, '/lookups/topics', { chapter_id: chapterId }),
    session,
    { signal },
    'Unable to load topics.'
  );
  return mapOptions(body.data);
}
