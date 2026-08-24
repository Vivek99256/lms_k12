'use client';

import type { ReactNode } from 'react';
import { LogOut, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PalStudentSelection } from '@/app/pal/data/pal';

/**
 * Banner shown while an admin/teacher is viewing PAL "as" a specific student.
 * Design-system styled (indigo tint, lucide icons), responsive: the meta row
 * wraps and the actions drop below the identity on small screens.
 */
export default function ViewAsBanner({
  student,
  onExit,
  actions,
  audience = 'Student',
}: {
  student: PalStudentSelection;
  onExit: () => void;
  actions?: ReactNode;
  audience?: 'Teacher' | 'Student';
}) {
  const eyebrow = audience === 'Teacher' ? "Reviewing student's PAL" : 'Viewing PAL as student';
  const exitLabel = audience === 'Teacher' ? 'Close review' : 'Exit student view';
  const meta = [
    student.standardId && `Std ${student.standardId}`,
    student.divisionId && `Div ${student.divisionId}`,
    student.enrollmentNo && `Enroll ${student.enrollmentNo}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-500">
            {eyebrow}
          </p>
          <p className="truncate text-sm font-bold text-indigo-950">
            {student.name || `Student #${student.studentId}`}
          </p>
          {meta ? <p className="truncate text-xs text-indigo-700">{meta}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
        <Button
          size="sm"
          variant="outline"
          onClick={onExit}
          className="border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          {exitLabel}
        </Button>
      </div>
    </div>
  );
}
