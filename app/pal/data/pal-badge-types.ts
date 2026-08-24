export type BadgeDefinition = {
  id: number;
  badgeCode: string;
  badgeName: string;
  category: string;
  description: string;
  triggerType: string;
  triggerRule: Record<string, unknown>;
  icon: string | null;
  color: string | null;
  sortOrder: number;
};

export type BadgeAward = {
  id: number;
  userId: string;
  subInstituteId: string;
  syear: string;
  badgeId: number;
  badgeCode: string;
  badgeName: string;
  category: string;
  description: string;
  icon: string | null;
  color: string | null;
  earnedAt: string;
  evidence: Record<string, unknown> | null;
};

export type BadgeSummary = {
  totalBadges: number;
  categories: Record<string, number>;
  recentBadges: BadgeAward[];
};

export type BadgeProgress = BadgeDefinition & {
  earned: boolean;
  earnedAt: string | null;
  progress: Record<string, unknown>;
};

export type BadgeEventInput = {
  userId: string;
  subInstituteId: string;
  syear: string;
  eventType: string;
  sourceId?: string;
  context?: Record<string, unknown>;
};

export type BadgeEvaluateInput = {
  userId: string;
  subInstituteId: string;
  syear: string;
  quizData?: {
    conceptName: string;
    masteryLevel: number;
    fluency: number;
    sessionCount: number;
  }[];
  sessionStart?: string;
  sessionEnd?: string;
};
