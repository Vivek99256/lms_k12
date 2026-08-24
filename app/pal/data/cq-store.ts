import mysql from 'mysql2/promise';
import { getDbConfig } from './pal-pb-store-config';
import type {
  CareerPathway,
  CareerSkill,
  StudentCareerProgress,
  CareerQuestState,
  CareerActivity,
  CareerInterest,
  MasteryState,
  CareerQuestSummary,
  PathwayWithSkills,
  StageDefinition,
  CareerQuestStage,
  InterestDeclarationInput,
  ActivityCompletionInput,
  ActivityType,
  ActivityStatus,
  InterestType,
} from './cq-types';

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    stage: 'explorer',
    label: 'Explorer',
    description: 'Exploration and curiosity. Discover new domains and build foundational awareness.',
    gradeRange: 'Grades 1–2',
    minGrade: 1,
    maxGrade: 2,
    features: ['hpc_domain_exploration', 'curiosity_badges', 'no_forced_selection'],
  },
  {
    stage: 'skill_builder',
    label: 'Skill Builder',
    description: 'Grow your skill tree and explore introductory career interests.',
    gradeRange: 'Grades 3–5',
    minGrade: 3,
    maxGrade: 5,
    features: ['skill_tree_growth', 'interest_signals', 'non_binding_declarations'],
  },
  {
    stage: 'pathway_seeker',
    label: 'Pathway Seeker',
    description: 'Discover your emerging profile and explore top career pathways.',
    gradeRange: 'Grades 6–8',
    minGrade: 6,
    maxGrade: 8,
    features: ['riasec_profile', 'top_pathways', 'nsqf_options', 'skill_progress'],
  },
  {
    stage: 'career_builder',
    label: 'Career Builder',
    description: 'Build your career pathway report and prepare for the future.',
    gradeRange: 'Grades 9–12',
    minGrade: 9,
    maxGrade: 12,
    features: ['career_report', 'subject_recommendations', 'nsqf_progress', 'required_skills'],
  },
];

export function resolveStageFromGrade(grade: number | null | undefined): CareerQuestStage {
  if (grade == null) return 'explorer';
  if (grade >= 1 && grade <= 2) return 'explorer';
  if (grade >= 3 && grade <= 5) return 'skill_builder';
  if (grade >= 6 && grade <= 8) return 'pathway_seeker';
  if (grade >= 9 && grade <= 12) return 'career_builder';
  return 'explorer';
}

