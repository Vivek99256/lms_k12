export type ChallengeType =
    | 'mastery_sprint'
    | 'collective_fluency'
    | 'peer_teaching'
    | 'exploration';

export type ChallengeStatus =
    | 'draft'
    | 'active'
    | 'ended'
    | 'completed';

export type TargetMetric =
    | 'concepts_mastered'
    | 'total_fluency'
    | 'peer_help_count'
    | 'content_explored';

export type RewardType =
    | 'points'
    | 'badge'
    | 'certificate';

export type ContributionEvent =
    | 'mastery'
    | 'fluency'
    | 'peer_help'
    | 'exploration';

export type ContributionStatus =
    | 'counted'
    | 'skipped';

export type ParticipantStatus =
    | 'active'
    | 'removed';

export type ProgressStatus =
    | 'in_progress'
    | 'completed'
    | 'ended';

export interface TeamChallengeRow {
    id: number;
    title: string;
    description: string | null;
    challenge_type: ChallengeType;
    target_type: TargetMetric;
    target_value: number;
    reward_type: RewardType | null;
    reward_value: string | null;
    status: ChallengeStatus;
    created_by: number;
    sub_institute_id: number;
    syear: number;
    grade_id: number | null;
    standard_id: number | null;
    division_id: number | null;
    start_date: Date | null;
    deadline: Date | null;
    ended_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface TeamChallengeParticipantRow {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    joined_at: Date;
    status: ParticipantStatus;
}

export interface TeamChallengeContributionRow {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    event_type: ContributionEvent;
    source_id: string | null;
    value: number;
    idempotency_key: string;
    status: ContributionStatus;
    created_at: Date;
    updated_at: Date;
}

export interface TeamChallengeProgressRow {
    id: number;
    team_challenge_id: number;
    total_participants: number;
    active_contributors: number;
    aggregate_value: number;
    target_value: number;
    progress_percentage: number;
    status: ProgressStatus;
    last_updated: Date;
    updated_at: Date;
}

export interface TeamChallenge {
    id: number;
    title: string;
    description: string | null;
    challenge_type: ChallengeType;
    target_type: TargetMetric;
    target_value: number;
    reward_type: RewardType | null;
    reward_value: string | null;
    status: ChallengeStatus;
    created_by: number;
    sub_institute_id: number;
    syear: number;
    grade_id: number | null;
    standard_id: number | null;
    division_id: number | null;
    start_date: string | null;
    deadline: string | null;
    ended_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ChallengeParticipant {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    joined_at: string;
    status: ParticipantStatus;
}

export interface ChallengeContribution {
    id: number;
    team_challenge_id: number;
    user_id: number;
    sub_institute_id: number;
    syear: number;
    event_type: ContributionEvent;
    source_id: string | null;
    value: number;
    idempotency_key: string;
    status: ContributionStatus;
    created_at: string;
    updated_at: string;
}

export interface ChallengeProgressSnapshot {
    id: number;
    team_challenge_id: number;
    total_participants: number;
    active_contributors: number;
    aggregate_value: number;
    target_value: number;
    progress_percentage: number;
    status: ProgressStatus;
    last_updated: string;
    updated_at: string;
}

export interface ChallengeProgress {
    team_challenge_id: number;
    total_participants: number;
    active_contributors: number;
    aggregate_value: number;
    target_value: number;
    progress_percentage: number;
    status: ProgressStatus;
    is_completed: boolean;
}

export interface ChallengeWithProgress extends TeamChallenge {
    progress: ChallengeProgress;
    participant_count: number;
    has_joined: boolean;
    can_join: boolean;
    can_contribute: boolean;
}

export interface TeamChallengeCreateData {
    title: string;
    description?: string | null;
    challenge_type: ChallengeType;
    target_type: TargetMetric;
    target_value: number;
    reward_type?: RewardType | null;
    reward_value?: string | null;
    grade_id?: number | null;
    standard_id?: number | null;
    division_id?: number | null;
    start_date?: string | Date | null;
    deadline?: string | Date | null;
}

export interface TeamChallengeUpdateData {
    title?: string;
    description?: string | null;
    challenge_type?: ChallengeType;
    target_type?: TargetMetric;
    target_value?: number;
    reward_type?: RewardType | null;
    reward_value?: string | null;
    status?: ChallengeStatus;
    start_date?: string | Date | null;
    deadline?: string | Date | null;
    ended_at?: string | Date | null;
}

export interface ContributionInput {
    team_challenge_id: number;
    user_id: number;
    event_type: ContributionEvent;
    source_id?: string | null;
    value?: number;
    idempotency_key: string;
}

export interface ChallengeContext {
    sub_institute_id: number;
    syear: number;
    user_id: number;
}
