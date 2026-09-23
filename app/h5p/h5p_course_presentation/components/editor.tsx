'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, FileUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  COURSE_PRESENTATION_DEFAULTS,
  coursePresentationApi,
  newRef,
  type CoursePresentationSavePayload,
  type H5pCoursePresentation,
  type PresentationTheme,
  type SlideElementInput,
  type SlideInput,
  type SlideTransition,
} from '../../data/h5p-content-types';
import { SCORED_ELEMENT_TYPES, type SlideElementType } from '@/lib/h5p/course-presentation-scoring';
import { CheckField, FieldGroup, NumberField, SelectField, TextAreaField, TextField } from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';
import { SlideCanvas } from './slide-canvas';
import { ElementForm } from './element-form';

/**
 * Course presentation — authoring editor.
 *
 * THE SHAPE OF THIS SCREEN: a filmstrip of slides down the side, one slide on
 * the canvas, and a form for whatever element is selected. That is the shape
 * every slide editor has, because a deck is edited one slide at a time and a
 * scrolling list of every element in the deck is unusable past about six.
 *
 * SLIDES ARE ADDRESSED BY REF, NOT ID. A branch destination and a go-to button
 * both point at a slide, and a brand new slide has no id until the server has
 * written it. So the editor gives every slide a client-side ref that is stable
 * while the editor is open, and the server maps refs to ids in one pass on
 * save. That is what lets a new slide branch to another new slide.
 *
 * GEOMETRY IS A PERCENTAGE OF THE SLIDE, like every other positioned thing in
 * this family.
 */

export interface PresentationEditorState extends Omit<CoursePresentationSavePayload, 'slides'> {
  slides: SlideInput[];
  /** Index into `slides`. */
  current: number;
  /** Index into the current slide's elements, or null. */
  selectedElement: number | null;
}

const ELEMENT_LABELS: Record<SlideElementType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  blanks: 'Fill in the blanks',
  drag_drop: 'Drag and drop',
  goto_slide: 'Go to slide',
};

export function emptySlide(title = ''): SlideInput {
  return {
    ref: newRef(),
    title,
    background_image: '',
    background_token: '',
    notes: '',
    next_slide_ref: '',
    elements: [],
  };
}

export function emptyPresentationState(): PresentationEditorState {
  return {
    ...COURSE_PRESENTATION_DEFAULTS,
    // One slide, because a deck editor with no slide has nothing to show and
    // "add a slide" is not a thing an author should have to discover.
    slides: [emptySlide('Slide 1')],
    current: 0,
    selectedElement: null,
  };
}

export function presentationStateFromRow(row: H5pCoursePresentation): PresentationEditorState {
  // id -> ref, so the branch and go-to targets stored as ids come back as the
  // refs the editor and the save payload speak in.
  const refById = new Map<number, string>();
  for (const slide of row.slides ?? []) refById.set(slide.id, `slide-${slide.id}`);

  return {
    title: row.title ?? '',
    description: row.description ?? '',
    theme: (row.theme as PresentationTheme) ?? 'default',
    slide_transition: (row.slide_transition as SlideTransition) ?? 'fade',
    show_progress_bar: row.show_progress_bar,
    show_keywords: row.show_keywords,
    show_summary_slide: row.show_summary_slide,
    enable_print: row.enable_print,
    active_surface: row.active_surface,
    enable_retry: row.enable_retry,
    enable_show_solution: row.enable_show_solution,
    pass_percentage: row.pass_percentage,
    feedback_bands: row.feedback_bands ?? [],
    slides: (row.slides ?? []).map((slide) => ({
      ref: refById.get(slide.id) ?? newRef(),
      title: slide.title ?? '',
      background_image: slide.background_image ?? '',
      background_token: slide.background_token ?? '',
      notes: slide.notes ?? '',
      next_slide_ref: slide.next_slide_id !== null ? (refById.get(slide.next_slide_id) ?? '') : '',
      elements: (slide.elements ?? []).map((element) => {
        const options = { ...((element.options as Record<string, unknown>) ?? {}) };

        // Same id -> ref translation for a go-to button's destination.
        if (element.element_type === 'goto_slide' && options.target_slide_id) {
          options.target_slide_ref = refById.get(Number(options.target_slide_id)) ?? '';
          delete options.target_slide_id;
        }

        return {
          element_type: element.element_type as SlideElementType,
          position_x: Number(element.position_x),
          position_y: Number(element.position_y),
          width: Number(element.width),
          height: Number(element.height),
          content_text: element.content_text ?? '',
          media_path: element.media_path ?? '',
          media_alt: element.media_alt ?? '',
          options,
          ref_content_id: element.ref_content_id,
          points: element.points,
        };
      }),
    })),
    current: 0,
    selectedElement: null,
  };
}

