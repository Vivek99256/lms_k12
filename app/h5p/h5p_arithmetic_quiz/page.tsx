'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { arithmeticQuizApi, type H5pArithmeticQuiz } from '../data/h5p-content-types';
import { DIFFICULTY_RANGES, OPERATION_SYMBOL } from '@/lib/h5p/arithmetic-quiz';

/**
 * Arithmetic quiz — list page.
 *
 * The operations column shows the SYMBOLS rather than the words, because a
 * teacher scanning a list of drills is looking for "× ÷" and four spelled-out
 * operation names in a table cell wrap to three lines.
 */
export default function ArithmeticQuizListPage() {
  return (
    <ContentTypeListPage<H5pArithmeticQuiz>
      path="h5p_arithmetic_quiz"
      title="Arithmetic quiz"
      description="Automatically generated arithmetic questions for learner practice"
      noun="arithmetic quiz"
      emptyHint="Choose the operations and the difficulty, and the questions are generated for every attempt."
      api={arithmeticQuizApi as never}
      searchText={(row) => row.intro_text ?? ''}
      columns={[
        {
          header: 'Operations',
          render: (row) => (
            <span className="font-mono text-sm">
              {(row.operations ?? []).map((operation) => OPERATION_SYMBOL[operation] ?? '?').join(' ')}
            </span>
          ),
        },
        {
          header: 'Level',
          render: (row) => {
            const range = DIFFICULTY_RANGES[row.difficulty_level] ?? DIFFICULTY_RANGES[1];
            return `${range.label} (${range.min}–${range.max})`;
          },
        },
        { header: 'Questions', numeric: true, render: (row) => row.max_questions },
        {
          header: 'Time limit',
          numeric: true,
          render: (row) => (row.time_limit_seconds > 0 ? `${row.time_limit_seconds}s` : 'Untimed'),
        },
      ]}
    />
  );
}
