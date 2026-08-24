import type { BadgeAward, BadgeDefinition, BadgeEventInput, BadgeProgress, BadgeSummary } from './pal-badge-types';
import { getDbConfig } from './pal-pb-store-config';

export interface PalBadgeStore {
  getAllBadgeDefinitions(): Promise<BadgeDefinition[]>;

  getStudentBadges(userId: string, subInstituteId: string, syear: string): Promise<BadgeAward[]>;

  getBadgeProgress(userId: string, subInstituteId: string, syear: string): Promise<BadgeProgress[]>;

  getBadgeSummary(userId: string, subInstituteId: string, syear: string): Promise<BadgeSummary>;

  isBadgeEarned(userId: string, subInstituteId: string, syear: string, badgeCode: string): Promise<boolean>;

  awardBadge(
    userId: string,
    subInstituteId: string,
    syear: string,
    badgeId: number,
    badgeCode: string,
    evidence: Record<string, unknown> | null
  ): Promise<void>;

  insertBadgeEvent(event: BadgeEventInput): Promise<void>;

  countBadgeEvents(
    userId: string,
    subInstituteId: string,
    syear: string,
    eventType: string,
    since?: string
  ): Promise<number>;

  getMasteredConceptCount(userId: string, subInstituteId: string, syear: string): Promise<number>;

  getCurrentStreak(userId: string, subInstituteId: string, syear: string): Promise<number>;

