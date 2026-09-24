"use client";

import RequireStaff from "@/app/lms/_shared/RequireStaff";
import { AssignWorkPanel } from "@/app/lms/_shared/assign-work-panel";

/**
 * Send Worksheet to students.
 *
 * Mirrors app/lms/lmsAssignment/page.tsx: AssignWorkPanel already understands
 * workType="worksheet" (its own question_paper.exam_type pool and PDF
 * preview), this page just mounts it. Also embedded directly at the top of
 * /lms/worksheet, above that screen's paper table — see app/lms/worksheet/page.tsx.
 */
export default function SendWorksheetPage() {
  return (
    <RequireStaff redirectTo="/lms/lmsAssignment_submission">
      <main className="mx-auto space-y-5 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Send Worksheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search students by class, attach a worksheet paper, and assign it.
          </p>
        </header>

        <AssignWorkPanel workType="worksheet" />
      </main>
    </RequireStaff>
  );
}
