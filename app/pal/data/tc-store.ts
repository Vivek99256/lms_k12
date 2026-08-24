import mysql from 'mysql2/promise';
import { getDbConfig } from './pal-pb-store-config';
import type {
    TeamChallengeRow,
    TeamChallengeParticipantRow,
    TeamChallengeContributionRow,
    TeamChallengeProgressRow,
    TeamChallengeCreateData,
    TeamChallengeUpdateData,
    ContributionInput,
    ChallengeContext,
} from './tc-types';

export interface PalTcStoreConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface PalTcStore {
    fetchChallenges: (ctx: ChallengeContext) => Promise<TeamChallengeRow[]>;
    fetchChallengeById: (id: number, ctx: ChallengeContext) => Promise<TeamChallengeRow | null>;
    createChallenge: (data: TeamChallengeCreateData, ctx: ChallengeContext) => Promise<number>;
    updateChallenge: (id: number, data: TeamChallengeUpdateData, ctx: ChallengeContext) => Promise<boolean>;
    fetchParticipants: (challengeId: number, ctx: ChallengeContext) => Promise<TeamChallengeParticipantRow[]>;
    addParticipant: (challengeId: number, userId: number, ctx: ChallengeContext) => Promise<boolean>;
    removeParticipant: (challengeId: number, userId: number, ctx: ChallengeContext) => Promise<boolean>;
    fetchProgress: (challengeId: number, ctx: ChallengeContext) => Promise<TeamChallengeProgressRow | null>;
    recordContribution: (input: ContributionInput, ctx: ChallengeContext) => Promise<TeamChallengeContributionRow | null>;
    fetchContributions: (challengeId: number, ctx: ChallengeContext) => Promise<TeamChallengeContributionRow[]>;
    recomputeProgress: (challengeId: number, ctx: ChallengeContext) => Promise<TeamChallengeProgressRow>;
    close: () => Promise<void>;
}

export function createMockPalTcStore(): PalTcStore {
    return {
        fetchChallenges: async () => [],
        fetchChallengeById: async () => null,
        createChallenge: async () => 1,
        updateChallenge: async () => true,
        fetchParticipants: async () => [],
        addParticipant: async () => true,
        removeParticipant: async () => true,
        fetchProgress: async () => null,
        recordContribution: async () => null,
        fetchContributions: async () => [],
        recomputeProgress: async () => ({
            id: 1,
            team_challenge_id: 1,
            total_participants: 0,
            active_contributors: 0,
            aggregate_value: 0,
            target_value: 0,
            progress_percentage: 0,
            status: 'in_progress' as const,
            last_updated: new Date(),
            updated_at: new Date(),
        }),
        close: async () => {},
    };
}

