/**
 * Assessments — types.
 *
 * Ported from g2gv0's `services/competency/assessment-workspace.ts`,
 * `services/competency/assessment-review.ts` and
 * `services/competency/ai-assessment.ts`. Shapes are preserved exactly; only
 * the transport (in assessments-service.ts) was re-pointed at this repo's
 * erp-client conventions and the `api/g2g-lms/assessments/*` endpoint
 * contract.
 */

/* ─── Review cycles (assessment-workspace.ts) ──────────────────────────────── */

export interface AssessmentCycleMetrics {
  active_campaigns: number
  overall_completion_percent: number
  completed_assessments: number
  total_assessments: number
  pending_manager_ratings: number
  pending_calibration: number
}

export interface AssessmentCycle {
  id: string
  name: string
  type: string
  /** The framework the campaign assesses against; null for ad-hoc campaigns. */
  framework_id?: number | null
  framework_name?: string | null
  participants: number
  completion: number
  status: string
  date: string
  start_date?: string | null
}

/** A participant assessment row for the workspace top tabs. */
export interface AssessmentRow {
  assessment_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  campaign: string
  self: boolean
  manager: boolean
  score: number | null
  status: string
  review_status: string | null
  date: string | null
}

export interface AssessmentParticipant {
  id: string
  assessment_id: string
  name: string
  initials: string
  emp_id: string
  role: string
  self: boolean
  manager: boolean
  status: string
  self_date: string | null
  manager_date: string | null
}

export interface CreateCampaignPayload {
  name: string
  type?: string
  framework_id?: number
  start_date?: string
  end_date?: string
}

/* ─── Assessment review (tests / attempts / proposals) ─────────────────────── */

export interface AssessmentTestRow {
  id: number
  title: string
  status: 'draft' | 'published' | 'superseded' | string
  scope_type: 'jobrole' | 'competency' | 'kasba_item' | string
  model: string | null
  published_at: string | null
  time_limit_minutes: number | null
  pass_percent: number | null
  is_open: number
  jobrole: string | null
  competency_name: string | null
  questions: number
  assigned: number
  submitted: number
  awaiting_review: number
}

export interface AssessmentQuestionFull {
  id: number
  format: string
  question_text: string
  options: string[] | null
  /** Admin eyes only. */
  correct_option: string | null
  /** Admin eyes only. */
  model_answer: string | null
  max_score: number
  sort_order: number
  cited_item_label: string | null
  cited_kasba_type: string | null
  cited_competency_name: string | null
  cited_required_proficiency: string | null
}

export interface AttemptRow {
  id: number
  test_id: number
  user_id: number
  employee: string
  title: string
  due_date: string | null
  started_at: string | null
  submitted_at: string | null
  total_score: number | null
  max_score: number | null
  percent: number | null
  pass_percent: number | null
  awaiting_review: number
  status: string
}

export interface AttemptAnswer {
  question_id: number
  response_id: number | null
  format: string
  question_text: string
  options: string[] | null
  correct_option: string | null
  model_answer: string | null
  max_score: number
  cited_item_label: string | null
  cited_kasba_type: string | null
  answer_text: string | null
  selected_option: string | null
  /** Null means NOT YET MARKED. It does not mean zero. */
  score: number | null
  scored_by: 'auto' | 'ai' | 'manual' | null
  answered_at: string | null
}

export interface ProposalRow {
  id: number
  user_id: number
  employee: string
  item_label: string | null
  kasba_type: string | null
  competency_name: string | null
  test_title: string | null
  questions: number
  scored_percent: number | null
  /** Null when too few questions were scored to justify proposing anything. */
  proposed_rating: number | null
  current_rating: number | null
  status: string
  decided_at: string | null
}

export type RatingBands = Record<string, { min: number; label: string }>

/* ─── My assessment (ai-assessment.ts) ─────────────────────────────────────── */

export interface AttemptResult {
  attempt_id: number
  score: number
  max_score: number
  percent: number | null
  awaiting_review: number
  proposals: number
  /** True when written answers still need marking. Ask for it separately. */
  marking_pending: boolean
}

export interface StartResult {
  attempt_id: number
  started_at: string | null
  time_limit_minutes: number | null
  /** Server-computed. Null when the test has no limit. Never negative. */
  seconds_remaining: number | null
  submitted_at: string | null
}

/** A rating this result SUGGESTS — never one it applied. */
export interface RatingProposal {
  item_label: string | null
  kasba_type: string | null
  questions: number
  scored_percent: number | null
  proposed_rating: number | null
  current_rating: number | null
  status: 'pending' | 'approved' | 'rejected' | string
}

export interface MyResult {
  attempt: {
    id: number
    test_id: number
    title: string
    percent: number | null
    total_score: number | null
    max_score: number | null
    awaiting_review: number
    pass_percent: number | null
    submitted_at: string | null
    status: string
  }
  questions: Array<{
    id: number
    question_text: string
    format: string
    max_score: number
    cited_item_label: string | null
    cited_kasba_type: string | null
    cited_competency_name: string | null
    /** Your score. Null means not yet marked - NOT zero. */
    score: number | null
    scored_by: 'auto' | 'ai' | 'manual' | null
    answered_at: string | null
  }>
  proposals: RatingProposal[]
  /** Null when the test sets no pass mark, so it makes no pass/fail claim. */
  passed: boolean | null
  bands: Record<string, { min: number; label: string }>
}

export interface AiQuestion {
  id: number
  format: 'mcq' | 'short_answer' | string
  question_text: string
  /** MCQ choices; null for short_answer. */
  options: string[] | null
  max_score: number
  /** The caller's own previous answer, if they have one. */
  answer_text: string | null
  selected_option: string | null
  answered_at: string | null
}

export interface AiTest {
  id: number
  title: string
  instructions: string | null
  published_at: string | null
}

export interface MyTestResult {
  test: AiTest | null
  questions: AiQuestion[]
  total: number
  answered: number
  /** Outstanding, never reported as a score of nothing. */
  unanswered: number
  submitted: boolean
  empty_is_expected: boolean
  empty_reason: string | null
}