function mapRowToCareerQuestState(row: Record<string, unknown>): CareerQuestState {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subInstituteId: String(row.sub_institute_id),
    syear: String(row.syear),
    grade: row.grade != null ? Number(row.grade) : null,
    currentStage: String(row.current_stage) as CareerQuestStage,
    primaryPathwayId: row.primary_pathway_id != null ? Number(row.primary_pathway_id) : null,
    secondaryPathwayId: row.secondary_pathway_id != null ? Number(row.secondary_pathway_id) : null,
    interestDeclaration: row.interest_declaration
      ? (typeof row.interest_declaration === 'string'
          ? JSON.parse(row.interest_declaration)
          : row.interest_declaration)
      : null,
    questLevel: Number(row.quest_level),
    progressInfo: row.progress_info
      ? (typeof row.progress_info === 'string'
          ? JSON.parse(row.progress_info)
          : row.progress_info)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRowToCareerPathway(row: Record<string, unknown>): CareerPathway {
  return {
    id: Number(row.id),
    pathwayCode: String(row.pathway_code),
    pathwayName: String(row.pathway_name),
    description: row.description != null ? String(row.description) : null,
    category: row.category != null ? String(row.category) : null,
    riasecCodes: row.riasec_codes != null ? String(row.riasec_codes) : null,
    status: Number(row.status),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRowToCareerSkill(row: Record<string, unknown>): CareerSkill {
  return {
    id: Number(row.id),
    pathwayId: Number(row.pathway_id),
    skillCode: String(row.skill_code),
    skillLabel: String(row.skill_label),
    description: row.description != null ? String(row.description) : null,
    weight: Number(row.weight),
    nsqfRelevance: Boolean(row.nsqf_relevance),
    sortOrder: Number(row.sort_order),
  };
}

function mapRowToStudentCareerProgress(row: Record<string, unknown>): StudentCareerProgress {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subInstituteId: String(row.sub_institute_id),
    syear: String(row.syear),
    pathwayId: Number(row.pathway_id),
    skillId: Number(row.skill_id),
    masteryState: String(row.mastery_state) as MasteryState,
    completionState: Boolean(row.completion_state),
    achievedAt: row.achieved_at != null ? String(row.achieved_at) : null,
  };
}

function mapRowToCareerActivity(row: Record<string, unknown>): CareerActivity {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subInstituteId: String(row.sub_institute_id),
    syear: String(row.syear),
    activityType: String(row.activity_type) as ActivityType,
    activityName: String(row.activity_name),
    pathwayId: row.pathway_id != null ? Number(row.pathway_id) : null,
    skillId: row.skill_id != null ? Number(row.skill_id) : null,
    sourceId: row.source_id != null ? String(row.source_id) : null,
    status: String(row.status) as ActivityStatus,
    metadata: row.metadata
      ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
      : null,
    createdAt: String(row.created_at),
  };
}

function mapRowToCareerInterest(row: Record<string, unknown>): CareerInterest {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    subInstituteId: String(row.sub_institute_id),
    syear: String(row.syear),
    interestType: String(row.interest_type) as InterestType,
    interestValue: String(row.interest_value),
    metadata: row.metadata
      ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
      : null,
    createdAt: String(row.created_at),
  };
}

