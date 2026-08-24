import mysql from 'mysql2/promise';
import { getDbConfig } from './pal-pb-store-config';
import type {
    ChallengeRow,
    ChallengeOptInRow,
    ChallengeAttemptRow,
    ChallengeResponseRow,
    ChallengeLeaderboardRow,
    ChallengeContext,
    ScoringResult,
} from './cm-types';

export interface PalCmStoreConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface PalCmStore {
    fetchAvailableChallenges(ctx: ChallengeContext): Promise<ChallengeRow[]>;
    fetchChallengeById(id: number, ctx: ChallengeContext): Promise<ChallengeRow | null>;
    getOptInStatus(userId: string, ctx: ChallengeContext): Promise<ChallengeOptInRow | null>;
    setOptIn(userId: string, isOptedIn: boolean, ctx: ChallengeContext): Promise<ChallengeOptInRow>;
    createAttempt(challengeId: number, userId: string, ctx: ChallengeContext, totalItems: number): Promise<ChallengeAttemptRow>;
    getInProgressAttempt(challengeId: number, userId: string, ctx: ChallengeContext): Promise<ChallengeAttemptRow | null>;
    getAttemptById(attemptId: number, ctx: ChallengeContext): Promise<ChallengeAttemptRow | null>;
    submitResponse(attemptId: number, input: { question_id: string | null; is_correct: boolean; response_time: number; difficulty: number; target_time: number }, ctx: ChallengeContext): Promise<ChallengeResponseRow>;
    getResponsesForAttempt(attemptId: number): Promise<ChallengeResponseRow[]>;
    completeAttempt(attemptId: number, scoring: ScoringResult, ctx: ChallengeContext): Promise<ChallengeAttemptRow>;
    getQualifiedAttemptsForLeaderboard(challengeId: number, ctx: ChallengeContext, weekStart: Date): Promise<{ attempt: ChallengeAttemptRow; display_name: string }[]>;
    upsertLeaderboardEntry(challengeId: number, userId: string, weekStart: Date, weekNumber: number, yearNumber: number, score: number, isQualified: boolean, displayName: string, ctx: ChallengeContext): Promise<ChallengeLeaderboardRow>;
    getLeaderboard(challengeId: number, weekStart: Date, limit?: number, ctx?: { sub_institute_id: string; syear: string }): Promise<ChallengeLeaderboardRow[]>;
    getStudentOptInStatuses(userIds: string[], ctx: ChallengeContext): Promise<Map<string, boolean>>;
    getStudentDisplayNames(userIds: string[]): Promise<Map<string, string>>;
    getStudentChallengeHistory(userId: string, ctx: ChallengeContext): Promise<ChallengeAttemptRow[]>;
    close: () => Promise<void>;
}

