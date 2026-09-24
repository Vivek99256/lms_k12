'use client';

/**
 * Project.
 *
 * Two independent pieces on one page, per the product ask: the full
 * Assignment-style "Create Project" authoring UI (AssignWorkPanel,
 * workType="project" — Assign To / Section / Standard / Division / Subject /
 * student search / project paper dropdown / title / submission date /
 * description / student grid and controls, identical in shape to Create
 * Assignment) sits above the existing project table. Below it, the same
 * `question_paper` grid and API as Exam (tab 242) —
 * `useQuestionPaperRows` + `QuestionPaperGrid` from
 * `app/lms/_shared/question-paper-grid.tsx` — pinned to exam_type='project'
 * and narrowed to the Exam, Class, Type and Paper columns, unchanged.
 */

import { AssignWorkPanel } from '@/app/lms/_shared/assign-work-panel';
import type { QuestionPaperColumn } from '@/app/lms/_shared/question-paper-grid';
import { QuestionPaperGrid, useQuestionPaperRows } from '@/app/lms/_shared/question-paper-grid';

const PROJECT_COLUMNS: QuestionPaperColumn[] = ['exam', 'class', 'type', 'paper'];

export default function ProjectPage() {
  const { rows, isLoading, loadError } = useQuestionPaperRows('project');

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Project</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search students by class, attach a project paper, and assign it.
          </p>
        </div>

        <AssignWorkPanel workType="project" />
      </div>

      <div>
        <h2 className="text-[20px] font-semibold text-[#1E293B]">Projects</h2>
        <p className="mt-1 text-[14px] text-[#5F7087]">
          Project question papers, filtered from the same list as Exams.
        </p>
      </div>

      <QuestionPaperGrid
        rows={rows}
        isLoading={isLoading}
        loadError={loadError}
        columns={PROJECT_COLUMNS}
        showTypeFilter={false}
        showOpenPdfOption
        noun="projects"
        searchPlaceholder="Search projects..."
      />
    </div>
  );
}
