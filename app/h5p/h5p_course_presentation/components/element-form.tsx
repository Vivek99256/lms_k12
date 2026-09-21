'use client';

import { useEffect, useState } from 'react';
import { FileUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { coursePresentationApi, type SlideElementInput, type SlideInput } from '../../data/h5p-content-types';
import { fetchDragDrops, readH5pContext, type H5pDragDrop } from '../../data/h5p';
import { useSearchParams } from 'next/navigation';
import { CheckField, NumberField, SelectField, TextAreaField, TextField } from '../../components/fields';
import { Input } from '@/components/ui/input';
import { parsePassage } from '@/lib/h5p/text-activity-markup';

/**
 * The form for whichever slide element is selected.
 *
 * One component with a branch per element kind rather than nine components,
 * because seven of the nine are two or three fields and the shell around them
 * — the header, the points field, the remove button — is the same for all of
 * them. The branch is a `switch`, which is what a tagged union wants.
 */

type ElementOptions = Record<string, unknown>;

interface MultiChoiceAnswer {
  text: string;
  correct: boolean;
  feedback?: string;
  tip?: string;
}

export function ElementForm({
  element,
  slides,
  currentSlideRef,
  label,
  disabled,
  onChange,
  onRemove,
  onUploadError,
}: {
  element: SlideElementInput;
  slides: SlideInput[];
  currentSlideRef: string;
  label: string;
  disabled?: boolean;
  onChange: (patch: Partial<SlideElementInput>) => void;
  onRemove: () => void;
  onUploadError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const options = (element.options ?? {}) as ElementOptions;

  const setOption = (key: string, value: unknown) => onChange({ options: { ...options, [key]: value } });

  const upload = async (file: File, role: 'image' | 'video' | 'audio') => {
    setUploading(true);
    try {
      onChange({ media_path: await coursePresentationApi.uploadMedia(file, role) });
    } catch (err: unknown) {
      onUploadError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-indigo-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>

      <div className="space-y-4">
        {element.element_type === 'text' ? (
          <TextAreaField
            label="Text"
            value={element.content_text}
            onChange={(v) => onChange({ content_text: v })}
            disabled={disabled}
            rows={5}
            hint="Headings, lists and links are allowed. Markup is sanitised before learners see it."
          />
        ) : null}

        {(['image', 'video', 'audio'] as const).includes(element.element_type as 'image') ? (
          <MediaFields
            element={element}
            disabled={disabled}
            uploading={uploading}
            options={options}
            onChange={onChange}
            onUpload={(file) => void upload(file, element.element_type as 'image' | 'video' | 'audio')}
            setOption={setOption}
          />
        ) : null}

        {element.element_type === 'multiple_choice' ? (
          <MultiChoiceFields
            element={element}
            options={options}
            disabled={disabled}
            onChange={onChange}
            setOption={setOption}
          />
        ) : null}

        {element.element_type === 'true_false' ? (
          <>
            <TextAreaField
              label="Statement"
              value={element.content_text}
              onChange={(v) => onChange({ content_text: v })}
              disabled={disabled}
              rows={2}
              hint="A statement the learner judges, not a question."
            />
            <SelectField
              label="The statement is"
              value={options.correct === false ? 'false' : 'true'}
              onChange={(v) => setOption('correct', v === 'true')}
              disabled={disabled}
              options={[
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' },
              ]}
            />
          </>
        ) : null}

        {element.element_type === 'blanks' ? <BlanksFields options={options} disabled={disabled} setOption={setOption} /> : null}

        {element.element_type === 'drag_drop' ? (
          <EmbeddedDragDropField element={element} disabled={disabled} onChange={onChange} />
        ) : null}

        {element.element_type === 'goto_slide' ? (
          <>
            <TextField
              label="Button label"
              value={element.content_text}
              onChange={(v) => onChange({ content_text: v, options: { ...options, label: v } })}
              disabled={disabled}
              placeholder="Continue"
            />
            <SelectField
              label="Goes to"
              value={String(options.target_slide_ref ?? '')}
              onChange={(v) => setOption('target_slide_ref', v)}
              disabled={disabled}
              options={[
                { value: '', label: 'Choose a slide…' },
                ...slides
                  .filter((slide) => slide.ref !== currentSlideRef)
                  .map((slide) => ({
                    value: slide.ref,
                    label: slide.title || `Slide ${slides.indexOf(slide) + 1}`,
                  })),
              ]}
            />
          </>
        ) : null}

        {element.points > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="Marks"
              value={element.points}
              onChange={(v) => onChange({ points: v })}
              min={1}
              max={100}
              disabled={disabled}
            />
            <div className="space-y-2 pt-5">
              <CheckField
                label="Allow retries on this question"
                checked={options.enable_retry !== false}
                onChange={(v) => setOption('enable_retry', v)}
                disabled={disabled}
              />
              <CheckField
                label="Allow showing the answer"
                checked={options.enable_solution !== false}
                onChange={(v) => setOption('enable_solution', v)}
                disabled={disabled}
              />
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-slate-500">
          Position: {Math.round(element.position_x)}%, {Math.round(element.position_y)}% · size{' '}
          {Math.round(element.width)}% × {Math.round(element.height)}%. Drag on the slide, or use the arrow keys.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function MediaFields({
  element,
  options,
  disabled,
  uploading,
  onChange,
  onUpload,
  setOption,
}: {
  element: SlideElementInput;
  options: ElementOptions;
  disabled?: boolean;
  uploading: boolean;
  onChange: (patch: Partial<SlideElementInput>) => void;
  onUpload: (file: File) => void;
  setOption: (key: string, value: unknown) => void;
}) {
  const accept =
    element.element_type === 'image' ? 'image/*' : element.element_type === 'video' ? 'video/*' : 'audio/*';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          {element.media_path ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
        {element.media_path ? (
          <span className="max-w-xs truncate text-[11px] text-slate-400">{element.media_path}</span>
        ) : null}
      </div>

      <TextField
        label={element.element_type === 'image' ? 'Image description' : 'Description'}
        value={element.media_alt}
        onChange={(v) => onChange({ media_alt: v })}
        disabled={disabled}
        hint={
          element.element_type === 'image'
            ? 'What a learner using a screen reader is told the picture shows.'
            : 'A short description of what this clip contains.'
        }
        maxLength={255}
      />

      {element.element_type !== 'image' ? (
        <div className="space-y-2">
          <CheckField
            label="Show playback controls"
            checked={options.controls !== false}
            onChange={(v) => setOption('controls', v)}
            disabled={disabled}
          />
          <CheckField
            label="Play automatically"
            // Said out loud, because autoplay on a slide a learner arrives at
            // is the fastest way to make an activity unusable in a classroom.
            hint="Off by default. Audio that starts on its own is disruptive in a shared room."
            checked={options.autoplay === true}
            onChange={(v) => setOption('autoplay', v)}
            disabled={disabled}
          />
          {element.element_type === 'video' ? (
            <CheckField
              label="Loop"
              checked={options.loop === true}
              onChange={(v) => setOption('loop', v)}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function MultiChoiceFields({
  element,
  options,
  disabled,
  onChange,
  setOption,
}: {
  element: SlideElementInput;
  options: ElementOptions;
  disabled?: boolean;
  onChange: (patch: Partial<SlideElementInput>) => void;
  setOption: (key: string, value: unknown) => void;
}) {
  const answers = (options.answers as MultiChoiceAnswer[] | undefined) ?? [];

  const patchAnswer = (index: number, patch: Partial<MultiChoiceAnswer>) =>
    setOption(
      'answers',
      answers.map((answer, i) => (i === index ? { ...answer, ...patch } : answer))
    );

  const correctCount = answers.filter((answer) => answer.correct).length;

  return (
    <>
      <TextAreaField
        label="Question"
        value={element.content_text}
        onChange={(v) => onChange({ content_text: v })}
        disabled={disabled}
        rows={2}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">Answers</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOption('answers', [...answers, { text: '', correct: false, feedback: '' }])}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add answer
          </button>
        </div>

        {answers.map((answer, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={answer.correct}
              disabled={disabled}
              onChange={(e) => patchAnswer(i, { correct: e.target.checked })}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              aria-label={`Answer ${i + 1} is correct`}
            />
            <Input
              value={answer.text}
              disabled={disabled}
              placeholder={`Answer ${i + 1}`}
              onChange={(e) => patchAnswer(i, { text: e.target.value })}
              aria-label={`Answer ${i + 1} text`}
            />
            <Input
              value={answer.feedback ?? ''}
              disabled={disabled}
              placeholder="Feedback (optional)"
              onChange={(e) => patchAnswer(i, { feedback: e.target.value })}
              aria-label={`Answer ${i + 1} feedback`}
              className="max-w-[14rem]"
            />
            <button
              type="button"
              disabled={disabled || answers.length <= 2}
              onClick={() => setOption('answers', answers.filter((_, j) => j !== i))}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              aria-label={`Remove answer ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Said plainly, because "why is this a radio button" is the most
            common question about this element and the answer is not obvious. */}
        <p className="text-[11px] text-slate-500">
          {correctCount === 0
            ? 'Tick at least one correct answer.'
            : correctCount === 1
              ? 'One correct answer: learners pick exactly one.'
              : `${correctCount} correct answers: learners tick several, and a wrong tick cancels a right one.`}
        </p>
      </div>

      <CheckField
        label="Shuffle the answers"
        checked={options.randomise_answers !== false}
        onChange={(v) => setOption('randomise_answers', v)}
        disabled={disabled}
      />
    </>
  );
}

function BlanksFields({
  options,
  disabled,
  setOption,
}: {
  options: ElementOptions;
  disabled?: boolean;
  setOption: (key: string, value: unknown) => void;
}) {
  const passage = String(options.passage ?? '');
  const slots = parsePassage(passage);

  return (
    <>
      <TextField
        label="Instruction"
        value={String(options.task_description ?? '')}
        onChange={(v) => setOption('task_description', v)}
        disabled={disabled}
        placeholder="Fill in the missing words"
      />

      <TextAreaField
        label="Passage"
        value={passage}
        onChange={(v) => setOption('passage', v)}
        disabled={disabled}
        rows={4}
        hint="Wrap each answer in asterisks: “Water *evaporates* from the *sea/ocean*.” Use a slash for alternatives."
      />

      <p className="text-[11px] text-slate-500">
        {slots.length === 0
          ? 'No answers marked yet — nothing to fill in.'
          : `${slots.length} ${slots.length === 1 ? 'blank' : 'blanks'}: ${slots
              .map((slot) => slot.solution)
              .join(', ')}`}
      </p>

      <div className="space-y-2">
        <CheckField
          label="Answers are case sensitive"
          checked={options.case_sensitive === true}
          onChange={(v) => setOption('case_sensitive', v)}
          disabled={disabled}
        />
        <CheckField
          label="Forgive one spelling mistake"
          hint="Only on words of four letters or more, so “cat” does not accept “bat”."
          checked={options.accept_spelling_errors === true}
          onChange={(v) => setOption('accept_spelling_errors', v)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

/**
 * The picker for an embedded Drag and Drop activity.
 *
 * It lists what is in THIS CHAPTER, which is the same scope the server
 * enforces on save — so an author is not offered an activity that would then
 * be refused. Drafts are listed but marked, because the server refuses to
 * embed one and "why can I not save" is otherwise unanswerable from here.
 */
function EmbeddedDragDropField({
  element,
  disabled,
  onChange,
}: {
  element: SlideElementInput;
  disabled?: boolean;
  onChange: (patch: Partial<SlideElementInput>) => void;
}) {
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<H5pDragDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let cancelled = false;
    const ctx = readH5pContext(new URLSearchParams(searchParams?.toString()));

    fetchDragDrops(ctx)
      .then((rows) => {
        if (!cancelled) setActivities(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailed(err instanceof Error ? err.message : 'Could not list drag and drop activities');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (loading) {
    return <p className="text-xs text-slate-500">Loading drag and drop activities in this chapter…</p>;
  }

  if (failed) {
    return <p className="text-xs text-red-600">{failed}</p>;
  }

  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
        This chapter has no drag and drop activities yet. Build and publish one first, then embed it here.
      </p>
    );
  }

  return (
    <>
      <SelectField
        label="Activity"
        value={element.ref_content_id ? String(element.ref_content_id) : ''}
        onChange={(v) => onChange({ ref_content_id: v ? Number(v) : null })}
        disabled={disabled}
        hint="The activity is referenced, not copied — editing it there updates it here."
        options={[
          { value: '', label: 'Choose an activity…' },
          ...activities.map((activity) => ({
            value: String(activity.id),
            label:
              activity.status === 'published'
                ? activity.title
                : `${activity.title} — draft, publish it before embedding`,
          })),
        ]}
      />
      {element.ref_content_id &&
      activities.find((a) => a.id === element.ref_content_id)?.status !== 'published' ? (
        <p className="text-[11px] text-amber-700">
          That activity is still a draft. Publish it before publishing this presentation.
        </p>
      ) : null}
    </>
  );
}
