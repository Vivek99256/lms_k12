'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

import StudentPicker from '@/app/pal/_components/StudentPicker';
import ViewAsBanner from '@/app/pal/_components/ViewAsBanner';
import { getViewAsStudent, setViewAsStudent, useViewAsStudent } from '@/app/pal/data/pal-view-as';
import type { PalStudentSelection } from '@/app/pal/data/pal';
import type { LearnerScope } from '@/app/pal/new/data/gamification';

import { PageShell, StatusPanel } from './GamificationChrome';

/**
 * Who is this Gamification screen about?
 *
 * A signed-in student is always themselves — the API resolves the learner from
 * the JWT and ignores anything the client sends, so there is nothing to choose.
 *
 * Staff must name a learner. Rather than guessing the caller's role from
 * localStorage, this reuses PAL's existing "view as student" context: whatever
 * learner the staff member picked on the PAL landing carries straight through
 * to Gamification. If none is picked and the API says one is required, the
 * picker is shown — the server stays the authority on who may be viewed.
 */

/** The API's exact wording when staff omit a learner. */
const NEEDS_LEARNER_HINT = 'learner_id is required';

export function isMissingLearnerError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes(NEEDS_LEARNER_HINT);
}

export function useGamificationScope(): {
  scope: LearnerScope;
  student: PalStudentSelection | null;
  chooseStudent: (student: PalStudentSelection) => void;
  clearStudent: () => void;
  hydrated: boolean;
} {
  const student = useViewAsStudent();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Read once on mount so the first request does not race localStorage.
    const id = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const chooseStudent = useCallback((next: PalStudentSelection) => {
    setViewAsStudent(next);
  }, []);

  const clearStudent = useCallback(() => {
    setViewAsStudent(null);
  }, []);

  return {
    scope: { learnerId: student?.studentId || undefined },
    student,
    chooseStudent,
    clearStudent,
    hydrated,
  };
}

/** Read the stored selection without subscribing — for one-shot request builds. */
export function currentScope(): LearnerScope {
  const student = getViewAsStudent();
  return { learnerId: student?.studentId || undefined };
}

/** The banner shown while staff are viewing a specific learner's gamification. */
export function ScopeBar({
  student,
  onExit,
}: {
  student: PalStudentSelection | null;
  onExit: () => void;
}) {
  if (student === null) return null;

  return <ViewAsBanner student={student} onExit={onExit} audience="Teacher" />;
}

/**
 * The full-page "pick a learner" state.
 *
 * Gamification is inherently about one learner's journey, so there is no
 * meaningful class-wide view of it — a teacher picks a student, exactly as they
 * do everywhere else in PAL.
 */
export function LearnerRequiredPanel({
  message,
  onSelect,
}: {
  message?: string;
  onSelect: (student: PalStudentSelection) => void;
}) {
  return (
    <PageShell>
      <StatusPanel
        kind="empty"
        title="Pick a student"
        message={
          message ||
          'Gamification follows one learner\'s own journey, so it needs a student. Choose one below — you will keep viewing that learner across PAL.'
        }
      >
        <div className="mx-auto max-w-3xl text-left">
          <StudentPicker audience="Teacher" onSelect={onSelect} />
        </div>
      </StatusPanel>
    </PageShell>
  );
}

/** A compact inline prompt for sub-pages that already have a header. */
export function InlineLearnerPrompt({ onSelect }: { onSelect: (student: PalStudentSelection) => void }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Choose a student</p>
          <p className="text-xs text-slate-500">
            This view follows one learner. Pick a student to see their record.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <StudentPicker audience="Teacher" onSelect={onSelect} />
      </div>
    </div>
  );
}
