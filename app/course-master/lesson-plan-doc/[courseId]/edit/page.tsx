'use client';

/**
 * Create/edit page for the Lesson Plan document - the dedicated editor reached via the
 * "Edit lesson plan" / "Create lesson plan" button on the read-only document panel
 * (../page.tsx and the embedded panel inside /course-master/lesson-plan/[courseId]).
 * Owns loading the session, the chapter list (for the header), the existing document
 * (a 404 means "new plan" - fetchLessonPlanDocument already resolves that to `null`),
 * the chapter's topics and the mapping-type/value options, then hands all of it to
 * LessonPlanEditorForm. Both Save and Cancel return to the read page for this same
 * chapter, regardless of which host page Edit was opened from.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { NotebookText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubjectAndChapters, type Chapter } from '../../../data/chapters';
import { getCurriculumSession } from '../../../data/curriculum';
import { fetchLessonPlanDocument, type LessonPlanDocument } from '../../../data/lessonPlanDocument';
import {
  fetchLessonPlanMappingOptions,
  fetchLessonPlanTopics,
  type LessonPlanMappingOptions,
  type LessonPlanTopicOption,
} from '../../../data/lessonPlanDocumentWrite';
import { LessonPlanEditorForm } from '../../edit/LessonPlanEditorForm';

export default function LessonPlanEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCourseId = useParams()?.courseId;
  const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId ?? '';
  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0] ?? '';
  const standardId = courseIdParts[1] ?? '';
  const chapterId = searchParams?.get('chapterId') ?? '';

  const [subjectName, setSubjectName] = useState('');
  const [standardName, setStandardName] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [plan, setPlan] = useState<LessonPlanDocument | null>(null);
  const [topics, setTopics] = useState<LessonPlanTopicOption[]>([]);
  const [mappingOptions, setMappingOptions] = useState<LessonPlanMappingOptions>({ types: [], values: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = `/course-master/lesson-plan-doc/${courseId}?chapterId=${chapterId}`;

  useEffect(() => {
    if (!subjectId || !chapterId) {
      setLoading(false);
      setError(!chapterId ? 'No chapter selected.' : 'This subject could not be found.');
      return;
    }

    const session = getCurriculumSession();
    if (!session) {
      setError('Your session is missing or expired. Please sign in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getSubjectAndChapters(subjectId, standardId),
      fetchLessonPlanDocument(session, { subjectId, standardId, chapterId, subInstituteId: session.subInstituteId }),
      fetchLessonPlanTopics(session, { chapterId }),
      fetchLessonPlanMappingOptions(session, { chapterId }),
    ])
      .then(([subjectResult, document, topicOptions, mapping]) => {
        if (cancelled) return;
        if (!subjectResult.subject) {
          setError('This subject could not be found.');
          return;
        }
        setSubjectName(subjectResult.subject.subject_name);
        setStandardName(subjectResult.subject.standard_name);
        setChapters(subjectResult.chapters);
        setPlan(document);
        setTopics(topicOptions);
        setMappingOptions(mapping);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Failed to load the lesson plan editor.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId, chapterId]);

  const selectedChapterName = chapters.find((chapter) => chapter.id === chapterId)?.title ?? '';
  const session = getCurriculumSession();

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50/50">
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-6">
        <ErrorState title="Couldn't load the lesson plan editor" description={error ?? 'Please sign in again.'} />
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {plan ? 'Edit lesson plan' : 'Create lesson plan'}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-slate-600">
                <BookOpen className="h-4 w-4" />
                {subjectName}
                {standardName ? ` · Class ${standardName}` : ''}
                {selectedChapterName ? ` · ${selectedChapterName}` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(returnUrl)}
            className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          >
            Back
          </Button>
        </div>

        <LessonPlanEditorForm
          session={session}
          subjectId={subjectId}
          standardId={standardId}
          chapterId={chapterId}
          subjectName={subjectName}
          standardName={standardName}
          initialDocument={plan}
          topics={topics}
          mappingOptions={mappingOptions}
          onSaved={() => router.push(returnUrl)}
          onCancel={() => router.push(returnUrl)}
        />
      </div>
    </div>
  );
}