function dateToSql(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function createMockPalCmStore(): PalCmStore {
    return {
        fetchAvailableChallenges: async () => [],
        fetchChallengeById: async () => null,
        getOptInStatus: async () => null,
        setOptIn: async () => ({ id: 0, user_id: '', sub_institute_id: '', syear: '', is_opted_in: true, opted_in_at: new Date(), opted_out_at: null, created_at: new Date(), updated_at: new Date() }),
        createAttempt: async () => ({ id: 0, challenge_id: 0, user_id: '', sub_institute_id: '', syear: '', opt_in_id: null, started_at: new Date(), completed_at: null, total_items: 0, valid_responses: 0, correct_responses: 0, accuracy: 0, avg_time_per_item: 0, speed_ratio: 0, difficulty_coefficient: 0, raw_score: 0, is_qualified: false, attempt_status: 'in_progress', created_at: new Date(), updated_at: new Date() }),
        getInProgressAttempt: async () => null,
        getAttemptById: async () => null,
        submitResponse: async () => ({ id: 0, attempt_id: 0, challenge_id: 0, user_id: '', sub_institute_id: '', syear: '', question_id: null, is_correct: false, response_time: 0, difficulty: 0, target_time: 0, response_metadata: null, created_at: new Date() }),
        getResponsesForAttempt: async () => [],
        completeAttempt: async () => ({ id: 0, challenge_id: 0, user_id: '', sub_institute_id: '', syear: '', opt_in_id: null, started_at: new Date(), completed_at: new Date(), total_items: 0, valid_responses: 0, correct_responses: 0, accuracy: 0, avg_time_per_item: 0, speed_ratio: 0, difficulty_coefficient: 0, raw_score: 0, is_qualified: false, attempt_status: 'completed', created_at: new Date(), updated_at: new Date() }),
        getQualifiedAttemptsForLeaderboard: async () => [],
        upsertLeaderboardEntry: async () => ({ id: 0, challenge_id: 0, user_id: '', sub_institute_id: '', syear: '', week_start: new Date(), week_number: 0, year_number: 0, score: 0, rank: null, is_qualified: true, display_name: '', created_at: new Date(), updated_at: new Date() }),
        getLeaderboard: async () => [],
        getStudentOptInStatuses: async () => new Map(),
        getStudentDisplayNames: async () => new Map(),
        getStudentChallengeHistory: async () => [],
        close: async () => {},
    };
}

export function createPalCmStore(config?: PalCmStoreConfig): PalCmStore {
    const resolvedConfig = config ?? getDbConfig();
    let pool: mysql.Pool | null = null;

    function getPool(): mysql.Pool {
        if (!pool) {
            pool = mysql.createPool({
                host: resolvedConfig!.host,
                port: resolvedConfig!.port,
                user: resolvedConfig!.user,
                password: resolvedConfig!.password,
                database: resolvedConfig!.database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                multipleStatements: false,
            });
        }
        return pool;
    }

    async function withConnection<T>(callback: (conn: mysql.Connection) => Promise<T>): Promise<T> {
        const conn = await getPool().getConnection();
        try {
            return await callback(conn);
        } finally {
            conn.release();
        }
    }

    function mapChallengeRow(row: Record<string, unknown>): ChallengeRow {
        return {
            id: Number(row.id),
            title: String(row.title),
            description: row.description != null ? String(row.description) : null,
            subject_id: row.subject_id != null ? String(row.subject_id) : null,
            concept_id: row.concept_id != null ? String(row.concept_id) : null,
            difficulty: String(row.difficulty) as ChallengeRow['difficulty'],
            target_time_seconds: Number(row.target_time_seconds),
            item_count: Number(row.item_count),
            is_active: Boolean(row.is_active),
            start_date: row.start_date != null ? new Date(row.start_date as string) : null,
            end_date: row.end_date != null ? new Date(row.end_date as string) : null,
            created_by: Number(row.created_by),
            sub_institute_id: String(row.sub_institute_id),
            syear: String(row.syear),
            created_at: new Date(row.created_at as string),
            updated_at: new Date(row.updated_at as string),
        };
    }

    function mapOptInRow(row: Record<string, unknown>): ChallengeOptInRow {
        return {
            id: Number(row.id),
            user_id: String(row.user_id),
            sub_institute_id: String(row.sub_institute_id),
            syear: String(row.syear),
            is_opted_in: Boolean(row.is_opted_in),
            opted_in_at: new Date(row.opted_in_at as string),
            opted_out_at: row.opted_out_at != null ? new Date(row.opted_out_at as string) : null,
            created_at: new Date(row.created_at as string),
            updated_at: new Date(row.updated_at as string),
        };
    }

    function mapAttemptRow(row: Record<string, unknown>): ChallengeAttemptRow {
        return {
            id: Number(row.id),
            challenge_id: Number(row.challenge_id),
            user_id: String(row.user_id),
            sub_institute_id: String(row.sub_institute_id),
            syear: String(row.syear),
            opt_in_id: row.opt_in_id != null ? Number(row.opt_in_id) : null,
            started_at: new Date(row.started_at as string),
            completed_at: row.completed_at != null ? new Date(row.completed_at as string) : null,
            total_items: Number(row.total_items),
            valid_responses: Number(row.valid_responses),
            correct_responses: Number(row.correct_responses),
            accuracy: Number(row.accuracy),
            avg_time_per_item: Number(row.avg_time_per_item),
            speed_ratio: Number(row.speed_ratio),
            difficulty_coefficient: Number(row.difficulty_coefficient),
            raw_score: Number(row.raw_score),
            is_qualified: Boolean(row.is_qualified),
            attempt_status: String(row.attempt_status) as ChallengeAttemptRow['attempt_status'],
            created_at: new Date(row.created_at as string),
            updated_at: new Date(row.updated_at as string),
        };
    }

    function mapResponseRow(row: Record<string, unknown>): ChallengeResponseRow {
        return {
            id: Number(row.id),
            attempt_id: Number(row.attempt_id),
            challenge_id: Number(row.challenge_id),
            user_id: String(row.user_id),
            sub_institute_id: String(row.sub_institute_id),
            syear: String(row.syear),
            question_id: row.question_id != null ? String(row.question_id) : null,
            is_correct: Boolean(row.is_correct),
            response_time: Number(row.response_time),
            difficulty: Number(row.difficulty),
            target_time: Number(row.target_time),
            response_metadata: row.response_metadata != null ? String(row.response_metadata) : null,
            created_at: new Date(row.created_at as string),
        };
    }

    function mapLeaderboardRow(row: Record<string, unknown>): ChallengeLeaderboardRow {
        return {
            id: Number(row.id),
            challenge_id: Number(row.challenge_id),
            user_id: String(row.user_id),
            sub_institute_id: String(row.sub_institute_id),
            syear: String(row.syear),
            week_start: new Date(row.week_start as string),
            week_number: Number(row.week_number),
            year_number: Number(row.year_number),
            score: Number(row.score),
            rank: row.rank != null ? Number(row.rank) : null,
            is_qualified: Boolean(row.is_qualified),
            display_name: String(row.display_name),
            created_at: new Date(row.created_at as string),
            updated_at: new Date(row.updated_at as string),
        };
    }

    return {
        async fetchAvailableChallenges(ctx: ChallengeContext): Promise<ChallengeRow[]> {
            return withConnection(async (conn) => {
                const now = dateToSql(new Date());
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenges
                     WHERE sub_institute_id = ? AND syear = ? AND is_active = 1
                       AND (start_date IS NULL OR start_date <= ?)
                       AND (end_date IS NULL OR end_date >= ?)
                     ORDER BY created_at DESC`,
                    [ctx.sub_institute_id, ctx.syear, now, now]
                );
                return (rows as Record<string, unknown>[]).map(mapChallengeRow);
            });
        },

        async fetchChallengeById(id: number, ctx: ChallengeContext): Promise<ChallengeRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenges
                     WHERE id = ? AND sub_institute_id = ? AND syear = ?`,
                    [id, ctx.sub_institute_id, ctx.syear]
                );
                const result = (rows as Record<string, unknown>[]);
                return result.length > 0 ? mapChallengeRow(result[0]) : null;
            });
        },

        async getOptInStatus(userId: string, ctx: ChallengeContext): Promise<ChallengeOptInRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_opt_ins
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ?`,
                    [userId, ctx.sub_institute_id, ctx.syear]
                );
                const result = (rows as Record<string, unknown>[]);
                return result.length > 0 ? mapOptInRow(result[0]) : null;
            });
        },

        async setOptIn(userId: string, isOptedIn: boolean, ctx: ChallengeContext): Promise<ChallengeOptInRow> {
            return withConnection(async (conn) => {
                const nowSql = dateToSql(new Date());
                const [existing] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_opt_ins
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ?`,
                    [userId, ctx.sub_institute_id, ctx.syear]
                );
                const existingRows = existing as Record<string, unknown>[];

                if (existingRows.length > 0) {
                    const current = mapOptInRow(existingRows[0]);
                    if (current.is_opted_in === isOptedIn) {
                        return current;
                    }
                    const optedOutAt = isOptedIn ? null : nowSql;
                    const [updateResult] = await conn.execute(
                        `UPDATE Gamification_challenge_opt_ins
                         SET is_opted_in = ?, opted_out_at = ?, updated_at = ?
                         WHERE id = ?`,
                        [isOptedIn ? 1 : 0, optedOutAt, nowSql, current.id]
                    );
                    if ((updateResult as { affectedRows: number }).affectedRows > 0) {
                        const [updated] = await conn.execute(
                            `SELECT * FROM Gamification_challenge_opt_ins WHERE id = ?`,
                            [current.id]
                        );
                        return mapOptInRow((updated as Record<string, unknown>[])[0]);
                    }
                }

                const [insertResult] = await conn.execute(
                    `INSERT INTO Gamification_challenge_opt_ins
                     (user_id, sub_institute_id, syear, is_opted_in, opted_in_at, opted_out_at, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, ctx.sub_institute_id, ctx.syear, isOptedIn ? 1 : 0, nowSql, isOptedIn ? null : nowSql, nowSql, nowSql]
                );
                const insertId = Number((insertResult as { insertId: number }).insertId);
                const [inserted] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_opt_ins WHERE id = ?`,
                    [insertId]
                );
                return mapOptInRow((inserted as Record<string, unknown>[])[0]);
            });
        },

        async createAttempt(challengeId: number, userId: string, ctx: ChallengeContext, totalItems: number): Promise<ChallengeAttemptRow> {
            return withConnection(async (conn) => {
                const nowSql = dateToSql(new Date());
                const [optInRows] = await conn.execute(
                    `SELECT id FROM Gamification_challenge_opt_ins
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND is_opted_in = 1`,
                    [userId, ctx.sub_institute_id, ctx.syear]
                );
                const optInResult = optInRows as Record<string, unknown>[];
                const optInId = optInResult.length > 0 ? Number(optInResult[0].id) : null;

                const [existing] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts
                     WHERE challenge_id = ? AND user_id = ? AND attempt_status = 'in_progress'
                       AND sub_institute_id = ? AND syear = ?`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear]
                );
                const existingAttempts = existing as Record<string, unknown>[];
                if (existingAttempts.length > 0) {
                    return mapAttemptRow(existingAttempts[0]);
                }

                const [insertResult] = await conn.execute(
                    `INSERT INTO Gamification_challenge_attempts
                     (challenge_id, user_id, sub_institute_id, syear, opt_in_id, started_at, total_items)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear, optInId, nowSql, totalItems]
                );
                const insertId = Number((insertResult as { insertId: number }).insertId);
                const [inserted] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts WHERE id = ?`,
                    [insertId]
                );
                return mapAttemptRow((inserted as Record<string, unknown>[])[0]);
            });
        },

        async getInProgressAttempt(challengeId: number, userId: string, ctx: ChallengeContext): Promise<ChallengeAttemptRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts
                     WHERE challenge_id = ? AND user_id = ? AND attempt_status = 'in_progress'
                       AND sub_institute_id = ? AND syear = ?
                     ORDER BY started_at DESC LIMIT 1`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear]
                );
                const result = (rows as Record<string, unknown>[]);
                return result.length > 0 ? mapAttemptRow(result[0]) : null;
            });
        },

        async getAttemptById(attemptId: number, ctx: ChallengeContext): Promise<ChallengeAttemptRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts
                     WHERE id = ? AND sub_institute_id = ? AND syear = ?`,
                    [attemptId, ctx.sub_institute_id, ctx.syear]
                );
                const result = (rows as Record<string, unknown>[]);
                return result.length > 0 ? mapAttemptRow(result[0]) : null;
            });
        },

        async submitResponse(attemptId: number, input: { question_id: string | null; is_correct: boolean; response_time: number; difficulty: number; target_time: number }, ctx: ChallengeContext): Promise<ChallengeResponseRow> {
            return withConnection(async (conn) => {
                const nowSql = dateToSql(new Date());

                const challengeIdRow = (await conn.execute(
                    `SELECT challenge_id FROM Gamification_challenge_attempts WHERE id = ?`,
                    [attemptId]
                ))[0] as { challenge_id: number }[];
                const challengeId = challengeIdRow[0]?.challenge_id ?? 0;

                const [insertResult] = await conn.execute(
                    `INSERT INTO Gamification_challenge_responses
                     (attempt_id, challenge_id, user_id, sub_institute_id, syear,
                      question_id, is_correct, response_time, difficulty, target_time, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        attemptId,
                        challengeId,
                        ctx.user_id,
                        ctx.sub_institute_id,
                        ctx.syear,
                        input.question_id,
                        input.is_correct ? 1 : 0,
                        input.response_time,
                        input.difficulty,
                        input.target_time,
                        nowSql,
                    ]
                );
                const insertId = Number((insertResult as { insertId: number }).insertId);
                const [inserted] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_responses WHERE id = ?`,
                    [insertId]
                );
                const row = mapResponseRow((inserted as Record<string, unknown>[])[0]);
                row.challenge_id = challengeId;
                return row;
            });
        },

        async getResponsesForAttempt(attemptId: number): Promise<ChallengeResponseRow[]> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_responses
                     WHERE attempt_id = ?
                     ORDER BY created_at ASC`,
                    [attemptId]
                );
                return (rows as Record<string, unknown>[]).map(mapResponseRow);
            });
        },

        async completeAttempt(attemptId: number, scoring: ScoringResult, ctx: ChallengeContext): Promise<ChallengeAttemptRow> {
            return withConnection(async (conn) => {
                const [attemptRows] = await conn.execute(
                    `SELECT sub_institute_id, syear FROM Gamification_challenge_attempts WHERE id = ?`,
                    [attemptId]
                );
                const attemptCtx = (attemptRows as Record<string, unknown>[])[0];
                if (!attemptCtx || attemptCtx.sub_institute_id !== ctx.sub_institute_id || attemptCtx.syear !== ctx.syear) {
                    throw new Error(`Attempt ${attemptId} not found in the current institute/year.`);
                }

                const nowSql = dateToSql(new Date());
                const [result] = await conn.execute(
                    `UPDATE Gamification_challenge_attempts
                     SET completed_at = ?,
                         valid_responses = ?,
                         correct_responses = ?,
                         accuracy = ?,
                         avg_time_per_item = ?,
                         speed_ratio = ?,
                         difficulty_coefficient = ?,
                         raw_score = ?,
                         is_qualified = ?,
                         attempt_status = 'completed'
                     WHERE id = ?`,
                    [
                        nowSql,
                        scoring.valid_responses,
                        scoring.correct_responses,
                        scoring.accuracy,
                        scoring.avg_time_per_item,
                        scoring.speed_ratio,
                        scoring.difficulty_coefficient,
                        scoring.raw_score,
                        scoring.is_qualified ? 1 : 0,
                        attemptId,
                    ]
                );
                if ((result as { affectedRows: number }).affectedRows === 0) {
                    throw new Error(`Attempt ${attemptId} not found.`);
                }
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts WHERE id = ?`,
                    [attemptId]
                );
                return mapAttemptRow((rows as Record<string, unknown>[])[0]);
            });
        },

        async getQualifiedAttemptsForLeaderboard(challengeId: number, ctx: ChallengeContext, weekStart: Date): Promise<{ attempt: ChallengeAttemptRow; display_name: string }[]> {
            return withConnection(async (conn) => {
                const weekStartSql = dateToSql(weekStart);
                const [rows] = await conn.execute(
                    `SELECT a.*, COALESCE(u.first_name, SUBSTRING_INDEX(u.name, ' ', 1), 'Student') AS display_name
                     FROM Gamification_challenge_attempts a
                     LEFT JOIN users u ON u.id = a.user_id AND u.sub_institute_id = a.sub_institute_id
                     WHERE a.challenge_id = ?
                       AND a.sub_institute_id = ?
                       AND a.syear = ?
                       AND a.is_qualified = 1
                       AND a.attempt_status = 'completed'
                       AND DATE(a.completed_at) >= ?
                       AND DATE(a.completed_at) < DATE_ADD(?, INTERVAL 7 DAY)
                     ORDER BY a.raw_score DESC`,
                    [challengeId, ctx.sub_institute_id, ctx.syear, weekStartSql, weekStartSql]
                );
                return (rows as Record<string, unknown>[]).map((row) => ({
                    attempt: mapAttemptRow(row),
                    display_name: String(row.display_name || 'Student'),
                }));
            });
        },

        async upsertLeaderboardEntry(challengeId: number, userId: string, weekStart: Date, weekNumber: number, yearNumber: number, score: number, isQualified: boolean, displayName: string, ctx: ChallengeContext): Promise<ChallengeLeaderboardRow> {
            return withConnection(async (conn) => {
                const weekStartSql = dateToSql(weekStart);
                const [existing] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_leaderboards
                     WHERE challenge_id = ? AND week_start = ? AND user_id = ?`,
                    [challengeId, weekStartSql, userId]
                );
                const existingRows = existing as Record<string, unknown>[];

                if (existingRows.length > 0) {
                    const [updateResult] = await conn.execute(
                        `UPDATE Gamification_challenge_leaderboards
                         SET score = ?, is_qualified = ?, display_name = ?, updated_at = ?
                         WHERE id = ?`,
                        [score, isQualified ? 1 : 0, displayName, dateToSql(new Date()), Number(existingRows[0].id)]
                    );
                    if ((updateResult as { affectedRows: number }).affectedRows > 0) {
                        const [updated] = await conn.execute(
                            `SELECT * FROM Gamification_challenge_leaderboards WHERE id = ?`,
                            [Number(existingRows[0].id)]
                        );
                        return mapLeaderboardRow((updated as Record<string, unknown>[])[0]);
                    }
                }

                const [insertResult] = await conn.execute(
                    `INSERT INTO Gamification_challenge_leaderboards
                     (challenge_id, user_id, sub_institute_id, syear, week_start, week_number, year_number, score, is_qualified, display_name)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear, weekStartSql, weekNumber, yearNumber, score, isQualified ? 1 : 0, displayName]
                );
                const insertId = Number((insertResult as { insertId: number }).insertId);
                const [inserted] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_leaderboards WHERE id = ?`,
                    [insertId]
                );
                return mapLeaderboardRow((inserted as Record<string, unknown>[])[0]);
            });
        },

        async getLeaderboard(challengeId: number, weekStart: Date, limit = 5, ctx?: { sub_institute_id: string; syear: string }): Promise<ChallengeLeaderboardRow[]> {
            return withConnection(async (conn) => {
                const weekStartSql = dateToSql(weekStart);
                if (ctx) {
                    const [rows] = await conn.execute(
                        `SELECT * FROM Gamification_challenge_leaderboards
                         WHERE challenge_id = ? AND week_start = ? AND is_qualified = 1
                           AND sub_institute_id = ? AND syear = ?
                         ORDER BY rank ASC, score DESC
                         LIMIT ?`,
                        [challengeId, weekStartSql, ctx.sub_institute_id, ctx.syear, limit]
                    );
                    return (rows as Record<string, unknown>[]).map(mapLeaderboardRow);
                }
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_leaderboards
                     WHERE challenge_id = ? AND week_start = ? AND is_qualified = 1
                     ORDER BY rank ASC, score DESC
                     LIMIT ?`,
                    [challengeId, weekStartSql, limit]
                );
                return (rows as Record<string, unknown>[]).map(mapLeaderboardRow);
            });
        },

        async getStudentOptInStatuses(userIds: string[], ctx: ChallengeContext): Promise<Map<string, boolean>> {
            if (userIds.length === 0) return new Map();
            return withConnection(async (conn) => {
                const placeholders = userIds.map(() => '?').join(',');
                const [rows] = await conn.execute(
                    `SELECT user_id, is_opted_in FROM Gamification_challenge_opt_ins
                     WHERE user_id IN (${placeholders})
                       AND sub_institute_id = ? AND syear = ?`,
                    [...userIds, ctx.sub_institute_id, ctx.syear]
                );
                const result = new Map<string, boolean>();
                for (const row of (rows as Record<string, unknown>[])) {
                    result.set(String(row.user_id), Boolean(row.is_opted_in));
                }
                return result;
            });
        },

        async getStudentDisplayNames(userIds: string[]): Promise<Map<string, string>> {
            if (userIds.length === 0) return new Map();
            return withConnection(async (conn) => {
                const numericIds = userIds.filter((id) => /^\d+$/.test(id)).map(Number);
                if (numericIds.length === 0) return new Map();
                const placeholders = numericIds.map(() => '?').join(',');
                const [rows] = await conn.execute(
                    `SELECT id, COALESCE(first_name, SUBSTRING_INDEX(name, ' ', 1)) AS display_name FROM users WHERE id IN (${placeholders})`,
                    numericIds
                );
                const result = new Map<string, string>();
                for (const row of (rows as Record<string, unknown>[])) {
                    result.set(String(row.id), String(row.display_name || 'Student'));
                }
                return result;
            });
        },

        async getStudentChallengeHistory(userId: string, ctx: ChallengeContext): Promise<ChallengeAttemptRow[]> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_challenge_attempts
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
                       AND attempt_status = 'completed'
                     ORDER BY completed_at DESC`,
                    [userId, ctx.sub_institute_id, ctx.syear]
                );
                return (rows as Record<string, unknown>[]).map(mapAttemptRow);
            });
        },

        async close(): Promise<void> {
            if (pool) {
                await pool.end();
                pool = null;
            }
        },
    };
}

export function createPalCmStoreFromEnv(): PalCmStore {
    return createPalCmStore();
}
