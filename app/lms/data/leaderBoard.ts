import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Leader Board data layer (lmsLeaderboardController, student display).
 *
 *   GET /lms/lmsLeaderboard?type=API&sub_institute_id&user_id&user_profile_id&syear
 *     → { status, message, lb_Data: {...} | [] }
 *
 * lb_Data is an object when the student has points, or an empty array otherwise.
 * Ranking = SUM(points) DESC within the student's standard/year (top-5); the
 * medal/tier is hard-coded "Bronze" in Laravel (no tier logic exists), and
 * lb_points is only ever read — nothing in the backend awards points yet.
 * The controller now reads tenant/user from the request (headless fallback).
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

export interface LbModule {
  name: string;
  points: number;
}

export interface LbTopper {
  rank: number;
  name: string;
  points: number;
  isCurrentUser: boolean;
}

export interface LeaderBoard {
  hasData: boolean;
  totalPoints: number;
  rank: number;
  medal: string;
  modules: LbModule[];
  toppers: LbTopper[];
}

export async function fetchLeaderBoard(signal?: AbortSignal): Promise<LeaderBoard> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsLeaderboard`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('user_id', session.userId);
  url.searchParams.set('user_profile_id', userProfileId());
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the leader board.`);
  const raw = toRecord(await readJson(res, 'Failed to load the leader board'));

  const lbData = raw.lb_Data;
  // Empty array => no points yet.
  if (Array.isArray(lbData) || !lbData) {
    return { hasData: false, totalPoints: 0, rank: 0, medal: 'Bronze', modules: [], toppers: [] };
  }

  const data = toRecord(lbData);

  // modulewise_points: { module_name: { ICON, DATA: { date: points } } }
  const modules: LbModule[] = Object.entries(toRecord(data.modulewise_points)).map(([name, value]) => {
    const node = toRecord(value);
    const dataMap = toRecord(node.DATA);
    const points = Object.values(dataMap).reduce<number>((sum, v) => sum + readNumber(v), 0);
    return { name, points };
  });

  const toppers: LbTopper[] = toArray(data.classdata).map((entry, index) => {
    const r = toRecord(entry);
    return {
      rank: index + 1,
      name: readString(r.student_name).trim() || `Student ${index + 1}`,
      points: readNumber(r.total_points),
      isCurrentUser: readString(r.user_id) === session.userId,
    };
  });

  return {
    hasData: true,
    totalPoints: readNumber(data.total_points),
    rank: readNumber(data.student_rank),
    medal: 'Bronze',
    modules,
    toppers,
  };
}