  countSessionRecords(userId: string, subInstituteId: string, syear: string): Promise<number>;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 1,
    badgeCode: 'BADGE_FIRST_MASTERY',
    badgeName: 'First Steps to Mastery',
    category: 'Mastery',
    description: 'Achieve mastery (>= 70%) in any concept for the first time.',
    triggerType: 'mastery_first',
    triggerRule: { min_mastery: 70 },
    icon: 'Target',
    color: 'emerald',
    sortOrder: 1,
  },
  {
    id: 2,
    badgeCode: 'BADGE_PERFECT_MASTERY',
    badgeName: 'Perfect Score',
    category: 'Mastery',
    description: 'Achieve 100% mastery in any concept.',
    triggerType: 'mastery_perfect',
    triggerRule: { min_mastery: 100 },
    icon: 'Star',
    color: 'yellow',
    sortOrder: 2,
  },
  {
    id: 3,
    badgeCode: 'BADGE_QUICK_MASTERY',
    badgeName: 'Quick Learner',
    category: 'Mastery',
    description: 'Reach mastery >= 70% in a concept in 3 or fewer sessions.',
    triggerType: 'mastery_quick',
    triggerRule: { min_mastery: 70, max_sessions: 3 },
    icon: 'Zap',
    color: 'violet',
    sortOrder: 3,
  },
  {
    id: 4,
    badgeCode: 'BADGE_FIRST_FLUENCY',
    badgeName: 'First Fluency',
    category: 'Fluency',
    description: 'Achieve fluency > 0% in any concept for the first time.',
    triggerType: 'fluency_first',
    triggerRule: { min_fluency: 0.01 },
    icon: 'Target',
    color: 'sky',
    sortOrder: 4,
  },
  {
    id: 5,
    badgeCode: 'BADGE_PERFECT_FLUENCY',
    badgeName: 'Perfect Fluency',
    category: 'Fluency',
    description: 'Achieve 100% fluency in any concept.',
    triggerType: 'fluency_perfect',
    triggerRule: { min_fluency: 1.0 },
    icon: 'CheckCircle2',
    color: 'green',
    sortOrder: 5,
  },
  {
    id: 6,
    badgeCode: 'BADGE_FLUENCY_MASTER',
    badgeName: 'Fluency Master',
    category: 'Fluency',
    description: 'Achieve 90%+ fluency in any concept.',
    triggerType: 'fluency_high',
    triggerRule: { min_fluency: 0.9 },
    icon: 'TrendingUp',
    color: 'teal',
    sortOrder: 6,
  },
  {
    id: 7,
    badgeCode: 'BADGE_FIRST_STEPS',
    badgeName: 'First Steps',
    category: 'Persistence',
    description: 'Complete your first PAL quiz.',
    triggerType: 'first_quiz',
    triggerRule: {},
    icon: 'Footprints',
    color: 'orange',
    sortOrder: 7,
  },
  {
    id: 8,
    badgeCode: 'BADGE_WEEK_STREAK',
    badgeName: 'Week Warrior',
    category: 'Persistence',
    description: 'Achieve a 7-day learning streak.',
    triggerType: 'streak',
    triggerRule: { min_days: 7 },
    icon: 'Flame',
    color: 'red',
    sortOrder: 8,
  },
  {
    id: 9,
    badgeCode: 'BADGE_MONTH_STREAK',
    badgeName: 'Monthly Master',
    category: 'Persistence',
    description: 'Achieve a 30-day learning streak.',
    triggerType: 'streak',
    triggerRule: { min_days: 30 },
    icon: 'Flame',
    color: 'rose',
    sortOrder: 9,
  },
  {
    id: 10,
    badgeCode: 'BADGE_CONTENT_EXPLORER',
    badgeName: 'Content Explorer',
    category: 'Curiosity',
    description: 'Visit 5 unique PAL content items.',
    triggerType: 'content_visit',
    triggerRule: { min_count: 5 },
    icon: 'BookOpen',
    color: 'blue',
    sortOrder: 10,
  },
  {
    id: 11,
    badgeCode: 'BADGE_PRACTICE_PARTICIPANT',
    badgeName: 'Practice Enthusiast',
    category: 'Curiosity',
    description: 'Complete 5 PAL quizzes.',
    triggerType: 'quiz_count',
    triggerRule: { min_count: 5 },
    icon: 'ClipboardList',
    color: 'indigo',
    sortOrder: 11,
  },
  {
    id: 12,
    badgeCode: 'BADGE_MISCONCEPTION_INVESTIGATOR',
    badgeName: 'Misconception Sleuth',
    category: 'Curiosity',
    description: 'Review misconception content 3 times.',
    triggerType: 'misconception_view',
    triggerRule: { min_count: 3 },
    icon: 'CircleHelp',
    color: 'purple',
    sortOrder: 12,
  },
  {
    id: 13,
    badgeCode: 'BADGE_PEER_HELPER',
    badgeName: 'Peer Helper',
    category: 'Social',
    description: 'Access misconception remediation or peer help content.',
    triggerType: 'remediation_view',
    triggerRule: { min_count: 1 },
    icon: 'Users',
    color: 'cyan',
    sortOrder: 13,
  },
  {
    id: 14,
    badgeCode: 'BADGE_REFLECTIVE_LEARNER',
    badgeName: 'Reflective Learner',
    category: 'Social',
    description: 'View pedagogy suggestions 5 times.',
    triggerType: 'pedagogy_view',
    triggerRule: { min_count: 5 },
    icon: 'Lightbulb',
    color: 'amber',
    sortOrder: 14,
  },
  {
    id: 15,
    badgeCode: 'BADGE_CAREER_EXPLORER',
    badgeName: 'Career Explorer',
    category: 'Career',
    description: 'Visit the career counselling page.',
    triggerType: 'career_visit',
    triggerRule: { min_count: 1 },
    icon: 'Compass',
    color: 'teal',
    sortOrder: 15,
  },
  {
    id: 16,
    badgeCode: 'BADGE_RIASEC_COMPLETE',
    badgeName: 'Interest Profiler',
    category: 'Career',
    description: 'Complete the RIASEC interest profile assessment.',
    triggerType: 'riasec_complete',
    triggerRule: {},
    icon: 'ClipboardCheck',
    color: 'emerald',
    sortOrder: 16,
  },
  {
    id: 17,
    badgeCode: 'BADGE_PATHWAY_STARTER',
    badgeName: 'Pathway Starter',
    category: 'Career',
    description: 'Master 3 different concepts, building a clear skill pathway.',
    triggerType: 'mastery_count',
    triggerRule: { min_mastered_concepts: 3 },
    icon: 'Route',
    color: 'slate',
    sortOrder: 17,
  },
];

