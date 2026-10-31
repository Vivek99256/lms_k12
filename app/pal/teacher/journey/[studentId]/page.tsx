'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { MountainJourneyView } from '@/app/pal/journey/_components/MountainJourneyView';

/**
 * A teacher's read-only view of one student's Mountain Adventure journey for
 * one chapter — the narrow, chapter-scoped counterpart to the Teacher
 * Learning Insights roster's per-chapter mastery-percentage row. That page
 * answers "how is this student doing across chapters"; this page answers
 * "exactly where is this student stuck in THIS chapter's workflow", with the
 * same 8-milestone mountain a student sees for themselves, never a second
 * copy of its data or rules.
 *
 * `?chapterId=` is required — there is no auto-selecting dashboard endpoint
 * here on purpose (see pal-journey.ts / the known studentDashboard() /
 * learningPath() pilot-chapter fallback this page deliberately never calls).
 */
export default function TeacherJourneyPage() {
  return (
    <Suspense fallback={<Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>}>
      <TeacherJourneyView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">{children}</div>;
}

function TeacherJourneyView() {
  const router = useRouter();
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const chapterId = searchParams.get('chapterId');
  const [allowed, setAllowed] = useState(false);

  // Client-side backstop, same pattern as app/lms/_shared/RequireStaff — the
  // menu-rights API already hides this page's entry points from a student
  // session; this just stops direct URL navigation. Kept inline rather than
  // importing RequireStaff, since no other app/pal page reaches into
  // app/lms/_shared and this one shouldn't be the first.
  useEffect(() => {
    if (isStudentSession()) {
      router.replace('/pal');
    } else {
      setAllowed(true);
    }
  }, [router]);

  if (!allowed) return null;

  const studentId = params?.studentId;

  if (!studentId || !chapterId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <BackButton router={router} />
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">Chapter required</CardTitle>
            <CardDescription className="text-amber-800">
              Open this page with a chapter id, e.g. from a student&apos;s mastery-by-chapter row
              (?chapterId=...).
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <BackButton router={router} />
      <MountainJourneyView chapterId={chapterId} viewContext={{ mode: 'monitor', studentId, readOnly: true }} />
    </div>
  );
}

/**
 * Plain `router.back()`, not a hardcoded href to the roster — this page is
 * only ever reached by an in-app click (the "Jump to one student" search or
 * a mastery-by-chapter row on Teacher Learning Insights), never a bookmark,
 * so browser history already points at the right place.
 */
function BackButton({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4 gap-1.5 bg-white">
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back
    </Button>
  );
}
