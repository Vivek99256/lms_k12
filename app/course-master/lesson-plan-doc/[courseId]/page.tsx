'use client';

/**
 * Read-only "Lesson Plan" document for one chapter: Summary / Teaching /
 * Learning / Day Planning / Map & Alignment, sourced from the existing
 * lms_lesson_plan / lms_lessonplan_dayswise data via GET /api/lesson-plan-doc.
 *
 * This is a different feature from /course-master/lesson-plan/[courseId]
 * (the AI Lesson Intelligence calendar) - that page's own data is untouched
 * by this one. The two share LessonPlanDocumentPanel (../LessonPlanDocumentPanel)
 * for the actual tab content; this page owns the chapter list, URL state and
 * page header around it.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { NotebookText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { getSubjectAndChapters, type Chapter } from '../../data/chapters';
import { LessonPlanDocumentPanel } from '../LessonPlanDocumentPanel';

export default function LessonPlanDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCourseId = useParams()?.courseId;
  const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId ?? '';
  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0] ?? '';
  const standardId = courseIdParts[1];

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [standardName, setStandardName] = useState('');
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [chaptersError, setChaptersError] = useState<string | null>(null);

  const [chapterId, setChapterId] = useState(() => searchParams?.get('chapterId') ?? '');

  // Chapter list for this subject - also supplies the subject/standard display
  // names for the header, same helper the sibling chapters page already uses.
  useEffect(() => {
    if (!subjectId) {
      setChaptersLoading(false);
      return;
    }

    let cancelled = false;
    setChaptersLoading(true);
    setChaptersError(null);

    getSubjectAndChapters(subjectId, standardId)
      .then(({ subject, chapters: fetchedChapters }) => {
        if (cancelled) return;
        if (!subject) {
          setChaptersError('This subject could not be found.');
          setChapters([]);
          return;
        }
        setSubjectName(subject.subject_name);
        setStandardName(subject.standard_name);
        setChapters(fetchedChapters);
      })
      .catch((err: unknown) => {
        if (!cancelled) setChaptersError(err instanceof Error ? err.message : 'Failed to load chapters.');
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId]);

  // Default to the first chapter once the list loads, and reflect the choice
  // in the URL so the page stays bookmarkable/shareable (matching ?chapterId=
  // on the AI Lesson Intelligence page).
  useEffect(() => {
    if (chapterId || chapters.length === 0) return;
    const firstId = chapters[0].id;
    setChapterId(firstId);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('chapterId', firstId);
    router.replace(`/course-master/lesson-plan-doc/${courseId}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);

  function handleChapterChange(nextChapterId: string) {
    setChapterId(nextChapterId);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('chapterId', nextChapterId);
    router.replace(`/course-master/lesson-plan-doc/${courseId}?${params.toString()}`);
  }

  const subjectLabel = useMemo(
    () => `${subjectName}${standardName ? ` · Class ${standardName}` : ''}`,
    [subjectName, standardName]
  );

  if (chaptersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-slate-500">Loading lesson plan...</div>
      </div>
    );
  }

  if (chaptersError || !subjectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-6">
        <ErrorState title="Lesson plan unavailable" description={chaptersError ?? 'This subject could not be found.'} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/50">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#6D4AFF]">
              <NotebookText size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Lesson Plan</h1>
              <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                <BookOpen className="h-4 w-4" /> {subjectLabel}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          >
            Back
          </Button>
        </div>

        <LessonPlanDocumentPanel
          subjectId={subjectId}
          standardId={standardId ?? ''}
          chapters={chapters}
          chapterId={chapterId}
          onChapterIdChange={handleChapterChange}
          onEdit={() => router.push(`/course-master/lesson-plan-doc/${courseId}/edit?chapterId=${chapterId}`)}
        />
      </div>
    </div>
  );
}