export function createMockPalBadgeStore(): PalBadgeStore {
  const earnedMap = new Map<string, BadgeAward>();
  const eventLog: Array<{ userId: string; subInstituteId: string; syear: string; eventType: string }> = [];

  return {
    async getAllBadgeDefinitions() {
      return BADGE_DEFINITIONS.map((def) => ({ ...def }));
    },

    async getStudentBadges() {
      return Array.from(earnedMap.values()).map((award) => ({ ...award }));
    },

    async getBadgeProgress() {
      return BADGE_DEFINITIONS.map((def) => {
        const award = earnedMap.get(def.badgeCode);
        return {
          ...def,
          earned: !!award,
          earnedAt: award?.earnedAt ?? null,
          progress: award?.evidence ?? {},
        };
      });
    },

    async getBadgeSummary() {
      const earned = Array.from(earnedMap.values());
      const categories: Record<string, number> = {};
      for (const badge of earned) {
        categories[badge.category] = (categories[badge.category] || 0) + 1;
      }
      return {
        totalBadges: earned.length,
        categories,
        recentBadges: earned.slice(0, 10),
      };
    },

    async isBadgeEarned(_userId, _subInstituteId, _syear, badgeCode) {
      return earnedMap.has(badgeCode);
    },

    async awardBadge(_userId, _subInstituteId, _syear, badgeId, badgeCode, evidence) {
      earnedMap.set(badgeCode, {
        id: Date.now(),
        userId: _userId,
        subInstituteId: _subInstituteId,
        syear: _syear,
        badgeId,
        badgeCode,
        badgeName: BADGE_DEFINITIONS.find((d) => d.badgeCode === badgeCode)?.badgeName ?? badgeCode,
        category: BADGE_DEFINITIONS.find((d) => d.badgeCode === badgeCode)?.category ?? '',
        description: '',
        icon: null,
        color: null,
        earnedAt: new Date().toISOString(),
        evidence: evidence ?? null,
      });
    },

    async insertBadgeEvent(event) {
      eventLog.push({
        userId: event.userId,
        subInstituteId: event.subInstituteId,
        syear: event.syear,
        eventType: event.eventType,
      });
    },

    async countBadgeEvents(userId, subInstituteId, syear, eventType) {
      return eventLog.filter(
        (e) => e.userId === userId && e.subInstituteId === subInstituteId && e.syear === syear && e.eventType === eventType
      ).length;
    },

    async getMasteredConceptCount() {
      return 0;
    },

    async getCurrentStreak() {
      return 0;
    },

    async countSessionRecords() {
      return 0;
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

function createPool(config: ReturnType<typeof getDbConfig>) {
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

export function createPalBadgeStore(): PalBadgeStore {
  const config = getDbConfig();
  const poolPromise = createPool(config);

  return {
    async getAllBadgeDefinitions() {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT id, badge_code, badge_name, category, description, trigger_type, trigger_rule, icon, color, sort_order FROM Gamification_badges WHERE status = 1 ORDER BY sort_order ASC, id ASC'
      );
      return (rows as Array<{
        id: number;
        badge_code: string;
        badge_name: string;
        category: string;
        description: string;
        trigger_type: string;
        trigger_rule: string;
        icon: string | null;
        color: string | null;
        sort_order: number;
      }>).map((row) => ({
        id: row.id,
        badgeCode: row.badge_code,
        badgeName: row.badge_name,
        category: row.category,
        description: row.description,
        triggerType: row.trigger_type,
        triggerRule: JSON.parse(row.trigger_rule || '{}'),
        icon: row.icon,
        color: row.color,
        sortOrder: row.sort_order,
      }));
    },

    async getStudentBadges(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT sb.id, sb.user_id, sb.sub_institute_id, sb.syear, sb.badge_id, sb.badge_code,
                b.badge_name, b.category, b.description, b.icon, b.color, sb.earned_at, sb.evidence
         FROM Gamification_student_badges sb
         JOIN Gamification_badges b ON b.id = sb.badge_id
         WHERE sb.user_id = ? AND sb.sub_institute_id = ? AND sb.syear = ?
         ORDER BY sb.earned_at DESC, sb.id DESC`,
        [userId, subInstituteId, syear]
      );
      return (rows as Array<{
        id: number;
        user_id: string;
        sub_institute_id: string;
        syear: string;
        badge_id: number;
        badge_code: string;
        badge_name: string;
        category: string;
        description: string;
        icon: string | null;
        color: string | null;
        earned_at: string;
        evidence: string | null;
      }>).map((row) => ({
        id: row.id,
        userId: row.user_id,
        subInstituteId: row.sub_institute_id,
        syear: row.syear,
        badgeId: row.badge_id,
        badgeCode: row.badge_code,
        badgeName: row.badge_name,
        category: row.category,
        description: row.description,
        icon: row.icon,
        color: row.color,
        earnedAt: row.earned_at,
        evidence: row.evidence ? JSON.parse(row.evidence) : null,
      }));
    },

    async getBadgeProgress(userId, subInstituteId, syear) {
      const definitions = await this.getAllBadgeDefinitions();
      const earned = await this.getStudentBadges(userId, subInstituteId, syear);
      const earnedMap = new Map(earned.map((e) => [e.badgeCode, e]));

      return definitions.map((def) => {
        const award = earnedMap.get(def.badgeCode);
        return {
          ...def,
          earned: !!award,
          earnedAt: award?.earnedAt ?? null,
          progress: award?.evidence ?? {},
        };
      });
    },

    async getBadgeSummary(userId, subInstituteId, syear) {
      const earned = await this.getStudentBadges(userId, subInstituteId, syear);
      const categories: Record<string, number> = {};
      const recentBadges = earned.slice(0, 10);

      for (const badge of earned) {
        categories[badge.category] = (categories[badge.category] || 0) + 1;
      }

      return {
        totalBadges: earned.length,
        categories,
        recentBadges,
      };
    },

    async isBadgeEarned(userId, subInstituteId, syear, badgeCode) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT id FROM Gamification_student_badges WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND badge_code = ? LIMIT 1',
        [userId, subInstituteId, syear, badgeCode]
      );
      return (rows as Array<{ id: number }>).length > 0;
    },

    async awardBadge(userId, subInstituteId, syear, badgeId, badgeCode, evidence) {
      const pool = await poolPromise;
      const earnedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await pool.query(
        `INSERT INTO Gamification_student_badges (user_id, sub_institute_id, syear, badge_id, badge_code, earned_at, evidence)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        [userId, subInstituteId, syear, badgeId, badgeCode, earnedAt, evidence ? JSON.stringify(evidence) : null]
      );
    },

    async insertBadgeEvent(event) {
      const pool = await poolPromise;
      await pool.query(
        `INSERT INTO Gamification_badge_events (user_id, sub_institute_id, syear, event_type, source_id, context)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          event.userId,
          event.subInstituteId,
          event.syear,
          event.eventType,
          event.sourceId ?? null,
          event.context ? JSON.stringify(event.context) : null,
        ]
      );
    },

    async countBadgeEvents(userId, subInstituteId, syear, eventType, since) {
      const pool = await poolPromise;
      if (since) {
        const [rows] = await pool.query(
          'SELECT COUNT(*) as cnt FROM Gamification_badge_events WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND event_type = ? AND created_at >= ?',
          [userId, subInstituteId, syear, eventType, since]
        );
        return Number((rows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      }
      const [rows] = await pool.query(
        'SELECT COUNT(*) as cnt FROM Gamification_badge_events WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND event_type = ?',
        [userId, subInstituteId, syear, eventType]
      );
      return Number((rows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
    },

    async getMasteredConceptCount(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT COUNT(DISTINCT concept) as cnt FROM Gamification_mastery_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND mastery_result >= 70',
        [userId, subInstituteId, syear]
      );
      return Number((rows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
    },

    async getCurrentStreak(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        'SELECT current_streak FROM Gamification_streak_records WHERE user_id = ? AND sub_institute_id = ? AND syear = ? LIMIT 1',
        [userId, subInstituteId, syear]
      );
      return Number((rows as Array<{ current_streak: number }>)[0]?.current_streak ?? 0);
    },

    async countSessionRecords(userId, subInstituteId, syear) {
      const pool = await poolPromise;
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM Gamification_session_records
         WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND record_type NOT IN ('pb_processed', 'fluency_pb', 'streak_pb', 'mastery_pb', 'session_pb')`,
        [userId, subInstituteId, syear]
      );
      return Number((rows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
    },
  };
}
