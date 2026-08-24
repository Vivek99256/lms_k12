export type PbApiNotification = {
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
};

export type PbApiSummary = {
  fluencyCount: number;
  bestFluency: number;
  streakCurrent: number;
  streakLongest: number;
  masteryCount: number;
  bestMastery: number;
  sessionCount: number;
  bestSession: number;
};

export type PbApiFluencyRecord = {
  conceptId: string;
  conceptName: string;
  bestFluency: number;
  previousBest: number;
  absoluteImprovement: number;
  improvementPercentage: number;
  achievedAt: string;
};

export type PbApiStreakRecord = {
  currentStreak: number;
  longestStreak: number;
  longestStreakDate: string | null;
  lastActivityDate: string | null;
};

export type PbApiMasteryRecord = {
  concept: string;
  conceptId: string | null;
  masteryResult: number;
  masteryDuration: number | null;
  masterySessionCount: number | null;
  fastestMastery: number | null;
  mountainSkyConcept: boolean;
  achievedAt: string;
};

export type PbApiSessionRecord = {
  recordType: string;
  previousValue: number;
  newValue: number;
  sessionStart: string | null;
  sessionEnd: string | null;
  conceptsCovered: string[];
  achievedAt: string;
};

export type PbPersonalBestData = {
  summary: PbApiSummary;
  fluency: PbApiFluencyRecord[];
  streak: PbApiStreakRecord[];
  mastery: PbApiMasteryRecord[];
  session: PbApiSessionRecord[];
  notifications: PbApiNotification[];
};
