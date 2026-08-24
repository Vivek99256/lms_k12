import type { PalCmStore } from './cm-store';
import type {
    ChallengeRow,
    ChallengeOptInRow,
    ChallengeAttemptRow,
    ChallengeResponseRow,
    ChallengeLeaderboardRow,
    Challenge,
    ChallengeOptIn,
    ChallengeAttempt,
    ChallengeResponse,
    ChallengeLeaderboardEntry,
    ChallengeContext,
    ChallengeAvailabilityStatus,
    ScoringResult,
    SubmitResponseInput,
} from './cm-types';

function getMonday(d: Date): Date {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    date.setUTCDate(diff);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function getIsoWeek(date: Date): { weekNumber: number; yearNumber: number } {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { weekNumber, yearNumber: d.getUTCFullYear() };
}

function mapRowToChallenge(row: ChallengeRow): Challenge {
    const now = new Date();
    let availabilityStatus: ChallengeAvailabilityStatus = 'available';
    if (!row.is_active) {
        availabilityStatus = 'unavailable';
    } else if (row.start_date && now < row.start_date) {
        availabilityStatus = 'unavailable';
    } else if (row.end_date && now > row.end_date) {
        availabilityStatus = 'ended';
    }
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        subject_id: row.subject_id,
        concept_id: row.concept_id,
        difficulty: row.difficulty,
        target_time_seconds: row.target_time_seconds,
        item_count: row.item_count,
        is_active: row.is_active,
        start_date: row.start_date ? row.start_date.toISOString() : null,
        end_date: row.end_date ? row.end_date.toISOString() : null,
        created_by: row.created_by,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        availability_status: availabilityStatus,
    };
}

