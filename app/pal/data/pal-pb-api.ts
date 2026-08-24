import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';
import type { PbFluencyEvent, PbNotificationEvent, PbSessionEvent, PbStreakEvent } from './pal-pb';
import type { PbApiMasteryRecord } from './pal-pb-types';

export type PbApiSummary = {
  fluencyCount: number;
  bestFluency: number;
  streakCurrent: number;
  streakLongest: number;
  masteryCount: number;
  bestMastery: number;
  sessionCount: number;
  bestSession: number;
};

export type PbApiPersonalBest = {
  summary: PbApiSummary;
  fluency: PbFluencyEvent[];
  streak: PbStreakEvent[];
  mastery: PbApiMasteryRecord[];
  session: PbSessionEvent[];
  notifications: PbNotificationEvent[];
};

/**
 * PAL → Personal Best data layer.
 *
 *   GET /api/pal/gamification/personal-best?user_id=
 *   GET /api/pal/gamification/notifications?user_id=&limit=
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function resolveLearnerId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const viewAs = localStorage.getItem('pal_view_as_student');
    if (viewAs) {
      const parsed = JSON.parse(viewAs) as Record<string, unknown>;
      const studentId = readString(parsed.studentId);
      if (studentId) return studentId;
    }
  } catch {
    // ignore
  }
  return requireSession().userId;
}

export async function fetchPersonalBestSummary(signal?: AbortSignal): Promise<PbApiPersonalBest> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = `/api/pal/gamification/personal-best?user_id=${encodeURIComponent(learnerId)}&sub_institute_id=${encodeURIComponent(session.subInstituteId)}&syear=${encodeURIComponent(session.syear)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load personal best summary.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load personal best summary.');
  }

  const data = toRecord(record.data);
  const summary = toRecord(data.summary) as Record<string, unknown>;
  return {
    summary: {
      fluencyCount: readNumber(summary.fluency_count),
      bestFluency: readNumber(summary.best_fluency),
      streakCurrent: readNumber(summary.streak_current),
      streakLongest: readNumber(summary.streak_longest),
      masteryCount: readNumber(summary.mastery_count),
      bestMastery: readNumber(summary.best_mastery),
      sessionCount: readNumber(summary.session_count),
      bestSession: readNumber(summary.best_session),
    },
    fluency: Array.isArray(data.fluency) ? (data.fluency as PbFluencyEvent[]) : [],
    streak: Array.isArray(data.streak) ? (data.streak as PbStreakEvent[]) : [],
    mastery: Array.isArray(data.mastery) ? (data.mastery as PbApiMasteryRecord[]) : [],
    session: Array.isArray(data.session) ? (data.session as PbSessionEvent[]) : [],
    notifications: Array.isArray(data.notifications) ? (data.notifications as PbNotificationEvent[]) : [],
  };
}

export async function fetchPbNotifications(limit = 20, signal?: AbortSignal) {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = `/api/pal/gamification/notifications?user_id=${encodeURIComponent(learnerId)}&sub_institute_id=${encodeURIComponent(session.subInstituteId)}&syear=${encodeURIComponent(session.syear)}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load personal best notifications.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load personal best notifications.');
  }

  const data = toRecord(record.data);
  return {
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    limit: readNumber(data.limit),
  };
}
