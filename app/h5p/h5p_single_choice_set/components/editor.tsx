'use client';

import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import {
  SINGLE_CHOICE_SET_DEFAULTS,
  blankSingleChoiceQuestion,
  type H5pSingleChoiceSet,
  type SingleChoiceOptionInput,
  type SingleChoiceQuestionInput,
  type SingleChoiceSetSavePayload,
} from '../../data/h5p-content-types';
import { plainText } from '@/lib/h5p/single-choice-set';
import { CheckField, FieldGroup, NumberField, TextAreaField, TextField } from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';
import { Input } from '@/components/ui/input';

/**
 * Single choice set — authoring editor.
 *
 * EXACTLY ONE OPTION IS CORRECT, AND THE UI IS WHAT MAKES THAT TRUE.
 *
 * The correct answer is a radio group per question, not a checkbox per option.
 * That is the whole design: a radio group cannot express "two right answers"
 * or "no right answer", so the invariant the server refuses a save over is
 * unreachable from this editor rather than merely validated against. Deleting
 * the correct option moves the mark to the first survivor for the same reason
 * — a question with nothing marked would be an error the author did not make.
 *
 * ORDER IS AUTHORING ORDER, NOT SCORING ORDER. The options appear here in the
 * order they were written; the player shuffles them when the author asks it
 * to, and the export puts the correct one first because the H5P format
 * requires it. Nothing about the position an author sees here is meaningful,
 * which is why the reorder buttons are a convenience rather than a setting.
 *
 * WHY THE FIELDS ARE PER OPTION AND NOT PER QUESTION. The feedback that
 * actually helps a learner is on the distractor they picked ("you may be
 * thinking of the Venus flytrap"), not the question's generic "not quite". So
 * the per-option box is always visible while the per-question one is folded
 * away under "more" — the layout is an argument about which one to write.
 */

export type SingleChoiceSetEditorState = SingleChoiceSetSavePayload;

export function emptySingleChoiceState(): SingleChoiceSetEditorState {
  return {
    ...SINGLE_CHOICE_SET_DEFAULTS,
    feedback_bands: [],
    // One question, opened up. An empty editor with an "add question" button
    // teaches an author nothing about what a question in this type is.
    questions: [blankSingleChoiceQuestion()],
  };
}

export function singleChoiceStateFromRow(row: H5pSingleChoiceSet): SingleChoiceSetEditorState {
  return {
    title: row.title ?? '',
    description: row.description ?? '',
    task_description: row.task_description ?? '',
    auto_continue: row.auto_continue,
    timeout_correct_ms: row.timeout_correct_ms,
    timeout_wrong_ms: row.timeout_wrong_ms,
    sound_effects: row.sound_effects,
    enable_retry: row.enable_retry,
    enable_show_solution: row.enable_show_solution,
    randomize_questions: row.randomize_questions,
    randomize_answers: row.randomize_answers,
    points_per_question: row.points_per_question,
    pass_percentage: row.pass_percentage,
    show_progress: row.show_progress,
    feedback_bands: row.feedback_bands ?? [],
    questions: (row.questions ?? []).map((question) => ({
      question_text: question.question_text ?? '',
      feedback_correct: question.feedback_correct ?? '',
      feedback_incorrect: question.feedback_incorrect ?? '',
      explanation: question.explanation ?? '',
      options: (question.options ?? []).map((option) => ({
        option_text: option.option_text ?? '',
        is_correct: Boolean(option.is_correct),
        feedback: option.feedback ?? '',
      })),
    })),
  };
}

