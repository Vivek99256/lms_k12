import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS Engagement -> Leader Board data layer.
 *
 * Talks to the K12 REST API added for this module (Laravel:
 * App\Http\Controllers\api\lms\LmsLeaderboardApiController), NOT the legacy
 * `/lms/lmsLeaderboard` Blade route the page used to scrape:
 *
 *   GET /api/lms/leaderboard            my summary (points, modules, rank, toppers)
 *   GET /api/lms/leaderboard/filters    the years/classes/modules that have data
 *   GET /api/lms/leaderboard/rankings   the whole class ranking, paginated
 *
 * Auth is the standard ERP bearer JWT; the tenant, the user and the academic
 * year are all derived from that token server-side, so nothing identifying is
 * sent from here. `syear`/`term_id` are passed only to let the signed-in user
 * switch academic year, exactly like the header year switcher does elsewhere.
 */

export interface LbModule {
  moduleName: string;
  label: string;
  icon: string;
  description: string;
  points: number;
  entries: { date: string; points: number }[];
}

export interface LbRanking {
  rank: number;
  userId: number;
  name: string;
  points: number;
  avatarUrl: string;
  isCurrentUser: boolean;
}

export interface LeaderBoard {
  hasData: boolean;
  syear: number;
  totalPoints: number;
  rank: number | null;
  classSize: number;
  medal: string;
  standardName: string;
  sectionName: string;
  modules: LbModule[];
  toppers: LbRanking[];
}

export interface LbFilterOptions {
  syears: number[];
  standards: { id: number; name: string }[];
  modules: { value: string; label: string }[];
}

export interface LbRankingFilters {
  standardId?: string;
  moduleName?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface LbRankingPage {
  items: LbRanking[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
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

/** Build a request URL carrying the year context the API needs. */
function apiUrl(session: SessionContext, path: string, params: Record<string, string | undefined> = {}): URL {
  const url = new URL(`${session.baseUrl}/api/lms/${path}`);
  if (session.syear) url.searchParams.set('syear', session.syear);
  if (session.termId) url.searchParams.set('term_id', session.termId);
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
      throw new Error(`The server returned an unexpected response (HTTP ${res.status}).`);
    }
  }

  if (!res.ok || body.success === false) {
    // Never surface a raw backend error; the API already writes user-safe copy.
    const message = readString(body.message);
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(message || `Unable to load the leader board (HTTP ${res.status}).`);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRanking(entry: unknown): LbRanking {
  const row = toRecord(entry);
  return {
    rank: readNumber(row.rank),
    userId: readNumber(row.user_id),
    name: readString(row.student_name).trim() || 'Unnamed learner',
    points: readNumber(row.total_points),
    avatarUrl: readString(row.avatar_url),
    isCurrentUser: row.is_current_user === true,
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchLeaderBoard(syear?: string, signal?: AbortSignal): Promise<LeaderBoard> {
  const session = requireSession();
  const url = apiUrl(session, 'leaderboard', { syear, top_limit: '10' });
  const data = toRecord((await getJson(url, session, signal)).data);
  const learner = toRecord(data.learner);

  return {
    hasData: data.has_data === true,
    syear: readNumber(data.syear),
    totalPoints: readNumber(learner.total_points),
    rank: learner.rank == null ? null : readNumber(learner.rank),
    classSize: readNumber(learner.class_size),
    medal: readString(learner.medal) || 'Bronze',
    standardName: readString(learner.standard_name),
    sectionName: readString(learner.section_name),
    modules: toArray(data.modules).map((entry) => {
      const row = toRecord(entry);
      return {
        moduleName: readString(row.module_name),
        label: readString(row.label) || readString(row.module_name),
        icon: readString(row.icon),
        description: readString(row.description),
        points: readNumber(row.points),
        entries: toArray(row.entries).map((item) => {
          const point = toRecord(item);
          return { date: readString(point.date), points: readNumber(point.points) };
        }),
      };
    }),
    toppers: toArray(data.toppers).map(mapRanking),
  };
}

export async function fetchLbFilterOptions(signal?: AbortSignal): Promise<LbFilterOptions> {
  const session = requireSession();
  const data = toRecord((await getJson(apiUrl(session, 'leaderboard/filters'), session, signal)).data);

  return {
    syears: toArray(data.syears).map((year) => readNumber(year)),
    standards: toArray(data.standards).map((entry) => {
      const row = toRecord(entry);
      return { id: readNumber(row.id), name: readString(row.name) };
    }),
    modules: toArray(data.modules).map((entry) => {
      const row = toRecord(entry);
      return { value: readString(row.value), label: readString(row.label) };
    }),
  };
}

export async function fetchLbRankings(
  filters: LbRankingFilters = {},
  signal?: AbortSignal
): Promise<LbRankingPage> {
  const session = requireSession();
  const url = apiUrl(session, 'leaderboard/rankings', {
    standard_id: filters.standardId,
    module_name: filters.moduleName,
    from: filters.from,
    to: filters.to,
    page: String(filters.page ?? 1),
    per_page: String(filters.perPage ?? 20),
  });

  const body = await getJson(url, session, signal);
  const meta = toRecord(body.meta);

  return {
    items: toArray(body.data).map(mapRanking),
    page: readNumber(meta.current_page) || 1,
    perPage: readNumber(meta.per_page) || 20,
    total: readNumber(meta.total),
    lastPage: readNumber(meta.last_page) || 1,
  };
}
