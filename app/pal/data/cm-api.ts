import {
    buildSessionContext,
    createAuthHeaders,
    readString,
} from '@/lib/erp-client';
import type {
    Challenge,
    ChallengeOptIn,
    ChallengeAttempt,
    ChallengeResponse,
    ChallengeLeaderboardEntry,
    SubmitResponseInput,
    ScoringResult,
} from './cm-types';

export interface ChallengeModeApiClient {
    getStudentStatus(signal?: AbortSignal): Promise<{ hasOptedIn: boolean; optIn: ChallengeOptIn | null; availableChallenges: Challenge[] }>;
    setOptIn(isOptedIn: boolean, signal?: AbortSignal): Promise<ChallengeOptIn>;
    fetchAvailableChallenges(signal?: AbortSignal): Promise<Challenge[]>;
    fetchChallengeDetail(challengeId: number, signal?: AbortSignal): Promise<Challenge | null>;
    startAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null>;
    getInProgressAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null>;
    getAttempt(attemptId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null>;
    submitResponse(attemptId: number, input: SubmitResponseInput, signal?: AbortSignal): Promise<ChallengeResponse>;
    completeAttempt(attemptId: number, responses: SubmitResponseInput[], signal?: AbortSignal): Promise<{ attempt: ChallengeAttempt; scoring: ScoringResult }>;
    getAttemptResponses(attemptId: number, signal?: AbortSignal): Promise<ChallengeResponse[]>;
    getWeeklyLeaderboard(challengeId: number, weekStart: string, signal?: AbortSignal): Promise<ChallengeLeaderboardEntry[]>;
    getStudentHistory(signal?: AbortSignal): Promise<ChallengeAttempt[]>;
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

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            search.append(key, String(value));
        }
    }
    return search.toString();
}

function getSession() {
    const session = buildSessionContext();
    if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
    return session;
}

function toChallenge(record: Record<string, unknown>): Challenge {
    return {
        id: Number(record.id),
        title: String(record.title),
        description: record.description != null ? String(record.description) : null,
        subject_id: record.subject_id != null ? String(record.subject_id) : null,
        concept_id: record.concept_id != null ? String(record.concept_id) : null,
        difficulty: String(record.difficulty) as Challenge['difficulty'],
        target_time_seconds: Number(record.target_time_seconds),
        item_count: Number(record.item_count),
        is_active: Boolean(record.is_active),
        start_date: record.start_date != null ? String(record.start_date) : null,
        end_date: record.end_date != null ? String(record.end_date) : null,
        created_by: Number(record.created_by),
        sub_institute_id: String(record.sub_institute_id),
        syear: String(record.syear),
        created_at: String(record.created_at),
        updated_at: String(record.updated_at),
        availability_status: String(record.availability_status) as Challenge['availability_status'],
    };
}

function toOptIn(record: Record<string, unknown>): ChallengeOptIn {
    return {
        id: Number(record.id),
        user_id: String(record.user_id),
        sub_institute_id: String(record.sub_institute_id),
        syear: String(record.syear),
        is_opted_in: Boolean(record.is_opted_in),
        opted_in_at: String(record.opted_in_at),
        opted_out_at: record.opted_out_at != null ? String(record.opted_out_at) : null,
        created_at: String(record.created_at),
        updated_at: String(record.updated_at),
    };
}

function toAttempt(record: Record<string, unknown>): ChallengeAttempt {
    return {
        id: Number(record.id),
        challenge_id: Number(record.challenge_id),
        user_id: String(record.user_id),
        sub_institute_id: String(record.sub_institute_id),
        syear: String(record.syear),
        opt_in_id: record.opt_in_id != null ? Number(record.opt_in_id) : null,
        started_at: String(record.started_at),
        completed_at: record.completed_at != null ? String(record.completed_at) : null,
        total_items: Number(record.total_items),
        valid_responses: Number(record.valid_responses),
        correct_responses: Number(record.correct_responses),
        accuracy: Number(record.accuracy),
        avg_time_per_item: Number(record.avg_time_per_item),
        speed_ratio: Number(record.speed_ratio),
        difficulty_coefficient: Number(record.difficulty_coefficient),
        raw_score: Number(record.raw_score),
        is_qualified: Boolean(record.is_qualified),
        attempt_status: String(record.attempt_status) as ChallengeAttempt['attempt_status'],
        created_at: String(record.created_at),
        updated_at: String(record.updated_at),
    };
}