export function singleChoiceToPayload(state: SingleChoiceSetEditorState): SingleChoiceSetSavePayload {
  return {
    ...state,
    title: state.title.trim(),
    // Clamped on the way out rather than while typing, so a half-deleted
    // number in a spinner does not snap back under the author's cursor.
    timeout_correct_ms: clamp(state.timeout_correct_ms, 0, 10000),
    timeout_wrong_ms: clamp(state.timeout_wrong_ms, 0, 10000),
    points_per_question: clamp(state.points_per_question || 1, 1, 100),
    pass_percentage: clamp(state.pass_percentage, 0, 100),
    questions: state.questions.map((question) => ({
      ...question,
      question_text: question.question_text.trim(),
      options: question.options.map((option) => ({ ...option, option_text: option.option_text.trim() })),
    })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}

/**
 * Mirrors the server's publish check, in the author's words.
 *
 * The "exactly one correct" rule is NOT listed here, because the radio group
 * makes it unreachable — a blocker for a state the UI cannot produce would be
 * a line of text nobody ever sees, and a reader of this file would reasonably
 * wonder how to trigger it.
 */
export function validateSingleChoiceState(state: SingleChoiceSetEditorState): string[] {
  const problems: string[] = [];

  if (state.title.trim() === '') problems.push('Give the set a title.');
  if (state.questions.length === 0) problems.push('Add at least one question.');

  state.questions.forEach((question, index) => {
    const position = index + 1;

    if (plainText(question.question_text) === '') {
      problems.push(`Question ${position} has no text.`);
    }

    const blank = question.options.filter((option) => plainText(option.option_text) === '').length;
    if (blank > 0) {
      problems.push(
        blank === 1
          ? `Question ${position} has a blank answer option.`
          : `Question ${position} has ${blank} blank answer options.`
      );
    }
  });

  return problems;
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

const iconButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40';

export function SingleChoiceSetEditor({
  state,
  onChange,
  disabled,
}: {
  state: SingleChoiceSetEditorState;
  onChange: (next: SingleChoiceSetEditorState) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof SingleChoiceSetEditorState>(key: K, value: SingleChoiceSetEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const setQuestions = (questions: SingleChoiceQuestionInput[]) => onChange({ ...state, questions });

  const updateQuestion = (index: number, patch: Partial<SingleChoiceQuestionInput>) =>
    setQuestions(state.questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));

  const moveQuestion = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= state.questions.length) return;

    const next = [...state.questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
  };

  return (
    <div className="space-y-4">
      <FieldGroup title="About this set" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="Science recap — states, forces and the solar system"
          maxLength={255}
        />
        <TextAreaField
          label="Description"
          value={state.description}
          onChange={(v) => set('description', v)}
          disabled={disabled}
          hint="For teachers, in the content list. Learners do not see this."
          rows={2}
        />
        <TextAreaField
          label="Introduction"
          value={state.task_description}
          onChange={(v) => set('task_description', v)}
          disabled={disabled}
          hint="Shown above the first question."
          rows={2}
        />
      </FieldGroup>

      <QuestionList
        questions={state.questions}
        disabled={disabled}
        onChange={setQuestions}
        onUpdate={updateQuestion}
        onMove={moveQuestion}
      />

      <FieldGroup title="How it plays">
        <CheckField
          label="Move on automatically"
          hint="After the feedback, the next question arrives by itself. Off, the learner presses to continue."
          checked={state.auto_continue}
          onChange={(v) => set('auto_continue', v)}
          disabled={disabled}
        />
        <CheckField
          label="Show the progress counter"
          hint='The "3 of 8" between questions.'
          checked={state.show_progress}
          onChange={(v) => set('show_progress', v)}
          disabled={disabled}
        />
        <NumberField
          label="Pause after a correct answer"
          value={state.timeout_correct_ms}
          onChange={(v) => set('timeout_correct_ms', v)}
          min={0}
          max={10000}
          suffix="ms"
          disabled={disabled}
          hint="0 means no pause."
        />
        <NumberField
          label="Pause after a wrong answer"
          value={state.timeout_wrong_ms}
          onChange={(v) => set('timeout_wrong_ms', v)}
          min={0}
          max={10000}
          suffix="ms"
          disabled={disabled}
          hint="Usually longer — there is more to read."
        />
        <CheckField
          label="Shuffle the questions"
          hint="Off keeps them in the order above, which matters when they build on each other."
          checked={state.randomize_questions}
          onChange={(v) => set('randomize_questions', v)}
          disabled={disabled}
        />
        <CheckField
          label="Shuffle the answers"
          hint="Stops the position of the right answer becoming a pattern."
          checked={state.randomize_answers}
          onChange={(v) => set('randomize_answers', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup title="Scoring">
        <NumberField
          label="Points per question"
          value={state.points_per_question}
          onChange={(v) => set('points_per_question', v)}
          min={1}
          max={100}
          disabled={disabled}
          hint="H5P itself scores one point per question, so an exported package will use 1."
        />
        <NumberField
          label="Pass mark"
          value={state.pass_percentage}
          onChange={(v) => set('pass_percentage', v)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
        />
        <CheckField
          label="Allow retries"
          checked={state.enable_retry}
          onChange={(v) => set('enable_retry', v)}
          disabled={disabled}
        />
        <CheckField
          label="Offer Show solution"
          hint="Lets a learner see the right answers and any explanations after finishing."
          checked={state.enable_show_solution}
          onChange={(v) => set('enable_show_solution', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FeedbackBandEditor
        bands={state.feedback_bands}
        onChange={(bands) => set('feedback_bands', bands)}
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function QuestionList({
  questions,
  disabled,
  onChange,
  onUpdate,
  onMove,
}: {
  questions: SingleChoiceQuestionInput[];
  disabled?: boolean;
  onChange: (questions: SingleChoiceQuestionInput[]) => void;
  onUpdate: (index: number, patch: Partial<SingleChoiceQuestionInput>) => void;
  onMove: (index: number, delta: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Questions</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Each question has exactly one right answer. Learners see them one at a time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...questions, blankSingleChoiceQuestion()])}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
          No questions yet. A set needs at least one before it can be published.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {questions.map((question, index) => (
            <QuestionRow
              key={index}
              index={index}
              total={questions.length}
              question={question}
              disabled={disabled}
              onUpdate={(patch) => onUpdate(index, patch)}
              onRemove={() => onChange(questions.filter((_, i) => i !== index))}
              onDuplicate={() =>
                onChange([
                  ...questions.slice(0, index + 1),
                  // A structural copy: the options array would otherwise be
                  // shared with the original, and editing one would edit both.
                  { ...question, options: question.options.map((option) => ({ ...option })) },
                  ...questions.slice(index + 1),
                ])
              }
              onMove={(delta) => onMove(index, delta)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionRow({
  index,
  total,
  question,
  disabled,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}: {
  index: number;
  total: number;
  question: SingleChoiceQuestionInput;
  disabled?: boolean;
  onUpdate: (patch: Partial<SingleChoiceQuestionInput>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}) {
  const position = index + 1;
  const groupName = `scs-correct-${index}`;

  const updateOption = (optionIndex: number, patch: Partial<SingleChoiceOptionInput>) =>
    onUpdate({
      options: question.options.map((option, i) => (i === optionIndex ? { ...option, ...patch } : option)),
    });

  /** Marking one option correct unmarks every other. The radio group's job. */
  const markCorrect = (optionIndex: number) =>
    onUpdate({
      options: question.options.map((option, i) => ({ ...option, is_correct: i === optionIndex })),
    });

  const removeOption = (optionIndex: number) => {
    const remaining = question.options.filter((_, i) => i !== optionIndex);
    // Deleting the right answer moves the mark to the first survivor rather
    // than leaving the question with nothing marked — which is a state the
    // author did not ask for and the server would refuse.
    if (!remaining.some((option) => option.is_correct) && remaining.length > 0) {
      remaining[0] = { ...remaining[0], is_correct: true };
    }
    onUpdate({ options: remaining });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
          {position}
        </span>

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${groupName}-text`}>
            Question {position}
          </label>
          <Input
            id={`${groupName}-text`}
            value={question.question_text}
            disabled={disabled}
            maxLength={5000}
            placeholder="Which state of matter has a fixed volume but takes the shape of its container?"
            onChange={(e) => onUpdate({ question_text: e.target.value })}
          />
        </div>

        <div className="mt-0.5 inline-flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            className={iconButton}
            aria-label={`Move question ${position} up`}
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            className={iconButton}
            aria-label={`Move question ${position} down`}
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
            className={iconButton}
            aria-label={`Duplicate question ${position}`}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            aria-label={`Remove question ${position}`}
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <fieldset className="mt-3 space-y-2">
        <legend className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Answers — select the correct one
        </legend>

        {question.options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex items-start gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
            <input
              type="radio"
              name={groupName}
              checked={option.is_correct}
              disabled={disabled}
              onChange={() => markCorrect(optionIndex)}
              className="mt-2.5 h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500"
              aria-label={`Mark answer ${optionIndex + 1} of question ${position} correct`}
            />

            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                value={option.option_text}
                disabled={disabled}
                maxLength={1000}
                placeholder={`Answer ${optionIndex + 1}`}
                onChange={(e) => updateOption(optionIndex, { option_text: e.target.value })}
                aria-label={`Answer ${optionIndex + 1} of question ${position}`}
              />
              <Input
                value={option.feedback}
                disabled={disabled}
                maxLength={1000}
                placeholder={
                  option.is_correct
                    ? 'Optional — shown when a learner picks this'
                    : 'Optional — what to say to a learner who picks this'
                }
                onChange={(e) => updateOption(optionIndex, { feedback: e.target.value })}
                className="text-xs"
                aria-label={`Feedback for answer ${optionIndex + 1} of question ${position}`}
              />
            </div>

            <button
              type="button"
              onClick={() => removeOption(optionIndex)}
              // Two is the floor: a single-choice question with one option has
              // no choice in it.
              disabled={disabled || question.options.length <= 2}
              className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              aria-label={`Remove answer ${optionIndex + 1} of question ${position}`}
              title={question.options.length <= 2 ? 'A question needs at least two answers' : 'Remove'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onUpdate({ options: [...question.options, { option_text: '', is_correct: false, feedback: '' }] })}
          disabled={disabled || question.options.length >= 6}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          Add answer
        </button>
      </fieldset>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-700">
          Feedback for the whole question, and an explanation
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={question.feedback_correct}
            disabled={disabled}
            maxLength={1000}
            placeholder="When they get it right"
            onChange={(e) => onUpdate({ feedback_correct: e.target.value })}
            className="text-xs"
            aria-label={`Correct-answer feedback for question ${position}`}
          />
          <Input
            value={question.feedback_incorrect}
            disabled={disabled}
            maxLength={1000}
            placeholder="When they do not"
            onChange={(e) => onUpdate({ feedback_incorrect: e.target.value })}
            className="text-xs"
            aria-label={`Wrong-answer feedback for question ${position}`}
          />
          <div className="sm:col-span-2">
            <Input
              value={question.explanation}
              disabled={disabled}
              maxLength={2000}
              placeholder="Explanation — shown with the solution at the end, whichever way they answered"
              onChange={(e) => onUpdate({ explanation: e.target.value })}
              className="text-xs"
              aria-label={`Explanation for question ${position}`}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
