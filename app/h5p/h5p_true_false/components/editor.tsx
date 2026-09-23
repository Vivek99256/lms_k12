'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  TRUE_FALSE_DEFAULTS,
  blankTrueFalseQuestion,
  trueFalseApi,
  type H5pTrueFalse,
  type TrueFalseQuestionInput,
  type TrueFalseSavePayload,
} from '../../data/h5p-content-types';
import { answerBalance, plainText } from '@/lib/h5p/true-false';
import { CheckField, FieldGroup, NumberField, TextAreaField, TextField } from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';
import { Input } from '@/components/ui/input';

/**
 * True/false — authoring editor.
 *
 * AN ITEM IS A POOL, AND THE EDITOR SAYS SO IN THE ONLY WAY THAT WORKS: by
 * showing the balance of true and false answers as the author writes. A pool
 * whose answers are all the same can be scored full marks by pressing the same
 * button repeatedly, and it is a mistake made by writing the statements one
 * knows to be true and forgetting to write any one knows to be false. The
 * server refuses to publish one; the counter here is what stops that being a
 * surprise at the end of an afternoon's authoring.
 *
 * TRUE AND FALSE ARE TWO BUTTONS, NOT A CHECKBOX. A checkbox labelled
 * "correct answer is true" reads as a setting to leave alone, and leaving it
 * alone marks the statement true — an answer nobody chose. Two buttons make
 * the choice explicit and make it visible at a glance down a list of twenty.
 *
 * `questions_to_ask` IS SHOWN AGAINST THE POOL SIZE, because the number only
 * means something relative to it: "10" is a draw from a pool of twenty and a
 * no-op on a pool of eight.
 */

export type TrueFalseEditorState = TrueFalseSavePayload;

export function emptyTrueFalseState(): TrueFalseEditorState {
  return {
    ...TRUE_FALSE_DEFAULTS,
    feedback_bands: [],
    // Two statements, one of each answer. One statement would be a pool an
    // author cannot see the point of, and two of the same answer would open
    // the editor already showing its own warning.
    questions: [
      { ...blankTrueFalseQuestion(), correct_answer: true },
      { ...blankTrueFalseQuestion(), correct_answer: false },
    ],
  };
}

export function trueFalseStateFromRow(row: H5pTrueFalse): TrueFalseEditorState {
  return {
    title: row.title ?? '',
    description: row.description ?? '',
    task_description: row.task_description ?? '',
    enable_retry: row.enable_retry,
    enable_show_solution: row.enable_show_solution,
    enable_check_button: row.enable_check_button,
    auto_check: row.auto_check,
    confirm_check_dialog: row.confirm_check_dialog,
    confirm_retry_dialog: row.confirm_retry_dialog,
    randomize_questions: row.randomize_questions,
    questions_to_ask: row.questions_to_ask,
    points_per_question: row.points_per_question,
    pass_percentage: row.pass_percentage,
    show_progress: row.show_progress,
    feedback_bands: row.feedback_bands ?? [],
    questions: (row.questions ?? []).map((question) => ({
      question_text: question.question_text ?? '',
      correct_answer: Boolean(question.correct_answer),
      feedback_correct: question.feedback_correct ?? '',
      feedback_incorrect: question.feedback_incorrect ?? '',
      explanation: question.explanation ?? '',
      media_image: question.media_image ?? '',
      media_alt: question.media_alt ?? '',
    })),
  };
}

