'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  TEXT_ACTIVITY_DESCRIPTIONS,
  TEXT_ACTIVITY_LABELS,
  TEXT_ACTIVITY_LIBRARIES,
  answerKey,
  passageProblems,
  uploadTextActivityImage,
  type H5pTextActivity,
  type TextActivitySavePayload,
  type TextActivityType,
} from '../../data/h5p';

/**
 * The authoring surface for all three text-passage types.
 *
 * ONE EDITOR, THREE TYPES -- for the same reason the server has one
 * controller: the three agree on everything except which behaviour settings
 * make sense, and three copies of a passage editor would be three places to
 * fix the next markup bug. `FIELDS` below is the whole of the difference.
 *
 * THE LIVE ANSWER KEY IS THE POINT OF THIS SCREEN.
 *
 * Every mistake this markup invites is invisible in the raw text: an unclosed
 * asterisk silently deletes a blank, a stray colon silently turns half an
 * answer into a tip, and a distractor that matches an answer silently makes
 * the activity easier. So the parsed result is shown beside the passage as the
 * author types, parsed by the SAME grammar the server stores
 * (lib/h5p/text-activity-markup.ts). The author never has to save to find out
 * what they wrote.
 */

export interface TextActivityEditorState {
  title: string;
  description: string;
  taskDescription: string;
  passage: string;
  distractors: string;
  mediaImage: string;
  mediaAlt: string;

  enableRetry: boolean;
  enableShowSolution: boolean;
  enableCheck: boolean;
  caseSensitive: boolean;
  acceptSpellingErrors: boolean;
  instantFeedback: boolean;
  showScorePoints: boolean;
  separateLines: boolean;
  solutionRequiresInput: boolean;

  pointsPerBlank: number;
  passPercentage: number;
  feedbackBands: Array<{ from: number; to: number; feedback: string }>;
}

/**
 * Which behaviour settings each type actually honours.
 *
 * A setting that does nothing is worse than a missing one: an author who ticks
 * "case sensitive" on Mark the Words reasonably expects it to matter, and
 * nothing tells them it does not. The server normalises the same way in
 * `H5PTextActivityController::attributes()`, so hiding a field here and
 * discarding it there are the same decision written twice deliberately.
 */
const FIELDS: Record<
  TextActivityType,
  {
    distractors: boolean;
    caseSensitive: boolean;
    spellingErrors: boolean;
    separateLines: boolean;
    solutionRequiresInput: boolean;
    instantFeedback: boolean;
  }
> = {
  drag_text: {
    distractors: true,
    caseSensitive: false,
    spellingErrors: false,
    separateLines: false,
    solutionRequiresInput: false,
    instantFeedback: true,
  },
  fill_in_the_blanks: {
    distractors: false,
    caseSensitive: true,
    spellingErrors: true,
    separateLines: true,
    solutionRequiresInput: true,
    instantFeedback: true,
  },
  mark_the_words: {
    distractors: false,
    caseSensitive: false,
    spellingErrors: false,
    separateLines: false,
    solutionRequiresInput: false,
    // A word is marked or it is not -- there is no partial state to give
    // instant feedback on, and Check is the moment of truth.
    instantFeedback: false,
  },
};

/** What the markup means, in the words of each type. */
const MARKUP_HINTS: Record<TextActivityType, string> = {
  drag_text:
    'Wrap each word learners drag into place in asterisks. Add a hint after a colon: *Norway:It is a Nordic country*.',
  fill_in_the_blanks:
    'Wrap each answer in asterisks. Separate alternatives with a slash and add a hint after a colon: *Norway/Noreg:It is a Nordic country*.',
  mark_the_words:
    'Wrap each word learners should mark in asterisks: The *dog* chased the *cat*.',
};

