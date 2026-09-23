'use client';

import { useMemo } from 'react';
import {
  ARITHMETIC_OPERATIONS,
  DIFFICULTY_RANGES,
  OPERATION_LABEL,
  OPERATION_SYMBOL,
  generateArithmeticPaper,
  type ArithmeticOperation,
} from '@/lib/h5p/arithmetic-quiz';
import {
  ARITHMETIC_QUIZ_DEFAULTS,
  type ArithmeticQuizSavePayload,
  type H5pArithmeticQuiz,
} from '../../data/h5p-content-types';
import { CheckField, FieldGroup, NumberField, TextAreaField, TextField } from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';

/**
 * Arithmetic quiz — authoring editor.
 *
 * The editor state IS the save payload for this type. There are no children to
 * address by ref and nothing to position, so the indirection every other
 * editor in this family needs would be pure ceremony here.
 *
 * THE WORKED EXAMPLE IS THE POINT OF THIS SCREEN. An author choosing
 * "multiplication, hard" has no way to know that means questions up to
 * 100 × 100 until a class sits it. So the editor generates a real paper from
 * the current settings, with the real generator, and shows the first few
 * questions. It is not a mock-up — it is the same function the player calls,
 * which is why it cannot drift from what learners actually get.
 */

export type ArithmeticQuizEditorState = ArithmeticQuizSavePayload;

export function emptyArithmeticState(): ArithmeticQuizEditorState {
  return { ...ARITHMETIC_QUIZ_DEFAULTS, operations: [...ARITHMETIC_QUIZ_DEFAULTS.operations] };
}

export function arithmeticStateFromRow(row: H5pArithmeticQuiz): ArithmeticQuizEditorState {
  return {
    title: row.title ?? '',
    description: row.description ?? '',
    intro_text: row.intro_text ?? '',
    show_intro: row.show_intro,
    operations: [...(row.operations ?? ['addition'])],
    difficulty_level: row.difficulty_level,
    max_questions: row.max_questions,
    enable_timer: row.enable_timer,
    time_limit_seconds: row.time_limit_seconds,
    points_per_question: row.points_per_question,
    pass_percentage: row.pass_percentage,
    enable_retry: row.enable_retry,
    max_attempts: row.max_attempts,
    feedback_bands: row.feedback_bands ?? [],
  };
}

export function arithmeticToPayload(state: ArithmeticQuizEditorState): ArithmeticQuizSavePayload {
  return {
    ...state,
    title: state.title.trim(),
    // Clamped on the way out rather than while typing, so a half-deleted
    // number in a spinner does not snap back under the author's cursor.
    max_questions: Math.max(1, Math.min(100, state.max_questions || 1)),
    difficulty_level: Math.max(1, Math.min(3, state.difficulty_level || 1)),
    points_per_question: Math.max(1, Math.min(100, state.points_per_question || 1)),
    pass_percentage: Math.max(0, Math.min(100, state.pass_percentage || 0)),
    time_limit_seconds: Math.max(0, Math.min(7200, state.time_limit_seconds || 0)),
    max_attempts: Math.max(0, Math.min(100, state.max_attempts || 0)),
    operations: state.operations.length > 0 ? state.operations : ['addition'],
  };
}

/** Mirrors the server's publish check, in the author's words. */
export function validateArithmeticState(state: ArithmeticQuizEditorState): string[] {
  const problems: string[] = [];
  if (state.title.trim() === '') problems.push('Give the quiz a title.');
  if (state.operations.length === 0) problems.push('Choose at least one operation.');
  if (state.max_questions < 1) problems.push('Set how many questions the quiz asks.');
  return problems;
}

