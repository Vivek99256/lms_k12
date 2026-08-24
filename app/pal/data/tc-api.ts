import {
    buildSessionContext,
    createAuthHeaders,
    readString,
} from '@/lib/erp-client';
import type {
    ChallengeWithProgress,
    ChallengeProgress,
    TeamChallengeCreateData,
    TeamChallengeUpdateData,
    ContributionInput,
} from './tc-types';

export interface ChallengeParticipantInfo {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    joined_at: string;
    status: string;
}

export interface ChallengeContributionInfo {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    event_type: string;
    source_id: string | null;
    value: number;
    idempotency_key: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface ChallengeDetail {
    challenge: {
        id: number;
        title: string;
        description: string | null;
        challenge_type: string;
        target_type: string;
        target_value: number;
        reward_type: string | null;
        reward_value: string | null;
        status: string;
        created_by: number;
        sub_institute_id: number;
        syear: number;
        grade_id: number | null;
        standard_id: number | null;
        division_id: number | null;
        start_date: string | null;
        deadline: string | null;
        ended_at: string | null;
        created_at: string;
        updated_at: string;
    };
    participants: ChallengeParticipantInfo[];
    progress: ChallengeProgress | null;
    contributions: ChallengeContributionInfo[];
}

export interface TeamChallengeApiClient {
    fetchTeamChallenges: (opts?: { activeOnly?: boolean; signal?: AbortSignal }) => Promise<ChallengeWithProgress[]>;
    fetchChallengeDetail: (challengeId: number, signal?: AbortSignal) => Promise<ChallengeDetail>;
    fetchChallengeProgress: (challengeId: number, signal?: AbortSignal) => Promise<ChallengeProgress | null>;
    joinChallenge: (challengeId: number, signal?: AbortSignal) => Promise<boolean>;
    submitChallengeContribution: (
        challengeId: number,
        input: Omit<ContributionInput, 'team_challenge_id' | 'user_id'>,
        signal?: AbortSignal
    ) => Promise<ChallengeProgress | null>;
    createTeamChallenge: (data: TeamChallengeCreateData, signal?: AbortSignal) => Promise<number>;
    updateTeamChallenge: (challengeId: number, data: TeamChallengeUpdateData, signal?: AbortSignal) => Promise<boolean>;
    endTeamChallenge: (challengeId: number, signal?: AbortSignal) => Promise<boolean>;
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
    return '';
}

function getSession() {
    const session = buildSessionContext();
    if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
    return session;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            search.append(key, String(value));
        }
    }
    return search.toString();
}

export function createTcApiClient(): TeamChallengeApiClient {
    const session = getSession();
    const learnerId = resolveLearnerId() || session.userId;

    return {
        async fetchTeamChallenges(opts: { activeOnly?: boolean; signal?: AbortSignal } = {}): Promise<ChallengeWithProgress[]> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
                active: opts.activeOnly === true ? 'true' : undefined,
            });
            const url = `/api/pal/gamification/team-challenges?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal: opts.signal,
            });

            const payload = await readJson(res, 'Unable to load team challenges.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load team challenges.');
            }
            const data = toRecord(record.data);
            return Array.isArray(data.challenges) ? (data.challenges as ChallengeWithProgress[]) : [];
        },

        async fetchChallengeDetail(challengeId: number, signal?: AbortSignal): Promise<ChallengeDetail> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load challenge details.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load challenge details.');
            }
            const data = toRecord(record.data);
            return toRecord(data.challenge) as unknown as ChallengeDetail;
        },

        async fetchChallengeProgress(challengeId: number, signal?: AbortSignal): Promise<ChallengeProgress | null> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}/progress?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load challenge progress.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load challenge progress.');
            }
            const data = toRecord(record.data);
            return toRecord(data.progress) as unknown as ChallengeProgress;
        },

        async joinChallenge(challengeId: number, signal?: AbortSignal): Promise<boolean> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}/join?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to join challenge.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to join challenge.');
            }
            const data = toRecord(record.data);
            return Boolean(data.joined);
        },

        async submitChallengeContribution(
            challengeId: number,
            input: Omit<ContributionInput, 'team_challenge_id' | 'user_id'>,
            signal?: AbortSignal
        ): Promise<ChallengeProgress | null> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}/contribute?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                body: JSON.stringify(input),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to submit contribution.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to submit contribution.');
            }
            const data = toRecord(record.data);
            return toRecord(data.progress) as unknown as ChallengeProgress;
        },

        async createTeamChallenge(data: TeamChallengeCreateData, signal?: AbortSignal): Promise<number> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                body: JSON.stringify(data),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to create challenge.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to create challenge.');
            }
            const dataObj = toRecord(record.data);
            return Number(dataObj.challengeId ?? 0);
        },

        async updateTeamChallenge(challengeId: number, data: TeamChallengeUpdateData, signal?: AbortSignal): Promise<boolean> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}?${query}`;
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                body: JSON.stringify(data),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to update challenge.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to update challenge.');
            }
            const dataObj = toRecord(record.data);
            return Boolean(dataObj.updated);
        },

        async endTeamChallenge(challengeId: number, signal?: AbortSignal): Promise<boolean> {
            const query = buildQuery({
                user_id: learnerId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/team-challenges/${challengeId}/end?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to end challenge.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to end challenge.');
            }
            const dataObj = toRecord(record.data);
            return Boolean(dataObj.ended);
        },
    };
}

export async function fetchTeamChallenges(
    opts: { activeOnly?: boolean; signal?: AbortSignal } = {}
): Promise<ChallengeWithProgress[]> {
    return createTcApiClient().fetchTeamChallenges(opts);
}

export async function fetchChallengeDetail(
    challengeId: number,
    signal?: AbortSignal
): Promise<ChallengeDetail> {
    return createTcApiClient().fetchChallengeDetail(challengeId, signal);
}

export async function fetchChallengeProgress(
    challengeId: number,
    signal?: AbortSignal
): Promise<ChallengeProgress | null> {
    return createTcApiClient().fetchChallengeProgress(challengeId, signal);
}

export async function joinChallenge(
    challengeId: number,
    signal?: AbortSignal
): Promise<boolean> {
    return createTcApiClient().joinChallenge(challengeId, signal);
}

export async function submitChallengeContribution(
    challengeId: number,
    input: Omit<ContributionInput, 'team_challenge_id' | 'user_id'>,
    signal?: AbortSignal
): Promise<ChallengeProgress | null> {
    return createTcApiClient().submitChallengeContribution(challengeId, input, signal);
}

export async function createTeamChallenge(
    data: TeamChallengeCreateData,
    signal?: AbortSignal
): Promise<number> {
    return createTcApiClient().createTeamChallenge(data, signal);
}

export async function updateTeamChallenge(
    challengeId: number,
    data: TeamChallengeUpdateData,
    signal?: AbortSignal
): Promise<boolean> {
    return createTcApiClient().updateTeamChallenge(challengeId, data, signal);
}

export async function endTeamChallenge(
    challengeId: number,
    signal?: AbortSignal
): Promise<boolean> {
    return createTcApiClient().endTeamChallenge(challengeId, signal);
}
