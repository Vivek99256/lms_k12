import type { PalTcStore } from './tc-store';
import type {
    TeamChallengeRow,
    TeamChallengeParticipantRow,
    TeamChallengeContributionRow,
    TeamChallengeProgressRow,
    TeamChallenge,
    ChallengeParticipant,
    ChallengeContribution,
    ChallengeProgress,
    ChallengeWithProgress,
    TeamChallengeCreateData,
    TeamChallengeUpdateData,
    ContributionInput,
    ChallengeContext,
} from './tc-types';

export interface TeamChallengeDetail {
    challenge: TeamChallenge;
    participants: ChallengeParticipant[];
    progress: ChallengeProgress | null;
    contributions: ChallengeContribution[];
}

export interface PalTcService {
    fetchTeamChallenges: (ctx: ChallengeContext) => Promise<ChallengeWithProgress[]>;
    fetchChallengeDetail: (challengeId: number, ctx: ChallengeContext) => Promise<TeamChallengeDetail | null>;
    createTeamChallenge: (data: TeamChallengeCreateData, ctx: ChallengeContext) => Promise<number>;
    updateTeamChallenge: (id: number, data: TeamChallengeUpdateData, ctx: ChallengeContext) => Promise<boolean>;
    endTeamChallenge: (id: number, ctx: ChallengeContext) => Promise<boolean>;
    joinChallenge: (challengeId: number, ctx: ChallengeContext) => Promise<boolean>;
    submitContribution: (challengeId: number, input: Omit<ContributionInput, 'team_challenge_id' | 'user_id'>, ctx: ChallengeContext) => Promise<ChallengeProgress | null>;
    fetchChallengeProgress: (challengeId: number, ctx: ChallengeContext) => Promise<ChallengeProgress | null>;
}