/** A starting passage per type, so the first screen is never a blank box. */
const PLACEHOLDERS: Record<TextActivityType, string> = {
  drag_text: 'Oslo is the capital of *Norway*.',
  fill_in_the_blanks: 'Oslo is the capital of *Norway/Noreg:It is a Nordic country*.',
  mark_the_words: 'The dog *ran* across the yard and *barked* twice.',
};

export function emptyEditorState(): TextActivityEditorState {
  return {
    title: '',
    description: '',
    taskDescription: '',
    passage: '',
    distractors: '',
    mediaImage: '',
    mediaAlt: '',

    enableRetry: true,
    enableShowSolution: true,
    enableCheck: true,
    caseSensitive: false,
    acceptSpellingErrors: false,
    instantFeedback: false,
    showScorePoints: true,
    separateLines: false,
    solutionRequiresInput: true,

    pointsPerBlank: 1,
    passPercentage: 100,
    feedbackBands: [
      { from: 0, to: 49, feedback: 'Keep practising — read the passage again.' },
      { from: 50, to: 99, feedback: 'Good work. Check the ones you missed.' },
      { from: 100, to: 100, feedback: 'Everything correct.' },
    ],
  };
}

/** An existing row as editor state, for the edit page. */
export function editorStateFrom(activity: H5pTextActivity): TextActivityEditorState {
  const base = emptyEditorState();

  return {
    ...base,
    title: activity.title ?? '',
    description: activity.description ?? '',
    taskDescription: activity.task_description ?? '',
    passage: activity.passage ?? '',
    distractors: activity.distractors ?? '',
    mediaImage: activity.media_image ?? '',
    mediaAlt: activity.media_alt ?? '',

    enableRetry: activity.enable_retry,
    enableShowSolution: activity.enable_show_solution,
    enableCheck: activity.enable_check,
    caseSensitive: activity.case_sensitive,
    acceptSpellingErrors: activity.accept_spelling_errors,
    instantFeedback: activity.instant_feedback,
    showScorePoints: activity.show_score_points,
    separateLines: activity.separate_lines,
    solutionRequiresInput: activity.solution_requires_input,

    pointsPerBlank: activity.points_per_blank || 1,
    passPercentage: activity.pass_percentage ?? 100,
    // An activity saved before feedback bands were authored has none; the
    // defaults are better than an empty editor with an Add button.
    feedbackBands:
      activity.feedback_bands && activity.feedback_bands.length > 0
        ? activity.feedback_bands.map((band) => ({
            from: band.from,
            to: band.to,
            feedback: band.feedback ?? '',
          }))
        : base.feedbackBands,
  };
}

export function toSavePayload(
  type: TextActivityType,
  state: TextActivityEditorState
): TextActivitySavePayload {
  const fields = FIELDS[type];

  return {
    title: state.title.trim(),
    description: state.description.trim(),
    task_description: state.taskDescription.trim(),
    passage: state.passage,
    distractors: fields.distractors ? state.distractors.trim() : '',
    media_image: state.mediaImage.trim() || null,
    media_alt: state.mediaAlt.trim() || null,

    enable_retry: state.enableRetry,
    enable_show_solution: state.enableShowSolution,
    enable_check: state.enableCheck,
    case_sensitive: fields.caseSensitive ? state.caseSensitive : false,
    accept_spelling_errors: fields.spellingErrors ? state.acceptSpellingErrors : false,
    instant_feedback: fields.instantFeedback ? state.instantFeedback : false,
    show_score_points: state.showScorePoints,
    separate_lines: fields.separateLines ? state.separateLines : false,
    solution_requires_input: fields.solutionRequiresInput ? state.solutionRequiresInput : true,

    points_per_blank: Math.max(1, Math.min(100, Math.round(state.pointsPerBlank || 1))),
    pass_percentage: Math.max(0, Math.min(100, Math.round(state.passPercentage ?? 100))),
    feedback_bands: state.feedbackBands.map((band) => ({
      from: Math.max(0, Math.min(100, Math.round(band.from))),
      to: Math.max(0, Math.min(100, Math.round(band.to))),
      feedback: band.feedback.trim(),
    })),
  };
}