export function createPalTcStore(config?: PalTcStoreConfig): PalTcStore {
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

    async function withConnection<T>(
        callback: (conn: mysql.Connection) => Promise<T>
    ): Promise<T> {
        const conn = await getPool().getConnection();
        try {
            return await callback(conn);
        } finally {
            conn.release();
        }
    }

    return {
        async fetchChallenges(ctx: ChallengeContext): Promise<TeamChallengeRow[]> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_team_challenges
                     WHERE sub_institute_id = ? AND syear = ?
                     ORDER BY created_at DESC`,
                    [ctx.sub_institute_id, ctx.syear]
                );
                return rows as TeamChallengeRow[];
            });
        },

        async fetchChallengeById(
            id: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_team_challenges
                     WHERE id = ? AND sub_institute_id = ? AND syear = ?`,
                    [id, ctx.sub_institute_id, ctx.syear]
                );
                return (rows as TeamChallengeRow[])[0] || null;
            });
        },

        async createChallenge(
            data: TeamChallengeCreateData,
            ctx: ChallengeContext
        ): Promise<number> {
            return withConnection(async (conn) => {
                const dateToSql = (d: string | Date | null | undefined): string | null => {
                    if (!d) return null;
                    return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
                };

                const [result] = await conn.execute(
                    `INSERT INTO Gamification_team_challenges
                     (title, description, challenge_type, target_type, target_value,
                      reward_type, reward_value, status, created_by, sub_institute_id, syear,
                      grade_id, standard_id, division_id, start_date, deadline)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        data.title,
                        data.description ?? null,
                        data.challenge_type,
                        data.target_type,
                        data.target_value,
                        data.reward_type ?? null,
                        data.reward_value ?? null,
                        ctx.user_id,
                        ctx.sub_institute_id,
                        ctx.syear,
                        data.grade_id ?? null,
                        data.standard_id ?? null,
                        data.division_id ?? null,
                        dateToSql(data.start_date),
                        dateToSql(data.deadline),
                    ]
                );
                return Number((result as { insertId: number }).insertId);
            });
        },

        async updateChallenge(
            id: number,
            data: TeamChallengeUpdateData,
            ctx: ChallengeContext
        ): Promise<boolean> {
            const updates: string[] = [];
            const values: unknown[] = [];

            const dateToSql = (d: string | Date | null | undefined): string | null => {
                if (!d) return null;
                return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
            };

            if (data.title !== undefined) {
                updates.push(`title = ?`);
                values.push(data.title);
            }
            if (data.description !== undefined) {
                updates.push(`description = ?`);
                values.push(data.description ?? null);
            }
            if (data.challenge_type !== undefined) {
                updates.push(`challenge_type = ?`);
                values.push(data.challenge_type);
            }
            if (data.target_type !== undefined) {
                updates.push(`target_type = ?`);
                values.push(data.target_type);
            }
            if (data.target_value !== undefined) {
                updates.push(`target_value = ?`);
                values.push(data.target_value);
            }
            if (data.reward_type !== undefined) {
                updates.push(`reward_type = ?`);
                values.push(data.reward_type ?? null);
            }
            if (data.reward_value !== undefined) {
                updates.push(`reward_value = ?`);
                values.push(data.reward_value ?? null);
            }
            if (data.status !== undefined) {
                updates.push(`status = ?`);
                values.push(data.status);
            }
            if (data.start_date !== undefined) {
                updates.push(`start_date = ?`);
                values.push(dateToSql(data.start_date));
            }
            if (data.deadline !== undefined) {
                updates.push(`deadline = ?`);
                values.push(dateToSql(data.deadline));
            }
            if (data.ended_at !== undefined) {
                updates.push(`ended_at = ?`);
                values.push(dateToSql(data.ended_at));
            }

            if (updates.length === 0) return false;

            return withConnection(async (conn) => {
                const sql = `UPDATE Gamification_team_challenges
                             SET ${updates.join(', ')}
                             WHERE id = ? AND sub_institute_id = ? AND syear = ?`;
                const [result] = await conn.query(sql, [...values, id, ctx.sub_institute_id, ctx.syear]);
                return (result as { affectedRows: number }).affectedRows > 0;
            });
        },

        async fetchParticipants(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeParticipantRow[]> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT p.* FROM Gamification_team_challenge_participants p
                     JOIN Gamification_team_challenges c ON p.team_challenge_id = c.id
                     WHERE p.team_challenge_id = ?
                       AND p.sub_institute_id = ? AND p.syear = ?
                       AND p.status = 'active'
                     ORDER BY p.joined_at ASC`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                return rows as TeamChallengeParticipantRow[];
            });
        },

        async addParticipant(
            challengeId: number,
            userId: number,
            ctx: ChallengeContext
        ): Promise<boolean> {
            return withConnection(async (conn) => {
                await conn.execute(
                    `INSERT IGNORE INTO Gamification_team_challenge_participants
                     (team_challenge_id, user_id, sub_institute_id, syear)
                     VALUES (?, ?, ?, ?)`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear]
                );
                return true;
            });
        },

        async removeParticipant(
            challengeId: number,
            userId: number,
            ctx: ChallengeContext
        ): Promise<boolean> {
            return withConnection(async (conn) => {
                const [result] = await conn.execute(
                    `UPDATE Gamification_team_challenge_participants
                     SET status = 'removed'
                     WHERE team_challenge_id = ? AND user_id = ?
                       AND sub_institute_id = ? AND syear = ?`,
                    [challengeId, userId, ctx.sub_institute_id, ctx.syear]
                );
                return (result as { affectedRows: number }).affectedRows > 0;
            });
        },

        async fetchProgress(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeProgressRow | null> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT p.* FROM Gamification_team_challenge_progress p
                     JOIN Gamification_team_challenges c ON p.team_challenge_id = c.id
                     WHERE p.team_challenge_id = ?
                       AND c.sub_institute_id = ? AND c.syear = ?`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                return (rows as TeamChallengeProgressRow[])[0] || null;
            });
        },

        async recordContribution(
            input: ContributionInput,
            ctx: ChallengeContext
        ): Promise<TeamChallengeContributionRow | null> {
            return withConnection(async (conn) => {
                let result: TeamChallengeContributionRow | null = null;
                try {
                    const [insertResult] = await conn.execute(
                        `INSERT INTO Gamification_team_challenge_contributions
                         (team_challenge_id, user_id, sub_institute_id, syear,
                          event_type, source_id, value, idempotency_key, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'counted')`,
                        [
                            input.team_challenge_id,
                            input.user_id,
                            ctx.sub_institute_id,
                            ctx.syear,
                            input.event_type,
                            input.source_id ?? null,
                            input.value ?? 1,
                            input.idempotency_key,
                        ]
                    );

                    const [rows] = await conn.execute(
                        `SELECT * FROM Gamification_team_challenge_contributions WHERE id = ?`,
                        [(insertResult as { insertId: number }).insertId]
                    );
                    result = (rows as TeamChallengeContributionRow[])[0] || null;
                } catch (err: unknown) {
                    const mysqlErr = err as { code?: string };
                    if (mysqlErr.code === 'ER_DUP_ENTRY') {
                        const [rows] = await conn.execute(
                            `SELECT * FROM Gamification_team_challenge_contributions
                             WHERE idempotency_key = ?`,
                            [input.idempotency_key]
                        );
                        result = (rows as TeamChallengeContributionRow[])[0] || null;
                    } else {
                        throw err;
                    }
                }
                return result;
            });
        },

        async fetchContributions(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeContributionRow[]> {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_team_challenge_contributions
                     WHERE team_challenge_id = ? AND status = 'counted'
                       AND sub_institute_id = ? AND syear = ?
                     ORDER BY created_at DESC`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                return rows as TeamChallengeContributionRow[];
            });
        },

        async recomputeProgress(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeProgressRow> {
            return withConnection(async (conn) => {
                const [participantRows] = await conn.execute(
                    `SELECT COUNT(*) as count FROM Gamification_team_challenge_participants
                     WHERE team_challenge_id = ? AND status = 'active'
                       AND sub_institute_id = ? AND syear = ?`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                const totalParticipants = Number((participantRows as Array<{ count: number }>)[0]?.count ?? 0);

                const [contribResult] = await conn.execute(
                    `SELECT
                         COALESCE(SUM(value), 0) as total,
                         COUNT(DISTINCT user_id) as contributors
                     FROM Gamification_team_challenge_contributions
                     WHERE team_challenge_id = ? AND status = 'counted'
                       AND sub_institute_id = ? AND syear = ?`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                const contribRow = (contribResult as Array<{ total: number | null; contributors: number | null }>)[0];
                const aggregateValue = Number(contribRow?.total ?? 0);
                const activeContributors = Number(contribRow?.contributors ?? 0);

                const [challengeRows] = await conn.execute(
                    `SELECT target_value, status FROM Gamification_team_challenges
                     WHERE id = ? AND sub_institute_id = ? AND syear = ?`,
                    [challengeId, ctx.sub_institute_id, ctx.syear]
                );
                const challengeRowsTyped = challengeRows as TeamChallengeRow[];
                const challenge = challengeRowsTyped[0];

                if (!challenge) {
                    throw new Error(`Challenge ${challengeId} not found`);
                }

                const targetValue = Number(challenge.target_value);
                const progressPercentage =
                    targetValue > 0
                        ? Math.min((aggregateValue / targetValue) * 100, 100)
                        : 0;

                let progressStatus: 'in_progress' | 'completed' | 'ended';
                if (challenge.status === 'ended') {
                    progressStatus = 'ended';
                } else if (progressPercentage >= 100 || aggregateValue >= targetValue) {
                    progressStatus = 'completed';
                } else {
                    progressStatus = 'in_progress';
                }

                const [existing] = await conn.execute(
                    `SELECT * FROM Gamification_team_challenge_progress
                     WHERE team_challenge_id = ?`,
                    [challengeId]
                );

                if ((existing as TeamChallengeProgressRow[]).length > 0) {
                    await conn.execute(
                        `UPDATE Gamification_team_challenge_progress
                         SET total_participants = ?, active_contributors = ?,
                             aggregate_value = ?, target_value = ?,
                             progress_percentage = ?, status = ?,
                             last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                         WHERE team_challenge_id = ?`,
                        [
                            totalParticipants,
                            activeContributors,
                            aggregateValue,
                            targetValue,
                            progressPercentage,
                            progressStatus,
                            challengeId,
                        ]
                    );
                } else {
                    await conn.execute(
                        `INSERT INTO Gamification_team_challenge_progress
                         (team_challenge_id, total_participants, active_contributors,
                          aggregate_value, target_value, progress_percentage, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            challengeId,
                            totalParticipants,
                            activeContributors,
                            aggregateValue,
                            targetValue,
                            progressPercentage,
                            progressStatus,
                        ]
                    );
                }

                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_team_challenge_progress
                     WHERE team_challenge_id = ?`,
                    [challengeId]
                );
                return (rows as TeamChallengeProgressRow[])[0];
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

export function createPalTcStoreFromEnv(): PalTcStore {
    return createPalTcStore();
}
