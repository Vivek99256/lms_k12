/**
 * Single source of truth for the STUDENT-facing submission status shown on
 * assignment/homework pages.
 *
 * A submission's real state lives in three independent backend columns on
 * `lms_assignment` (and the equivalent `homework` columns):
 *   - student_submission_status ('Y'/'N')
 *   - ai_status ('' | 'Checking' | 'Evaluated' | 'OCR Failed' | 'Evaluation Failed' | 'Failed')
 *   - teacher_submission_status ('Y'/'N')
 *
 * Before this helper, student-facing pages only looked at the first and
 * third of those, so a student saw a flat "Awaiting review" for the entire
 * time an AI evaluation was running or had failed, with no visibility into
 * what was actually happening. This composes all three into one label/badge
 * variant so AI progress is visible without exposing teacher-only detail
 * (score, failure reason, etc — those stay on the teacher-facing pages).
 *
 * Teacher-facing pages (Annotate assignment, Homework submission report)
 * have their own "Awaiting submission" / "Completed" columns and the raw
 * ai_status badge, and do NOT use this helper — their workflow is unchanged.
 */

export type StudentSubmissionStatusVariant =
  | "inactive"
  | "processing"
  | "warning"
  | "error"
  | "active";

export type StudentSubmissionStatusInfo = {
  label: string;
  variant: StudentSubmissionStatusVariant;
};

const AI_FAILURE_STATUSES = new Set(["ocr failed", "evaluation failed", "failed"]);

export function studentSubmissionStatus(row: {
  studentSubmitted: boolean;
  teacherReviewed: boolean;
  aiStatus: string;
}): StudentSubmissionStatusInfo {
  if (row.teacherReviewed) {
    return { label: "Reviewed", variant: "active" };
  }

  if (!row.studentSubmitted) {
    return { label: "Not submitted", variant: "inactive" };
  }

  const normalizedAiStatus = row.aiStatus.trim().toLowerCase();

  if (normalizedAiStatus === "checking") {
    return { label: "AI Evaluating", variant: "processing" };
  }

  if (normalizedAiStatus === "evaluated") {
    return {
      label: "AI Evaluated",
      variant: "warning",
    };
  }

  if (AI_FAILURE_STATUSES.has(normalizedAiStatus)) {
    return {
      label: "Evaluation Failed",
      variant: "error",
    };
  }

  // ai_status not yet set (e.g. AI columns unavailable in this environment,
  // or the row predates the AI evaluation pipeline) — falls back to the
  // original, AI-agnostic label rather than showing nothing.
  return { label: "Awaiting Review", variant: "warning" };
}
