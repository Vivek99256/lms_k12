export type ChallengeDifficulty = 'hard' | 'advanced';

export type ChallengeAttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export type ChallengeOptInStatus = 'opted_in' | 'opted_out';

export type ChallengeAvailabilityStatus = 'available' | 'unavailable' | 'ended';

export interface ChallengeRow {
    id: number;
    title: string;
    description: string | null;
    subject_id: string | null;
    concept_id: string | null;
    difficulty: ChallengeDifficulty;
    target_time_seconds: number;
    item_count: number;
    is_active: boolean;
    start_date: Date | null;
    end_date: Date | null;
    created_by: number;
    sub_institute_id: string;
    syear: string;
    created_at: Date;
    updated_at: Date;
}

export interface Challenge {
    id: number;
    title: string;
    description: string | null;
    subject_id: string | null;
    concept_id: string | null;
    difficulty: ChallengeDifficulty;
    target_time_seconds: number;
    item_count: number;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    created_by: number;
    sub_institute_id: string;
    syear: string;
    created_at: string;
    updated_at: string;
    availability_status: ChallengeAvailabilityStatus;
}

export interface ChallengeOptInRow {
    id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    is_opted_in: boolean;
    opted_in_at: Date;
    opted_out_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface ChallengeOptIn {
    id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    is_opted_in: boolean;
    opted_in_at: string;
    opted_out_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ChallengeAttemptRow {
    id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    opt_in_id: number | null;
    started_at: Date;
    completed_at: Date | null;
    total_items: number;
    valid_responses: number;
    correct_responses: number;
    accuracy: number;
    avg_time_per_item: number;
    speed_ratio: number;
    difficulty_coefficient: number;
    raw_score: number;
    is_qualified: boolean;
    attempt_status: ChallengeAttemptStatus;
    created_at: Date;
    updated_at: Date;
}

export interface ChallengeAttempt {
    id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    opt_in_id: number | null;
    started_at: string;
    completed_at: string | null;
    total_items: number;
    valid_responses: number;
    correct_responses: number;
    accuracy: number;
    avg_time_per_item: number;
    speed_ratio: number;
    difficulty_coefficient: number;
    raw_score: number;
    is_qualified: boolean;
    attempt_status: ChallengeAttemptStatus;
    created_at: string;
    updated_at: string;
}

export interface ChallengeResponseRow {
    id: number;
    attempt_id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    question_id: string | null;
    is_correct: boolean;
    response_time: number;
    difficulty: number;
    target_time: number;
    response_metadata: string | null;
    created_at: Date;
}

export interface ChallengeResponse {
    id: number;
    attempt_id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    question_id: string | null;
    is_correct: boolean;
    response_time: number;
    difficulty: number;
    target_time: number;
    response_metadata: string | null;
    created_at: string;
}

export interface ChallengeLeaderboardRow {
    id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    week_start: Date;
    week_number: number;
    year_number: number;
    score: number;
    rank: number | null;
    is_qualified: boolean;
    display_name: string;
    created_at: Date;
    updated_at: Date;
}

export interface ChallengeLeaderboardEntry {
    id: number;
    challenge_id: number;
    user_id: string;
    sub_institute_id: string;
    syear: string;
    week_start: string;
    week_number: number;
    year_number: number;
    score: number;
    rank: number | null;
    is_qualified: boolean;
    display_name: string;
    created_at: string;
    updated_at: string;
}

export interface ScoringResult {
    accuracy: number;
    avg_time_per_item: number;
    speed_ratio: number;
    difficulty_coefficient: number;
    raw_score: number;
    is_qualified: boolean;
    valid_responses: number;
    correct_responses: number;
    total_items: number;
}

export interface SubmitResponseInput {
    question_id: string | null;
    is_correct: boolean;
    response_time: number;
    difficulty: number;
    target_time: number;
    response_metadata?: Record<string, unknown> | null;
}

export interface CompleteAttemptInput {
    responses: SubmitResponseInput[];
}

export interface ChallengeContext {
    sub_institute_id: string;
    syear: string;
    user_id: string;
}
