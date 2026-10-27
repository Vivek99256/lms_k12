'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { EmptyChapterState } from './_components/EmptyChapterState';
import { MountainJourneyView } from './_components/MountainJourneyView';

/**
 * `/pal/journey?chapterId=` — the Mountain Adventure Learning Journey.
 *
 * Mirrors `app/pal/reports/activity/page.tsx`'s own shape: a Suspense
 * boundary around the `useSearchParams()` read, and `isStudentSession()`
 * resolved before anything renders. Phase 1 is the student's own journey
 * only — a teacher-facing monitor that reuses `MountainJourneyView` with
 * `viewContext={{mode:'monitor', studentId, readOnly:true}}` is a later
 * phase's route, not this one, so a staff session here sees a plain notice
 * rather than a half-built picker.
 */
export default function PalJourneyPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <Loader2 className="h-5 w-5 animate-spin" />
        </Centered>
      }
    >
      <PalJourneyPageContent />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">{children}</div>;
}

function PalJourneyPageContent() {
  const searchParams = useSearchParams();
  const chapterId = searchParams.get('chapterId') ?? '';
  const isStudent = isStudentSession();

  if (!chapterId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <EmptyChapterState />
      </div>
    );
  }

  if (!isStudent) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 text-sm text-indigo-900">
          The Mountain Adventure journey shows a student&rsquo;s own progress. Sign in as a student to see it
          here &mdash; a teacher monitoring view is coming in a later phase.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <MountainJourneyView chapterId={chapterId} />
    </div>
  );
}
