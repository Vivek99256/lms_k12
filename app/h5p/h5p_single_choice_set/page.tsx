'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { singleChoiceSetApi, type H5pSingleChoiceSet } from '../data/h5p-content-types';
import { plainText } from '@/lib/h5p/single-choice-set';

/**
 * Single choice set — list page.
 *
 * The question count comes from the loaded rows and the max score from the
 * server's computed `max_score`, deliberately not recomputed here: the list,
 * the player and the analytics pipeline all have to agree on what an activity
 * is worth, and three independent counts is three chances to disagree.
 *
 * The search matches question TEXT as well as the title, because a teacher
 * looking for a set usually remembers a question in it rather than what they
 * called the set. It is matched as plain text, since the stored form is HTML
 * and nobody searches for "&amp;".
 */
export default function SingleChoiceSetListPage() {
  return (
    <ContentTypeListPage<H5pSingleChoiceSet>
      path="h5p_single_choice_set"
      title="Single choice set"
      description="A sequence of single-choice questions with instant feedback"
      noun="single choice set"
      emptyHint="Write a run of questions with one right answer each. Learners see them one at a time and find out straight away."
      api={singleChoiceSetApi as never}
      searchText={(row) => (row.questions ?? []).map((question) => plainText(question.question_text)).join(' ')}
      columns={[
        {
          header: 'Questions',
          numeric: true,
          render: (row) => (row.questions ?? []).length,
        },
        {
          header: 'Marks',
          numeric: true,
          render: (row) => row.max_score ?? 0,
        },
        {
          header: 'Pass mark',
          numeric: true,
          render: (row) => `${row.pass_percentage}%`,
        },
        {
          header: 'Order',
          render: (row) => {
            const shuffled = [
              row.randomize_questions ? 'questions' : null,
              row.randomize_answers ? 'answers' : null,
            ].filter(Boolean);

            return shuffled.length > 0 ? `Shuffles ${shuffled.join(' and ')}` : 'Fixed';
          },
        },
      ]}
    />
  );
}
