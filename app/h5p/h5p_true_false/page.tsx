'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { trueFalseApi, type H5pTrueFalse } from '../data/h5p-content-types';
import { plainText } from '@/lib/h5p/true-false';

/**
 * True/false — list page.
 *
 * The "Asked" column shows the draw rather than the pool, because that is what
 * a learner sits: a pool of twenty asking ten is a ten-question activity, and
 * a teacher scanning this list for something that fits the last ten minutes of
 * a lesson needs the ten, not the twenty. The pool size is beside it so the
 * two are never confused.
 */
export default function TrueFalseListPage() {
  return (
    <ContentTypeListPage<H5pTrueFalse>
      path="h5p_true_false"
      title="True or false"
      description="True or false statements with automated scoring and feedback"
      noun="true or false activity"
      emptyHint="Write a pool of statements and ask all of them, or a different few each time."
      api={trueFalseApi as never}
      searchText={(row) => (row.questions ?? []).map((question) => plainText(question.question_text)).join(' ')}
      columns={[
        {
          header: 'Statements',
          numeric: true,
          render: (row) => (row.questions ?? []).length,
        },
        {
          header: 'Asked',
          numeric: true,
          render: (row) => {
            const pool = (row.questions ?? []).length;
            const asked = row.questions_to_ask > 0 ? Math.min(row.questions_to_ask, pool) : pool;

            return asked === pool ? 'All' : `${asked} of ${pool}`;
          },
        },
        {
          header: 'Marks',
          numeric: true,
          render: (row) => row.max_score ?? 0,
        },
        {
          header: 'Feedback',
          render: (row) => (row.auto_check ? 'Instant' : 'On check'),
        },
      ]}
    />
  );
}