export interface PalCqStoreConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface PalCqStore {
  getCareerQuestState(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<CareerQuestState | null>;

  upsertCareerQuestState(
    userId: string,
    subInstituteId: string,
    syear: string,
    grade: number | null,
    currentStage: CareerQuestStage,
    primaryPathwayId: number | null,
    secondaryPathwayId: number | null,
    interestDeclaration: Record<string, unknown> | null,
    questLevel: number,
    progressInfo: Record<string, unknown> | null
  ): Promise<CareerQuestState>;

  getStageDefinitions(): Promise<StageDefinition[]>;

  getCareerPathways(activeOnly?: boolean): Promise<CareerPathway[]>;

  getCareerPathwayById(pathwayId: number): Promise<CareerPathway | null>;

  getPathwaySkills(pathwayId: number): Promise<CareerSkill[]>;

  getStudentPathwayProgress(
    userId: string,
    subInstituteId: string,
    syear: string,
    pathwayId: number
  ): Promise<StudentCareerProgress[]>;

  upsertStudentProgress(
    userId: string,
    subInstituteId: string,
    syear: string,
    pathwayId: number,
    skillId: number,
    masteryState: MasteryState,
    completionState: boolean,
    achievedAt: string | null
  ): Promise<void>;

  recordCareerActivity(input: {
    userId: string;
    subInstituteId: string;
    syear: string;
    activityType: ActivityCompletionInput['activityType'];
    activityName: string;
    pathwayId: number | null;
    skillId: number | null;
    sourceId: string | null;
    metadata: Record<string, unknown> | null;
  }): Promise<CareerActivity>;

  getCareerActivities(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<CareerActivity[]>;

  declareInterest(
    userId: string,
    subInstituteId: string,
    syear: string,
    input: InterestDeclarationInput
  ): Promise<CareerInterest>;

  getCareerInterests(
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<CareerInterest[]>;

  getCareerQuestSummary(
    userId: string,
    subInstituteId: string,
    syear: string,
    primaryPathwayId: number | null,
    secondaryPathwayId: number | null
  ): Promise<CareerQuestSummary>;

  getPathwayWithSkills(
    pathwayId: number,
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<PathwayWithSkills | null>;

  close(): Promise<void>;
}

const mockQuestStateMap = new Map<string, CareerQuestState>();
const mockProgressMap = new Map<string, StudentCareerProgress>();
const mockActivityList: CareerActivity[] = [];
const mockInterestMap = new Map<string, CareerInterest>();

export function resetMockPalCqStore(): void {
  mockQuestStateMap.clear();
  mockProgressMap.clear();
  mockActivityList.length = 0;
  mockInterestMap.clear();
}

export function createMockPalCqStore(): PalCqStore {
  function questStateKey(userId: string, subInstituteId: string, syear: string): string {
    return `${userId}::${subInstituteId}::${syear}`;
  }

  return {
    async getCareerQuestState(userId, subInstituteId, syear) {
      const key = questStateKey(userId, subInstituteId, syear);
      return mockQuestStateMap.get(key) ?? null;
    },

    async upsertCareerQuestState(
      userId,
      subInstituteId,
      syear,
      grade,
      currentStage,
      primaryPathwayId,
      secondaryPathwayId,
      interestDeclaration,
      questLevel,
      progressInfo
    ) {
      const key = questStateKey(userId, subInstituteId, syear);
      const existing = mockQuestStateMap.get(key);
      const now = new Date().toISOString();
      const state: CareerQuestState = {
        id: existing?.id ?? Date.now(),
        userId,
        subInstituteId,
        syear,
        grade: grade ?? existing?.grade ?? null,
        currentStage,
        primaryPathwayId: primaryPathwayId ?? existing?.primaryPathwayId ?? null,
        secondaryPathwayId: secondaryPathwayId ?? existing?.secondaryPathwayId ?? null,
        interestDeclaration: interestDeclaration ?? existing?.interestDeclaration ?? null,
        questLevel: questLevel ?? existing?.questLevel ?? 1,
        progressInfo: progressInfo ?? existing?.progressInfo ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      mockQuestStateMap.set(key, state);
      return { ...state };
    },

    async getStageDefinitions() {
      return STAGE_DEFINITIONS.map((def) => ({ ...def }));
    },

    async getCareerPathways(activeOnly = true) {
      return [];
    },

    async getCareerPathwayById(pathwayId: number) {
      return null;
    },

    async getPathwaySkills(pathwayId: number) {
      return [];
    },

    async getStudentPathwayProgress(userId, subInstituteId, syear, pathwayId) {
      return Array.from(mockProgressMap.values()).filter((p) =>
        p.userId === userId && p.subInstituteId === subInstituteId && p.syear === syear && p.pathwayId === pathwayId
      );
    },

    async upsertStudentProgress(
      userId,
      subInstituteId,
      syear,
      pathwayId,
      skillId,
      masteryState,
      completionState,
      achievedAt
    ) {
      const key = `${userId}::${subInstituteId}::${syear}::${pathwayId}::${skillId}`;
      const now = new Date().toISOString();
      const progress: StudentCareerProgress = {
        id: Date.now(),
        userId,
        subInstituteId,
        syear,
        pathwayId,
        skillId,
        masteryState,
        completionState,
        achievedAt: achievedAt ?? now,
      };
      mockProgressMap.set(key, progress);
    },

    async recordCareerActivity(input) {
      const activity: CareerActivity = {
        id: Date.now(),
        userId: input.userId,
        subInstituteId: input.subInstituteId,
        syear: input.syear,
        activityType: input.activityType,
        activityName: input.activityName,
        pathwayId: input.pathwayId ?? null,
        skillId: input.skillId ?? null,
        sourceId: input.sourceId ?? null,
        status: 'completed',
        metadata: input.metadata ?? null,
        createdAt: new Date().toISOString(),
      };
      mockActivityList.push(activity);
      return { ...activity };
    },

    async getCareerActivities(userId, subInstituteId, syear) {
      return mockActivityList.filter(
        (a) => a.userId === userId && a.subInstituteId === subInstituteId && a.syear === syear
      );
    },

    async declareInterest(userId, subInstituteId, syear, input) {
      const key = `${userId}::${subInstituteId}::${syear}::${input.interestType}::${input.interestValue}`;
      const existing = mockInterestMap.get(key);
      const now = new Date().toISOString();
      const interest: CareerInterest = {
        id: existing?.id ?? Date.now(),
        userId,
        subInstituteId,
        syear,
        interestType: input.interestType,
        interestValue: input.interestValue,
        metadata: input.metadata ?? existing?.metadata ?? null,
        createdAt: existing?.createdAt ?? now,
      };
      mockInterestMap.set(key, interest);
      return { ...interest };
    },

    async getCareerInterests(userId, subInstituteId, syear) {
      return Array.from(mockInterestMap.values()).filter(
        (i) => i.userId === userId && i.subInstituteId === subInstituteId && i.syear === syear
      );
    },

    async getCareerQuestSummary(userId, subInstituteId, syear, primaryPathwayId, secondaryPathwayId) {
      const key = questStateKey(userId, subInstituteId, syear);
      const state = mockQuestStateMap.get(key);
      const activities = await this.getCareerActivities(userId, subInstituteId, syear);
      const interests = await this.getCareerInterests(userId, subInstituteId, syear);
      const stageDef = STAGE_DEFINITIONS.find((d) => d.stage === (state?.currentStage ?? 'explorer')) ?? STAGE_DEFINITIONS[0];

      let primaryPathway: CareerPathway | null = null;
      let secondaryPathway: CareerPathway | null = null;

      if (primaryPathwayId) primaryPathway = await this.getCareerPathwayById(primaryPathwayId);
      if (secondaryPathwayId) secondaryPathway = await this.getCareerPathwayById(secondaryPathwayId);

      let masteredSkillCount = 0;
      let totalSkillCount = 0;

      if (primaryPathwayId) {
        const progress = await this.getStudentPathwayProgress(userId, subInstituteId, syear, primaryPathwayId);
        masteredSkillCount = progress.filter((p) => p.masteryState === 'mastered').length;
        const skills = await this.getPathwaySkills(primaryPathwayId);
        totalSkillCount = skills.length;
      }

      return {
        currentStage: state?.currentStage ?? 'explorer',
        grade: state?.grade ?? null,
        stageLabel: stageDef.label,
        stageDescription: stageDef.description,
        primaryPathway,
        secondaryPathway,
        interestCount: interests.length,
        activityCount: activities.length,
        masteredSkillCount,
        totalSkillCount,
      };
    },

    async getPathwayWithSkills(pathwayId, userId, subInstituteId, syear) {
      const pathway = await this.getCareerPathwayById(pathwayId);
      if (!pathway) return null;
      const skills = await this.getPathwaySkills(pathwayId);
      const studentProgress = await this.getStudentPathwayProgress(userId, subInstituteId, syear, pathwayId);
      const masteredCount = studentProgress.filter((p) => p.masteryState === 'mastered').length;
      const totalCount = skills.length;
      const progressPercentage = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

      return {
        pathway,
        skills,
        studentProgress,
        masteredCount,
        totalCount,
        progressPercentage,
      };
    },

    async close() {
      // no-op for mock store
    },
  };
}

export function createPalCqStore(config?: PalCqStoreConfig): PalCqStore {
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
    async getCareerQuestState(userId, subInstituteId, syear) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_quests
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
           LIMIT 1`,
          [userId, subInstituteId, syear]
        );
        const row = (rows as Array<Record<string, unknown>>)[0];
        if (!row) return null;
        return mapRowToCareerQuestState(row);
      });
    },

    async upsertCareerQuestState(
      userId,
      subInstituteId,
      syear,
      grade,
      currentStage,
      primaryPathwayId,
      secondaryPathwayId,
      interestDeclaration,
      questLevel,
      progressInfo
    ) {
      return withConnection(async (conn) => {
        await conn.execute(
          `INSERT INTO Gamification_career_quests
           (user_id, sub_institute_id, syear, grade, current_stage,
            primary_pathway_id, secondary_pathway_id, interest_declaration,
            quest_level, progress_info)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           grade = VALUES(grade),
           current_stage = VALUES(current_stage),
           primary_pathway_id = VALUES(primary_pathway_id),
           secondary_pathway_id = VALUES(secondary_pathway_id),
           interest_declaration = VALUES(interest_declaration),
           quest_level = VALUES(quest_level),
           progress_info = VALUES(progress_info),
           updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            subInstituteId,
            syear,
            grade ?? null,
            currentStage,
            primaryPathwayId ?? null,
            secondaryPathwayId ?? null,
            interestDeclaration ? JSON.stringify(interestDeclaration) : null,
            questLevel,
            progressInfo ? JSON.stringify(progressInfo) : null,
          ]
        );
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_quests
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
           LIMIT 1`,
          [userId, subInstituteId, syear]
        );
        return mapRowToCareerQuestState((rows as Array<Record<string, unknown>>)[0]);
      });
    },

    async getStageDefinitions() {
      return STAGE_DEFINITIONS;
    },

    async getCareerPathways(activeOnly = true) {
      return withConnection(async (conn) => {
        const sql = activeOnly
          ? `SELECT * FROM Gamification_career_pathways WHERE status = 1 ORDER BY sort_order ASC, pathway_name ASC`
          : `SELECT * FROM Gamification_career_pathways ORDER BY sort_order ASC, pathway_name ASC`;
        const [rows] = await conn.execute(sql);
        return (rows as Array<Record<string, unknown>>).map(mapRowToCareerPathway);
      });
    },

    async getCareerPathwayById(pathwayId) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_pathways WHERE id = ? LIMIT 1`,
          [pathwayId]
        );
        const row = (rows as Array<Record<string, unknown>>)[0];
        return row ? mapRowToCareerPathway(row) : null;
      });
    },

    async getPathwaySkills(pathwayId) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_skills WHERE pathway_id = ? ORDER BY sort_order ASC, skill_label ASC`,
          [pathwayId]
        );
        return (rows as Array<Record<string, unknown>>).map(mapRowToCareerSkill);
      });
    },

    async getStudentPathwayProgress(userId, subInstituteId, syear, pathwayId) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_student_career_progress
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND pathway_id = ?
           ORDER BY created_at ASC`,
          [userId, subInstituteId, syear, pathwayId]
        );
        return (rows as Array<Record<string, unknown>>).map(mapRowToStudentCareerProgress);
      });
    },

    async upsertStudentProgress(
      userId,
      subInstituteId,
      syear,
      pathwayId,
      skillId,
      masteryState,
      completionState,
      achievedAt
    ) {
      return withConnection(async (conn) => {
        await conn.execute(
          `INSERT INTO Gamification_student_career_progress
           (user_id, sub_institute_id, syear, pathway_id, skill_id,
            mastery_state, completion_state, achieved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           mastery_state = VALUES(mastery_state),
           completion_state = VALUES(completion_state),
           achieved_at = VALUES(achieved_at),
           updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            subInstituteId,
            syear,
            pathwayId,
            skillId,
            masteryState,
            completionState ? 1 : 0,
            achievedAt ?? null,
          ]
        );
      });
    },

    async recordCareerActivity(input) {
      return withConnection(async (conn) => {
        const [result] = await conn.execute(
          `INSERT INTO Gamification_career_activities
           (user_id, sub_institute_id, syear, activity_type, activity_name,
            pathway_id, skill_id, source_id, status, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
          [
            input.userId,
            input.subInstituteId,
            input.syear,
            input.activityType,
            input.activityName,
            input.pathwayId ?? null,
            input.skillId ?? null,
            input.sourceId ?? null,
            input.metadata ? JSON.stringify(input.metadata) : null,
          ]
        );
        const insertId = Number((result as { insertId: number }).insertId);
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_activities WHERE id = ? LIMIT 1`,
          [insertId]
        );
        return mapRowToCareerActivity((rows as Array<Record<string, unknown>>)[0]);
      });
    },

    async getCareerActivities(userId, subInstituteId, syear) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_activities
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
           ORDER BY created_at DESC`,
          [userId, subInstituteId, syear]
        );
        return (rows as Array<Record<string, unknown>>).map(mapRowToCareerActivity);
      });
    },

    async declareInterest(userId, subInstituteId, syear, input) {
      return withConnection(async (conn) => {
        await conn.execute(
          `INSERT INTO Gamification_career_interests
           (user_id, sub_institute_id, syear, interest_type, interest_value, metadata)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           interest_value = VALUES(interest_value),
           metadata = VALUES(metadata)`,
          [
            userId,
            subInstituteId,
            syear,
            input.interestType,
            input.interestValue,
            input.metadata ? JSON.stringify(input.metadata) : null,
          ]
        );
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_interests
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ? AND interest_type = ? AND interest_value = ?
           LIMIT 1`,
          [userId, subInstituteId, syear, input.interestType, input.interestValue]
        );
        return mapRowToCareerInterest((rows as Array<Record<string, unknown>>)[0]);
      });
    },

    async getCareerInterests(userId, subInstituteId, syear) {
      return withConnection(async (conn) => {
        const [rows] = await conn.execute(
          `SELECT * FROM Gamification_career_interests
           WHERE user_id = ? AND sub_institute_id = ? AND syear = ?
           ORDER BY created_at DESC`,
          [userId, subInstituteId, syear]
        );
        return (rows as Array<Record<string, unknown>>).map(mapRowToCareerInterest);
      });
    },

    async getCareerQuestSummary(
      userId,
      subInstituteId,
      syear,
      primaryPathwayId,
      secondaryPathwayId
    ) {
      const state = await this.getCareerQuestState(userId, subInstituteId, syear);
      const activities = await this.getCareerActivities(userId, subInstituteId, syear);
      const interests = await this.getCareerInterests(userId, subInstituteId, syear);

      const stageDef = STAGE_DEFINITIONS.find((d) => d.stage === state?.currentStage) ?? STAGE_DEFINITIONS[0];

      let primaryPathway: CareerPathway | null = null;
      let secondaryPathway: CareerPathway | null = null;

      if (primaryPathwayId) {
        primaryPathway = await this.getCareerPathwayById(primaryPathwayId);
      }
      if (secondaryPathwayId) {
        secondaryPathway = await this.getCareerPathwayById(secondaryPathwayId);
      }

      let masteredSkillCount = 0;
      let totalSkillCount = 0;

      if (primaryPathwayId) {
        const progress = await this.getStudentPathwayProgress(userId, subInstituteId, syear, primaryPathwayId);
        masteredSkillCount = progress.filter((p) => p.masteryState === 'mastered').length;
        const skills = await this.getPathwaySkills(primaryPathwayId);
        totalSkillCount = skills.length;
      }

      return {
        currentStage: state?.currentStage ?? 'explorer',
        grade: state?.grade ?? null,
        stageLabel: stageDef.label,
        stageDescription: stageDef.description,
        primaryPathway,
        secondaryPathway,
        interestCount: interests.length,
        activityCount: activities.length,
        masteredSkillCount,
        totalSkillCount,
      };
    },

    async getPathwayWithSkills(pathwayId, userId, subInstituteId, syear) {
      const pathway = await this.getCareerPathwayById(pathwayId);
      if (!pathway) return null;
      const skills = await this.getPathwaySkills(pathwayId);
      const studentProgress = await this.getStudentPathwayProgress(userId, subInstituteId, syear, pathwayId);
      const masteredCount = studentProgress.filter((p) => p.masteryState === 'mastered').length;
      const totalCount = skills.length;
      const progressPercentage = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

      return {
        pathway,
        skills,
        studentProgress,
        masteredCount,
        totalCount,
        progressPercentage,
      };
    },

    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },
  };
}

export function createPalCqStoreFromEnv(): PalCqStore {
  return createPalCqStore();
}