export function ArithmeticQuizEditor({
  state,
  onChange,
  disabled,
}: {
  state: ArithmeticQuizEditorState;
  onChange: (next: ArithmeticQuizEditorState) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof ArithmeticQuizEditorState>(key: K, value: ArithmeticQuizEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const toggleOperation = (operation: ArithmeticOperation) => {
    const next = state.operations.includes(operation)
      ? state.operations.filter((o) => o !== operation)
      : [...state.operations, operation];
    // Never allow the last one to be unticked: a quiz drawing from nothing
    // would generate nothing, and the author would have no way back except
    // ticking something again anyway.
    onChange({ ...state, operations: next.length > 0 ? next : state.operations });
  };

  // A real paper from the real generator, on a fixed seed so it does not
  // reshuffle on every keystroke while the author reads it.
  const sample = useMemo(
    () =>
      generateArithmeticPaper(
        {
          operations: state.operations,
          difficulty_level: state.difficulty_level,
          max_questions: Math.min(8, Math.max(1, state.max_questions || 1)),
        },
        20260921
      ),
    [state.operations, state.difficulty_level, state.max_questions]
  );

  const range = DIFFICULTY_RANGES[state.difficulty_level] ?? DIFFICULTY_RANGES[1];

  return (
    <div className="space-y-4">
      <FieldGroup title="About this quiz" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="Times tables — two minute drill"
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
          label="Start screen text"
          value={state.intro_text}
          onChange={(v) => set('intro_text', v)}
          disabled={disabled}
          hint="Shown above the start button."
          rows={2}
        />
        <CheckField
          label="Show a start screen"
          hint="Off means the first question appears immediately."
          checked={state.show_intro}
          onChange={(v) => set('show_intro', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup title="Questions" description="The questions are generated fresh for every attempt." columns={1}>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">
            Operations<span className="ml-0.5 text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {ARITHMETIC_OPERATIONS.map((operation) => {
              const on = state.operations.includes(operation);
              return (
                <button
                  key={operation}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => toggleOperation(operation)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                    on
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono text-sm">{OPERATION_SYMBOL[operation]}</span>
                  {OPERATION_LABEL[operation]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            Pick more than one and questions are drawn from all of them. H5P itself supports one operation per quiz, so
            an exported package will run as {OPERATION_LABEL[state.operations[0] ?? 'addition'].toLowerCase()} only
            outside this ERP.
          </p>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-700">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((level) => {
                const on = state.difficulty_level === level;
                const levelRange = DIFFICULTY_RANGES[level];
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => set('difficulty_level', level)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                      on
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {levelRange.label}
                    <span className="ml-1.5 font-normal tabular-nums text-slate-400">
                      {levelRange.min}–{levelRange.max}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Numbers are drawn from {range.min}–{range.max}. Division builds its questions backwards from a whole
              answer, so a dividend can be larger than that.
            </p>
          </fieldset>

          <NumberField
            label="Number of questions"
            value={state.max_questions}
            onChange={(v) => set('max_questions', v)}
            min={1}
            max={100}
            disabled={disabled}
            hint="1 to 100."
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            What learners will see
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sample.map((question) => (
              <span
                key={question.index}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs tabular-nums text-slate-700"
              >
                {question.prompt} = {question.answer}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            A real sample from these settings. Every attempt draws a different paper.
          </p>
        </div>
      </FieldGroup>

      <FieldGroup title="Timing and scoring">
        <CheckField
          label="Show a timer"
          hint="Records how long the attempt took. It does not end the quiz."
          checked={state.enable_timer}
          onChange={(v) => set('enable_timer', v)}
          disabled={disabled}
        />
        <NumberField
          label="Time limit"
          value={state.time_limit_seconds}
          onChange={(v) => set('time_limit_seconds', v)}
          min={0}
          max={7200}
          suffix="seconds"
          disabled={disabled}
          hint="0 means no limit. Unanswered questions still count against the total."
        />
        <NumberField
          label="Points per question"
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
        />
        <CheckField
          label="Allow retries"
          checked={state.enable_retry}
          onChange={(v) => set('enable_retry', v)}
          disabled={disabled}
        />
        <NumberField
          label="Maximum attempts"
          value={state.max_attempts}
          onChange={(v) => set('max_attempts', v)}
          min={0}
          max={100}
          disabled={disabled || !state.enable_retry}
          hint="0 means unlimited."
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
