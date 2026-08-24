export interface SessionSummaryRow {
    id: number;
    sessionId: string;
    userId: string;
    subInstituteId: string;
    syear: string;
    sessionStart: string | null;
    sessionEnd: string | null;
    completionState: string;
    totalConcepts: number;
    totalQuestions: number;
    obtainMarks: number;
    totalMarks: number;
    accuracy: number;
    createdAt: string;
    updatedAt: string;
}

export interface SessionSummaryConceptRow {
    id: number;
    summaryId: number;
    conceptId: string | null;
    conceptName: string;
    masteryBefore: number;
    masteryAfter: number;
    masteryChange: number;
    accuracy: number;
    attempted: number;
    correct: number;
    sortOrder: number;
    createdAt: string;
}

export interface SessionSummaryPraiseRow {
    id: number;
    summaryId: number;
    praiseText: string;
    reason: string;
    sourceType: string | null;
    conceptName: string | null;
    sortOrder: number;
    createdAt: string;
}

export interface SessionSummaryUpcomingRow {
    id: number;
    summaryId: number;
    conceptId: string | null;
    conceptName: string;
    reason: string | null;
    expectedTiming: string | null;
    sortOrder: number;
    createdAt: string;
}

export interface SessionSummaryConcept {
    conceptId: string | null;
    conceptName: string;
    masteryBefore: number;
    masteryAfter: number;
    masteryChange: number;
    accuracy: number;
    attempted: number;
    correct: number;
}

export interface SessionSummaryPraise {
    praiseText: string;
    reason: string;
    sourceType: string | null;
    conceptName: string | null;
}

export interface SessionSummaryUpcoming {
    conceptId: string | null;
    conceptName: string;
    reason: string | null;
    expectedTiming: string | null;
}

export interface SessionSummary {
    sessionId: string;
    userId: string;
    subInstituteId: string;
    syear: string;
    sessionStart: string | null;
    sessionEnd: string | null;
    completionState: string;
    totalConcepts: number;
    totalQuestions: number;
    obtainMarks: number;
    totalMarks: number;
    accuracy: number;
    conceptsWorkedOn: SessionSummaryConcept[];
    specificPraise: SessionSummaryPraise[];
    upcoming: SessionSummaryUpcoming[];
    streak: {
        currentStreak: number;
        longestStreak: number;
        lastActivityDate: string | null;
    } | null;
    careerQuestUpdate: {
        currentStage: string;
        stageLabel: string;
        stageDescription: string;
        activityCount: number;
        masteredSkillCount: number;
        totalSkillCount: number;
    } | null;
    badgesEarned: Array<{
        badgeCode: string;
        badgeName: string;
        category: string;
        description: string;
        earnedAt: string;
    }>;
}

export interface SessionSummaryStore {
    getSummary(
        userId: string,
        subInstituteId: string,
        syear: string,
        sessionId: string
    ): Promise<SessionSummaryRow | null>;

    getConcepts(summaryId: number): Promise<SessionSummaryConceptRow[]>;

    getPraise(summaryId: number): Promise<SessionSummaryPraiseRow[]>;

    getUpcoming(summaryId: number): Promise<SessionSummaryUpcomingRow[]>;

    insertSummary(input: {
        sessionId: string;
        userId: string;
        subInstituteId: string;
        syear: string;
        sessionStart: string | null;
        sessionEnd: string | null;
        completionState: string;
        totalConcepts: number;
        totalQuestions: number;
        obtainMarks: number;
        totalMarks: number;
        accuracy: number;
    }): Promise<SessionSummaryRow>;

    insertConcept(
        summaryId: number,
        concept: {
            conceptId: string | null;
            conceptName: string;
            masteryBefore: number;
            masteryAfter: number;
            masteryChange: number;
            accuracy: number;
            attempted: number;
            correct: number;
            sortOrder: number;
        }
    ): Promise<SessionSummaryConceptRow>;

    insertPraise(
        summaryId: number,
        praise: {
            praiseText: string;
            reason: string;
            sourceType: string | null;
            conceptName: string | null;
            sortOrder: number;
        }
    ): Promise<SessionSummaryPraiseRow>;

    insertUpcoming(
        summaryId: number,
        upcoming: {
            conceptId: string | null;
            conceptName: string;
            reason: string | null;
            expectedTiming: string | null;
            sortOrder: number;
        }
    ): Promise<SessionSummaryUpcomingRow>;

    close(): Promise<void>;
}

export function createMockSessionSummaryStore(): SessionSummaryStore {
    return {
        getSummary: async () => null,
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
        insertSummary: async () => ({ id: 0, sessionId: '', userId: '', subInstituteId: '', syear: '', sessionStart: null, sessionEnd: null, completionState: 'completed', totalConcepts: 0, totalQuestions: 0, obtainMarks: 0, totalMarks: 0, accuracy: 0, createdAt: '', updatedAt: '' }),
        insertConcept: async () => ({ id: 0, summaryId: 0, conceptId: null, conceptName: '', masteryBefore: 0, masteryAfter: 0, masteryChange: 0, accuracy: 0, attempted: 0, correct: 0, sortOrder: 0, createdAt: '' }),
        insertPraise: async () => ({ id: 0, summaryId: 0, praiseText: '', reason: '', sourceType: null, conceptName: null, sortOrder: 0, createdAt: '' }),
        insertUpcoming: async () => ({ id: 0, summaryId: 0, conceptId: null, conceptName: '', reason: null, expectedTiming: null, sortOrder: 0, createdAt: '' }),
        close: async () => {},
    };
}
