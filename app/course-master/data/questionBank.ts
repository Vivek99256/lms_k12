'use client';

/**
 * Question bank questions, shared by the teacher's Course Master bank and the
 * student's read-only bank.
 *
 * Both screens show the same questions, so the fetch, the answer/concept
 * derivation and the grouping live here rather than in either page. What differs
 * between them is only whether the card carries Edit/Delete actions, which is a
 * rendering concern, not a data one.
 */
import { fetchQuestionBank, type QuestionBankApiQuestion } from './chapters';

/**
 * The only parts of a chapter this module reads. Kept structural so the teacher
 * can pass its full `Chapter` while the student passes its own lighter chapter
 * shape, without either side casting.
 */
export type QuestionBankChapterRef = {
  title?: string;
  concepts?: Array<{ id: string; title: string }>;
  topics?: Array<{ id: string; title: string }>;
};

export const QUESTION_BANK_TYPES = ['MCQ', 'Narrative'] as const;

/**
 * The PAL learning-flow categories, in the order a learner meets them.
 *
 * These mirror `lms_question_master.category` (and `pal_question_metadata.stage`,
 * which the PAL engine reads). `value` must stay byte-identical to what question
 * generation stores: the bank matches the stored value exactly, and the ERP
 * endpoint accepts the same value as a server-side filter.
 */
export const QUESTION_BANK_CATEGORIES = [
  { value: 'prerequisite', label: 'Prerequisite check', step: 1 },
  { value: 'adaptive_diagnostic', label: 'Adaptive diagnostic', step: 2 },
  { value: 'concept_diagnostic', label: 'Concept diagnosis', step: 3 },
  { value: 'concept_understanding', label: 'Check for understanding', step: 6 },
  { value: 'misconception_detection', label: 'Misconception detection', step: 6 },
  { value: 'prerequisite_concept_check', label: 'Prerequisite re-check', step: 7 },
  { value: 'adaptive_test', label: 'Adaptive practice', step: 8 },
  { value: 'mastery_check', label: 'Mastery check', step: 9 },
  { value: 'mastery_reverification', label: 'Mastery re-verification', step: 11 },
] as const;

export type QuestionBankCategory = (typeof QUESTION_BANK_CATEGORIES)[number]['value'];

/** Teacher-facing label for a stored category value. */
export function questionBankCategoryLabel(value?: string | null): string {
  if (!value) return 'Uncategorised';
  return QUESTION_BANK_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export type QuestionBankQuestionType = (typeof QUESTION_BANK_TYPES)[number];

export interface QuestionBankOption {
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuestionBankItem {
  id: string;
  displayId: string;
  chapterId: string;
  chapterTitle: string;
  conceptTitle: string;
  category: string;
  /** PAL learning-flow category from lms_question_master.category. Distinct from
   *  `category` above, which is the caller's subject-area label. */
  palCategory: string | null;
  type: QuestionBankQuestionType;
  marks: number;
  question: string;
  options?: QuestionBankOption[];
  modelAnswer?: string;
}

export interface QuestionBankGroup {
  id: string;
  chapterId: string;
  chapterTitle: string;
  conceptTitle: string;
  category: string;
  questions: QuestionBankItem[];
}

/**
 * A model answer that is really a serialised MCQ payload rather than prose. Those
 * are already rendered as options, so the card must not print the raw JSON.
 */
export function isLikelyJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

/**
 * The question's type as stored against it. The API normalises the
 * question_type_master label (which spells multiple-choice 'multiple') down to
 * the two types the bank shows, so this only has to defend against casing.
 */
export function normaliseQuestionBankType(value: string | undefined): QuestionBankQuestionType {
  return (value ?? '').trim().toUpperCase() === 'MCQ' ? 'MCQ' : 'Narrative';
}

export function deriveQuestionBankAnswer(
  q: QuestionBankApiQuestion
): { type: QuestionBankQuestionType; options?: QuestionBankOption[]; modelAnswer?: string } {
  const type = normaliseQuestionBankType(q.question_type);

  if (q.options && q.options.length > 0) {
    return {
      type,
      options: q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.is_correct })),
      modelAnswer: type === 'MCQ' ? undefined : q.model_answer,
    };
  }

  if (q.model_answer) {
    try {
      const parsed = JSON.parse(q.model_answer) as {
        question_type?: string;
        options?: Array<{ label: string; text: string; is_correct?: boolean }>;
        correct_option?: string;
      };

      if (Array.isArray(parsed.options) && parsed.options.length > 0) {
        return {
          type,
          options: parsed.options.map((o) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.is_correct ?? o.label === parsed.correct_option,
          })),
          modelAnswer: undefined,
        };
      }
    } catch {
      // model_answer isn't structured JSON — treat it as a plain-text model answer below.
    }
  }

  return {
    type,
    options: undefined,
    modelAnswer: q.model_answer,
  };
}

