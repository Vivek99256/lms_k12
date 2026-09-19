"use client";

import RequireStaff from "@/app/lms/_shared/RequireStaff";
import { AssignWorkPanel } from "@/app/lms/_shared/assign-work-panel";

/**
 * Create Assignment.
 *
 * The form itself now lives in AssignWorkPanel, which the Worksheet and Project
 * screens mount with their own work type. Nothing about this screen moved: the
 * panel is this page's own markup, lifted out so the three cannot drift apart.
 */
export default function CreateAssignmentPage() {
  return (
    <RequireStaff redirectTo="/lms/lmsAssignment_submission">
      <main className="mx-auto space-y-5 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Create Assignment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search students by class, attach an offline Assignment paper, and assign it.
          </p>
        </header>

        <AssignWorkPanel workType="assignment" />
      </main>
    </RequireStaff>
  );
}
