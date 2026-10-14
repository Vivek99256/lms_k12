import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Engagement -> My Activity data layer.
 *
 * Talks to the K12 REST API added 2026-10-10 for this screen (Laravel:
 * App\Http\Controllers\api\lms\StudentEngagementApiController), which reads
 * real per-event rows from `lms_student_engagement` via
 * App\Services\Mcp\EngagementReportService — the same table now genuinely
 * written at three real student actions (viewing PAL-suggested content,
 * submitting adaptive practice, submitting homework). There is no mock data
 * path here: an empty `recent` list means the signed-in learner has no
 * recorded activity yet, not a loading placeholder.
 *
 *   GET /api/lms/student-engagement             my own activity + the three
 *                                                live attendance/homework/
 *                                                assignment rates
 *   GET /api/lms/student-engagement/{userId}     one learner's activity
 *                                                (staff/admin only, or self)
 *
 * Auth is the standard ERP bearer JWT; tenant, user and academic year are all
 * derived from that token server-side.
 */

export interface EngagementEvent {
  id: number;
  activityType: string;
  activityId: number | null;
  timeSpentSeconds: number;
  interactionCount: number;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface EngagementActivityLog {
  hasData: boolean;
  totalEvents: number;
  byType: Record<string, number>;
  recent: EngagementEvent[];
}

export interface EngagementSummary {
  studentId: number;
  windowDays: number;
  /** Percent present, or null when there is no attendance record in the window. */
  attendancePercent: number | null;
  /** Percent of homework submitted, or null when there is no homework in the window. */
  homeworkPercent: number | null;
  /** Average assignment progress (0-100), or null when there are no assignments in the window. */
  assignmentsPercent: number | null;
  activityLog: EngagementActivityLog;
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
  const url = new URL(`${session.baseUrl}/api/lms/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  return url;
}

async function getJson(url: URL, session: SessionContext, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });

  const text = (await res.text()).trim();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = toRecord(JSON.parse(text));
    } catch {
      throw new Error('The server returned an unexpected response.');
    }
  }

  if (!res.ok || body.success === false) {
    const message = readString(body.message);
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(message || "Couldn't load engagement activity.");
  }

  return body;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapEvent(entry: unknown): EngagementEvent {
  const row = toRecord(entry);
  return {
    id: readNumber(row.id),
    activityType: readString(row.activity_type),
    activityId: row.activity_id == null ? null : readNumber(row.activity_id),
    timeSpentSeconds: readNumber(row.time_spent_seconds),
    interactionCount: readNumber(row.interaction_count),
    occurredAt: readString(row.occurred_at),
    metadata: toRecord(row.metadata),
  };
}

function mapActivityLog(entry: unknown): EngagementActivityLog {
  const row = toRecord(entry);
  const byTypeRow = toRecord(row.by_type);
  const byType: Record<string, number> = {};
  Object.entries(byTypeRow).forEach(([key, value]) => {
    byType[key] = readNumber(value);
  });

  return {
    hasData: row.has_data === true,
    totalEvents: readNumber(row.total_events),
    byType,
    recent: toArray(row.recent).map(mapEvent),
  };
}

function mapSummary(data: Record<string, unknown>): EngagementSummary {
  return {
    studentId: readNumber(data.student_id),
    windowDays: readNumber(data.window_days),
    attendancePercent: data.attendance == null ? null : readNumber(data.attendance),
    homeworkPercent: data.homework == null ? null : readNumber(data.homework),
    assignmentsPercent: data.assignments == null ? null : readNumber(data.assignments),
    activityLog: mapActivityLog(data.activity_log),
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** My own engagement activity + live attendance/homework/assignment rates. */
export async function fetchMyEngagementActivity(
  opts: { daysBack?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<EngagementSummary> {
  const session = requireSession();
  const url = apiUrl(session, 'student-engagement', {
    days_back: opts.daysBack ? String(opts.daysBack) : undefined,
    limit: opts.limit ? String(opts.limit) : undefined,
  });

  const payload = await getJson(url, session, opts.signal);
  return mapSummary(toRecord(payload.data));
}

/** A specific learner's engagement activity (staff/admin, or that learner themself). */
export async function fetchLearnerEngagementActivity(
  userId: string,
  opts: { daysBack?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<EngagementSummary> {
  const session = requireSession();
  const url = apiUrl(session, `student-engagement/${encodeURIComponent(userId)}`, {
    days_back: opts.daysBack ? String(opts.daysBack) : undefined,
    limit: opts.limit ? String(opts.limit) : undefined,
  });

  const payload = await getJson(url, session, opts.signal);
  return mapSummary(toRecord(payload.data));
}
