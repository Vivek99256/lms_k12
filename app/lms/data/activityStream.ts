import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Activity Stream data layer (report / read-only feed).
 *
 *   GET /lms/lmsActivityStream?type=API&sub_institute_id&syear&user_id
 *       &user_profile&user_profile_id&term_id
 *
 * Returns { todaytitle, upcoming, today, recent, checkList }, where each of
 * `upcoming`/`today`/`recent` is an object of 15 named sections (each an array
 * of raw rows). The Laravel controller reads tenant/user from the request when
 * present (headless fallback), falling back to the session otherwise.
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

/** First non-empty stringified value among the candidate keys. */
function pick(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(record[key]).trim();
    if (value && value !== '0' && value.toLowerCase() !== 'null') return value;
  }
  return '';
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: string): string {
  if (!value) return '';
  // Handles "HH:MM:SS", "HH:MM", or a full timestamp.
  const time = value.includes('T') || value.includes('-') ? value.replace(' ', 'T') : `1970-01-01T${value}`;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BucketKey = 'upcoming' | 'today' | 'recent';

export interface ActivityItem {
  key: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  timeLabel: string;
  chips: string[];
}

export interface ActivitySection {
  key: string;
  label: string;
  items: ActivityItem[];
}

export interface ChecklistItem {
  title: string;
  status: string;
  reply: string;
}

export interface ActivityStreamData {
  todayTitle: string;
  buckets: Record<BucketKey, ActivitySection[]>;
  checklist: ChecklistItem[];
}

// ---------------------------------------------------------------------------
// Section configuration — mirrors the 15 sections in newActivityStream.blade.php.
// Each entry lists candidate field names (the Laravel rows vary per section, so
// we read defensively rather than assume one exact shape).
// ---------------------------------------------------------------------------

interface SectionMeta {
  key: string;
  label: string;
  title: string[];
  subtitle: string[];
  date: string[];
  time: string[];
  chips: string[];
  status: string[];
}

const SECTION_META: SectionMeta[] = [
  { key: 'class_schedule', label: 'Schedule', title: ['title', 'subject_name', 'week_day'], subtitle: ['week_day'], date: ['attendance_date', 'date'], time: ['start_time'], chips: ['standard', 'division'], status: [] },
  { key: 'homework', label: 'Homework', title: ['title'], subtitle: ['description', 'display_name'], date: ['date', 'submission_date', 'created_on'], time: [], chips: ['standard', 'division'], status: ['completion_status'] },
  { key: 'eventCalender', label: 'Events & Calendar', title: ['title'], subtitle: [], date: ['school_date', 'created_at'], time: [], chips: ['standard'], status: [] },
  { key: 'announcementNotice', label: 'Announcement & Notice', title: ['title'], subtitle: [], date: ['from_date', 'created_at'], time: [], chips: [], status: [] },
  { key: 'dueBooks', label: 'Due Books', title: ['book_name', 'title'], subtitle: [], date: ['due_date', 'return_date'], time: [], chips: ['standard_id'], status: [] },
  { key: 'studentProgress', label: 'Student Progress', title: ['name'], subtitle: [], date: [], time: [], chips: ['standard', 'division'], status: [] },
  { key: 'ptm', label: 'PTM', title: ['ptmTitle', 'title'], subtitle: [], date: ['ptm_date'], time: ['from_time'], chips: ['standard', 'division'], status: [] },
  { key: 'lessonPlan', label: 'Lesson Plan', title: ['chapter_name', 'title'], subtitle: [], date: ['date', 'created_on'], time: [], chips: ['standard'], status: [] },
  { key: 'hrmsPunchInOut', label: 'Punch In/Out', title: ['user_name'], subtitle: [], date: ['punch_in', 'date'], time: ['punch_in', 'punch_out'], chips: [], status: [] },
  { key: 'proxyLecture', label: 'Proxy Lecture', title: ['user_name'], subtitle: ['periods'], date: ['proxy_date'], time: ['start_time'], chips: ['standard', 'division'], status: [] },
  { key: 'examMarks', label: 'Exam Marks', title: ['title', 'standard'], subtitle: [], date: ['exam_date'], time: [], chips: ['standard'], status: [] },
  { key: 'studentAttendance', label: 'Student Attendance', title: ['title', 'standard'], subtitle: [], date: ['attendance_date'], time: [], chips: ['standard'], status: [] },
  { key: 'taskAssigned', label: 'Task Assigned', title: ['TASK_TITLE', 'title'], subtitle: ['task_user_name'], date: ['TASK_DATE', 'CREATED_ON'], time: [], chips: [], status: ['STATUS'] },
  { key: 'parentCommunication', label: 'Parent Communication', title: ['title'], subtitle: ['reply'], date: ['date_', 'start_date', 'created_on'], time: [], chips: [], status: [] },
  { key: 'studentLeave', label: 'Student Leave', title: ['title'], subtitle: [], date: ['apply_date'], time: [], chips: ['standard'], status: ['status'] },
];

function mapItem(meta: SectionMeta, entry: unknown, index: number): ActivityItem {
  const r = toRecord(entry);
  const chips = meta.chips.map((k) => pick(r, [k])).filter(Boolean);
  const status = pick(r, meta.status);
  if (status) chips.push(status);
  return {
    key: `${meta.key}-${readString(r.id) || index}`,
    title: pick(r, meta.title) || meta.label,
    subtitle: pick(r, meta.subtitle),
    dateLabel: formatDate(pick(r, meta.date)),
    timeLabel: formatTime(pick(r, meta.time)),
    chips,
  };
}

function mapBucket(bucket: unknown): ActivitySection[] {
  const record = toRecord(bucket);
  const sections: ActivitySection[] = [];
  for (const meta of SECTION_META) {
    const items = toArray(record[meta.key]).map((entry, i) => mapItem(meta, entry, i));
    if (items.length > 0) sections.push({ key: meta.key, label: meta.label, items });
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** The logged-in user's profile name (Student / Teacher / Admin), for role-scoped feeds. */
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

function userProfileId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return readString(menuContext.user_profile_id ?? userData.user_profile_id ?? userData.profile_id);
  } catch {
    return '';
  }
}

export async function fetchActivityStream(signal?: AbortSignal): Promise<ActivityStreamData> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsActivityStream`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('user_id', session.userId);
  url.searchParams.set('user_profile', userProfileName());
  url.searchParams.set('user_profile_id', userProfileId());
  if (session.termId) url.searchParams.set('term_id', String(session.termId));

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the activity stream.`);
  const raw = toRecord(await readJson(res, 'Failed to load the activity stream'));

  const checklist: ChecklistItem[] = toArray(raw.checkList).map((entry) => {
    const r = toRecord(entry);
    return {
      title: pick(r, ['TASK_TITLE', 'title']),
      status: pick(r, ['STATUS', 'status']),
      reply: pick(r, ['reply']),
    };
  });

  return {
    todayTitle: readString(raw.todaytitle),
    buckets: {
      upcoming: mapBucket(raw.upcoming),
      today: mapBucket(raw.today),
      recent: mapBucket(raw.recent),
    },
    checklist,
  };
}