function toResponse(record: Record<string, unknown>): ChallengeResponse {
    return {
        id: Number(record.id),
        attempt_id: Number(record.attempt_id),
        challenge_id: Number(record.challenge_id),
        user_id: String(record.user_id),
        sub_institute_id: String(record.sub_institute_id),
        syear: String(record.syear),
        question_id: record.question_id != null ? String(record.question_id) : null,
        is_correct: Boolean(record.is_correct),
        response_time: Number(record.response_time),
        difficulty: Number(record.difficulty),
        target_time: Number(record.target_time),
        response_metadata: record.response_metadata != null ? String(record.response_metadata) : null,
        created_at: String(record.created_at),
    };
}

function toLeaderboardEntry(record: Record<string, unknown>): ChallengeLeaderboardEntry {
    return {
        id: Number(record.id),
        challenge_id: Number(record.challenge_id),
        user_id: String(record.user_id),
        sub_institute_id: String(record.sub_institute_id),
        syear: String(record.syear),
        week_start: String(record.week_start),
        week_number: Number(record.week_number),
        year_number: Number(record.year_number),
        score: Number(record.score),
        rank: record.rank != null ? Number(record.rank) : null,
        is_qualified: Boolean(record.is_qualified),
        display_name: String(record.display_name),
        created_at: String(record.created_at),
        updated_at: String(record.updated_at),
    };
}

export function createCmApiClient(): ChallengeModeApiClient {
    const session = getSession();

    return {
        async getStudentStatus(signal?: AbortSignal): Promise<{ hasOptedIn: boolean; optIn: ChallengeOptIn | null; availableChallenges: Challenge[] }> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load challenge mode status.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load challenge mode status.');
            }
            const data = toRecord(record.data);
            return {
                hasOptedIn: Boolean(data.hasOptedIn),
                optIn: data.optIn ? toOptIn(toRecord(data.optIn)) : null,
                availableChallenges: Array.isArray(data.availableChallenges) ? data.availableChallenges.map(toChallenge) : [],
            };
        },

        async setOptIn(isOptedIn: boolean, signal?: AbortSignal): Promise<ChallengeOptIn> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOptedIn }),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to update opt-in status.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to update opt-in status.');
            }
            return toOptIn(toRecord(record.data));
        },

        async fetchAvailableChallenges(signal?: AbortSignal): Promise<Challenge[]> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/challenges?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load challenges.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load challenges.');
            }
            const data = toRecord(record.data);
            return Array.isArray(data.challenges) ? data.challenges.map(toChallenge) : [];
        },

        async fetchChallengeDetail(challengeId: number, signal?: AbortSignal): Promise<Challenge | null> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/challenges/${challengeId}?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load challenge detail.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load challenge detail.');
            }
            const data = toRecord(record.data);
            return data.challenge ? toChallenge(toRecord(data.challenge)) : null;
        },

        async startAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/challenges/${challengeId}?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to start challenge attempt.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to start challenge attempt.');
            }
            const data = toRecord(record.data);
            return data.attempt ? toAttempt(toRecord(data.attempt)) : null;
        },

        async getInProgressAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load attempt.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                return null;
            }
            const data = toRecord(record.data);
            const attempts = Array.isArray(data.attempts) ? data.attempts.map(toAttempt) : [];
            return attempts.find((a) => a.challenge_id === challengeId && a.attempt_status === 'in_progress') || null;
        },

        async getAttempt(attemptId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts/${attemptId}?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load attempt.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load attempt.');
            }
            const data = toRecord(record.data);
            return data.attempt ? toAttempt(toRecord(data.attempt)) : null;
        },

        async submitResponse(attemptId: number, input: SubmitResponseInput, signal?: AbortSignal): Promise<ChallengeResponse> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts/${attemptId}/responses?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to submit response.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to submit response.');
            }
            const data = toRecord(record.data);
            return toResponse(toRecord(data.response));
        },

        async completeAttempt(attemptId: number, responses: SubmitResponseInput[], signal?: AbortSignal): Promise<{ attempt: ChallengeAttempt; scoring: ScoringResult }> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts/${attemptId}/complete?${query}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...createAuthHeaders(session, 'application/json'), Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ responses }),
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to complete attempt.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to complete attempt.');
            }
            const data = toRecord(record.data);
            return {
                attempt: toAttempt(toRecord(data.attempt)),
                scoring: toRecord(data.scoring) as unknown as ScoringResult,
            };
        },

        async getAttemptResponses(attemptId: number, signal?: AbortSignal): Promise<ChallengeResponse[]> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts/${attemptId}/responses?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load responses.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                return [];
            }
            const data = toRecord(record.data);
            return Array.isArray(data.responses) ? data.responses.map(toResponse) : [];
        },

        async getWeeklyLeaderboard(challengeId: number, weekStart: string, signal?: AbortSignal): Promise<ChallengeLeaderboardEntry[]> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
                challenge_id: challengeId,
                week_start: weekStart,
            });
            const url = `/api/pal/gamification/challenge-mode/leaderboard?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load leaderboard.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                throw new Error(readString(record.message) || 'Unable to load leaderboard.');
            }
            const data = toRecord(record.data);
            return Array.isArray(data.entries) ? data.entries.map(toLeaderboardEntry) : [];
        },

        async getStudentHistory(signal?: AbortSignal): Promise<ChallengeAttempt[]> {
            const query = buildQuery({
                user_id: session.userId,
                sub_institute_id: session.subInstituteId,
                syear: session.syear,
            });
            const url = `/api/pal/gamification/challenge-mode/attempts?${query}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...createAuthHeaders(session), Accept: 'application/json' },
                cache: 'no-store',
                signal,
            });

            const payload = await readJson(res, 'Unable to load history.');
            const record = toRecord(payload);
            if (readString(record.status) !== '1') {
                return [];
            }
            const data = toRecord(record.data);
            return Array.isArray(data.attempts) ? data.attempts.map(toAttempt) : [];
        },
    };
}