export function presentationToPayload(state: PresentationEditorState): CoursePresentationSavePayload {
  // `current` and `selectedElement` are editor cursor state, not content.
  // Dropped here rather than filtered server-side, so the payload this
  // function returns is exactly what the API contract describes.
  const rest = { ...state } as Partial<PresentationEditorState>;
  delete rest.current;
  delete rest.selectedElement;

  return {
    ...(rest as Omit<PresentationEditorState, 'current' | 'selectedElement'>),
    title: state.title.trim(),
    pass_percentage: Math.max(0, Math.min(100, state.pass_percentage || 0)),
    slides: state.slides.map((slide) => ({
      ...slide,
      elements: slide.elements.map((element) => ({
        ...element,
        position_x: Math.max(0, Math.min(100, element.position_x)),
        position_y: Math.max(0, Math.min(100, element.position_y)),
        width: Math.max(1, Math.min(100, element.width)),
        height: Math.max(1, Math.min(100, element.height)),
        // The server does this too and is the authority. Doing it here as well
        // means the editor's own "Marks" figure matches what will be saved.
        points: SCORED_ELEMENT_TYPES.includes(element.element_type) ? Math.max(1, element.points || 1) : 0,
      })),
    })),
  };
}

/** Mirrors the server's publish check, in the author's words. */
export function validatePresentationState(state: PresentationEditorState): string[] {
  const problems: string[] = [];
  if (state.title.trim() === '') problems.push('Give the presentation a title.');
  if (state.slides.length === 0) problems.push('Add at least one slide.');

  const refs = new Set(state.slides.map((slide) => slide.ref));

  state.slides.forEach((slide, index) => {
    const where = `Slide ${index + 1}`;

    if (slide.next_slide_ref && !refs.has(slide.next_slide_ref)) {
      problems.push(`${where} branches to a slide that is no longer in this presentation.`);
    }

    slide.elements.forEach((element) => {
      const options = element.options ?? {};

      switch (element.element_type) {
        case 'multiple_choice': {
          const answers = (options.answers as Array<{ text?: string; correct?: boolean }> | undefined) ?? [];
          if (answers.length < 2) problems.push(`${where} has a multiple choice with fewer than two answers.`);
          else if (!answers.some((answer) => answer.correct)) {
            problems.push(`${where} has a multiple choice with no correct answer.`);
          }
          break;
        }
        case 'true_false':
          if (!('correct' in options)) problems.push(`${where} has a true/false with no correct side chosen.`);
          break;
        case 'blanks':
          if (!String(options.passage ?? '').includes('*')) {
            problems.push(`${where} has a fill in the blanks with no *answer* marked in its passage.`);
          }
          break;
        case 'drag_drop':
          if (!element.ref_content_id) {
            problems.push(`${where} has an embedded drag and drop with no activity chosen.`);
          }
          break;
        case 'goto_slide': {
          const target = String(options.target_slide_ref ?? '');
          if (!target || !refs.has(target)) {
            problems.push(`${where} has a "go to slide" button with no destination.`);
          }
          break;
        }
        case 'image':
        case 'video':
        case 'audio':
          if (element.media_path.trim() === '') {
            problems.push(`${where} has a ${ELEMENT_LABELS[element.element_type].toLowerCase()} element with no file.`);
          }
          break;
        default:
          break;
      }
    });
  });

  // With the navigation chrome hidden, a slide with no way out strands the
  // learner — and it is the one failure of this type an author cannot see by
  // clicking through their own deck.
  if (state.active_surface && state.slides.length > 1) {
    const last = state.slides[state.slides.length - 1];
    const stuck = state.slides.find(
      (slide) =>
        slide.ref !== last.ref &&
        !slide.next_slide_ref &&
        !slide.elements.some((element) => element.element_type === 'goto_slide')
    );
    if (stuck) {
      problems.push(
        'Navigation is hidden, but a slide has no way forward. Add a "go to slide" button, or turn navigation back on.'
      );
    }
  }

  return problems.length > 6 ? [...problems.slice(0, 5), `…and ${problems.length - 5} more.`] : problems;
}