function mapRowToChallenge(row: TeamChallengeRow): TeamChallenge {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        challenge_type: row.challenge_type,
        target_type: row.target_type,
        target_value: Number(row.target_value),
        reward_type: row.reward_type,
        reward_value: row.reward_value,
        status: row.status,
        created_by: row.created_by,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        grade_id: row.grade_id,
        standard_id: row.standard_id,
        division_id: row.division_id,
        start_date: row.start_date ? row.start_date.toISOString() : null,
        deadline: row.deadline ? row.deadline.toISOString() : null,
        ended_at: row.ended_at ? row.ended_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

function mapRowToParticipant(row: TeamChallengeParticipantRow): ChallengeParticipant {
    return {
        id: row.id,
        team_challenge_id: row.team_challenge_id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        joined_at: row.joined_at.toISOString(),
        status: row.status,
    };
}

function mapRowToContribution(row: TeamChallengeContributionRow): ChallengeContribution {
    return {
        id: row.id,
        team_challenge_id: row.team_challenge_id,
        user_id: row.user_id,
        sub_institute_id: row.sub_institute_id,
        syear: row.syear,
        event_type: row.event_type,
        source_id: row.source_id,
        value: Number(row.value),
        idempotency_key: row.idempotency_key,
        status: row.status,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

function mapRowToProgress(row: TeamChallengeProgressRow): ChallengeProgress {
    const isCompleted = row.status === 'completed' || row.progress_percentage >= 100;
    return {
        team_challenge_id: row.team_challenge_id,
        total_participants: row.total_participants,
        active_contributors: row.active_contributors,
        aggregate_value: Number(row.aggregate_value),
        target_value: Number(row.target_value),
        progress_percentage: Number(row.progress_percentage),
        status: row.status,
        is_completed: isCompleted,
    };
}

export function createPalTcService(store: PalTcStore): PalTcService {
    return {
        async fetchTeamChallenges(ctx: ChallengeContext): Promise<ChallengeWithProgress[]> {
            const challengeRows = await store.fetchChallenges(ctx);
            const now = new Date();
            const results: ChallengeWithProgress[] = [];

            for (const row of challengeRows) {
                const challenge = mapRowToChallenge(row);
                const progressRow = await store.fetchProgress(challenge.id, ctx);
                const participantRows = await store.fetchParticipants(challenge.id, ctx);
                const progress = progressRow ? mapRowToProgress(progressRow) : null;

                const isActive = challenge.status === 'active' &&
                    (!challenge.start_date || now >= new Date(challenge.start_date)) &&
                    (!challenge.deadline || now <= new Date(challenge.deadline));

                results.push({
                    ...challenge,
                    progress: progress ?? {
                        team_challenge_id: challenge.id,
                        total_participants: participantRows.length,
                        active_contributors: 0,
                        aggregate_value: 0,
                        target_value: challenge.target_value,
                        progress_percentage: 0,
                        status: 'in_progress' as const,
                        is_completed: false,
                    },
                    participant_count: participantRows.length,
                    has_joined: participantRows.some(p => p.user_id === ctx.user_id && p.status === 'active'),
                    can_join: isActive && !participantRows.some(p => p.user_id === ctx.user_id && p.status === 'active'),
                    can_contribute: isActive && participantRows.some(p => p.user_id === ctx.user_id && p.status === 'active'),
                });
            }

            return results;
        },

        async fetchChallengeDetail(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<TeamChallengeDetail | null> {
            const row = await store.fetchChallengeById(challengeId, ctx);
            if (!row) return null;

            const challenge = mapRowToChallenge(row);
            const participantRows = await store.fetchParticipants(challengeId, ctx);
            const progressRow = await store.fetchProgress(challengeId, ctx);
            const contributionRows = await store.fetchContributions(challengeId, ctx);

            return {
                challenge,
                participants: participantRows.map(mapRowToParticipant),
                progress: progressRow ? mapRowToProgress(progressRow) : null,
                contributions: contributionRows.map(mapRowToContribution),
            };
        },

        async createTeamChallenge(
            data: TeamChallengeCreateData,
            ctx: ChallengeContext
        ): Promise<number> {
            return store.createChallenge(data, ctx);
        },

        async updateTeamChallenge(
            id: number,
            data: TeamChallengeUpdateData,
            ctx: ChallengeContext
        ): Promise<boolean> {
            return store.updateChallenge(id, data, ctx);
        },

        async endTeamChallenge(
            id: number,
            ctx: ChallengeContext
        ): Promise<boolean> {
            const updated = await store.updateChallenge(id, {
                status: 'ended',
                ended_at: new Date(),
            }, ctx);
            if (!updated) return false;

            await store.recomputeProgress(id, ctx);
            return true;
        },

        async joinChallenge(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<boolean> {
            const row = await store.fetchChallengeById(challengeId, ctx);
            if (!row) return false;

            const challenge = mapRowToChallenge(row);
            if (challenge.status !== 'active') return false;

            return store.addParticipant(challengeId, ctx.user_id, ctx);
        },

        async submitContribution(
            challengeId: number,
            input: Omit<ContributionInput, 'team_challenge_id' | 'user_id'>,
            ctx: ChallengeContext
        ): Promise<ChallengeProgress | null> {
            const challengeRow = await store.fetchChallengeById(challengeId, ctx);
            if (!challengeRow) return null;

            const challenge = mapRowToChallenge(challengeRow);
            if (challenge.status !== 'active') return null;

            const participantRows = await store.fetchParticipants(challengeId, ctx);
            const isParticipant = participantRows.some((p) => p.user_id === ctx.user_id && p.status === 'active');
            if (!isParticipant) return null;

            const fullInput: ContributionInput = {
                ...input,
                team_challenge_id: challengeId,
                user_id: ctx.user_id,
            };

            const contribution = await store.recordContribution(fullInput, ctx);
            if (!contribution) return null;

            const updatedProgress = await store.recomputeProgress(challengeId, ctx);
            return mapRowToProgress(updatedProgress);
        },

        async fetchChallengeProgress(
            challengeId: number,
            ctx: ChallengeContext
        ): Promise<ChallengeProgress | null> {
            const row = await store.fetchProgress(challengeId, ctx);
            if (!row) return null;
            return mapRowToProgress(row);
        },
    };
}