export function trueFalseToPayload(state: TrueFalseEditorState): TrueFalseSavePayload {
  return {
    ...state,
    title: state.title.trim(),
    points_per_question: clamp(state.points_per_question || 1, 1, 100),
    pass_percentage: clamp(state.pass_percentage, 0, 100),
    // Clamped to the pool being saved, exactly as the server clamps it. The
    // two agreeing is what stops an attempt being scored out of a number of
    // questions it never asked.
    questions_to_ask: clamp(state.questions_to_ask, 0, state.questions.length),
    questions: state.questions.map((question) => ({
      ...question,
      question_text: question.question_text.trim(),
      // Alt text with no picture is a description of nothing, and would
      // survive into an export as an empty image node.
      media_alt: question.media_image.trim() === '' ? '' : question.media_alt,
    })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}

/** Mirrors the server's publish check, in the author's words. */
export function validateTrueFalseState(state: TrueFalseEditorState): string[] {
  const problems: string[] = [];

  if (state.title.trim() === '') problems.push('Give the activity a title.');
  if (state.questions.length === 0) problems.push('Add at least one statement.');

  state.questions.forEach((question, index) => {
    if (plainText(question.question_text) === '') {
      problems.push(`Statement ${index + 1} has no text.`);
    }

    if (question.media_image.trim() !== '' && question.media_alt.trim() === '') {
      problems.push(`Statement ${index + 1} has a picture with no description.`);
    }
  });

  const balance = answerBalance(
    state.questions.map((question, index) => ({
      id: index,
      question_text: question.question_text,
      correct_answer: question.correct_answer,
    }))
  );

  if (balance.lopsided) {
    problems.push(
      balance.falseCount === 0
        ? 'Every statement is true, so the activity can be answered without reading it. Add some that are false.'
        : 'Every statement is false, so the activity can be answered without reading it. Add some that are true.'
    );
  }

  return problems;
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

const iconButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40';

export function TrueFalseEditor({
  state,
  onChange,
  disabled,
}: {
  state: TrueFalseEditorState;
  onChange: (next: TrueFalseEditorState) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof TrueFalseEditorState>(key: K, value: TrueFalseEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const setQuestions = (questions: TrueFalseQuestionInput[]) => onChange({ ...state, questions });

  const updateQuestion = (index: number, patch: Partial<TrueFalseQuestionInput>) =>
    setQuestions(state.questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));

  const moveQuestion = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= state.questions.length) return;

    const next = [...state.questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
  };

  const balance = useMemo(
    () =>
      answerBalance(
        state.questions.map((question, index) => ({
          id: index,
          question_text: question.question_text,
          correct_answer: question.correct_answer,
        }))
      ),
    [state.questions]
  );

  const asked = state.questions_to_ask > 0
    ? Math.min(state.questions_to_ask, state.questions.length)
    : state.questions.length;

  return (
    <div className="space-y-4">
      <FieldGroup title="About this activity" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="General knowledge — true or false"
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
          hint="Shown above the first statement."
          rows={2}
        />
      </FieldGroup>

      <StatementList
        questions={state.questions}
        balance={balance}
        disabled={disabled}
        onChange={setQuestions}
        onUpdate={updateQuestion}
        onMove={moveQuestion}
      />

      <FieldGroup title="How it plays">
        <CheckField
          label="Mark each answer straight away"
          hint="Instant feedback: the answer is marked the moment it is chosen, with no Check button."
          checked={state.auto_check}
          onChange={(v) =>
            // With instant marking on there is nothing left for Check to do,
            // and leaving the button there means a button that does nothing.
            onChange({ ...state, auto_check: v, enable_check_button: v ? false : state.enable_check_button })
          }
          disabled={disabled}
        />
        <CheckField
          label="Show the Check button"
          hint="Lets a learner change their mind before committing."
          checked={state.enable_check_button}
          onChange={(v) => set('enable_check_button', v)}
          disabled={disabled || state.auto_check}
        />
        <CheckField
          label="Show the progress counter"
          hint='The "3 of 10" above each statement.'
          checked={state.show_progress}
          onChange={(v) => set('show_progress', v)}
          disabled={disabled}
        />
        <CheckField
          label="Shuffle the statements"
          checked={state.randomize_questions}
          onChange={(v) => set('randomize_questions', v)}
          disabled={disabled}
        />
        <NumberField
          label="Statements to ask"
          value={state.questions_to_ask}
          onChange={(v) => set('questions_to_ask', v)}
          min={0}
          max={Math.max(1, state.questions.length)}
          disabled={disabled}
          hint={
            state.questions_to_ask > 0
              ? `${asked} of the ${state.questions.length} below, drawn fresh each attempt.`
              : `0 means all ${state.questions.length}. Set a smaller number to draw from the pool.`
          }
        />
        <CheckField
          label="Confirm before checking"
          hint="Asks the learner to confirm. Useful when there is no retry."
          checked={state.confirm_check_dialog}
          onChange={(v) => set('confirm_check_dialog', v)}
          disabled={disabled || state.auto_check}
        />
      </FieldGroup>

      <FieldGroup title="Scoring">
        <NumberField
          label="Points per statement"
          value={state.points_per_question}
          onChange={(v) => set('points_per_question', v)}
          min={1}
          max={100}
          disabled={disabled}
        />
        <NumberField
          label="Pass mark"
          value={state.pass_percentage}
          onChange={(v) => set('pass_percentage', v)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
          hint="A two-way question is guessable half the time, so a low pass mark means very little here."
        />
        <CheckField
          label="Allow retries"
          checked={state.enable_retry}
          onChange={(v) => set('enable_retry', v)}
          disabled={disabled}
        />
        <CheckField
          label="Offer Show solution"
          hint="Lets a learner see the answers and any explanations after finishing."
          checked={state.enable_show_solution}
          onChange={(v) => set('enable_show_solution', v)}
          disabled={disabled}
        />
        <CheckField
          label="Confirm before retrying"
          checked={state.confirm_retry_dialog}
          onChange={(v) => set('confirm_retry_dialog', v)}
          disabled={disabled || !state.enable_retry}
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
// Statements
// ---------------------------------------------------------------------------

function StatementList({
  questions,
  balance,
  disabled,
  onChange,
  onUpdate,
  onMove,
}: {
  questions: TrueFalseQuestionInput[];
  balance: { trueCount: number; falseCount: number; lopsided: boolean };
  disabled?: boolean;
  onChange: (questions: TrueFalseQuestionInput[]) => void;
  onUpdate: (index: number, patch: Partial<TrueFalseQuestionInput>) => void;
  onMove: (index: number, delta: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Statements</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Each one is answered true or false. Write as many as you like and ask a subset of them.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...questions,
              // A new statement takes the answer that is currently scarcer,
              // which nudges a pool towards balance without overriding anyone.
              { ...blankTrueFalseQuestion(), correct_answer: balance.trueCount <= balance.falseCount },
            ])
          }
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add statement
        </button>
      </div>

      {questions.length > 0 ? (
        <p
          className={`mt-3 text-[11px] ${balance.lopsided ? 'text-amber-700' : 'text-slate-500'}`}
          aria-live="polite"
        >
          <span className="tabular-nums">{balance.trueCount} true</span> ·{' '}
          <span className="tabular-nums">{balance.falseCount} false</span>
          {balance.lopsided
            ? ' — every statement has the same answer, so this can be answered without being read.'
            : ''}
        </p>
      ) : null}

      {questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
          No statements yet. This activity needs at least one before it can be published.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {questions.map((question, index) => (
            <StatementRow
              key={index}
              index={index}
              total={questions.length}
              question={question}
              disabled={disabled}
              onUpdate={(patch) => onUpdate(index, patch)}
              onRemove={() => onChange(questions.filter((_, i) => i !== index))}
              onDuplicate={() =>
                onChange([...questions.slice(0, index + 1), { ...question }, ...questions.slice(index + 1)])
              }
              onMove={(delta) => onMove(index, delta)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StatementRow({
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
  question: TrueFalseQuestionInput;
  disabled?: boolean;
  onUpdate: (patch: Partial<TrueFalseQuestionInput>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}) {
  const position = index + 1;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const url = await trueFalseApi.uploadMedia(file, 'image');
      onUpdate({ media_image: url });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload that picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
          {position}
        </span>

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`tf-statement-${index}`}>
            Statement {position}
          </label>
          <Input
            id={`tf-statement-${index}`}
            value={question.question_text}
            disabled={disabled}
            maxLength={5000}
            placeholder="The Pacific is the largest ocean on Earth."
            onChange={(e) => onUpdate({ question_text: e.target.value })}
          />
        </div>

        <div className="mt-0.5 inline-flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            className={iconButton}
            aria-label={`Move statement ${position} up`}
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            className={iconButton}
            aria-label={`Move statement ${position} down`}
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
            className={iconButton}
            aria-label={`Duplicate statement ${position}`}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            aria-label={`Remove statement ${position}`}
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <fieldset className="inline-flex items-center gap-1.5">
          <legend className="sr-only">Correct answer for statement {position}</legend>
          <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">Answer</span>

          {[true, false].map((value) => {
            const on = question.correct_answer === value;
            return (
              <button
                key={String(value)}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => onUpdate({ correct_answer: value })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  on
                    ? value
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {value ? 'True' : 'False'}
              </button>
            );
          })}
        </fieldset>

        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          {question.media_image ? 'Replace picture' : 'Add a picture'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared before the await so choosing the same file twice in a
              // row still fires a change event.
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
        </label>
      </div>

      {uploadError ? <p className="mt-1.5 text-[11px] text-red-600">{uploadError}</p> : null}

      {question.media_image ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.media_image}
            alt={question.media_alt || ''}
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              value={question.media_alt}
              disabled={disabled}
              maxLength={255}
              placeholder="Describe the picture — required before this can be published"
              onChange={(e) => onUpdate({ media_alt: e.target.value })}
              className="text-xs"
              aria-label={`Picture description for statement ${position}`}
            />
            <button
              type="button"
              onClick={() => onUpdate({ media_image: '', media_alt: '' })}
              disabled={disabled}
              className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-40"
            >
              Remove picture
            </button>
          </div>
        </div>
      ) : null}

      <details className="mt-2.5">
        <summary className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-700">
          Feedback and explanation
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={question.feedback_correct}
            disabled={disabled}
            maxLength={1000}
            placeholder="When they get it right"
            onChange={(e) => onUpdate({ feedback_correct: e.target.value })}
            className="text-xs"
            aria-label={`Correct-answer feedback for statement ${position}`}
          />
          <Input
            value={question.feedback_incorrect}
            disabled={disabled}
            maxLength={1000}
            placeholder="When they do not"
            onChange={(e) => onUpdate({ feedback_incorrect: e.target.value })}
            className="text-xs"
            aria-label={`Wrong-answer feedback for statement ${position}`}
          />
          <div className="sm:col-span-2">
            <Input
              value={question.explanation}
              disabled={disabled}
              maxLength={2000}
              placeholder="Explanation — shown with the solution, whichever way they answered"
              onChange={(e) => onUpdate({ explanation: e.target.value })}
              className="text-xs"
              aria-label={`Explanation for statement ${position}`}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