// ---------------------------------------------------------------------------

function defaultElement(type: SlideElementType): SlideElementInput {
  const base: SlideElementInput = {
    element_type: type,
    position_x: 10,
    position_y: 10,
    width: 50,
    height: 25,
    content_text: '',
    media_path: '',
    media_alt: '',
    options: {},
    ref_content_id: null,
    points: SCORED_ELEMENT_TYPES.includes(type) ? 1 : 0,
  };

  switch (type) {
    case 'multiple_choice':
      return {
        ...base,
        width: 80,
        height: 50,
        options: {
          answers: [
            { text: '', correct: true, feedback: '' },
            { text: '', correct: false, feedback: '' },
          ],
          randomise_answers: true,
          enable_retry: true,
          enable_solution: true,
        },
      };
    case 'true_false':
      return { ...base, width: 80, height: 30, options: { correct: true, enable_retry: true, enable_solution: true } };
    case 'blanks':
      return {
        ...base,
        width: 80,
        height: 40,
        options: { passage: '', task_description: '', case_sensitive: false, accept_spelling_errors: false },
      };
    case 'goto_slide':
      return { ...base, width: 25, height: 10, position_x: 70, position_y: 85, content_text: 'Continue' };
    default:
      return base;
  }
}

export function CoursePresentationEditor({
  state,
  onChange,
  disabled,
}: {
  state: PresentationEditorState;
  onChange: (next: PresentationEditorState) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const set = <K extends keyof PresentationEditorState>(key: K, value: PresentationEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const slide = state.slides[state.current];

  const patchSlide = (patch: Partial<SlideInput>) =>
    onChange({
      ...state,
      slides: state.slides.map((s, i) => (i === state.current ? { ...s, ...patch } : s)),
    });

  const patchElement = (index: number, patch: Partial<SlideElementInput>) =>
    patchSlide({
      elements: slide.elements.map((element, i) => (i === index ? { ...element, ...patch } : element)),
    });

  const addSlide = () => {
    const next = [...state.slides];
    next.splice(state.current + 1, 0, emptySlide(`Slide ${state.slides.length + 1}`));
    onChange({ ...state, slides: next, current: state.current + 1, selectedElement: null });
  };

  const removeSlide = (index: number) => {
    const removed = state.slides[index];
    const remaining = state.slides.filter((_, i) => i !== index);

    // Any branch or button that pointed at the removed slide would otherwise
    // become a dead end the author cannot see. Cleared here, at the moment the
    // cause is on screen, rather than reported on save.
    const cleaned = remaining.map((s) => ({
      ...s,
      next_slide_ref: s.next_slide_ref === removed.ref ? '' : s.next_slide_ref,
      elements: s.elements.map((element) =>
        element.element_type === 'goto_slide' && element.options?.target_slide_ref === removed.ref
          ? { ...element, options: { ...element.options, target_slide_ref: '' } }
          : element
      ),
    }));

    onChange({
      ...state,
      slides: cleaned,
      current: Math.max(0, Math.min(cleaned.length - 1, state.current > index ? state.current - 1 : state.current)),
      selectedElement: null,
    });
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= state.slides.length) return;
    const next = [...state.slides];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...state, slides: next, current: to, selectedElement: null });
  };

  const uploadSlideBackground = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      patchSlide({ background_image: await coursePresentationApi.uploadMedia(file, 'slide_background') });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const marks = useMemo(
    () =>
      state.slides
        .flatMap((s) => s.elements)
        .reduce((sum, element) => sum + (SCORED_ELEMENT_TYPES.includes(element.element_type) ? element.points : 0), 0),
    [state.slides]
  );

  return (
    <div className="space-y-4">
      {uploadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
      ) : null}

      <FieldGroup title="About this presentation" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="The water cycle"
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
      </FieldGroup>

      {/* ---- the deck ---- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Slides</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {state.slides.length} {state.slides.length === 1 ? 'slide' : 'slides'} ·{' '}
              {marks > 0 ? `${marks} marks` : 'no questions yet'}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={addSlide}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add slide
          </button>
        </div>

        {/* Filmstrip */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {state.slides.map((s, index) => (
            <button
              key={s.ref}
              type="button"
              onClick={() => onChange({ ...state, current: index, selectedElement: null })}
              className={`flex h-16 w-24 shrink-0 flex-col justify-between rounded-lg border-2 p-1.5 text-left transition ${
                index === state.current
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="text-[10px] font-semibold tabular-nums text-slate-400">{index + 1}</span>
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">
                {s.title || `Slide ${index + 1}`}
              </span>
              <span className="text-[9px] text-slate-400">
                {s.elements.length} {s.elements.length === 1 ? 'item' : 'items'}
                {s.next_slide_ref ? ' · branches' : ''}
              </span>
            </button>
          ))}
        </div>

        {slide ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || state.current === 0}
                  onClick={() => moveSlide(state.current, state.current - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move this slide earlier"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || state.current === state.slides.length - 1}
                  onClick={() => moveSlide(state.current, state.current + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move this slide later"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const copy: SlideInput = {
                      ...slide,
                      ref: newRef(),
                      title: `${slide.title || `Slide ${state.current + 1}`} (copy)`,
                      // A copy must not inherit the branch: two slides sending
                      // learners to the same place is almost never what a
                      // duplicate was for, and is invisible until it bites.
                      next_slide_ref: '',
                      elements: slide.elements.map((element) => ({ ...element, options: { ...element.options } })),
                    };
                    const next = [...state.slides];
                    next.splice(state.current + 1, 0, copy);
                    onChange({ ...state, slides: next, current: state.current + 1, selectedElement: null });
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Duplicate this slide"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || state.slides.length <= 1}
                  onClick={() => removeSlide(state.current)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  aria-label="Remove this slide"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(ELEMENT_LABELS) as SlideElementType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...state,
                        slides: state.slides.map((s, i) =>
                          i === state.current ? { ...s, elements: [...s.elements, defaultElement(type)] } : s
                        ),
                        selectedElement: slide.elements.length,
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    + {ELEMENT_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <SlideCanvas
              slide={slide}
              theme={state.theme}
              selected={state.selectedElement}
              disabled={disabled}
              labels={ELEMENT_LABELS}
              onSelect={(index) => set('selectedElement', index)}
              onMove={(index, x, y) => patchElement(index, { position_x: x, position_y: y })}
              onResize={(index, width, height) => patchElement(index, { width, height })}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Slide title"
                value={slide.title}
                onChange={(v) => patchSlide({ title: v })}
                disabled={disabled}
                hint="Shown in the keyword rail and read out as the slide's name."
                maxLength={255}
              />
              <SelectField
                label="After this slide, go to"
                value={slide.next_slide_ref}
                onChange={(v) => patchSlide({ next_slide_ref: v })}
                disabled={disabled}
                hint="Leave as the next slide unless this deck branches."
                options={[
                  { value: '', label: 'The next slide' },
                  ...state.slides
                    .filter((s) => s.ref !== slide.ref)
                    .map((s, i) => ({
                      value: s.ref,
                      label: s.title || `Slide ${state.slides.indexOf(s) + 1}`,
                      key: i,
                    })),
                ]}
              />
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">Slide background</span>
                <div className="flex items-center gap-2">
                  {slide.background_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.background_image}
                      alt=""
                      className="h-10 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                    {slide.background_image ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={disabled || uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadSlideBackground(file);
                      }}
                    />
                  </label>
                  {slide.background_image ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => patchSlide({ background_image: '' })}
                      className="text-[11px] font-medium text-slate-500 underline transition hover:text-red-600"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <TextAreaField
                label="Speaker notes"
                value={slide.notes}
                onChange={(v) => patchSlide({ notes: v })}
                disabled={disabled}
                hint="For you and other teachers. Learners never see these."
                rows={2}
              />
            </div>

            {state.selectedElement !== null && slide.elements[state.selectedElement] ? (
              <ElementForm
                element={slide.elements[state.selectedElement]}
                slides={state.slides}
                currentSlideRef={slide.ref}
                label={ELEMENT_LABELS[slide.elements[state.selectedElement].element_type as SlideElementType]}
                disabled={disabled}
                onChange={(patch) => patchElement(state.selectedElement as number, patch)}
                onRemove={() => {
                  patchSlide({ elements: slide.elements.filter((_, i) => i !== state.selectedElement) });
                  set('selectedElement', null);
                }}
                onUploadError={setUploadError}
              />
            ) : slide.elements.length > 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-500">
                Select something on the slide to edit it.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <FieldGroup title="Look and navigation">
        <SelectField<PresentationTheme>
          label="Theme"
          value={state.theme}
          onChange={(v) => set('theme', v)}
          disabled={disabled}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'slate', label: 'Slate' },
            { value: 'indigo', label: 'Indigo' },
            { value: 'warm', label: 'Warm' },
            { value: 'high-contrast', label: 'High contrast' },
          ]}
        />
        <SelectField<SlideTransition>
          label="Slide transition"
          value={state.slide_transition}
          onChange={(v) => set('slide_transition', v)}
          disabled={disabled}
          hint="Collapses to none for learners who have asked for reduced motion."
          options={[
            { value: 'none', label: 'None' },
            { value: 'fade', label: 'Fade' },
            { value: 'slide', label: 'Slide' },
          ]}
        />
        <CheckField
          label="Show a progress bar"
          checked={state.show_progress_bar}
          onChange={(v) => set('show_progress_bar', v)}
          disabled={disabled}
        />
        <CheckField
          label="Show the slide list"
          hint="A jump list of slide titles down the side."
          checked={state.show_keywords}
          onChange={(v) => set('show_keywords', v)}
          disabled={disabled}
        />
        <CheckField
          label="Show a summary slide at the end"
          checked={state.show_summary_slide}
          onChange={(v) => set('show_summary_slide', v)}
          disabled={disabled}
        />
        <CheckField
          label="Allow printing"
          checked={state.enable_print}
          onChange={(v) => set('enable_print', v)}
          disabled={disabled}
        />
        <CheckField
          label="Hide the navigation arrows"
          hint="The only way forward becomes something on the slide. Every slide then needs a way out."
          checked={state.active_surface}
          onChange={(v) => set('active_surface', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup title="Scoring">
        <NumberField
          label="Pass mark"
          value={state.pass_percentage}
          onChange={(v) => set('pass_percentage', v)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
          hint={marks > 0 ? `Out of ${marks} marks.` : 'This deck has no questions, so nothing is marked.'}
        />
        <CheckField
          label="Allow retries"
          checked={state.enable_retry}
          onChange={(v) => set('enable_retry', v)}
          disabled={disabled}
        />
        <CheckField
          label="Allow showing the answers"
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