/**
 * The concept a question is filed under.
 *
 * A question carries two different links: `concept_id` points at lms_concept and
 * `topic_id` at topic_master. They are separate id spaces, so each is resolved
 * against its own list — matching a topic id against the concept rows is what used
 * to yield "Topic 23740" labels and fill the concept dropdown with them. `concept`
 * is the name stored on the question itself and covers rows whose ids no longer
 * resolve against the chapter.
 */
export function resolveQuestionConceptTitle(
  q: QuestionBankApiQuestion,
  chapter: QuestionBankChapterRef | undefined
): string {
  if (q.concept_id) {
    const byConceptId = chapter?.concepts?.find((c) => Number(c.id) === Number(q.concept_id));
    if (byConceptId?.title.trim()) return byConceptId.title.trim();
  }

  if (q.concept?.trim()) return q.concept.trim();

  if (q.topic_id) {
    const byTopicId = chapter?.topics?.find((t) => Number(t.id) === Number(q.topic_id));
    if (byTopicId?.title.trim()) return byTopicId.title.trim();
  }

  return 'General';
}

/**
 * Fetch one chapter's questions, mapped to what the cards render.
 *
 * `resolveCategory` is the caller's own labelling of a question's subject area.
 * The teacher bank derives it from the course; the student bank has no course in
 * hand, so it falls back to a fixed label rather than inventing a subject.
 */
export async function fetchMappedQuestionBank(
  chapterId: number,
  chapter: QuestionBankChapterRef | undefined,
  resolveCategory?: (chapter: QuestionBankChapterRef | undefined, conceptTitle: string) => string
): Promise<QuestionBankItem[]> {
  const response = await fetchQuestionBank(chapterId);

  return response.data.map((q: QuestionBankApiQuestion) => {
    const conceptTitle = resolveQuestionConceptTitle(q, chapter);
    const { type, options, modelAnswer } = deriveQuestionBankAnswer(q);

    return {
      id: String(q.id),
      displayId: `QB-${q.id}`,
      chapterId: String(q.chapter_id),
      chapterTitle: chapter?.title ?? 'Unknown Chapter',
      conceptTitle,
      category: resolveCategory ? resolveCategory(chapter, conceptTitle) : 'Question Bank',
      palCategory: q.category ?? null,
      type,
      marks: q.marks ?? 1,
      question: q.question,
      options,
      modelAnswer,
    };
  });
}

/** Questions bucketed by chapter + concept, in first-seen order. */
export function groupQuestionBankItems(items: QuestionBankItem[]): QuestionBankGroup[] {
  const groups: QuestionBankGroup[] = [];
  const groupLookup = new Map<string, QuestionBankGroup>();

  items.forEach((question) => {
    const key = `${question.chapterId}-${question.conceptTitle}`;
    const existingGroup = groupLookup.get(key);

    if (existingGroup) {
      existingGroup.questions.push(question);
      return;
    }

    const group: QuestionBankGroup = {
      id: key,
      chapterId: question.chapterId,
      chapterTitle: question.chapterTitle,
      conceptTitle: question.conceptTitle,
      category: question.category,
      questions: [question],
    };

    groupLookup.set(key, group);
    groups.push(group);
  });

  return groups;
}
