'use client';

import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { AssignWorkPanel } from '@/app/lms/_shared/assign-work-panel';

/**
 * Projects.
 *
 * The screen is the assign flow: pick a class, pick the project paper, search
 * the students, send it. The paper dropdown is the list of published projects,
 * and the PDF button beside it opens the selected one — so the separate
 * published-projects grid that used to sit above this said the same thing
 * twice and is gone.
 *
 * Everything here is AssignWorkPanel, which is the Assignment module's own
 * form; `workType` picks which papers it lists and what the created rows carry.
 */
function ProjectAssign() {
  return (
    <main className="mx-auto w-full max-w-[1540px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Assign project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search students by class, attach a project paper, and assign it.
        </p>
      </header>

      <AssignWorkPanel workType="project" />
    </main>
  );
}

export default function ProjectPage() {
  return (
    <RequireStaff>
      <ProjectAssign />
    </RequireStaff>
  );
}
