"use client";

import RequireStaff from "@/app/lms/_shared/RequireStaff";
import { AssignWorkPanel } from "@/app/lms/_shared/assign-work-panel";

/**
 * Send Project to students.
 *
 * Mirrors app/lms/lmsAssignment/page.tsx: AssignWorkPanel already understands
 * workType="project" (its own question_paper.exam_type pool and PDF
 * preview), this page just mounts it. Also embedded directly at the top of
 * /lms/project, above that screen's paper table — see app/lms/project/page.tsx.
 */
export default function SendProjectPage() {
  return (
    <RequireStaff redirectTo="/lms/lmsAssignment_submission">
      <main className="mx-auto space-y-5 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Send Project</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search students by class, attach a project paper, and assign it.
          </p>
        </header>

        <AssignWorkPanel workType="project" />
      </main>
    </RequireStaff>
  );
}
