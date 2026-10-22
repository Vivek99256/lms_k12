'use client';

// Lesson Plans, reusing the two panels course-master's lesson-plan screen
// already composites together - LessonIntelligencePanel (the AI calendar /
// scheduler) and LessonPlanDocumentPanel (the static per-chapter document) -
// so there is exactly one implementation of each, not a fork for this tab.
//
// Neither panel needs a route-based courseId: LessonIntelligencePanel takes
// plain standard/subject/division/syear scalars, and LessonPlanDocumentPanel
// resolves its own session via getCurriculumSession() internally. Division is
// not collected here (always passed as null) - the panel accepts it as
// optional and treats null as "all divisions".

import { useRouter } from 'next/navigation';
import { LessonIntelligencePanel } from '@/app/course-master/lesson-plan/[courseId]/LessonIntelligencePanel';
import { LessonPlanDocumentPanel } from '@/app/course-master/lesson-plan-doc/LessonPlanDocumentPanel';
import type { Chapter as DocumentChapter } from '@/app/course-master/data/chapters';
import type { SessionContext } from '@/lib/erp-client';
import { NotProvided } from './shared';
import type { ApiChapter } from './types';

// LessonPlanDocumentPanel only ever reads id/number/title off each chapter
// (confirmed by reading the component) - the rest of the Chapter shape is
// course-master's own concept-intelligence payload, irrelevant here.
function toDocumentChapters(apiChapters: ApiChapter[], subjectId: string): DocumentChapter[] {
  return apiChapters.map((chapter) => ({
    id: String(chapter.chapter_id),
    courseId: subjectId,
    number: chapter.sort_order ?? 0,
    title: chapter.chapter_name,
    teachingMethodologies: [],
    resources: { teacherResource: 0, lessonPlanning: 0, chapterMapping: 0, hspContent: 0, questions: 0 },
  }));
}

export function LessonPlansTab({
  session,
  standardId,
  subjectId,
  chapterOptions,
  chapterId,
  setChapterId,
}: {
  session: SessionContext;
  standardId: number | null;
  subjectId: number | null;
  chapterOptions: ApiChapter[];
  chapterId: number | null;
  setChapterId: (id: number | null) => void;
}) {
  const router = useRouter();

  if (standardId === null || subjectId === null) {
    return <NotProvided label="Pick a Standard and Subject above to plan its lessons." />;
  }

  const courseId = `${subjectId}-${standardId}`;
  const documentChapters = toDocumentChapters(chapterOptions, String(subjectId));

  return (
    <div className="space-y-5">
      <LessonIntelligencePanel
        baseUrl={session.baseUrl}
        subInstituteId={session.subInstituteId}
        standardId={standardId}
        subjectId={subjectId}
        divisionId={null}
        syear={session.syear}
      />

      <LessonPlanDocumentPanel
        subjectId={String(subjectId)}
        standardId={String(standardId)}
        chapters={documentChapters}
        chapterId={chapterId !== null ? String(chapterId) : ''}
        onChapterIdChange={(id) => setChapterId(Number(id) || null)}
        onEdit={() =>
          router.push(
            `/course-master/lesson-plan-doc/${courseId}/edit${chapterId !== null ? `?chapterId=${chapterId}` : ''}`
          )
        }
      />
    </div>
  );
}
