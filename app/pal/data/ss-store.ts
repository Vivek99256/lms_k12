import mysql from 'mysql2/promise';
import { getDbConfig } from './pal-pb-store-config';
import type {
    SessionSummaryRow,
    SessionSummaryConceptRow,
    SessionSummaryPraiseRow,
    SessionSummaryUpcomingRow,
    SessionSummaryStore,
} from './ss-types';

function mapRowToSummary(row: Record<string, unknown>): SessionSummaryRow {
    return {
        id: Number(row.id),
        sessionId: String(row.session_id),
        userId: String(row.user_id),
        subInstituteId: String(row.sub_institute_id),
        syear: String(row.syear),
        sessionStart: row.session_start != null ? String(row.session_start) : null,
        sessionEnd: row.session_end != null ? String(row.session_end) : null,
        completionState: String(row.completion_state),
        totalConcepts: Number(row.total_concepts),
        totalQuestions: Number(row.total_questions),
        obtainMarks: Number(row.obtain_marks),
        totalMarks: Number(row.total_marks),
        accuracy: Number(row.accuracy),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function mapRowToConcept(row: Record<string, unknown>): SessionSummaryConceptRow {
    return {
        id: Number(row.id),
        summaryId: Number(row.summary_id),
        conceptId: row.concept_id != null ? String(row.concept_id) : null,
        conceptName: String(row.concept_name),
        masteryBefore: Number(row.mastery_before),
        masteryAfter: Number(row.mastery_after),
        masteryChange: Number(row.mastery_change),
        accuracy: Number(row.accuracy),
        attempted: Number(row.attempted),
        correct: Number(row.correct),
        sortOrder: Number(row.sort_order),
        createdAt: String(row.created_at),
    };
}

function mapRowToPraise(row: Record<string, unknown>): SessionSummaryPraiseRow {
    return {
        id: Number(row.id),
        summaryId: Number(row.summary_id),
        praiseText: String(row.praise_text),
        reason: String(row.reason),
        sourceType: row.source_type != null ? String(row.source_type) : null,
        conceptName: row.concept_name != null ? String(row.concept_name) : null,
        sortOrder: Number(row.sort_order),
        createdAt: String(row.created_at),
    };
}

function mapRowToUpcoming(row: Record<string, unknown>): SessionSummaryUpcomingRow {
    return {
        id: Number(row.id),
        summaryId: Number(row.summary_id),
        conceptId: row.concept_id != null ? String(row.concept_id) : null,
        conceptName: String(row.concept_name),
        reason: row.reason != null ? String(row.reason) : null,
        expectedTiming: row.expected_timing != null ? String(row.expected_timing) : null,
        sortOrder: Number(row.sort_order),
        createdAt: String(row.created_at),
    };
}

const NOW = '2026-08-18 12:00:00';

const mockSummaryMap = new Map<string, SessionSummaryRow>();
const mockConceptMap = new Map<number, SessionSummaryConceptRow[]>();
const mockPraiseMap = new Map<number, SessionSummaryPraiseRow[]>();
const mockUpcomingMap = new Map<number, SessionSummaryUpcomingRow[]>();

export function resetMockPalSsStore(): void {
    mockSummaryMap.clear();
    mockConceptMap.clear();
    mockPraiseMap.clear();
    mockUpcomingMap.clear();
}

export function createMockSessionSummaryStore(): SessionSummaryStore {
    function summaryKey(userId: string, subInstituteId: string, syear: string, sessionId: string): string {
        return `${userId}::${subInstituteId}::${syear}::${sessionId}`;
    }

    return {
        async getSummary(userId, subInstituteId, syear, sessionId) {
            return mockSummaryMap.get(summaryKey(userId, subInstituteId, syear, sessionId)) ?? null;
        },

        async getConcepts(summaryId) {
            return mockConceptMap.get(summaryId) ?? [];
        },

        async getPraise(summaryId) {
            return mockPraiseMap.get(summaryId) ?? [];
        },

        async getUpcoming(summaryId) {
            return mockUpcomingMap.get(summaryId) ?? [];
        },

        async insertSummary(input) {
            const key = summaryKey(input.userId, input.subInstituteId, input.syear, input.sessionId);
            const existing = mockSummaryMap.get(key);
            const row: SessionSummaryRow = existing ?? {
                id: 0,
                sessionId: input.sessionId,
                userId: input.userId,
                subInstituteId: input.subInstituteId,
                syear: input.syear,
                sessionStart: input.sessionStart,
                sessionEnd: input.sessionEnd,
                completionState: input.completionState,
                totalConcepts: input.totalConcepts,
                totalQuestions: input.totalQuestions,
                obtainMarks: input.obtainMarks,
                totalMarks: input.totalMarks,
                accuracy: input.accuracy,
                createdAt: NOW,
                updatedAt: NOW,
            };
            if (!existing) {
                row.id = mockSummaryMap.size + 1;
                mockSummaryMap.set(key, row);
            }
            return row;
        },

        async insertConcept(summaryId, concept) {
            const list = mockConceptMap.get(summaryId) ?? [];
            const row: SessionSummaryConceptRow = {
                id: list.length + 1,
                summaryId,
                conceptId: concept.conceptId,
                conceptName: concept.conceptName,
                masteryBefore: concept.masteryBefore,
                masteryAfter: concept.masteryAfter,
                masteryChange: concept.masteryChange,
                accuracy: concept.accuracy,
                attempted: concept.attempted,
                correct: concept.correct,
                sortOrder: concept.sortOrder,
                createdAt: NOW,
            };
            list.push(row);
            mockConceptMap.set(summaryId, list);
            return row;
        },

        async insertPraise(summaryId, praise) {
            const list = mockPraiseMap.get(summaryId) ?? [];
            const row: SessionSummaryPraiseRow = {
                id: list.length + 1,
                summaryId,
                praiseText: praise.praiseText,
                reason: praise.reason,
                sourceType: praise.sourceType,
                conceptName: praise.conceptName,
                sortOrder: praise.sortOrder,
                createdAt: NOW,
            };
            list.push(row);
            mockPraiseMap.set(summaryId, list);
            return row;
        },

        async insertUpcoming(summaryId, upcoming) {
            const list = mockUpcomingMap.get(summaryId) ?? [];
            const row: SessionSummaryUpcomingRow = {
                id: list.length + 1,
                summaryId,
                conceptId: upcoming.conceptId,
                conceptName: upcoming.conceptName,
                reason: upcoming.reason,
                expectedTiming: upcoming.expectedTiming,
                sortOrder: upcoming.sortOrder,
                createdAt: NOW,
            };
            list.push(row);
            mockUpcomingMap.set(summaryId, list);
            return row;
        },

        async close() {
            // no-op for mock store
        },
    };
}

export function createPalSsStore(config?: { host: string; port: number; user: string; password: string; database: string }): SessionSummaryStore {
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

    return {
        async getSummary(userId, subInstituteId, syear, sessionId) {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summaries
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND session_id = ?
                     LIMIT 1`,
                    [userId, subInstituteId, syear, sessionId]
                );
                const row = (rows as Array<Record<string, unknown>>)[0];
                return row ? mapRowToSummary(row) : null;
            });
        },

        async getConcepts(summaryId) {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_concepts
                     WHERE summary_id = ?
                     ORDER BY sort_order ASC, id ASC`,
                    [summaryId]
                );
                return (rows as Array<Record<string, unknown>>).map(mapRowToConcept);
            });
        },

        async getPraise(summaryId) {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_praise
                     WHERE summary_id = ?
                     ORDER BY sort_order ASC, id ASC`,
                    [summaryId]
                );
                return (rows as Array<Record<string, unknown>>).map(mapRowToPraise);
            });
        },

        async getUpcoming(summaryId) {
            return withConnection(async (conn) => {
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_upcoming
                     WHERE summary_id = ?
                     ORDER BY sort_order ASC, id ASC`,
                    [summaryId]
                );
                return (rows as Array<Record<string, unknown>>).map(mapRowToUpcoming);
            });
        },

        async insertSummary(input) {
            return withConnection(async (conn) => {
                await conn.execute(
                    `INSERT INTO Gamification_session_summaries
                     (session_id, user_id, sub_institute_id, syear, session_start, session_end,
                      completion_state, total_concepts, total_questions, obtain_marks, total_marks, accuracy)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     session_start = VALUES(session_start),
                     session_end = VALUES(session_end),
                     completion_state = VALUES(completion_state),
                     total_concepts = VALUES(total_concepts),
                     total_questions = VALUES(total_questions),
                     obtain_marks = VALUES(obtain_marks),
                     total_marks = VALUES(total_marks),
                     accuracy = VALUES(accuracy),
                     updated_at = CURRENT_TIMESTAMP`,
                    [
                        input.sessionId,
                        input.userId,
                        input.subInstituteId,
                        input.syear,
                        input.sessionStart,
                        input.sessionEnd,
                        input.completionState,
                        input.totalConcepts,
                        input.totalQuestions,
                        input.obtainMarks,
                        input.totalMarks,
                        input.accuracy,
                    ]
                );
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summaries
                     WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND session_id = ?
                     LIMIT 1`,
                    [input.userId, input.subInstituteId, input.syear, input.sessionId]
                );
                return mapRowToSummary((rows as Array<Record<string, unknown>>)[0]);
            });
        },

        async insertConcept(summaryId, concept) {
            return withConnection(async (conn) => {
                const [result] = await conn.execute(
                    `INSERT INTO Gamification_session_summary_concepts
                     (summary_id, concept_id, concept_name, mastery_before, mastery_after,
                      mastery_change, accuracy, attempted, correct, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        summaryId,
                        concept.conceptId,
                        concept.conceptName,
                        concept.masteryBefore,
                        concept.masteryAfter,
                        concept.masteryChange,
                        concept.accuracy,
                        concept.attempted,
                        concept.correct,
                        concept.sortOrder,
                    ]
                );
                const insertId = Number((result as { insertId: number }).insertId);
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_concepts WHERE id = ? LIMIT 1`,
                    [insertId]
                );
                return mapRowToConcept((rows as Array<Record<string, unknown>>)[0]);
            });
        },

        async insertPraise(summaryId, praise) {
            return withConnection(async (conn) => {
                const [result] = await conn.execute(
                    `INSERT INTO Gamification_session_summary_praise
                     (summary_id, praise_text, reason, source_type, concept_name, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        summaryId,
                        praise.praiseText,
                        praise.reason,
                        praise.sourceType,
                        praise.conceptName,
                        praise.sortOrder,
                    ]
                );
                const insertId = Number((result as { insertId: number }).insertId);
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_praise WHERE id = ? LIMIT 1`,
                    [insertId]
                );
                return mapRowToPraise((rows as Array<Record<string, unknown>>)[0]);
            });
        },

        async insertUpcoming(summaryId, upcoming) {
            return withConnection(async (conn) => {
                const [result] = await conn.execute(
                    `INSERT INTO Gamification_session_summary_upcoming
                     (summary_id, concept_id, concept_name, reason, expected_timing, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        summaryId,
                        upcoming.conceptId,
                        upcoming.conceptName,
                        upcoming.reason,
                        upcoming.expectedTiming,
                        upcoming.sortOrder,
                    ]
                );
                const insertId = Number((result as { insertId: number }).insertId);
                const [rows] = await conn.execute(
                    `SELECT * FROM Gamification_session_summary_upcoming WHERE id = ? LIMIT 1`,
                    [insertId]
                );
                return mapRowToUpcoming((rows as Array<Record<string, unknown>>)[0]);
            });
        },

        async close() {
            if (pool) {
                await pool.end();
                pool = null;
            }
        },
    };
}
