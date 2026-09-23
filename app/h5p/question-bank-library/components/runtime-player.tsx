'use client';

import { QuestionPlayer } from '@/components/h5p/players';
import { H5P_TARGETS } from '@/lib/h5p/question-bank-h5p-map';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import type { PlayableActivity } from '../../data/question-bank-library';

/**
 * Renders a question bank question through the shared players.
 *
 * THIS FILE USED TO BE THE SWITCH. It held a branch per H5P type and knew
 * which prop each player took, which made the question bank library the place
 * that decided how a question is rendered. That decision now lives in
 * `components/h5p/players`, where PAL, homework, assignments and exams can
 * make the same one -- so this is a two-line delegation and the library has no
 * special knowledge of players at all.
 */
export function RuntimePlayer({
  question,
  chapter,
  embedded = true,
}: {
  question: QuestionBankApiQuestion;
  /** The chapter, so a case study stem can find its sub-parts. */
  chapter?: QuestionBankApiQuestion[];
  /** False on the full-screen route, where the player draws its own header. */
  embedded?: boolean;
}) {
  return <QuestionPlayer question={question} subParts={childrenOf(question, chapter ?? [])} embedded={embedded} />;
}

/**
 * Case study sub-parts belonging to a stem.
 *
 * Re-exported from the data layer rather than reimplemented; kept here so the
 * player surface has one import.
 */
function childrenOf(
  question: QuestionBankApiQuestion,
  chapter: QuestionBankApiQuestion[]
): QuestionBankApiQuestion[] {
  const code = String(question.question_type_code ?? '').toLowerCase();
  if (code !== 'case_study_parent') return [];

  const ordered = [...chapter].sort((a, b) => Number(a.id) - Number(b.id));
  const start = ordered.findIndex((row) => Number(row.id) === Number(question.id));
  if (start < 0) return [];

  const children: QuestionBankApiQuestion[] = [];
  for (const row of ordered.slice(start + 1)) {
    if (String(row.question_type_code ?? '').toLowerCase() !== 'case_study_child') break;
    children.push(row);
  }

  return children;
}

/**
 * The library a question plays through, for the surface that labels it.
 *
 * Read out of `H5P_TARGETS` rather than written out again here. This used to
 * be a switch with the eight library names spelled into it, which meant the
 * name a screen displayed and the name the activity actually carries were two
 * strings that had to be kept in step by hand — and adding a type meant
 * remembering this file.
 */
export function runtimeLibraryName(activity: PlayableActivity): string {
  return H5P_TARGETS[activity.kind].library;
}