export async function getStudentChallengeStatus(signal?: AbortSignal): Promise<{ hasOptedIn: boolean; optIn: ChallengeOptIn | null; availableChallenges: Challenge[] }> {
    return createCmApiClient().getStudentStatus(signal);
}

export async function setChallengeOptIn(isOptedIn: boolean, signal?: AbortSignal): Promise<ChallengeOptIn> {
    return createCmApiClient().setOptIn(isOptedIn, signal);
}

export async function setChallengeOptOut(signal?: AbortSignal): Promise<ChallengeOptIn> {
    return createCmApiClient().setOptIn(false, signal);
}

export async function fetchChallengeModeChallenges(signal?: AbortSignal): Promise<Challenge[]> {
    return createCmApiClient().fetchAvailableChallenges(signal);
}

export async function fetchChallengeModeDetail(challengeId: number, signal?: AbortSignal): Promise<Challenge | null> {
    return createCmApiClient().fetchChallengeDetail(challengeId, signal);
}

export async function startChallengeAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
    return createCmApiClient().startAttempt(challengeId, signal);
}

export async function getChallengeModeAttempt(attemptId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
    return createCmApiClient().getAttempt(attemptId, signal);
}

export async function getChallengeModeInProgressAttempt(challengeId: number, signal?: AbortSignal): Promise<ChallengeAttempt | null> {
    return createCmApiClient().getInProgressAttempt(challengeId, signal);
}

export async function submitChallengeResponse(attemptId: number, input: SubmitResponseInput, signal?: AbortSignal): Promise<ChallengeResponse> {
    return createCmApiClient().submitResponse(attemptId, input, signal);
}

export async function completeChallengeAttempt(attemptId: number, responses: SubmitResponseInput[], signal?: AbortSignal): Promise<{ attempt: ChallengeAttempt; scoring: ScoringResult }> {
    return createCmApiClient().completeAttempt(attemptId, responses, signal);
}

export async function getChallengeModeResponses(attemptId: number, signal?: AbortSignal): Promise<ChallengeResponse[]> {
    return createCmApiClient().getAttemptResponses(attemptId, signal);
}

export async function getChallengeModeLeaderboard(challengeId: number, weekStart: string, signal?: AbortSignal): Promise<ChallengeLeaderboardEntry[]> {
    return createCmApiClient().getWeeklyLeaderboard(challengeId, weekStart, signal);
}

export async function getStudentChallengeHistory(signal?: AbortSignal): Promise<ChallengeAttempt[]> {
    return createCmApiClient().getStudentHistory(signal);
}
