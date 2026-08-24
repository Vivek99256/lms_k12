import type {
    SessionSummary,
    SessionSummaryConcept,
    SessionSummaryPraise,
    SessionSummaryUpcoming,
    SessionSummaryStore,
} from './ss-types';
import type { PalPbStore } from './pal-pb-store';
import type { PalCqStore } from './cq-store';

export interface PalSsService {
    getSessionSummary(
        userId: string,
        subInstituteId: string,
        syear: string,
        sessionId: string
    ): Promise<SessionSummary | null>;
}

export function createPalSsService(
    store: SessionSummaryStore,
    pbStore: PalPbStore,
    cqStore: PalCqStore
): PalSsService {
    return {
        async getSessionSummary(userId, subInstituteId, syear, sessionId) {
            const summaryRow = await store.getSummary(userId, subInstituteId, syear, sessionId);
            if (!summaryRow) {
                return null;
            }

            const [conceptRows, praiseRows, upcomingRows] = await Promise.all([
                store.getConcepts(summaryRow.id),
                store.getPraise(summaryRow.id),
                store.getUpcoming(summaryRow.id),
            ]);

            const conceptsWorkedOn: SessionSummaryConcept[] = conceptRows.map((row) => ({
                conceptId: row.conceptId,
                conceptName: row.conceptName,
                masteryBefore: row.masteryBefore,
                masteryAfter: row.masteryAfter,
                masteryChange: row.masteryChange,
                accuracy: row.accuracy,
                attempted: row.attempted,
                correct: row.correct,
            }));

            const specificPraise: SessionSummaryPraise[] = praiseRows.map((row) => ({
                praiseText: row.praiseText,
                reason: row.reason,
                sourceType: row.sourceType,
                conceptName: row.conceptName,
            }));

            const upcoming: SessionSummaryUpcoming[] = upcomingRows.map((row) => ({
                conceptId: row.conceptId,
                conceptName: row.conceptName,
                reason: row.reason,
                expectedTiming: row.expectedTiming,
            }));

            let streak = null;
            try {
                const streakRecord = await pbStore.getStreakRecord(userId, subInstituteId, syear);
                if (streakRecord) {
                    streak = {
                        currentStreak: streakRecord.currentStreak,
                        longestStreak: streakRecord.longestStreak,
                        lastActivityDate: streakRecord.lastActivityDate,
                    };
                }
            } catch {
                streak = null;
            }

            let careerQuestUpdate = null;
            try {
                const cqState = await cqStore.getCareerQuestState(userId, subInstituteId, syear);
                if (cqState) {
                    const summary = await cqStore.getCareerQuestSummary(
                        userId,
                        subInstituteId,
                        syear,
                        cqState.primaryPathwayId,
                        cqState.secondaryPathwayId
                    );
                    careerQuestUpdate = {
                        currentStage: summary.currentStage,
                        stageLabel: summary.stageLabel,
                        stageDescription: summary.stageDescription,
                        activityCount: summary.activityCount,
                        masteredSkillCount: summary.masteredSkillCount,
                        totalSkillCount: summary.totalSkillCount,
                    };
                }
            } catch {
                careerQuestUpdate = null;
            }

            let badgesEarned: SessionSummary['badgesEarned'] = [];
            try {
                const allBadges = await pbStore.getNotifications(userId, subInstituteId, syear, 100);
                const recentBadges = allBadges.filter((n) => {
                    const createdAt = new Date(n.createdAt);
                    const sessionEnd = summaryRow.sessionEnd ? new Date(summaryRow.sessionEnd) : null;
                    if (!sessionEnd) return true;
                    const diffMs = sessionEnd.getTime() - createdAt.getTime();
                    const diffMins = Math.abs(diffMs) / (1000 * 60);
                    return diffMins <= 60;
                });
                badgesEarned = recentBadges.map((n) => ({
                    badgeCode: n.notificationType.replace('_pb', '').toUpperCase(),
                    badgeName: n.title,
                    category: 'Gamification',
                    description: n.message,
                    earnedAt: n.createdAt,
                }));
            } catch {
                badgesEarned = [];
            }

            return {
                sessionId: summaryRow.sessionId,
                userId: summaryRow.userId,
                subInstituteId: summaryRow.subInstituteId,
                syear: summaryRow.syear,
                sessionStart: summaryRow.sessionStart,
                sessionEnd: summaryRow.sessionEnd,
                completionState: summaryRow.completionState,
                totalConcepts: summaryRow.totalConcepts,
                totalQuestions: summaryRow.totalQuestions,
                obtainMarks: summaryRow.obtainMarks,
                totalMarks: summaryRow.totalMarks,
                accuracy: summaryRow.accuracy,
                conceptsWorkedOn,
                specificPraise,
                upcoming,
                streak,
                careerQuestUpdate,
                badgesEarned,
            };
        },
    };
}
