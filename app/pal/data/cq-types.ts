export type CareerQuestStage =
  | 'explorer'
  | 'skill_builder'
  | 'pathway_seeker'
  | 'career_builder';

export type MasteryState =
  | 'not_started'
  | 'in_progress'
  | 'mastered';

export type ActivityStatus = 'started' | 'completed' | 'skipped';

export type ActivityType =
  | 'exploration'
  | 'skill_builder'
  | 'pathway_discovery'
  | 'riasec_assessment'
  | 'nsqf_module';

export type InterestType = 'riasec' | 'pathway' | 'skill' | 'cluster';

export interface CareerPathway {
  id: number;
  pathwayCode: string;
  pathwayName: string;
  description: string | null;
  category: string | null;
  riasecCodes: string | null;
  status: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CareerSkill {
  id: number;
  pathwayId: number;
  skillCode: string;
  skillLabel: string;
  description: string | null;
  weight: number;
  nsqfRelevance: boolean;
  sortOrder: number;
}

export interface StudentCareerProgress {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  pathwayId: number;
  skillId: number;
  masteryState: MasteryState;
  completionState: boolean;
  achievedAt: string | null;
}

export interface CareerQuestState {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  grade: number | null;
  currentStage: CareerQuestStage;
  primaryPathwayId: number | null;
  secondaryPathwayId: number | null;
  interestDeclaration: Record<string, unknown> | null;
  questLevel: number;
  progressInfo: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerActivity {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  activityType: ActivityType;
  activityName: string;
  pathwayId: number | null;
  skillId: number | null;
  sourceId: string | null;
  status: ActivityStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CareerInterest {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  interestType: InterestType;
  interestValue: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CareerQuestSummary {
  currentStage: CareerQuestStage;
  grade: number | null;
  stageLabel: string;
  stageDescription: string;
  primaryPathway: CareerPathway | null;
  secondaryPathway: CareerPathway | null;
  interestCount: number;
  activityCount: number;
  masteredSkillCount: number;
  totalSkillCount: number;
}

export interface PathwayWithSkills {
  pathway: CareerPathway;
  skills: CareerSkill[];
  studentProgress: StudentCareerProgress[];
  masteredCount: number;
  totalCount: number;
  progressPercentage: number;
}

export interface StageDefinition {
  stage: CareerQuestStage;
  label: string;
  description: string;
  gradeRange: string;
  minGrade: number;
  maxGrade: number;
  features: string[];
}

export interface InterestDeclarationInput {
  interestType: InterestType;
  interestValue: string;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityCompletionInput {
  activityType: ActivityType;
  activityName: string;
  pathwayId?: number | null;
  skillId?: number | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}
