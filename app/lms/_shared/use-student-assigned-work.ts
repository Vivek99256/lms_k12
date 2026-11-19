"use client";

import { useEffect, useState } from "react";
import { listAssignmentSubmissions } from "@/app/lms/lmsAssignment_submission/api";
import type { ExamRecord } from "@/app/lms/_shared/question-paper-grid";

/**
 * The worksheets (or projects) a teacher has sent to the logged-in student, shaped as rows for
 * the question-paper grid so the student's Worksheet / Project tab lists them in its table.
 *
 * View only: submitting stays on the Assignment Submission screen. Pass `enabled=false` for
 * staff, who see the school's papers instead, and nothing is requested.
 */
export function useStudentAssignedWork(workType: "worksheet" | "project", enabled: boolean) {
  const [rows, setRows] = useState<ExamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError("");

    listAssignmentSubmissions(workType)
      .then((all) => {
        if (cancelled) return;
        setRows(
          all
            .map((row) => ({
              id: `ASG-${row.id}`,
              // The question paper the work was sent from, which is what the PDF action opens.
              paperId: row.examId,
              name: row.title || "Untitled",
              classLabel: [row.subjectName, row.submissionDate ? `due ${row.submissionDate}` : ""]
                .filter(Boolean)
                .join(" - "),
              type: workType,
              window: row.submissionDate,
              attempts: 0,
              questions: 0,
              marks: 0,
              status: "Open",
            }))
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRows([]);
        setLoadError(error instanceof Error ? error.message : `Your ${workType}s couldn’t be loaded.`);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workType, enabled]);

  return { rows, isLoading, loadError };
}
