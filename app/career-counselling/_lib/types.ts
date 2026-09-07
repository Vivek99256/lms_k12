/**
 * RIASEC Interest Profile (O*NET Interest Profiler, proxied by
 * `lmsCounsellingController::intrestQuestions/intrestResults`). Both
 * payloads are unenveloped (no `data` wrapper) — the Laravel controller
 * passes O*NET's own response through unchanged.
 */
export interface RiasecQuestion {
  text: string;
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
