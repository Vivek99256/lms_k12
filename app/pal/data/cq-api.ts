import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';

export type CareerQuestStage =
  | 'explorer'
  | 'skill_builder'
  | 'pathway_seeker'
  | 'career_builder';

export type MasteryState = 'not_started' | 'in_progress' | 'mastered';

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
  activityType: string;
  activityName: string;
  pathwayId: number | null;
  skillId: number | null;
  sourceId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CareerInterest {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  interestType: string;
  interestValue: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

function requireSession() {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  return requireSession().userId;
}

export async function fetchCareerQuestState(signal?: AbortSignal): Promise<{
  state: CareerQuestState;
  stages: StageDefinition[];
  grade: number | null;
}> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL('/api/pal/gamification/career-quest', window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load career quest state.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load career quest state.');
  }

  const data = toRecord(record.data);
  return {
    state: toRecord(data.state) as unknown as CareerQuestState,
    stages: Array.isArray(data.stages) ? (data.stages as StageDefinition[]) : [],
    grade: readNumber(data.grade),
  };
}

export async function fetchCareerPathways(activeOnly = true, signal?: AbortSignal): Promise<CareerPathway[]> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL('/api/pal/gamification/career-pathways', window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  if (activeOnly) url.searchParams.set('active', 'true');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load career pathways.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load career pathways.');
  }

  const data = toRecord(record.data);
  return Array.isArray(data.pathways) ? (data.pathways as CareerPathway[]) : [];
}

export async function fetchPathwaySkills(pathwayId: number, signal?: AbortSignal): Promise<PathwayWithSkills | null> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL(`/api/pal/gamification/career-pathways/${pathwayId}/skills`, window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load pathway skills.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load pathway skills.');
  }

  const data = toRecord(record.data);
  return (data.pathway as PathwayWithSkills) || null;
}

export async function declareCareerInterest(
  input: {
    interestType: string;
    interestValue: string;
    metadata?: Record<string, unknown> | null;
  },
  signal?: AbortSignal
): Promise<CareerInterest> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL('/api/pal/gamification/career-interests', window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/json'),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
    body: JSON.stringify(input),
  });

  const payload = await readJson(res, 'Unable to save interest declaration.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to save interest declaration.');
  }

  const data = toRecord(record.data);
  return (data.interest as CareerInterest) || (input as unknown as CareerInterest);
}

export async function recordCareerActivity(
  input: {
    activityType: string;
    activityName: string;
    pathwayId?: number | null;
    skillId?: number | null;
    sourceId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  signal?: AbortSignal
): Promise<CareerActivity> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL('/api/pal/gamification/career-activities', window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/json'),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
    body: JSON.stringify(input),
  });

  const payload = await readJson(res, 'Unable to record activity.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to record activity.');
  }

  const data = toRecord(record.data);
  return (data.activity as CareerActivity) || (input as unknown as CareerActivity);
}

export async function fetchCareerQuestSummary(signal?: AbortSignal): Promise<{
  currentStage: string;
  grade: number | null;
  stageLabel: string;
  stageDescription: string;
  primaryPathway: CareerPathway | null;
  secondaryPathway: CareerPathway | null;
  interestCount: number;
  activityCount: number;
  masteredSkillCount: number;
  totalSkillCount: number;
}> {
  const session = requireSession();
  const learnerId = resolveLearnerId();
  const url = new URL('/api/pal/gamification/career-quest', window.location.origin);
  url.searchParams.set('user_id', learnerId);
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...createAuthHeaders(session),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  const payload = await readJson(res, 'Unable to load career quest summary.');
  const record = toRecord(payload);
  if (readString(record.status) !== '1') {
    throw new Error(readString(record.message) || 'Unable to load career quest summary.');
  }

  const data = toRecord(record.data);
  const state = toRecord(data.state);
  const stages = Array.isArray(data.stages) ? (data.stages as StageDefinition[]) : [];
  const stageDef = stages.find((s) => s.stage === state.currentStage) || stages[0];
  const summary = toRecord(data.summary);

  return {
    currentStage: readString(state.currentStage),
    grade: readNumber(data.grade),
    stageLabel: readString(stageDef?.label || ''),
    stageDescription: readString(stageDef?.description || ''),
    primaryPathway: summary.primaryPathway ? (toRecord(summary.primaryPathway) as unknown as CareerPathway) : null,
    secondaryPathway: summary.secondaryPathway ? (toRecord(summary.secondaryPathway) as unknown as CareerPathway) : null,
    interestCount: Number(summary.interestCount ?? 0),
    activityCount: Number(summary.activityCount ?? 0),
    masteredSkillCount: Number(summary.masteredSkillCount ?? 0),
    totalSkillCount: Number(summary.totalSkillCount ?? 0),
  };
}
