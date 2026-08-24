import type {
  PalResultData,
  PalResultQuestion,
  PalConceptMastery,
} from './pal';

export type PbFluencyInput = {
  conceptId: string;
  conceptName: string;
  fluency: number;
  achievedAt: string;
};

export type PbStreakInput = {
  activityDate: string;
};

export type PbMasteryInput = {
  concept: string;
  conceptId?: string;
  masteryResult: number;
  masteryDuration?: number;
  masterySessionCount?: number;
  fastestMastery?: number;
  mountainSkyConcept: boolean;
  achievedAt: string;
};

export type PbSessionInput = {
  recordType: 'longest_productive_session' | 'most_concepts_in_one_day' | 'best_single_session_mastery_gain';
  previousValue: number;
  newValue: number;
  sessionStart: string;
  sessionEnd: string;
  conceptsCovered: string[];
  achievedAt: string;
};

export type PbEventInput = {
  userId: string;
  subInstituteId: string;
  syear: string;
  questionPaperId: string;
  result: PalResultData;
  mastery: PalConceptMastery[];
  sessionStart?: string;
  sessionEnd?: string;
};

export type PbFluencyEvent = {
  type: 'fluency_pb';
  userId: string;
  subInstituteId: string;
  syear: string;
  conceptId: string;
  conceptName: string;
  previousBest: number;
  newBest: number;
  absoluteImprovement: number;
  improvementPercentage: number;
  achievedAt: string;
};

export type PbStreakEvent = {
  type: 'streak_pb';
  userId: string;
  subInstituteId: string;
  syear: string;
  previousLongest: number;
  newLongest: number;
  achievedAt: string;
};

export type PbMasteryEvent = {
  type: 'mastery_pb';
  userId: string;
  subInstituteId: string;
  syear: string;
  concept: string;
  conceptId?: string;
  previousResult: number;
  newResult: number;
  masteryDuration?: number;
  masterySessionCount?: number;
  fastestMastery?: number;
  mountainSkyConcept: boolean;
  achievedAt: string;
};

export type PbSessionEvent = {
  type: 'session_pb';
  userId: string;
  subInstituteId: string;
  syear: string;
  recordType: string;
  previousValue: number;
  newValue: number;
  sessionStart: string;
  sessionEnd: string;
  conceptsCovered: string[];
  achievedAt: string;
};

export type PbNotificationEvent = {
  notificationType: 'fluency_pb' | 'streak_pb' | 'mastery_pb' | 'session_pb';
  userId: string;
  subInstituteId: string;
  syear: string;
  title: string;
  message: string;
  relatedConcept?: string;
  previousValue: number;
  newValue: number;
  improvement: number;
};

