'use client';

import RequireStaff from '@/app/lms/_shared/RequireStaff';
import {
  QuestionPaperGrid,
  useQuestionPaperRows,
  type QuestionPaperColumn,
} from '@/app/lms/_shared/question-paper-grid';

/** Exam, Class, Type, Paper — the Window/Attempts/Questions/Marks/Status columns
 *  carry nothing for a project, so they stay off. */
const COLUMNS: QuestionPaperColumn[] = ['exam', 'class', 'type', 'paper'];

function ProjectList() {
  const { rows, isLoading, loadError } = useQuestionPaperRows('project');

  return (
    <div className="mx-auto w-full max-w-[1540px]">
      <section className="rounded-[24px] border border-[#D9E3F1] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A889D]">
              Learning management
            </p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#172554] sm:text-[34px]">
              Projects
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#5B6B82]">
              Every project published for your classes, with its brief ready to print.
            </p>
          </div>

          <QuestionPaperGrid
            rows={rows}
            isLoading={isLoading}
            loadError={loadError}
            columns={COLUMNS}
            noun="projects"
            searchPlaceholder="Search projects..."
            showTypeFilter={false}
          />
        </div>
      </section>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <RequireStaff>
      <ProjectList />
    </RequireStaff>
  );
}
