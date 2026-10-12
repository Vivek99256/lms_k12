/**
 * RIASEC Interest Profile (O*NET Interest Profiler, proxied by
 * `lmsCounsellingController::intrestQuestions/intrestResults`). Both
 * payloads are unenveloped (no `data` wrapper) — the Laravel controller
 * passes O*NET's own response through unchanged.
 */
export interface RiasecQuestion {
  text: string;
}

/**
 * `careerCounsellingNarrative` (App\CareerIntelligence\CareerCounsellingNarrator,
 * Laravel repo, `lms/counselling` namespace). "An AI counsellor retrieving
 * the student's skill/interest graph" grounded in what actually exists:
 * CaiCoreService's real career-alignment evaluation plus the student's real
 * concept-mastery state (Set Coherence Map) — NOT the RIASEC quiz above,
 * which is a separate, non-graph O*NET pipeline with no Neo4j relationship
 * behind it. `status` mirrors explain()'s own contract: `ok` (real
 * narrative text, plus the two real data sources it was grounded in),
 * `insufficient_evidence` (neither a resolvable career alignment nor any
 * recorded concept practice exists yet — most students today), `model_unavailable`
 * (no AI key configured, or the provider rejected the request), or
 * `graph_unavailable` (Neo4j itself could not be reached).
 */
export type CounsellingNarrativeStatus = 'ok' | 'insufficient_evidence' | 'model_unavailable' | 'graph_unavailable';

export interface CounsellingMasteryConcept {
  concept_id: number;
  name: string;
  mastery: number;
  attempts: number;
}

export interface CounsellingMasterySnapshot {
  subject_id: number;
  subject_name: string;
  total_concepts: number;
  mastered: number;
  ready: number;
  blocked: number;
  percent_mastered: number;
  evidenced_count: number;
  weakest_evidenced_concepts: CounsellingMasteryConcept[];
}

export interface CounsellingNarrativePayload {
  status: CounsellingNarrativeStatus;
  narrative: string | null;
  message: string | null;
  alignment: Record<string, unknown> | null;
  mastery: CounsellingMasterySnapshot | null;
}

export interface RiasecQuestionsPayload {
  question: RiasecQuestion[];
}

export interface RiasecResultItem {
  area: string;
  score: number;
  description: string;
}

export interface RiasecResultsPayload {
  result: RiasecResultItem[];
}

/**
 * Counselling course listing (proxied by `lmsCounsellingController::index`,
 * the API-mode response behind next_lms_erp's
 * resources/views/lms/counselling/show_lmsCounselling.blade.php). Unlike
 * the RIASEC endpoints above, this one IS enveloped in the
 * `{status_code, message, ...}` shape used across the rest of the ERP.
 */
export interface CounsellingCourse {
  id: number;
  sub_institute_id: number;
  sort_order: number;
  image: string;
  title: string;
  description: string;
  total_ques: number;
}

export interface CounsellingAttempt {
  id: number;
  course_id: number;
  obtain_marks: number;
  total_points: number | null;
  total_ques: number | null;
  total_right: number | null;
  total_wrong: number | null;
  exam_date: string;
}

export interface CounsellingCoursesPayload {
  status_code: number;
  message: string;
  counselling_course: CounsellingCourse[];
  user_data: Record<string, CounsellingAttempt[]>;
}