export type PbProcessResult = {
  processed: boolean;
  fluencyEvents: PbFluencyEvent[];
  streakEvent: PbStreakEvent | null;
  masteryEvents: PbMasteryEvent[];
  sessionEvents: PbSessionEvent[];
  notifications: PbNotificationEvent[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeFluency(questions: PalResultQuestion[]): Map<string, PbFluencyInput> {
  const byConcept = new Map<string, { total: number; correct: number; name: string }>();

  for (const q of questions) {
    const conceptName = q.conceptName?.trim() || 'General Concept';
    const group = byConcept.get(conceptName) ?? { total: 0, correct: 0, name: conceptName };
    group.total += 1;
    if (q.rightWrong === 'right') group.correct += 1;
    byConcept.set(conceptName, group);
  }

  const result = new Map<string, PbFluencyInput>();
  for (const [conceptName, group] of byConcept.entries()) {
    const fluency = group.total > 0 ? group.correct / group.total : 0;
    result.set(conceptName, {
      conceptId: conceptName,
      conceptName: group.name,
      fluency: round2(fluency),
      achievedAt: new Date().toISOString(),
    });
  }
  return result;
}

export function computeStreak(
  activityDate: string,
  currentStreak: number,
  longestStreak: number,
  lastActivityDate?: string | null
): PbStreakEvent | null {
  const today = new Date(activityDate).toISOString().slice(0, 10);
  const last = lastActivityDate?.slice(0, 10) || null;

  let newStreak: number;
  if (!last) {
    newStreak = 1;
  } else if (last === today) {
    newStreak = currentStreak > 0 ? currentStreak : 1;
  } else {
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      newStreak = currentStreak + 1;
    } else {
      newStreak = 1;
    }
  }

  if (newStreak > longestStreak && newStreak > 0) {
    return {
      type: 'streak_pb',
      userId: '',
      subInstituteId: '',
      syear: '',
      previousLongest: longestStreak,
      newLongest: newStreak,
      achievedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function computeMasteryPBs(
  mastery: PalConceptMastery[],
  existingRecords: Map<string, { masteryResult: number; fastestMastery?: number; masterySessionCount?: number }>
): PbMasteryEvent[] {
  const events: PbMasteryEvent[] = [];
  const now = new Date().toISOString();

  for (const concept of mastery) {
    const key = concept.conceptName;
    const prev = existingRecords.get(key);
    const prevResult = prev?.masteryResult ?? 0;
    const prevFastest = prev?.fastestMastery;
    const prevSessions = prev?.masterySessionCount;

    if (concept.masteryLevel > prevResult) {
      events.push({
        type: 'mastery_pb',
        userId: '',
        subInstituteId: '',
        syear: '',
        concept: concept.conceptName,
        conceptId: concept.conceptName,
        previousResult: prevResult,
        newResult: concept.masteryLevel,
        fastestMastery: concept.masteryLevel >= 70 ? (prevFastest ?? concept.masteryLevel) : undefined,
        masterySessionCount: prevSessions ?? concept.attempted,
        mountainSkyConcept: concept.status === 'mastered',
        achievedAt: now,
      });
    }
  }
  return events;
}

export function computeSessionPBs(
  sessionStart: string,
  sessionEnd: string,
  conceptsCovered: string[],
  existingRecords: Map<string, { previousValue: number; newValue?: number }>
): PbSessionEvent[] {
  const events: PbSessionEvent[] = [];
  const now = new Date().toISOString();
  const start = new Date(sessionStart).getTime();
  const end = new Date(sessionEnd).getTime();
  const durationMinutes = Math.max(0, (end - start) / (1000 * 60));

  const uniqueConcepts = Array.from(new Set(conceptsCovered));

  const candidates: { type: PbSessionInput['recordType']; value: number }[] = [
    { type: 'longest_productive_session', value: round2(durationMinutes) },
    { type: 'most_concepts_in_one_day', value: uniqueConcepts.length },
  ];

  for (const candidate of candidates) {
    const prev = existingRecords.get(candidate.type);
    if (!prev || candidate.value > prev.previousValue) {
      events.push({
        type: 'session_pb',
        userId: '',
        subInstituteId: '',
        syear: '',
        recordType: candidate.type,
        previousValue: prev?.previousValue ?? 0,
        newValue: candidate.value,
        sessionStart,
        sessionEnd,
        conceptsCovered: uniqueConcepts,
        achievedAt: now,
      });
    }
  }

  return events;
}

export function buildNotifications(events: PbProcessResult): PbNotificationEvent[] {
  const notifications: PbNotificationEvent[] = [];

  for (const fe of events.fluencyEvents) {
    const improvement = round2(fe.newBest - fe.previousBest);
    notifications.push({
      notificationType: 'fluency_pb',
      userId: fe.userId,
      subInstituteId: fe.subInstituteId,
      syear: fe.syear,
      title: 'New Fluency Personal Best!',
      message: `You achieved ${(fe.newBest * 100).toFixed(0)}% fluency in ${fe.conceptName}, up from ${(fe.previousBest * 100).toFixed(0)}%.`,
      relatedConcept: fe.conceptName,
      previousValue: fe.previousBest,
      newValue: fe.newBest,
      improvement,
    });
  }

  if (events.streakEvent) {
    const se = events.streakEvent;
    notifications.push({
      notificationType: 'streak_pb',
      userId: se.userId,
      subInstituteId: se.subInstituteId,
      syear: se.syear,
      title: 'New Streak Personal Best!',
      message: `You reached a ${se.newLongest}-day learning streak!`,
      previousValue: se.previousLongest,
      newValue: se.newLongest,
      improvement: se.newLongest - se.previousLongest,
    });
  }

  for (const me of events.masteryEvents) {
    const improvement = round2(me.newResult - me.previousResult);
    notifications.push({
      notificationType: 'mastery_pb',
      userId: me.userId,
      subInstituteId: me.subInstituteId,
      syear: me.syear,
      title: 'New Mastery Personal Best!',
      message: `You improved mastery in ${me.concept} to ${me.newResult}%.`,
      relatedConcept: me.concept,
      previousValue: me.previousResult,
      newValue: me.newResult,
      improvement,
    });
  }

  for (const se of events.sessionEvents) {
    const improvement = round2(se.newValue - se.previousValue);
    const label = se.recordType.replace(/_/g, ' ');
    notifications.push({
      notificationType: 'session_pb',
      userId: se.userId,
      subInstituteId: se.subInstituteId,
      syear: se.syear,
      title: 'New Session Personal Best!',
      message: `You set a new best for ${label}: ${se.newValue}.`,
      previousValue: se.previousValue,
      newValue: se.newValue,
      improvement,
    });
  }

  return notifications;
}