/**
 * Everything that would stop this activity being published, in the order an
 * author should fix it.
 *
 * The same checks the server runs on publish, run here so the author is not
 * told "no" by a round trip after writing a page of text.
 */
export function validateEditorState(
  type: TextActivityType,
  state: TextActivityEditorState
): string[] {
  const problems: string[] = [];

  if (state.title.trim() === '') problems.push('Give the activity a title.');
  problems.push(...passageProblems(type, state.passage, state.distractors));

  return problems;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-700">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-indigo-100';

// ---------------------------------------------------------------------------
// The answer key preview
// ---------------------------------------------------------------------------

/**
 * What the markup currently means, updated as the author types.
 *
 * This is the whole reason the parser is duplicated client-side. Without it,
 * finding out that a colon ate half an answer takes a save, a publish and a
 * student.
 */
function AnswerKeyPreview({
  type,
  passage,
  distractors,
}: {
  type: TextActivityType;
  passage: string;
  distractors: string;
}) {
  const key = useMemo(() => answerKey(type, passage, distractors), [type, passage, distractors]);
  const answers = key.filter((slot) => !slot.isDistractor);
  const spare = key.filter((slot) => slot.isDistractor);

  if (answers.length === 0 && spare.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">
        Answers you mark with asterisks will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
        </p>
        <ol className="mt-1.5 space-y-1.5">
          {answers.map((slot) => (
            <li
              key={slot.index}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
            >
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                {slot.index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-xs font-medium text-slate-800">{slot.solution}</span>
                {slot.alternatives.length > 0 ? (
                  <span className="mt-0.5 block break-words text-[11px] text-slate-500">
                    also accepts {slot.alternatives.join(', ')}
                  </span>
                ) : null}
                {slot.tip ? (
                  <span className="mt-0.5 block break-words text-[11px] italic text-indigo-600">
                    hint: {slot.tip}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {spare.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {spare.length} spare {spare.length === 1 ? 'word' : 'words'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {spare.map((slot) => (
              <span
                key={slot.index}
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              >
                {slot.solution}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function TextActivityEditor({
  type,
  state,
  onChange,
  onSave,
  saving,
  saveLabel,
  secondaryAction,
}: {
  type: TextActivityType;
  state: TextActivityEditorState;
  onChange: (state: TextActivityEditorState) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  secondaryAction?: ReactNode;
}) {
  const fields = FIELDS[type];
  const problems = validateEditorState(type, state);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const set = useCallback(
    <K extends keyof TextActivityEditorState>(key: K, value: TextActivityEditorState[K]) => {
      onChange({ ...state, [key]: value });
    },
    [onChange, state]
  );

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const url = await uploadTextActivityImage(type, file);
      onChange({ ...state, mediaImage: url });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload that image');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const bankSize = fields.distractors
    ? answerKey(type, state.passage, state.distractors).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- The passage ------------------------------------------- */}
        <div className="space-y-4">
          <Panel title="The activity" description={TEXT_ACTIVITY_DESCRIPTIONS[type]}>
            <Field label="Title">
              <input
                className={inputClass}
                value={state.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder={`${TEXT_ACTIVITY_LABELS[type]} — chapter practice`}
                maxLength={255}
              />
            </Field>

            <Field
              label="Instructions for learners"
              hint="Shown above the passage. Say what to do, not how the activity works."
            >
              <textarea
                className={`${inputClass} min-h-[64px] resize-y`}
                value={state.taskDescription}
                onChange={(event) => set('taskDescription', event.target.value)}
                placeholder={
                  type === 'mark_the_words'
                    ? 'Click every word that is a verb.'
                    : type === 'drag_text'
                      ? 'Drag each word into the sentence it belongs in.'
                      : 'Type the missing word into each blank.'
                }
                maxLength={5000}
              />
            </Field>
          </Panel>

          <Panel title="Text passage" description={MARKUP_HINTS[type]}>
            <textarea
              className={`${inputClass} min-h-[220px] resize-y font-mono text-[13px] leading-relaxed`}
              value={state.passage}
              onChange={(event) => set('passage', event.target.value)}
              placeholder={PLACEHOLDERS[type]}
              maxLength={20000}
              spellCheck={false}
            />

            {fields.distractors ? (
              <Field
                label="Spare words"
                hint="Extra draggable words that fit no blank, so the activity cannot be solved by elimination. Comma separated."
              >
                <input
                  className={inputClass}
                  value={state.distractors}
                  onChange={(event) => set('distractors', event.target.value)}
                  placeholder="Sweden, Denmark"
                  maxLength={2000}
                />
                {bankSize > 0 ? (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Learners will choose from {bankSize} {bankSize === 1 ? 'word' : 'words'}.
                  </p>
                ) : null}
              </Field>
            ) : null}
          </Panel>

          <Panel
            title="Illustration"
            description="Optional. Shown above the passage, and bundled into an exported package."
          >
            {uploadError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {uploadError}
              </p>
            ) : null}

            {state.mediaImage ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.mediaImage}
                    alt={state.mediaAlt || 'Activity illustration'}
                    className="max-h-56 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...state, mediaImage: '', mediaAlt: '' })}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-red-600"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Field
                  label="Describe the image"
                  hint="Read aloud to learners using a screen reader. Say what the image shows, not that it is an image."
                >
                  <input
                    className={inputClass}
                    value={state.mediaAlt}
                    onChange={(event) => set('mediaAlt', event.target.value)}
                    maxLength={255}
                  />
                </Field>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Uploading…' : 'Add an image'}
              </button>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
          </Panel>
        </div>

        {/* ---- The live answer key ----------------------------------- */}
        <div className="space-y-4">
          <Panel title="Answer key" description="What your markup means, as you type it.">
            <AnswerKeyPreview type={type} passage={state.passage} distractors={state.distractors} />
          </Panel>

          {problems.length > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Before publishing
              </p>
              <ul className="mt-2 space-y-1.5">
                {problems.map((problem) => (
                  <li key={problem} className="text-[11px] leading-relaxed text-amber-800">
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Exports as</p>
            <p className="mt-1 font-mono text-xs text-slate-700">{TEXT_ACTIVITY_LIBRARIES[type]}</p>
          </section>
        </div>
      </div>

      {/* ---- Behaviour and scoring ----------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What learners can do" description="Which controls the activity offers while it is being answered.">
          <div className="space-y-2">
            <Toggle
              label="Check answers"
              hint="Offers a Check button. Without it the activity is practice only and is never marked."
              checked={state.enableCheck}
              onChange={(value) => set('enableCheck', value)}
            />
            <Toggle
              label="Retry"
              hint="Learners can clear their answers and try the whole activity again."
              checked={state.enableRetry}
              onChange={(value) => set('enableRetry', value)}
            />
            <Toggle
              label="Show solution"
              hint="Reveals the correct answers after checking."
              checked={state.enableShowSolution}
              onChange={(value) => set('enableShowSolution', value)}
            />
            <Toggle
              label="Show score points"
              hint="Shows a running +1 beside each answer as it is marked."
              checked={state.showScorePoints}
              onChange={(value) => set('showScorePoints', value)}
            />
            {fields.instantFeedback ? (
              <Toggle
                label="Instant feedback"
                hint="Marks each answer as it is given, instead of waiting for Check."
                checked={state.instantFeedback}
                onChange={(value) => set('instantFeedback', value)}
              />
            ) : null}
          </div>
        </Panel>

        <Panel title="Marking" description="How answers are compared and what a pass is worth.">
          {fields.caseSensitive || fields.spellingErrors || fields.separateLines || fields.solutionRequiresInput ? (
            <div className="space-y-2">
              {fields.caseSensitive ? (
                <Toggle
                  label="Case sensitive"
                  hint="“norway” is wrong when the answer is “Norway”. Leave off unless capitalisation is the thing being taught."
                  checked={state.caseSensitive}
                  onChange={(value) => set('caseSensitive', value)}
                />
              ) : null}
              {fields.spellingErrors ? (
                <Toggle
                  label="Forgive one spelling mistake"
                  hint="Accepts an answer that is one letter out. Leave off when spelling is what is being marked."
                  checked={state.acceptSpellingErrors}
                  onChange={(value) => set('acceptSpellingErrors', value)}
                />
              ) : null}
              {fields.separateLines ? (
                <Toggle
                  label="One blank per line"
                  hint="Puts each blank on its own line instead of running them into the paragraph."
                  checked={state.separateLines}
                  onChange={(value) => set('separateLines', value)}
                />
              ) : null}
              {fields.solutionRequiresInput ? (
                <Toggle
                  label="Require an attempt before showing the solution"
                  hint="Stops a learner revealing the answers without trying."
                  checked={state.solutionRequiresInput}
                  onChange={(value) => set('solutionRequiresInput', value)}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Points per answer">
              <input
                type="number"
                min={1}
                max={100}
                className={inputClass}
                value={state.pointsPerBlank}
                onChange={(event) => set('pointsPerBlank', Number(event.target.value))}
              />
            </Field>
            <Field label="Pass mark (%)">
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={state.passPercentage}
                onChange={(event) => set('passPercentage', Number(event.target.value))}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <FeedbackBandsPanel
        bands={state.feedbackBands}
        onChange={(bands) => set('feedbackBands', bands)}
      />

      {/* ---- Save ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secondaryAction}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Score bands and the message each one shows.
 *
 * Bands are the only place a teacher's own voice reaches a learner at the end
 * of an attempt, so this is a full editor rather than a single "well done"
 * string -- but it opens with three sensible bands so nobody has to build one
 * from nothing.
 */
function FeedbackBandsPanel({
  bands,
  onChange,
}: {
  bands: Array<{ from: number; to: number; feedback: string }>;
  onChange: (bands: Array<{ from: number; to: number; feedback: string }>) => void;
}) {
  const update = (index: number, patch: Partial<{ from: number; to: number; feedback: string }>) => {
    onChange(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)));
  };

  // A gap between bands means a score in that gap gets no message at all,
  // which reads as a bug. Worth naming, not worth blocking a save over.
  const gaps = bands
    .slice()
    .sort((a, b) => a.from - b.from)
    .reduce<string[]>((found, band, index, sorted) => {
      const next = sorted[index + 1];
      if (next && next.from > band.to + 1) {
        found.push(`${band.to + 1}–${next.from - 1}%`);
      }
      return found;
    }, []);

  return (
    <Panel title="Feedback" description="What a learner is told when they finish, based on their score.">
      <div className="space-y-2">
        {bands.map((band, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2.5">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                aria-label="Band starts at"
                className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-[#4f46e5]"
                value={band.from}
                onChange={(event) => update(index, { from: Number(event.target.value) })}
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="number"
                min={0}
                max={100}
                aria-label="Band ends at"
                className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-[#4f46e5]"
                value={band.to}
                onChange={(event) => update(index, { to: Number(event.target.value) })}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
            <input
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#4f46e5]"
              value={band.feedback}
              placeholder="What to say at this score"
              maxLength={500}
              onChange={(event) => update(index, { feedback: event.target.value })}
            />
            <button
              type="button"
              onClick={() => onChange(bands.filter((_, i) => i !== index))}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove band"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {gaps.length > 0 ? (
        <p className="text-[11px] text-amber-700">
          Nothing is shown for {gaps.join(', ')}. Extend a band to cover it.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onChange([...bands, { from: 0, to: 100, feedback: '' }])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a band
      </button>
    </Panel>
  );
}
