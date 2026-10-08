// Shape of the "Outcomes & Delivery" tab: local view models plus the API
// contract they are built from. Mirrored by hand from
// app/Http/Controllers/api/lms/CurriculumOutcomesApiController.php and
// app/Services/Curriculum/OutcomeAnalyticsService.php in next_lms_erp;
// there is no shared type package across the two repos.

export type AchievementTier = 'exam_based' | 'pal_verified' | 'unavailable' | 'not_applicable';

/** Good (Achievement >= 75%) / Average (60-74%) / Needs attention (< 60%) - the reference report's own cut points, read from Achievement, never from Mastery. */
export type AchievementStatus = 'good' | 'average' | 'needs_attention';

export type AchievementSignal = {
  value: number;
  tier: AchievementTier;
  source: string | null;
};

/**
 * `value`/`mastery`/`source`/`status` are null exactly when `tier` is
 * 'unavailable' or 'not_applicable' - never a fabricated 0.
 *
 * `value` (Achievement) and `mastery` (Mastery) are genuinely different
 * numbers for the pal_verified tier: Achievement is the pass-rate against
 * each concept's own mastery_gate, Mastery is the mean of the raw
 * continuous p_mastery probability - a concept just under its gate still
 * has real, non-zero mastery. For the exam_based tier a diagnostic attempt
 * gives only one number, so the two coincide.
 *
 * `secondary` is the broader exam-based signal carried alongside a
 * pal_verified primary for comparison, null when no second signal exists.
 */
export type AchievementBlock = {
  value: number | null;
  mastery: number | null;
  tier: AchievementTier;
  source: string | null;
  status: AchievementStatus | null;
  secondary: AchievementSignal | null;
};

export type DeliveredStatus = 'delivered' | 'in_progress' | 'not_started' | 'not_applicable';
export type AssessedStatus = 'assessed' | 'not_assessed' | 'not_applicable';
export type GapCategory = 'delivery_gap' | 'assessment_gap' | 'learning_gap' | 'none' | 'not_applicable';
export type HealthStatus = 'on_track' | 'needs_attention' | 'at_risk';

export type OutcomeTrackerRow = {
  outcome_id: number;
  code: string | null;
  description: string | null;
  type: string | null;
  chapter_id: number | null;
  chapter_name: string | null;
  delivered: DeliveredStatus;
  assessed: AssessedStatus;
  achievement: AchievementBlock;
  gap_category: GapCategory;
};

export type OutcomeKpis = {
  expected_outcomes: { total: number; chapter_mapped: number; curriculum_level: number };
  delivered: { count: number; percent: number };
  achieved: {
    count: number;
    percent: number;
    tier_breakdown: { exam_based: number; pal_verified: number; unavailable: number };
  };
  delivery_gap: { count: number };
  resource_coverage: { percent: number };
  assessment_coverage: { percent: number };
};

/** A competency ("LO") with its leaf learning_outcome children ("LI") nested beneath. */
export type LoRow = Omit<OutcomeTrackerRow, 'type'> & {
  indicators: Omit<OutcomeTrackerRow, 'type'>[];
};

/** Real `pal_concept_mastery.band` keys for this curriculum's mapped concepts -> row count. Keys are whatever the school's Administration mastery-band config defines; never forced into a fixed scale. */
export type MasteryDistribution = Record<string, number>;

/** Real `content_master.file_type` values among this curriculum's resources -> count. */
export type ResourceBreakdown = Record<string, number>;

export type StudentScore = { value: number | null; tier: AchievementTier };

export type StudentRow = {
  student_id: number;
  name: string;
  roll_no: string | number | null;
  /** Keyed by outcome_id (as a string key once this crosses JSON). */
  scores: Record<string, StudentScore>;
  summary: { achieved_count: number; assessed_count: number; total_outcomes: number; mean: number | null };
};

export type StudentRowsPayload = {
  students: StudentRow[];
  outcomes: Array<{ outcome_id: number; code: string | null }>;
  /** Set instead of an empty `students` array when there is nothing to show, e.g. no student-level evidence recorded yet. */
  note: string | null;
};

export type OutcomeSummaryApiData = {
  curriculum: {
    curriculum_id: number;
    curriculum_name: string | null;
    standard_id: number;
    subject_id: number;
    syear: number | null;
  };
  health_status: HealthStatus;
  kpis: OutcomeKpis;
  tracker_rows: OutcomeTrackerRow[];
  lo_rows: LoRow[];
  gaps: {
    delivery_gaps: OutcomeTrackerRow[];
    assessment_gaps: OutcomeTrackerRow[];
    learning_gaps: OutcomeTrackerRow[];
  };
  resource_breakdown: ResourceBreakdown;
  mastery_distribution: MasteryDistribution;
  student_rows: StudentRowsPayload;
};

export type OutcomeSummaryApiResponse = {
  status?: boolean;
  message?: string;
  data?: OutcomeSummaryApiData | null;
};

export type OutcomeDetailApiData = {
  outcome_id: number;
  code: string | null;
  type: string | null;
  description: string | null;
  parent: { id: number; code: string | null; description: string | null } | null;
  chapter: { chapter_id: number; chapter_name: string | null; subject_id: number | null; standard_id: number | null } | null;
  delivery: {
    status: string;
    total_periods: number;
    completed_periods: number;
    start_date: string | null;
    end_date: string | null;
  } | null;
  assessment: { chapter_question_count: number; concept_level_question_count: number } | null;
  resources: { chapter_resource_count: number; breakdown: Record<string, number> } | null;
  achievement: AchievementBlock;
  mapped_concepts: Array<{
    concept_id: number;
    concept_name: string | null;
    match_source: string;
    match_score: number | null;
    pal_mastery_pct: number | null;
  }>;
  gap_category: GapCategory;
  gap_explanation: string;
  links: { concept_intelligence: string; coherence_map: string; question_bank: string } | null;
};

export type OutcomeDetailApiResponse = {
  status?: boolean;
  message?: string;
  data?: OutcomeDetailApiData | null;
};
