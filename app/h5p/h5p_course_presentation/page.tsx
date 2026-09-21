'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { coursePresentationApi, type H5pCoursePresentation } from '../data/h5p-content-types';
import { SCORED_ELEMENT_TYPES } from '@/lib/h5p/course-presentation-scoring';

/**
 * Course presentation — list page.
 *
 * A deck's useful summary is slides, questions and marks — not element count,
 * which is dominated by text boxes and tells a teacher nothing.
 */
function scoredElements(row: H5pCoursePresentation) {
  return (row.slides ?? [])
    .flatMap((slide) => slide.elements ?? [])
    .filter((element) => (SCORED_ELEMENT_TYPES as string[]).includes(element.element_type));
}

export default function CoursePresentationListPage() {
  return (
    <ContentTypeListPage<H5pCoursePresentation>
      path="h5p_course_presentation"
      title="Course presentation"
      description="Interactive slide-based learning presentations with multimedia and questions"
      noun="presentation"
      emptyHint="Build a deck of slides carrying text, media and questions, or import an existing .h5p package."
      api={coursePresentationApi as never}
      searchText={(row) => (row.slides ?? []).map((slide) => slide.title ?? '').join(' ')}
      columns={[
        { header: 'Slides', numeric: true, render: (row) => row.slides?.length ?? 0 },
        { header: 'Questions', numeric: true, render: (row) => scoredElements(row).length },
        {
          header: 'Marks',
          numeric: true,
          render: (row) => {
            // `max_score` is computed server-side and sent with every row, so
            // the list, the player and the analytics pipeline agree. The local
            // sum is only a fallback for a row that predates that field.
            const marks = row.max_score ?? scoredElements(row).reduce((sum, e) => sum + (e.points ?? 0), 0);
            // A lecture deck is a legitimate deck, and "0" reads like an error.
            return marks > 0 ? marks : 'Not marked';
          },
        },
        {
          header: 'Navigation',
          render: (row) =>
            row.active_surface
              ? 'On-slide only'
              : (row.slides ?? []).some((slide) => slide.next_slide_id !== null)
                ? 'Branching'
                : 'Linear',
        },
      ]}
    />
  );
}