function mapRowToOptIn(row: ChallengeOptInRow): ChallengeOptIn {
    return {
        id: row.id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        is_opted_in: row.is_opted_in,
        opted_in_at: row.opted_in_at.toISOString(),
        opted_out_at: row.opted_out_at ? row.opted_out_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

function mapRowToAttempt(row: ChallengeAttemptRow): ChallengeAttempt {
    return {
        id: row.id,
        challenge_id: row.challenge_id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        opt_in_id: row.opt_in_id,
        started_at: row.started_at.toISOString(),
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
        total_items: row.total_items,
        valid_responses: row.valid_responses,
        correct_responses: row.correct_responses,
        accuracy: row.accuracy,
        avg_time_per_item: row.avg_time_per_item,
        speed_ratio: row.speed_ratio,
        difficulty_coefficient: row.difficulty_coefficient,
        raw_score: row.raw_score,
        is_qualified: row.is_qualified,
        attempt_status: row.attempt_status,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

function mapRowToResponse(row: ChallengeResponseRow): ChallengeResponse {
    return {
        id: row.id,
        attempt_id: row.attempt_id,
        challenge_id: row.challenge_id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        question_id: row.question_id,
        is_correct: row.is_correct,
        response_time: row.response_time,
        difficulty: row.difficulty,
        target_time: row.target_time,
        response_metadata: row.response_metadata,
        created_at: row.created_at.toISOString(),
    };
}

function mapRowToLeaderboard(row: ChallengeLeaderboardRow): ChallengeLeaderboardEntry {
    return {
        id: row.id,
        challenge_id: row.challenge_id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        week_start: row.week_start.toISOString().slice(0, 10),
        week_number: row.week_number,
        year_number: row.year_number,
        score: row.score,
        rank: row.rank,
        is_qualified: row.is_qualified,
        display_name: row.display_name,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

export function calculateChallengeScore(responses: { difficulty: number; response_time: number; is_correct: boolean }[], targetTime: number): ScoringResult {
    const validResponses = responses.filter((r) => r.response_time > 0);
    const totalResponses = responses.length;
    const validCount = validResponses.length;

    if (validCount === 0) {
        return {
            accuracy: 0,
            avg_time_per_item: 0,
            speed_ratio: 0,
            difficulty_coefficient: 0,
            raw_score: 0,
            is_qualified: false,
            valid_responses: 0,
            correct_responses: 0,
            total_items: totalResponses,
        };
    }

    const correctResponses = validResponses.filter((r) => r.is_correct).length;
    const accuracy = correctResponses / validCount;
    const totalResponseTime = validResponses.reduce((sum, r) => sum + r.response_time, 0);
    const avgTimePerItem = totalResponseTime / validCount;
    const speedRatio = Math.min(targetTime / avgTimePerItem, 2.0);
    const avgDifficulty = validResponses.reduce((sum, r) => sum + r.difficulty, 0) / validCount;
    const difficultyCoefficient = Math.max(0, avgDifficulty / 5);
    const rawScore = Math.round(accuracy * speedRatio * difficultyCoefficient * 1000);
    const isQualified = validCount >= 5;

    return {
        accuracy: Math.round(accuracy * 10000) / 10000,
        avg_time_per_item: Math.round(avgTimePerItem * 1000) / 1000,
        speed_ratio: Math.round(speedRatio * 10000) / 10000,
        difficulty_coefficient: Math.round(difficultyCoefficient * 10000) / 10000,
        raw_score: rawScore,
        is_qualified: isQualified,
        valid_responses: validCount,
        correct_responses: correctResponses,
        total_items: totalResponses,
    };
}

export interface PalCmService {
    getStudentChallengeStatus: (ctx: ChallengeContext) => Promise<{ hasOptedIn: boolean; optIn: ChallengeOptIn | null; availableChallenges: Challenge[] }>;
    setChallengeOptIn: (userId: string, isOptedIn: boolean, ctx: ChallengeContext) => Promise<ChallengeOptIn>;
    setChallengeOptOut: (userId: string, ctx: ChallengeContext) => Promise<ChallengeOptIn>;
    fetchAvailableChallenges: (ctx: ChallengeContext) => Promise<Challenge[]>;
    fetchChallengeById: (challengeId: number, ctx: ChallengeContext) => Promise<Challenge | null>;
    startAttempt: (challengeId: number, ctx: ChallengeContext) => Promise<ChallengeAttempt | null>;
    getAttempt: (attemptId: number, ctx: ChallengeContext) => Promise<ChallengeAttempt | null>;
    getInProgressAttempt: (challengeId: number, ctx: ChallengeContext) => Promise<ChallengeAttempt | null>;
    submitResponse: (attemptId: number, input: SubmitResponseInput, ctx: ChallengeContext) => Promise<ChallengeResponse>;
    completeAttempt: (attemptId: number, responses: SubmitResponseInput[], ctx: ChallengeContext) => Promise<{ attempt: ChallengeAttempt; scoring: ScoringResult }>;
    getAttemptResponses: (attemptId: number) => Promise<ChallengeResponse[]>;
    getWeeklyLeaderboard: (challengeId: number, weekStart: Date, ctx: ChallengeContext) => Promise<ChallengeLeaderboardEntry[]>;
    getStudentLeaderboardForTeacher: (studentIds: string[], challengeId: number, weekStart: Date, ctx: ChallengeContext) => Promise<ChallengeLeaderboardEntry[]>;
    getStudentChallengeHistory: (ctx: ChallengeContext) => Promise<ChallengeAttempt[]>;
}

export function createPalCmService(store: PalCmStore): PalCmService {
    return {
        async getStudentChallengeStatus(ctx: ChallengeContext): Promise<{ hasOptedIn: boolean; optIn: ChallengeOptIn | null; availableChallenges: Challenge[] }> {
            const optInRow = await store.getOptInStatus(ctx.user_id, ctx);
            const challenges = await store.fetchAvailableChallenges(ctx);
            const hasOptedIn = optInRow ? optInRow.is_opted_in : false;
            return {
                hasOptedIn,
                optIn: optInRow ? mapRowToOptIn(optInRow) : null,
                availableChallenges: challenges.map(mapRowToChallenge),
            };
        },

        async setChallengeOptIn(userId: string, isOptedIn: boolean, ctx: ChallengeContext): Promise<ChallengeOptIn> {
            const row = await store.setOptIn(userId, isOptedIn, ctx);
            return mapRowToOptIn(row);
        },

        async setChallengeOptOut(userId: string, ctx: ChallengeContext): Promise<ChallengeOptIn> {
            const row = await store.setOptIn(userId, false, ctx);
            return mapRowToOptIn(row);
        },

        async fetchAvailableChallenges(ctx: ChallengeContext): Promise<Challenge[]> {
            const rows = await store.fetchAvailableChallenges(ctx);
            return rows.map(mapRowToChallenge);
        },

        async fetchChallengeById(challengeId: number, ctx: ChallengeContext): Promise<Challenge | null> {
            const row = await store.fetchChallengeById(challengeId, ctx);
            return row ? mapRowToChallenge(row) : null;
        },

        async startAttempt(challengeId: number, ctx: ChallengeContext): Promise<ChallengeAttempt | null> {
            const challengeRow = await store.fetchChallengeById(challengeId, ctx);
            if (!challengeRow) return null;

            const challenge = mapRowToChallenge(challengeRow);
            if (challenge.availability_status !== 'available') return null;

            const optInRow = await store.getOptInStatus(ctx.user_id, ctx);
            if (!optInRow || !optInRow.is_opted_in) return null;

            const existing = await store.getInProgressAttempt(challengeId, ctx.user_id, ctx);
            if (existing) return mapRowToAttempt(existing);

            const attemptRow = await store.createAttempt(challengeId, ctx.user_id, ctx, challenge.item_count);
            return mapRowToAttempt(attemptRow);
        },

        async getAttempt(attemptId: number, ctx: ChallengeContext): Promise<ChallengeAttempt | null> {
            const row = await store.getAttemptById(attemptId, ctx);
            return row ? mapRowToAttempt(row) : null;
        },

        async getInProgressAttempt(challengeId: number, ctx: ChallengeContext): Promise<ChallengeAttempt | null> {
            const row = await store.getInProgressAttempt(challengeId, ctx.user_id, ctx);
            return row ? mapRowToAttempt(row) : null;
        },

        async submitResponse(attemptId: number, input: SubmitResponseInput, ctx: ChallengeContext): Promise<ChallengeResponse> {
            const attemptRow = await store.getAttemptById(attemptId, ctx);
            if (!attemptRow || attemptRow.attempt_status !== 'in_progress') {
                throw new Error('Attempt not found or already completed.');
            }

            const challengeId = attemptRow.challenge_id;
            const inputWithoutMeta = (({ response_metadata: _m, ...rest }: typeof input) => rest)(input); // eslint-disable-line @typescript-eslint/no-unused-vars

            const responseRow = await store.submitResponse(attemptId, inputWithoutMeta, ctx);

            return {
                id: responseRow.id,
                attempt_id: responseRow.attempt_id,
                challenge_id: challengeId,
                user_id: responseRow.user_id,
                sub_institute_id: responseRow.sub_institute_id,
                syear: responseRow.syear,
                question_id: responseRow.question_id,
                is_correct: responseRow.is_correct,
                response_time: responseRow.response_time,
                difficulty: responseRow.difficulty,
                target_time: responseRow.target_time,
                response_metadata: responseRow.response_metadata,
                created_at: typeof responseRow.created_at === 'string' ? responseRow.created_at : responseRow.created_at.toISOString(),
            };
        },

        async completeAttempt(attemptId: number, responses: SubmitResponseInput[], ctx: ChallengeContext): Promise<{ attempt: ChallengeAttempt; scoring: ScoringResult }> {
            const attemptRow = await store.getAttemptById(attemptId, ctx);
            if (!attemptRow || attemptRow.attempt_status !== 'in_progress') {
                throw new Error('Attempt not found or already completed.');
            }

            const challengeRow = await store.fetchChallengeById(attemptRow.challenge_id, ctx);
            if (!challengeRow) {
                throw new Error('Challenge not found.');
            }

            const scoring = calculateChallengeScore(
                responses.map((r) => ({
                    difficulty: r.difficulty,
                    response_time: r.response_time,
                    is_correct: r.is_correct,
                })),
                challengeRow.target_time_seconds
            );

            const updatedAttempt = await store.completeAttempt(attemptId, scoring, ctx);

            if (scoring.is_qualified) {
                const { weekNumber, yearNumber } = getIsoWeek(new Date());
                const weekStart = getMonday(new Date());
                const nameResult = await store.getStudentDisplayNames([ctx.user_id]);
                const displayName = nameResult.get(ctx.user_id) || 'Student';

                await store.upsertLeaderboardEntry(
                    challengeRow.id,
                    ctx.user_id,
                    weekStart,
                    weekNumber,
                    yearNumber,
                    scoring.raw_score,
                    true,
                    displayName,
                    ctx
                );
            }

            return {
                attempt: mapRowToAttempt(updatedAttempt),
                scoring,
            };
        },

        async getAttemptResponses(attemptId: number): Promise<ChallengeResponse[]> {
            const rows = await store.getResponsesForAttempt(attemptId);
            return rows.map(mapRowToResponse);
        },

        async getWeeklyLeaderboard(challengeId: number, weekStart: Date, ctx: ChallengeContext): Promise<ChallengeLeaderboardEntry[]> {
            const rows = await store.getLeaderboard(challengeId, weekStart, 5, ctx);
            return rows.map(mapRowToLeaderboard);
        },

        async getStudentLeaderboardForTeacher(studentIds: string[], challengeId: number, weekStart: Date, ctx: ChallengeContext): Promise<ChallengeLeaderboardEntry[]> {
            if (studentIds.length === 0) return [];
            const rows = await store.getQualifiedAttemptsForLeaderboard(challengeId, ctx, weekStart);
            const filtered = rows.filter((r) => studentIds.includes(r.attempt.user_id));
            const ranked = filtered
                .sort((a, b) => b.attempt.raw_score - a.attempt.raw_score)
                .map((r, index) => {
                    const { weekNumber, yearNumber } = getIsoWeek(weekStart);
                    return {
                        id: index + 1,
                        challenge_id: challengeId,
                        user_id: r.attempt.user_id,
                        sub_institute_id: ctx.sub_institute_id,
                        syear: ctx.syear,
                        week_start: weekStart.toISOString().slice(0, 10),
                        week_number: weekNumber,
                        year_number: yearNumber,
                        score: r.attempt.raw_score,
                        rank: index + 1,
                        is_qualified: r.attempt.is_qualified,
                        display_name: r.display_name,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as ChallengeLeaderboardEntry;
                });
            return ranked.slice(0, 5);
        },

        async getStudentChallengeHistory(ctx: ChallengeContext): Promise<ChallengeAttempt[]> {
            const rows = await store.getStudentChallengeHistory(ctx.user_id, ctx);
            return rows.map(mapRowToAttempt);
        },
    };
}
