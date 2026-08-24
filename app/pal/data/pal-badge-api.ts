import {
  buildSessionContext,
  createAuthHeaders,
  readString,
} from '@/lib/erp-client';

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

export type BadgeApiDefinition = {
  id: number;
  badgeCode: string;
  badgeName: string;
  category: string;
  description: string;
  triggerType: string;
  triggerRule: Record<string, unknown>;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  earned: boolean;
  earnedAt: string | null;
  progress: Record<string, unknown>;
};

export type BadgeApiAward = {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  badgeId: number;
  badgeCode: string;
  badgeName: string;
  category: string;
  description: string;
  icon: string | null;
  color: string | null;
  earnedAt: string;
  evidence: Record<string, unknown> | null;
};

export type BadgeApiSummary = {
  totalBadges: number;
  categories: Record<string, number>;
  recentBadges: BadgeApiAward[];
};

export type BadgeApiEvaluateResult = {
  processed: boolean;
  awarded: Array<{
    badgeCode: string;
    badgeName: string;
    category: string;
    awarded: boolean;
    reason: string;
    evidence: Record<string, unknown>;
  }>;
};

function requireSession() {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

export async function fetchBadgeSummary(signal?: AbortSignal): Promise<{
  summary: BadgeApiSummary;
  badges: BadgeApiDefinition[];
}> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = `/api/pal/gamification/badges?user_id=${encodeURIComponent(learnerId)}&sub_institute_id=${encodeURIComponent(session.subInstituteId)}&syear=${encodeURIComponent(session.syear)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load badge data.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load badge data.');
  }

  const data = toRecord(record.data);
  return {
    summary: toRecord(data.summary) as BadgeApiSummary,
    badges: Array.isArray(data.badges) ? (data.badges as BadgeApiDefinition[]) : [],
  };
}

export async function evaluateBadges(
  input: {
    quizData?: Array<{
      conceptName: string;
      masteryLevel: number;
      fluency: number;
      sessionCount: number;
    }>;
    sessionStart?: string;
    sessionEnd?: string;
  },
  signal?: AbortSignal
): Promise<BadgeApiEvaluateResult> {
  const session = requireSession();
  const learnerId = resolveLearnerId();

  const url = `/api/pal/gamification/badges/evaluate?user_id=${encodeURIComponent(learnerId)}&sub_institute_id=${encodeURIComponent(session.subInstituteId)}&syear=${encodeURIComponent(session.syear)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/json'),
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to evaluate badges.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to evaluate badges.');
  }

  const data = toRecord(record.data);
  return {
    processed: Boolean(data.processed),
    awarded: Array.isArray(data.awarded) ? (data.awarded as BadgeApiEvaluateResult['awarded']) : [],
  };
}
