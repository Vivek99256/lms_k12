'use client';

// The Standard/Subject/Curriculum(/Chapter) toolbar shared by the Curriculum
// Exploration, CG/LO Analysis and Lesson Plans tabs - moved out of OutcomesTab
// (which used to render its own private copy) so all three tabs read and
// drive the same selection via useAcademicScope.

import type { ComponentProps } from 'react';
import { Select, type SelectOption } from '@/components/ui/g2g/select';
import { cn } from '@/lib/utils';
import type { AcademicScope } from './useAcademicScope';

/**
 * One segment of the toolbar: a small caption above a borderless select, so
 * the picked value sits inline with its label instead of needing a separate
 * "Standard: 6" chip underneath to say the same thing again.
 */
function ScopeField({
  label,
  value,
  options,
  onChange,
  className,
  ...selectProps
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
} & Pick<ComponentProps<typeof Select>, 'wrapOptionLabels' | 'minPanelWidthPx' | 'panelClassName'>) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2.5 py-1">
      <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-[#9a958e]">{label}</span>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        size="sm"
        aria-label={label}
        className={cn(
          'min-w-0 border-transparent bg-transparent px-1.5 font-medium text-[#3c3833] hover:bg-[#f7f6f4]',
          className
        )}
        {...selectProps}
      />
    </div>
  );
}

export function AcademicScopeBar({ scope, showChapter = false }: { scope: AcademicScope; showChapter?: boolean }) {
  const chapterOptions: SelectOption[] = scope.chapterOptions.map((chapter) => ({
    id: String(chapter.chapter_id),
    label: chapter.chapter_name,
    value: String(chapter.chapter_id),
  }));

  return (
    <div className="mb-4 flex flex-wrap items-center divide-x divide-[#e5e1da] rounded-lg border border-[#e5e1da] bg-white shadow-sm">
      <ScopeField
        label="Standard"
        value={scope.standardId !== null ? String(scope.standardId) : ''}
        options={scope.standardOptions}
        onChange={scope.handleStandardChange}
        className="w-14"
      />
      <ScopeField
        label="Subject"
        value={scope.subjectId !== null ? String(scope.subjectId) : ''}
        options={scope.subjectOptions}
        onChange={scope.handleSubjectChange}
        className="w-28"
      />
      <ScopeField
        label="Curriculum"
        value={scope.curriculumId !== null ? String(scope.curriculumId) : ''}
        options={scope.curriculumOptions}
        onChange={scope.handleCurriculumChange}
        className="w-56 sm:w-72"
        wrapOptionLabels
        minPanelWidthPx={320}
      />
      {showChapter ? (
        <ScopeField
          label="Chapter"
          value={scope.chapterId !== null ? String(scope.chapterId) : ''}
          options={chapterOptions}
          onChange={(value) => scope.setChapterId(Number(value) || null)}
          className="w-56 sm:w-72"
          wrapOptionLabels
          minPanelWidthPx={320}
        />
      ) : null}
    </div>
  );
}
