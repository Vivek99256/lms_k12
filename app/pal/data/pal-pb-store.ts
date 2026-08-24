import type { DbConfig } from './pal-pb-store-config';
import {
  type PbFluencyEvent,
  type PbMasteryEvent,
  type PbNotificationEvent,
  type PbSessionEvent,
  type PbStreakEvent,
} from './pal-pb';

export type { DbConfig } from './pal-pb-store-config';

function toMySQLDateTime(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

export interface PalPbStore {
  getFluencyRecord(
    userId: string,
    subInstituteId: string,
    syear: string,
    conceptId: string
  ): Promise<{ previousBest: number; bestFluency: number } | null>;

  getStreakRecord(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null } | null>;

  getMasteryRecord(
    userId: string,
    subInstituteId: string,
    syear: string,
    concept: string
  ): Promise<{ masteryResult: number; fastestMastery?: number; masterySessionCount?: number } | null>;

  getSessionRecord(
    userId: string,
    subInstituteId: string,
    syear: string,
    recordType: string
  ): Promise<{ previousValue: number } | null>;

  getFluencyRecords(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<
    {
      conceptId: string;
      conceptName: string;
      bestFluency: number;
      previousBest: number;
      absoluteImprovement: number;
      improvementPercentage: number;
      achievedAt: string;
    }[]
  >;

  getStreakRecords(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<
    {
      currentStreak: number;
      longestStreak: number;
      longestStreakDate: string | null;
      lastActivityDate: string | null;
    }[]
  >;

  getMasteryRecords(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<
    {
      concept: string;
      conceptId: string | null;
      masteryResult: number;
      masteryDuration: number | null;
      masterySessionCount: number | null;
      fastestMastery: number | null;
      mountainSkyConcept: boolean;
      achievedAt: string;
    }[]
  >;

  getSessionRecords(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<
    {
      recordType: string;
      previousValue: number;
      newValue: number;
      sessionStart: string | null;
      sessionEnd: string | null;
      conceptsCovered: string[];
      achievedAt: string;
    }[]
  >;

  getProcessedEvent(
    userId: string,
    subInstituteId: string,
    syear: string,
    questionPaperId: string
  ): Promise<boolean>;

  upsertFluencyRecord(event: PbFluencyEvent & { idempotencyKey: string }): Promise<void>;

  upsertStreakRecord(event: PbStreakEvent): Promise<void>;

  upsertMasteryRecord(event: PbMasteryEvent): Promise<void>;

  insertSessionRecord(event: PbSessionEvent): Promise<void>;

  insertNotification(event: PbNotificationEvent): Promise<void>;

  markEventProcessed(
    userId: string,
    subInstituteId: string,
    syear: string,
    questionPaperId: string
  ): Promise<void>;

  getPersonalBestSummary(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<{
    fluencyCount: number;
    bestFluency: number;
    streakCurrent: number;
    streakLongest: number;
    masteryCount: number;
    bestMastery: number;
    sessionCount: number;
    bestSession: number;
  }>;

  getNotifications(
    userId: string,
    subInstituteId: string,
    syear: string,
    limit: number
  ): Promise<
    {
      id: number;
      notificationType: string;
      title: string;
      message: string;
      relatedConcept: string | null;
      previousValue: number;
      newValue: number;
      improvement: number;
      isRead: number;
      createdAt: string;
    }[]
  >;
}

export function createPalPbStore(config: DbConfig): PalPbStore {
  const poolPromise = createPool(config);

  return {
    async getFluencyRecord(userId, subInstituteId, syear, conceptId) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT best_fluency, previous_best FROM Gamification_fluency_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND concept_id = ?',
        [userId, subInstituteId, syear, conceptId]
      );
      const row = (rows as Array<{ best_fluency: number; previous_best: number }>)[0];
      return row ? { previousBest: Number(row.previous_best), bestFluency: Number(row.best_fluency) } : null;
    },

    async getStreakRecord(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT current_streak, longest_streak, last_activity_date FROM Gamification_streak_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ?',
        [userId, subInstituteId, syear]
      );
      const row = (rows as Array<{ current_streak: number; longest_streak: number; last_activity_date: string | Date | null }>)[0];
      return row
        ? { currentStreak: Number(row.current_streak), longestStreak: Number(row.longest_streak), lastActivityDate: row.last_activity_date instanceof Date ? row.last_activity_date.toISOString().slice(0, 10) : (row.last_activity_date ?? null) }
        : null;
    },

    async getMasteryRecord(userId, subInstituteId, syear, concept) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT mastery_result, fastest_mastery, mastery_session_count FROM Gamification_mastery_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND concept = ?',
        [userId, subInstituteId, syear, concept]
      );
      const row = (rows as Array<{ mastery_result: number; fastest_mastery: number | null; mastery_session_count: number | null }>)[0];
      return row
        ? {
            masteryResult: Number(row.mastery_result),
            fastestMastery: row.fastest_mastery ?? undefined,
            masterySessionCount: row.mastery_session_count ?? undefined,
          }
        : null;
    },

    async getSessionRecord(userId, subInstituteId, syear, recordType) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT new_value FROM Gamification_session_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND record_type = ? ORDER BY id DESC LIMIT 1',
        [userId, subInstituteId, syear, recordType]
      );
      const row = (rows as Array<{ new_value: number }>)[0];
      return row ? { previousValue: Number(row.new_value) } : null;
    },

    async getFluencyRecords(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT concept_id, concept_name, best_fluency, previous_best, absolute_improvement, improvement_percentage, achieved_at
         FROM Gamification_fluency_records
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
         ORDER BY achieved_at DESC`,
        [userId, subInstituteId, syear]
      );
      return (rows as Array<{
        concept_id: string;
        concept_name: string;
        best_fluency: number;
        previous_best: number;
        absolute_improvement: number;
        improvement_percentage: number;
        achieved_at: string;
      }>).map((row) => ({
        conceptId: row.concept_id,
        conceptName: row.concept_name,
        bestFluency: Number(row.best_fluency),
        previousBest: Number(row.previous_best),
        absoluteImprovement: Number(row.absolute_improvement),
        improvementPercentage: Number(row.improvement_percentage),
        achievedAt: row.achieved_at,
      }));
    },

    async getStreakRecords(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT current_streak, longest_streak, longest_streak_date, last_activity_date
         FROM Gamification_streak_records
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
         ORDER BY id DESC`,
        [userId, subInstituteId, syear]
      );
      return (rows as Array<{
        current_streak: number;
        longest_streak: number;
        longest_streak_date: string | null;
        last_activity_date: string | null;
      }>).map((row) => ({
        currentStreak: Number(row.current_streak),
        longestStreak: Number(row.longest_streak),
        longestStreakDate: row.longest_streak_date,
        lastActivityDate: row.last_activity_date,
      }));
    },

    async getMasteryRecords(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT concept, concept_id, mastery_result, mastery_duration, mastery_session_count, fastest_mastery, mountain_sky_concept, achieved_at
         FROM Gamification_mastery_records
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
         ORDER BY achieved_at DESC`,
        [userId, subInstituteId, syear]
      );
      return (rows as Array<{
        concept: string;
        concept_id: string | null;
        mastery_result: number;
        mastery_duration: number | null;
        mastery_session_count: number | null;
        fastest_mastery: number | null;
        mountain_sky_concept: number;
        achieved_at: string;
      }>).map((row) => ({
        concept: row.concept,
        conceptId: row.concept_id,
        masteryResult: Number(row.mastery_result),
        masteryDuration: row.mastery_duration ?? null,
        masterySessionCount: row.mastery_session_count ?? null,
        fastestMastery: row.fastest_mastery ?? null,
        mountainSkyConcept: Boolean(row.mountain_sky_concept),
        achievedAt: row.achieved_at,
      }));
    },

    async getSessionRecords(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT record_type, previous_value, new_value, session_start, session_end, concepts_covered, achieved_at
         FROM Gamification_session_records
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND record_type != 'pb_processed'
         ORDER BY achieved_at DESC`,
        [userId, subInstituteId, syear]
      );
      return (rows as Array<{
        record_type: string;
        previous_value: number;
        new_value: number;
        session_start: string | null;
        session_end: string | null;
        concepts_covered: string;
        achieved_at: string;
      }>).map((row) => ({
        recordType: row.record_type,
        previousValue: Number(row.previous_value),
        newValue: Number(row.new_value),
        sessionStart: row.session_start,
        sessionEnd: row.session_end,
        conceptsCovered: (() => {
          try {
            const parsed = JSON.parse(row.concepts_covered);
            return Array.isArray(parsed) ? parsed : [row.concepts_covered];
          } catch {
            return [row.concepts_covered];
          }
        })(),
        achievedAt: row.achieved_at,
      }));
    },

    async getProcessedEvent(userId, subInstituteId, syear, questionPaperId) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT id FROM Gamification_session_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND JSON_CONTAINS(concepts_covered, JSON_QUOTE(?))',
        [userId, subInstituteId, syear, questionPaperId]
      );
      return (rows as Array<{ id: number }>).length > 0;
    },

    async upsertFluencyRecord(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_fluency_records 
         (user_id, sub_institute_id, syear, concept_id, concept_name, best_fluency, previous_best, absolute_improvement, improvement_percentage, achieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         best_fluency = VALUES(best_fluency),
         previous_best = VALUES(previous_best),
         absolute_improvement = VALUES(absolute_improvement),
         improvement_percentage = VALUES(improvement_percentage),
         achieved_at = VALUES(achieved_at),
         updated_at = CURRENT_TIMESTAMP`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.conceptId,
          event.conceptName,
          event.newBest,
          event.previousBest,
          event.absoluteImprovement,
          event.improvementPercentage,
          toMySQLDateTime(event.achievedAt),
        ]
      );
    },

    async upsertStreakRecord(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_streak_records 
         (user_id, sub_institute_id, syear, current_streak, longest_streak, longest_streak_date, last_activity_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         longest_streak = VALUES(longest_streak),
         longest_streak_date = VALUES(longest_streak_date),
         last_activity_date = VALUES(last_activity_date),
         updated_at = CURRENT_TIMESTAMP`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.newLongest,
          event.newLongest,
          event.achievedAt.slice(0, 10),
          event.achievedAt.slice(0, 10),
        ]
      );
    },

    async upsertMasteryRecord(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_mastery_records 
         (user_id, sub_institute_id, syear, concept, concept_id, mastery_result, mastery_duration, mastery_session_count, fastest_mastery, mountain_sky_concept, achieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         mastery_result = VALUES(mastery_result),
         mastery_duration = VALUES(mastery_duration),
         mastery_session_count = VALUES(mastery_session_count),
         fastest_mastery = VALUES(fastest_mastery),
         mountain_sky_concept = VALUES(mountain_sky_concept),
         achieved_at = VALUES(achieved_at),
         updated_at = CURRENT_TIMESTAMP`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.concept,
          event.conceptId,
          event.newResult,
          event.masteryDuration ?? null,
          event.masterySessionCount ?? null,
          event.fastestMastery ?? null,
          event.mountainSkyConcept ? 1 : 0,
          toMySQLDateTime(event.achievedAt),
        ]
      );
    },

    async insertSessionRecord(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_session_records 
         (user_id, sub_institute_id, syear, record_type, previous_value, new_value, session_start, session_end, concepts_covered, achieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.recordType,
          event.previousValue,
          event.newValue,
          toMySQLDateTime(event.sessionStart),
          toMySQLDateTime(event.sessionEnd),
          JSON.stringify(event.conceptsCovered),
          toMySQLDateTime(event.achievedAt),
        ]
      );
    },

    async insertNotification(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_pb_notifications 
         (user_id, sub_institute_id, syear, notification_type, title, message, related_concept, previous_value, new_value, improvement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.notificationType,
          event.title,
          event.message,
          event.relatedConcept ?? null,
          event.previousValue,
          event.newValue,
          event.improvement,
        ]
      );
    },

    async markEventProcessed(userId, subInstituteId, syear, questionPaperId) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_session_records 
         (user_id, sub_institute_id, syear, record_type, previous_value, new_value, session_start, session_end, concepts_covered, achieved_at)
         VALUES (?, ?, ?, 'pb_processed', 0, 0, NOW(), NOW(), JSON_ARRAY(?), NOW())`,
        [userId, subInstituteId, syear, questionPaperId]
      );
    },

    async getPersonalBestSummary(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [fluencyRows] = await pool.query(
        'SELECT COUNT(*) as cnt, COALESCE(MAX(best_fluency),0) as best FROM Gamification_fluency_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ?',
        [userId, subInstituteId, syear]
      );
      const [streakRows] = await pool.query(
        'SELECT current_streak, longest_streak FROM Gamification_streak_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ?',
        [userId, subInstituteId, syear]
      );
      const [masteryRows] = await pool.query(
        'SELECT COUNT(*) as cnt, COALESCE(MAX(mastery_result),0) as best FROM Gamification_mastery_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ?',
        [userId, subInstituteId, syear]
      );
      const [sessionRows] = await pool.query(
        'SELECT COUNT(*) as cnt, COALESCE(MAX(new_value),0) as best FROM Gamification_session_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ?',
        [userId, subInstituteId, syear]
      );

      const streak = (streakRows as Array<{ current_streak: number; longest_streak: number }>)[0];
      return {
        fluencyCount: Number((fluencyRows as Array<{ cnt: number; best: number }>)[0]?.cnt ?? 0),
        bestFluency: Number((fluencyRows as Array<{ cnt: number; best: number }>)[0]?.best ?? 0),
        streakCurrent: streak ? Number(streak.current_streak) : 0,
        streakLongest: streak ? Number(streak.longest_streak) : 0,
        masteryCount: Number((masteryRows as Array<{ cnt: number; best: number }>)[0]?.cnt ?? 0),
        bestMastery: Number((masteryRows as Array<{ cnt: number; best: number }>)[0]?.best ?? 0),
        sessionCount: Number((sessionRows as Array<{ cnt: number; best: number }>)[0]?.cnt ?? 0),
        bestSession: Number((sessionRows as Array<{ cnt: number; best: number }>)[0]?.best ?? 0),
      };
    },

    async getNotifications(userId, subInstituteId, syear, limit) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT id, notification_type, title, message, related_concept, previous_value, new_value, improvement, is_read, created_at
         FROM Gamification_pb_notifications
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, subInstituteId, syear, limit]
      );
      return (rows as Array<{
        id: number;
        notification_type: string;
        title: string;
        message: string;
        related_concept: string | null;
        previous_value: number;
        new_value: number;
        improvement: number;
        is_read: number;
        created_at: string;
      }>).map((row) => ({
        id: row.id,
        notificationType: row.notification_type,
        title: row.title,
        message: row.message,
        relatedConcept: row.related_concept,
        previousValue: Number(row.previous_value),
        newValue: Number(row.new_value),
        improvement: Number(row.improvement),
        isRead: row.is_read,
        createdAt: row.created_at,
      }));
    },
  };
}

let mysqlPromise: Promise<typeof import('mysql2/promise')> | null = null;

async function getMysql() {
  if (!mysqlPromise) {
    mysqlPromise = import('mysql2/promise');
  }
  return mysqlPromise;
}

function createPool(config: DbConfig) {
  return getMysql().then((mysql) =>
    mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    })
  );
}
