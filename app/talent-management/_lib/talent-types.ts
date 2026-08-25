/**
 * Shared TypeScript types for the Talent Management module, ported from G2G's
 * `components/domain/talent/**` feature folders. Each feature area appends
 * its own delimited block below as it's ported.
 */

// ---- Administration types ----
// Ported from G2G's `components/domain/talent/administration/admin-data.ts`
// and `services/talent/admin-service.ts`.

export interface AdminKPI {
  id: string
  title: string
  value: string
  linkText: string
  icon: 'git-merge' | 'file-text' | 'users' | 'plug' | 'shield-check'
}

export interface WorkflowStage {
  step: number
  label: string
}

export interface WorkflowApprover {
  id: string
  role: string
  title: string
  initials: string
  approvalType: string
  escalation: string
}

export interface Workflow {
  id: string
  name: string
  module: string
  status: 'Active' | 'Draft' | 'Inactive'
  version: string
  description: string
  createdBy: string
  lastUpdated: string
  updatedBy: string
  stages: WorkflowStage[]
  approvers: WorkflowApprover[]
}

export interface AdminWorkflowsResponse {
  status: number
  message: string
  data: Omit<Workflow, 'stages' | 'approvers'>[]
  pagination: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export interface AdminWorkflowDetailResponse {
  status: number
  message: string
  data: Workflow
}

// ---- Performance types ----
//
// Ported verbatim from G2G's `services/talent/performance.ts` (type-only —
// this file carries no request logic, that lives in `performance-api.ts`).
// Field names, enum values and shapes are unchanged so they stay
// backend-shape-preserving against the parallel `/api/performance/*` port.

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

export interface PerfResponse<T> {
  status: number
  message: string
  data: T
}

export interface PerfPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface PerfListResponse<T> extends PerfResponse<T> {
  pagination: PerfPagination
}

export interface PerfSummaryListResponse<T, S> extends PerfListResponse<T> {
  summary: S
}

/* ------------------------------------------------------------------ *
 * Shared vocabulary (mirrors the Laravel enums exactly)
 * ------------------------------------------------------------------ */

export type ReviewStage = 'self_review' | 'manager_review' | 'calibration' | 'final_review' | 'completed'
export type ReviewStatus = 'pending' | 'in_progress' | 'completed'
export type DecisionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'
export type BonusStatus = DecisionStatus | 'paid'
export type CycleStatus = 'draft' | 'active' | 'calibration' | 'closed'
export type CycleType = 'annual' | 'half_yearly' | 'quarterly' | 'probation' | 'project'
export type GoalCategory = 'kra' | 'kpi' | 'okr' | 'competency' | 'project'
export type GoalStatus = 'draft' | 'active' | 'achieved' | 'partially_achieved' | 'missed' | 'cancelled'
export type Recommendation = 'promote' | 'retain' | 'pip' | 'exit' | 'lateral_move'
export type RevisionType = 'merit' | 'promotion' | 'market_correction' | 'retention' | 'probation_confirmation'
export type BonusType = 'performance' | 'retention' | 'spot' | 'festival' | 'referral' | 'project'
export type CalibrationStatus = 'scheduled' | 'in_progress' | 'completed' | 'locked'
export type PerfTab = 'goals' | 'reviews' | 'appraisals' | 'compensation' | 'bonus' | 'calibration'

export interface PerfOption {
  value: string
  label: string
}

export interface CycleOption extends PerfOption {
  status: CycleStatus
  cycle_type: CycleType
  period_label: string | null
}

export interface EmployeeOption extends PerfOption {
  employee_no: string | null
  department_id: string | null
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

/** Icon keys the KPI row maps to lucide components. */
export type PerfKpiIcon = 'calendar' | 'users' | 'user-clock' | 'user-check' | 'scale' | 'check-circle' | 'gift'

export interface PerfKpi {
  id: string
  title: string
  value: string
  subtitle: string
  icon: PerfKpiIcon
  /** Present only on the "Final Ratings Completed" card (the progress ring). */
  progress?: number
}

export interface PerfOverview {
  kpis: PerfKpi[]
  totals: {
    total_employees: number
    total_reviews: number
    comp_pending: number
    bonus_pending: number
  }
}

export interface PerfFilterOptions {
  cycles: CycleOption[]
  departments: PerfOption[]
  managers: PerfOption[]
  employees: EmployeeOption[]
  jobroles: PerfOption[]
  stages: PerfOption[]
  statuses: PerfOption[]
  decision_statuses: PerfOption[]
  goal_categories: PerfOption[]
  recommendations: PerfOption[]
  revision_types: PerfOption[]
  bonus_types: PerfOption[]
  cycle_types: PerfOption[]
}

export interface RatingBand {
  band: number
  label: string | null
  count: number
}

export interface TeamComparison {
  department_id: number
  department: string | null
  total_reviews: number
  rated_count: number
  average_rating: number | null
  average_label: string | null
  top_performer_pct: number
  low_performer_pct: number
  top_performers: number
  low_performers: number
  distribution: RatingBand[]
  calibration: {
    id: number
    name: string
    status: CalibrationStatus
    status_label: string | null
    scheduled_at: string | null
    scheduled_label: string | null
  } | null
}

export interface TimelineMilestone {
  key: ReviewStage
  label: string
  due_date: string | null
  due_label: string | null
  at_stage: number
  pct: number
  is_overdue: boolean
}

export interface TimelineCycle {
  id: number
  name: string
  code: string | null
  cycle_type: CycleType
  status: CycleStatus
  status_label: string | null
  period_start: string | null
  period_end: string | null
  period_label: string | null
  launched_at: string | null
  total_reviews: number
  milestones: TimelineMilestone[]
}

/* ------------------------------------------------------------------ *
 * Cycles
 * ------------------------------------------------------------------ */

export interface PerfCycle {
  id: number
  name: string
  code: string | null
  cycle_type: CycleType
  cycle_type_label: string
  description: string | null
  period_start: string | null
  period_end: string | null
  period_label: string | null
  self_review_due: string | null
  manager_review_due: string | null
  calibration_due: string | null
  final_review_due: string | null
  status: CycleStatus
  status_label: string | null
  rating_scale_max: number
  launched_at: string | null
  launched_label: string | null
  closed_at: string | null
  total_reviews: number
  completed_reviews: number
  completion_pct: number
}

export interface CyclePayload {
  name: string
  code?: string | null
  cycle_type?: CycleType
  description?: string | null
  period_start?: string | null
  period_end?: string | null
  self_review_due?: string | null
  manager_review_due?: string | null
  calibration_due?: string | null
  final_review_due?: string | null
  status?: CycleStatus
  rating_scale_max?: number
}

export interface LaunchPayload {
  user_ids?: number[]
  department_ids?: number[]
  due_date?: string | null
}

export interface LaunchResult {
  cycle: PerfCycle
  created_reviews: number
  skipped_existing: number
}

/* ------------------------------------------------------------------ *
 * Reviews
 * ------------------------------------------------------------------ */

export interface ReviewEmployee {
  id: number
  name: string
  employee_no: string | null
  initials: string
  image: string | null
  joined_date: string | null
  joined_label: string | null
  location: string | null
}

export interface PerfReview {
  id: number
  employee: ReviewEmployee
  department_id: number | null
  department: string | null
  jobrole: string | null
  manager_id: number | null
  manager: string | null
  manager_initials: string | null
  cycle_id: number
  cycle: string | null
  cycle_type: CycleType | null
  cycle_type_label: string | null
  stage: ReviewStage
  stage_label: string | null
  status: ReviewStatus
  status_label: string | null
  self_rating: number | null
  manager_rating: number | null
  calibrated_rating: number | null
  overall_rating: number | null
  overall_rating_label: string | null
  potential_rating: number | null
  potential_rating_label: string | null
  is_draft: boolean
  self_comments: string | null
  manager_comments: string | null
  due_date: string | null
  due_label: string | null
  is_overdue: boolean
  self_submitted_label: string | null
  manager_submitted_label: string | null
  calibrated_label: string | null
  finalized_label: string | null
  last_reminder_label: string | null
  updated_at: string | null
  updated_label: string | null
  updated_by_id: number | null
  updated_by: string | null
  updated_by_initials: string | null
}

export interface ReviewStep {
  step: number
  key: ReviewStage
  label: string
  status: 'completed' | 'current' | 'upcoming'
  due_date: string | null
  due_label: string | null
}

export interface ReviewHistoryItem {
  id: number
  cycle: string | null
  stage: ReviewStage
  stage_label: string | null
  status: ReviewStatus
  status_label: string | null
  overall_rating: number | null
  overall_rating_label: string | null
  due_label: string | null
  is_current: boolean
}

export interface PerfReviewDetail extends PerfReview {
  steps: ReviewStep[]
  counts: {
    goals: number
    compensation: number
    bonus: number
    documents: number
    comments: number
    notes: number
    reviews: number
  }
  review_history: ReviewHistoryItem[]
}

export interface BoardColumn {
  stage: ReviewStage
  stage_label: string | null
  column_total: number
  truncated: boolean
  cards: PerfReview[]
}

/** The shared filter bar + More Filters sheet, as the API reads them. */
export interface ReviewFilters {
  cycle_id?: string
  department_id?: string
  manager_id?: string
  status?: string
  stage?: string
  search?: string
  user_id_filter?: string
  jobrole?: string
  rating_min?: string
  rating_max?: string
  overdue_only?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type BulkReviewAction = 'advance' | 'remind' | 'assign_manager' | 'set_due_date' | 'complete'

export interface ReviewUpdatePayload {
  self_rating?: number | null
  manager_rating?: number | null
  overall_rating?: number | null
  potential_rating?: number | null
  self_comments?: string | null
  manager_comments?: string | null
  due_date?: string | null
  manager_id?: number | null
  status?: ReviewStatus
  is_draft?: boolean
}

/* ------------------------------------------------------------------ *
 * Goals
 * ------------------------------------------------------------------ */

export interface PerfGoal {
  id: number
  title: string
  description: string | null
  category: GoalCategory
  category_label: string
  weightage: number | null
  metric: string | null
  target_value: string | null
  achieved_value: string | null
  unit: string | null
  progress: number
  status: GoalStatus
  status_label: string | null
  start_date: string | null
  start_label: string | null
  due_date: string | null
  due_label: string | null
  is_overdue: boolean
  self_rating: number | null
  manager_rating: number | null
  manager_comments: string | null
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
}

export interface GoalSummary {
  total: number
  active: number
  achieved: number
  missed: number
  avg_progress: number
  total_weight: number
}

export interface GoalPayload {
  /** The goal owner. Sent as user_id_target - `user_id` is the actor. */
  user_id_target: number
  title: string
  description?: string | null
  category?: GoalCategory
  weightage?: number | null
  metric?: string | null
  target_value?: string | null
  achieved_value?: string | null
  unit?: string | null
  start_date?: string | null
  due_date?: string | null
  progress?: number
  status?: GoalStatus
  cycle_id?: number | null
  review_id?: number | null
}

export interface GoalUpdatePayload extends Partial<Omit<GoalPayload, 'user_id_target'>> {
  self_rating?: number | null
  manager_rating?: number | null
  manager_comments?: string | null
}

/* ------------------------------------------------------------------ *
 * Appraisals
 * ------------------------------------------------------------------ */

export interface PerfAppraisal {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  jobrole: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  final_rating: number | null
  final_rating_label: string | null
  recommendation: Recommendation | null
  recommendation_label: string | null
  current_designation: string | null
  proposed_designation: string | null
  current_grade: string | null
  proposed_grade: string | null
  is_promotion: boolean
  effective_date: string | null
  effective_label: string | null
  status: DecisionStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface AppraisalSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  promotions: number
}

export interface AppraisalPayload {
  user_id_target: number
  review_id?: number | null
  cycle_id?: number | null
  final_rating?: number | null
  recommendation?: Recommendation | null
  current_designation?: string | null
  proposed_designation?: string | null
  current_grade?: string | null
  proposed_grade?: string | null
  effective_date?: string | null
  status?: DecisionStatus
  remarks?: string | null
}

export type DecisionAction = 'submit' | 'approve' | 'reject'
export type BonusDecisionAction = DecisionAction | 'mark_paid'

/* ------------------------------------------------------------------ *
 * Compensation
 * ------------------------------------------------------------------ */

export interface PerfCompensation {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  appraisal_id: number | null
  currency: string
  current_ctc: number | null
  proposed_ctc: number | null
  increment_amount: number | null
  increment_pct: number | null
  revision_type: RevisionType
  revision_type_label: string
  effective_date: string | null
  effective_label: string | null
  status: DecisionStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface CompensationSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  total_increment: number
  avg_increment_pct: number
}

export interface CompensationPayload {
  user_id_target: number
  review_id?: number | null
  appraisal_id?: number | null
  cycle_id?: number | null
  currency?: string
  current_ctc?: number | null
  /** Send proposed_ctc OR increment_pct/increment_amount - the API derives the rest. */
  proposed_ctc?: number | null
  increment_amount?: number | null
  increment_pct?: number | null
  revision_type?: RevisionType
  effective_date?: string | null
  status?: DecisionStatus
  remarks?: string | null
}

/* ------------------------------------------------------------------ *
 * Bonus
 * ------------------------------------------------------------------ */

export interface PerfBonus {
  id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department_id: number | null
  department: string | null
  cycle_id: number | null
  cycle: string | null
  review_id: number | null
  appraisal_id: number | null
  bonus_type: BonusType
  bonus_type_label: string
  currency: string
  amount: number | null
  pct_of_ctc: number | null
  payout_month: string | null
  payout_label: string | null
  payout_date: string | null
  payout_date_label: string | null
  status: BonusStatus
  status_label: string | null
  approver_id: number | null
  approver: string | null
  approved_label: string | null
  remarks: string | null
  created_at: string | null
}

export interface BonusSummary {
  total: number
  draft: number
  pending_approval: number
  approved: number
  rejected: number
  paid: number
  total_amount: number
}

export interface BonusPayload {
  user_id_target: number
  review_id?: number | null
  appraisal_id?: number | null
  cycle_id?: number | null
  bonus_type?: BonusType
  currency?: string
  amount?: number | null
  pct_of_ctc?: number | null
  payout_month?: string | null
  payout_date?: string | null
  status?: BonusStatus
  remarks?: string | null
}

/* ------------------------------------------------------------------ *
 * Calibration
 * ------------------------------------------------------------------ */

export interface PerfCalibrationSession {
  id: number
  name: string
  cycle_id: number
  cycle: string | null
  department_id: number | null
  department: string | null
  facilitator_id: number | null
  facilitator: string | null
  facilitator_initials: string | null
  scheduled_at: string | null
  scheduled_label: string | null
  status: CalibrationStatus
  status_label: string | null
  participant_count: number
  calibrated_count: number
  calibrated_pct: number
  average_rating: number | null
  distribution_target: Record<string, number> | null
  notes: string | null
  locked_at: string | null
  locked_label: string | null
  is_locked: boolean
}

export interface CalibrationSummary {
  total: number
  scheduled: number
  in_progress: number
  completed: number
  locked: number
}

export interface CalibrationParticipant {
  review_id: number
  user_id: number
  employee_name: string
  employee_initials: string
  employee_no: string | null
  department: string | null
  jobrole: string | null
  manager: string | null
  stage: ReviewStage
  stage_label: string | null
  self_rating: number | null
  manager_rating: number | null
  proposed_rating: number | null
  proposed_label: string | null
  calibrated_rating: number | null
  calibrated_label: string | null
  overall_rating: number | null
  overall_rating_label: string | null
  potential_rating: number | null
  delta: number | null
}

export interface CalibrationDistribution extends RatingBand {
  actual_pct: number
  target_pct: number | null
  variance: number | null
}

export interface CalibrationGrid {
  session: PerfCalibrationSession
  participants: CalibrationParticipant[]
  distribution: CalibrationDistribution[]
  rated_count: number
  total_count: number
}

export interface CalibrationSessionPayload {
  name: string
  cycle_id: number
  department_id?: number | null
  facilitator_id?: number | null
  scheduled_at?: string | null
  status?: CalibrationStatus
  distribution_target?: Record<string, number> | null
  notes?: string | null
  attach_reviews?: boolean
}

/* ------------------------------------------------------------------ *
 * Activity / notes / attachments / saved views
 * ------------------------------------------------------------------ */

export interface ActivityChange {
  field: string
  label: string
  old: unknown
  new: unknown
}

export type ActivityEntryType = 'status_change' | 'reminder' | 'approval' | 'comment' | 'system'

export interface PerfActivityEntry {
  id: number
  actor_id: number | null
  actor_name: string
  actor_initials: string
  action: string
  action_label: string
  description: string | null
  subject_type: string | null
  module: string
  subject_id: number | null
  subject_name: string | null
  review_id: number | null
  cycle_id: number | null
  changes: ActivityChange[] | null
  has_changes: boolean
  created_at: string | null
  created_label: string | null
  entry_type: ActivityEntryType
}

export interface PerfNote {
  id: number
  review_id: number
  note_type: 'comment' | 'note'
  visibility: 'all' | 'manager' | 'hr' | 'private'
  body: string
  author_id: number | null
  author_name: string
  author_initials: string
  created_at: string | null
  created_label: string | null
  updated_label: string | null
}

export interface PerfAttachment {
  id: number
  review_id: number
  title: string | null
  file_name: string
  file_path: string | null
  url: string | null
  mime_type: string | null
  file_size: number | null
  file_size_label: string | null
  document_type: string
  document_type_label: string
  uploaded_by: string | null
  uploaded_by_initials: string | null
  created_at: string | null
  created_label: string | null
}

export interface PerfSavedView {
  id: number
  name: string
  tab: PerfTab
  filters: Record<string, string>
  is_shared: boolean
  is_default: boolean
  user_id: number
  owner: string | null
  is_mine: boolean
  created_at: string | null
}

// ---- Dashboard types ----
// Ported from G2G's `types/talent-dashboard.ts`, which documents the payload
// of GET /api/talent/dashboard (App\Http\Controllers\Api\TalentDashboardController
// in hp_erp; ported here as
// App\Http\Controllers\api\TalentManagement\TalentDashboardController).
//
// Nullable numbers are deliberate: the controller returns null - never a
// fabricated 0 - for any figure it cannot derive from real rows, so the UI can
// render "no data" instead of a confident wrong number.

/** Laravel returns numeric ids as numbers here, but tolerate string ids. */
export type LaravelId = number | string;

export interface TalentDashboardKpis {
  open_positions: number;
  critical_positions: number;
  candidates: number;
  /** Null when the preceding window had no applications to compare against. */
  candidate_trend_pct: number | null;
  onboarding: number;
  preboarding: number;
  performance: number;
  pending_reviews: number;
  mobility: number;
  mobility_applications: number;
  offboarding: number;
  clearances_pending: number;
}

export interface TalentPipelineStage {
  key: 'requisition' | 'screening' | 'interview' | 'offer' | 'hired';
  label: string;
  value: number;
}

export interface TalentPipeline {
  stages: TalentPipelineStage[];
  /** Null until at least one candidate has been hired. */
  avg_time_to_hire_days: number | null;
  /** Null until at least one offer has actually been extended. */
  offer_acceptance_rate: number | null;
  /** How many extended offers the rate above was computed from. */
  offer_acceptance_basis: number;
}

export interface TalentPerformanceCycle {
  cycle_id: LaravelId | null;
  cycle_name: string | null;
  cycle_status: string | null;
  period_start: string | null;
  period_end: string | null;
  completed: number;
  in_progress: number;
  not_started: number;
  total: number;
  completed_pct: number;
}

export interface TalentOnboardingProgress {
  completed: number;
  in_progress: number;
  not_started: number;
  total: number;
  completed_pct: number;
  /** Null until at least one journey has been completed. */
  avg_completion_days: number | null;
}

export type TalentTone = 'danger' | 'warning' | 'primary' | 'success' | 'neutral';

/** A row of "My Action Items". `menu` is the m3 menu id to navigate to. */
export interface TalentActionItem {
  key: string;
  label: string;
  count: number;
  tone: TalentTone;
  menu: 'recruitment' | 'performance' | 'onboarding' | 'offboarding' | 'mobility-succession';
}

export interface TalentActivityEntry {
  id: string;
  type: 'application' | 'offer' | 'performance' | 'onboarding' | 'mobility' | 'offboarding';
  text: string;
  context: string | null;
  tone: TalentTone;
  at: string | null;
}

export interface TalentDashboardData {
  kpis: TalentDashboardKpis;
  pipeline: TalentPipeline;
  performance_cycle: TalentPerformanceCycle;
  onboarding_progress: TalentOnboardingProgress;
  action_items: TalentActionItem[];
  activity: TalentActivityEntry[];
}

/** The {status, message, data} envelope every /api/talent/* endpoint returns. */
export interface TalentEnvelope<T> {
  status: 0 | 1;
  message: string;
  data: T;
}

/**
 * Adaptation from G2G: hp_erp's controller returned `meta` as a top-level
 * sibling of `data` (`talentResponse($data, ..., ['meta' => [...]])`). The
 * target's `success()`/`failure()` envelope helper (mirroring
 * OnboardingApiController) only supports `{status, message, data}`, so the
 * ported backend nests `meta` inside `data.meta` instead. The type below
 * reflects that.
 */
export interface TalentDashboardResponse extends TalentEnvelope<TalentDashboardData & { meta?: { from: string; to: string } }> {}

export interface TalentDepartmentOption {
  id: LaravelId;
  department: string;
}

export interface TalentDashboardFilterData {
  departments: TalentDepartmentOption[];
  locations: string[];
  business_units: string[];
  /**
   * False in this schema - no business unit master exists, so the select is
   * disabled rather than populated from departments.
   */
  business_units_available: boolean;
  business_units_reason?: string;
}

export type TalentDashboardFiltersResponse = TalentEnvelope<TalentDashboardFilterData>;

/** Query parameters the dashboard endpoint accepts, beyond the tenant context. */
export interface TalentDashboardQuery {
  department_id?: string;
  location?: string;
  from?: string;
  to?: string;
}
// ---- End Dashboard types ----

// ---- Recruitment types ----
// Ported verbatim from G2G's `types/recruitment.ts`. Unlike the Dashboard/
// Onboarding/Performance/Mobility blocks above (which target a redesigned
// `/api/talent/*` backend), Recruitment is an EXACT as-is migration against
// the existing legacy Laravel recruitment routes, so these field names and
// shapes are preserved exactly as in G2G — see `recruitment-api.ts` for the
// endpoint-level detail. Named `RecruitmentLaravelId` (not `LaravelId`) to
// avoid colliding with the Dashboard block's `LaravelId` above; both are
// `number | string`.

export type RecruitmentLaravelId = number | string

export interface TalentListResponse<T> { message?: string; data: T[] }
export interface TalentItemResponse<T> {
  message?: string
  data: T
  status?: number | boolean
  success?: boolean
}

export interface JobPostingApi {
  id: RecruitmentLaravelId
  title: string
  department_id: RecruitmentLaravelId
  department_name?: string | null
  location: string
  employment_type: string
  experience?: string | null
  education?: string | null
  priority_level?: string | null
  positions: number
  min_salary?: string | number | null
  max_salary?: string | number | null
  start_date?: string | null
  end_date?: string | null
  deadline?: string | null
  skills?: string | null
  certifications?: string | null
  benefits?: string | null
  description?: string | null
  status: 'active' | 'inactive' | 'draft'
  created_at?: string | null
  updated_at?: string | null
  created_by?: RecruitmentLaravelId | null
}

export interface JobApplicationApi {
  id: RecruitmentLaravelId
  job_id: RecruitmentLaravelId
  first_name: string
  middle_name?: string | null
  last_name: string
  email: string
  mobile: string
  current_location?: string | null
  employment_type?: string | null
  experience?: string | null
  education?: string | null
  current_salary?: string | number | null
  expected_salary?: string | number | null
  skills?: string | null
  certifications?: string | null
  resume_path?: string | null
  photo?: string | null
  candidate_photo?: string | null
  profile_url?: string | null
  qualification?: string | null
  applied_date?: string | null
  status: string
  job_title?: string | null
  position?: string | null
  created_at?: string | null
  updated_at?: string | null
  created_by?: RecruitmentLaravelId | null
  source?: string | null
  recruiter_id?: RecruitmentLaravelId | null
  recruiter_name?: string | null
}

export type RecruitmentKanbanStage = 'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired'

export interface CandidateKanbanApi extends JobApplicationApi {
  candidate_id: RecruitmentLaravelId
  candidate_name: string
  position_id?: RecruitmentLaravelId | null
  position?: string | null
  name?: string | null
  job?: { title?: string | null } | null
  job_posting?: { title?: string | null } | null
  job_title?: string | null
  department_id?: RecruitmentLaravelId | null
  department_name?: string | null
  recruiter_id?: RecruitmentLaravelId | null
  recruiter_name?: string | null
  source?: string | null
  avatar?: string | null
  stage: RecruitmentKanbanStage
  rating?: number | string | null
  screening_completed?: boolean | number
  competency_match?: number | null
  overall_fit_score?: number | null
  ranking_score?: number | null
  cultural_fit?: string | number | null
  predicted_success?: string | null
  interview_id?: RecruitmentLaravelId | null
  interview_date?: string | null
  interview_time?: string | null
  interview_status?: string | null
  offer_id?: RecruitmentLaravelId | null
  offer_status?: string | null
  offer_salary?: string | number | null
  joining_date?: string | null
}

export interface CandidateKanbanResponse {
  success: boolean
  message?: string
  data: CandidateKanbanApi[]
  stage_counts: Record<RecruitmentKanbanStage, number>
  total: number
  filters?: {
    jobs?: Array<{ id: RecruitmentLaravelId; label: string }>
    recruiters?: Array<{ id: RecruitmentLaravelId; label: string }>
    locations?: string[]
    sources?: string[]
  }
}

export interface InterviewApi {
  id: RecruitmentLaravelId
  job_id: RecruitmentLaravelId
  applicant_id: RecruitmentLaravelId
  round_no?: number | null
  interview_date?: string | null
  time?: string | null
  duration?: string | number | null
  location?: string | null
  interviewer_id?: RecruitmentLaravelId[] | string | null
  panel_id?: RecruitmentLaravelId | null
  panel_name?: string | null
  status: string
  title?: string | null
  candidate_name?: string | null
  first_name?: string | null
  last_name?: string | null
  additional_notes?: string | null
}

export interface TalentOfferApi {
  id: RecruitmentLaravelId
  application_id: RecruitmentLaravelId
  job_id: RecruitmentLaravelId
  template_id?: RecruitmentLaravelId | null
  candidate_name?: string | null
  position?: string | null
  candidateEmail?: string | null
  salary?: string | number | null
  start_date?: string | null
  status: string
  reportmanager?: string | RecruitmentLaravelId | null
  created_at?: string | null
  updated_at?: string | null
  offer_letter_url?: string | null
}

export interface RequisitionApi {
  id: RecruitmentLaravelId
  title?: string | null
  department_name?: string | null
  department?: string | null
  location?: string | null
  positions?: number | null
  filled?: number | null
  status?: string | null
  priority_level?: string | null
  created_by?: string | number | null
  created_at?: string | null
}

export interface RequisitionPage {
  success: boolean
  page: number
  limit: number
  total: number
  data: RequisitionApi[]
}

export interface FunnelResponse {
  success: boolean
  data: Array<{ name: string; value: number }>
}

export interface ScreeningResultApi {
  id: RecruitmentLaravelId
  candidate_id: RecruitmentLaravelId
  competency_match?: number | null
  cultural_fit?: number | null
  skill_gaps?: string[] | null
  strengths?: string[] | null
  deepseek_analysis?: Record<string, unknown> | null
}

export interface CandidateScreeningResponse {
  success: boolean
  candidateId: RecruitmentLaravelId
  competency_match?: number | null
  cultural_fit?: string | number | null
  predicted_success?: string | null
  summary?: string | null
  skill_gaps?: string[]
  strengths?: string[]
  recommendation?: string | null
  ranking_score?: number | null
  skill_match_details?: Array<{
    competency?: string
    matched?: boolean
    extractedSkill?: string
    confidence?: number
    proficiency?: string
  }>
  scoringPipeline?: {
    bert_parsed_resume?: {
      totalSkillsFound?: number
      yearsExperience?: number
      educationLevel?: string
      extractionScore?: number
    }
    competency_scoring?: {
      overallFitScore?: number
      rankingScore?: number
      culturalFitIndex?: number
      matchedCompetencies?: number
      totalRequired?: number
    }
    deepseek_validation?: {
      competency_match?: number
      cultural_fit?: string | number
      predicted_success?: string
      summary?: string
      skill_gaps?: string[]
      strengths?: string[]
      recommendation?: string
      reasoning?: string
    }
    match_percentage?: number
    detailed_matches?: {
      skills_match?: number
      education_match?: number
      experience_match?: number
    } | null
  }
}

export interface CandidateProfileApi {
  application: JobApplicationApi
  screening: CandidateScreeningResponse
}

export interface InterviewPanelApi {
  id: RecruitmentLaravelId
  panel_name: string
  target_positions?: string | null
  description?: string | null
  available_interviewers?: string | RecruitmentLaravelId[] | null
  status: 'available' | 'assigned' | 'inactive' | 'active'
  schedules?: Array<{
    id: RecruitmentLaravelId
    interview_date?: string | null
    time?: string | null
    status?: string | null
  }>
}

export interface FeedbackPayload {
  job_id: RecruitmentLaravelId
  candidate_id: RecruitmentLaravelId
  panel_id: RecruitmentLaravelId
  evaluation_criteria: Array<{ name: string; score: number }>
  recommendation?: string
  key_strengths?: string
  areas_of_concern?: string
  additional_comments?: string
  notes?: string
  status?: 'draft' | 'submitted' | 'approved' | 'rejected'
}

export interface InterviewerApi {
  id: RecruitmentLaravelId
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  jobrole?: string | null
  job_role?: string | null
  skills?: string[]
}

export interface FeedbackApi extends FeedbackPayload {
  id: RecruitmentLaravelId
  candidate_name?: string | null
  job_title?: string | null
  panel_name?: string | null
  /** The candidate's overall application/interview status (e.g. Completed, Selected, Rejected) - distinct from `status`, which is this evaluation form's own draft/submitted/approved/rejected workflow state. */
  application_status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface OfferTemplateApi {
  id: RecruitmentLaravelId
  title: string
  module_name?: string | null
  content?: string | null
}

export interface TeamOverviewApi {
  open_positions?: number
  total_applications?: number
  interviews_scheduled?: number
  hired_candidates?: number
  [key: string]: string | number | null | undefined
}
// ---- End Recruitment types ----
