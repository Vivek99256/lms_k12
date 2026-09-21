'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  HOTSPOT_ICONS,
  IMAGE_HOTSPOTS_DEFAULTS,
  imageHotspotsApi,
  type H5pImageHotspots,
  type HotspotPopupType,
  type ImageHotspotPointInput,
  type ImageHotspotsSavePayload,
} from '../../data/h5p-content-types';
import {
  CheckField,
  ColorField,
  FieldGroup,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';
import { HotspotMarker } from './marker';

/**
 * Image hotspots — authoring editor.
 *
 * THE CANVAS IS THE EDITOR. Hotspots are placed by clicking the picture, moved
 * by dragging them, and selected by clicking them — with a form beside the
 * canvas for the selected one. A list-only editor with X and Y number fields
 * would be technically complete and unusable on a diagram.
 *
 * GEOMETRY IS A PERCENTAGE OF THE IMAGE, everywhere: here, in the database,
 * and in H5P.ImageHotspots' own params. Nothing converts to pixels until this
 * component measures its container, which is what lets one authored activity
 * render correctly on a phone and a projector.
 *
 * KEYBOARD PLACEMENT IS NOT OPTIONAL. Every marker is a button, and the arrow
 * keys nudge the selected one — so an author who cannot use a pointer can
 * still place a hotspot. H5P's own editor does not give us this.
 */

export interface ImageHotspotsEditorState extends Omit<ImageHotspotsSavePayload, 'points'> {
  points: ImageHotspotPointInput[];
  /** Which hotspot the form beside the canvas is editing. */
  selected: number | null;
}

export function emptyHotspotsState(): ImageHotspotsEditorState {
  return { ...IMAGE_HOTSPOTS_DEFAULTS, points: [], selected: null };
}

export function hotspotsStateFromRow(row: H5pImageHotspots): ImageHotspotsEditorState {
  return {
    title: row.title ?? '',
    description: row.description ?? '',
    task_description: row.task_description ?? '',
    background_image: row.background_image ?? '',
    background_alt: row.background_alt ?? '',
    image_width: row.image_width,
    image_height: row.image_height,
    default_icon: row.default_icon ?? 'plus',
    default_icon_color: row.default_icon_color ?? '#4f46e5',
    show_hotspot_numbers: row.show_hotspot_numbers,
    points_per_hotspot: row.points_per_hotspot,
    pass_percentage: row.pass_percentage,
    enable_retry: row.enable_retry,
    single_popup_open: row.single_popup_open,
    feedback_bands: row.feedback_bands ?? [],
    points: (row.points ?? []).map((point) => ({
      position_x: Number(point.position_x),
      position_y: Number(point.position_y),
      header: point.header ?? '',
      popup_type: (point.popup_type as HotspotPopupType) ?? 'text',
      body_text: point.body_text ?? '',
      popup_image: point.popup_image ?? '',
      popup_image_alt: point.popup_image_alt ?? '',
      icon_name: point.icon_name ?? '',
      icon_color: point.icon_color ?? '',
      icon_image: point.icon_image ?? '',
      tooltip: point.tooltip ?? '',
      aria_label: point.aria_label ?? '',
      popup_width: point.popup_width ?? 40,
    })),
    selected: null,
  };
}

export function hotspotsToPayload(state: ImageHotspotsEditorState): ImageHotspotsSavePayload {
  // `selected` is editor cursor state, not content. Dropped here rather
  // than filtered server-side, so the payload this function returns is
  // exactly what the API contract describes.
  const rest = { ...state } as Partial<ImageHotspotsEditorState>;
  delete rest.selected;

  return {
    ...(rest as Omit<ImageHotspotsEditorState, 'selected'>),
    title: state.title.trim(),
    points_per_hotspot: Math.max(1, Math.min(100, state.points_per_hotspot || 1)),
    pass_percentage: Math.max(0, Math.min(100, state.pass_percentage || 0)),
    points: state.points.map((point) => ({
      ...point,
      position_x: Math.max(0, Math.min(100, point.position_x)),
      position_y: Math.max(0, Math.min(100, point.position_y)),
      popup_width: Math.max(10, Math.min(100, point.popup_width || 40)),
      // Only the field the chosen popup kind uses is sent, matching what the
      // server stores — so a hotspot switched from image back to text does not
      // carry a picture nothing renders and an export does not package it.
      body_text: point.popup_type === 'image' ? '' : point.body_text,
      popup_image: point.popup_type === 'image' ? point.popup_image : '',
      popup_image_alt: point.popup_type === 'image' ? point.popup_image_alt : '',
    })),
  };
}

/** Mirrors the server's publish check, in the author's words. */
export function validateHotspotsState(state: ImageHotspotsEditorState): string[] {
  const problems: string[] = [];
  if (state.title.trim() === '') problems.push('Give the activity a title.');
  if (state.background_image.trim() === '') problems.push('Upload a background image.');
  if (state.background_alt.trim() === '') {
    problems.push('Describe the background image, so it can be read by a screen reader.');
  }
  if (state.points.length === 0) problems.push('Place at least one hotspot.');

  state.points.forEach((point, index) => {
    const empty =
      point.popup_type === 'image' ? point.popup_image.trim() === '' : point.body_text.trim() === '';
    if (empty) problems.push(`Hotspot ${index + 1} opens onto nothing.`);
    if (point.popup_type === 'image' && point.popup_image.trim() !== '' && point.popup_image_alt.trim() === '') {
      problems.push(`Hotspot ${index + 1}'s picture has no description.`);
    }
  });

  return problems.length > 6 ? [...problems.slice(0, 5), `…and ${problems.length - 5} more.`] : problems;
}

// ---------------------------------------------------------------------------

const ARROW_STEP = 1; // percent per arrow press
const ARROW_STEP_FINE = 0.25; // with shift held

export function ImageHotspotsEditor({
  state,
  onChange,
  disabled,
}: {
  state: ImageHotspotsEditorState;
  onChange: (next: ImageHotspotsEditorState) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState<'background' | 'popup' | 'icon' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);

  const set = <K extends keyof ImageHotspotsEditorState>(key: K, value: ImageHotspotsEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const patchPoint = (index: number, patch: Partial<ImageHotspotPointInput>) =>
    onChange({
      ...state,
      points: state.points.map((point, i) => (i === index ? { ...point, ...patch } : point)),
    });

  const upload = async (file: File, role: 'background' | 'popup' | 'icon', apply: (url: string) => void) => {
    setUploading(role);
    setUploadError('');
    try {
      apply(await imageHotspotsApi.uploadMedia(file, role));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  /** A pointer position on the canvas, as a percentage of it. */
  const pointToPercent = (clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: Math.max(0, Math.min(100, ((clientX - box.left) / box.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - box.top) / box.height) * 100)),
    };
  };

  const addHotspotAt = (x: number, y: number) => {
    const point: ImageHotspotPointInput = {
      position_x: x,
      position_y: y,
      header: '',
      popup_type: 'text',
      body_text: '',
      popup_image: '',
      popup_image_alt: '',
      icon_name: '',
      icon_color: '',
      icon_image: '',
      tooltip: '',
      aria_label: '',
      popup_width: 40,
    };
    onChange({ ...state, points: [...state.points, point], selected: state.points.length });
  };

  const selected = state.selected !== null ? state.points[state.selected] : undefined;

  return (
    <div className="space-y-4">
      {uploadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
      ) : null}

      <FieldGroup title="About this activity" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="Parts of the human digestive system"
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
        <TextField
          label="Instruction"
          value={state.task_description}
          onChange={(v) => set('task_description', v)}
          disabled={disabled}
          hint="Shown above the image."
          placeholder="Tap each marker to explore the diagram."
        />
      </FieldGroup>

      {/* ---- background ---- */}
      <FieldGroup title="Background image" columns={1}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
            {uploading === 'background' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {state.background_image ? 'Replace image' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled || uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;

                // The natural size is read here, at upload, because it is the
                // only moment the bytes are in hand. It is what reserves the
                // aspect box before the image loads later, which is what stops
                // every hotspot jumping when it does.
                const image = new Image();
                const objectUrl = URL.createObjectURL(file);
                image.onload = () => {
                  onChange({ ...state, image_width: image.naturalWidth, image_height: image.naturalHeight });
                  URL.revokeObjectURL(objectUrl);
                };
                image.src = objectUrl;

                void upload(file, 'background', (url) => set('background_image', url));
              }}
            />
          </label>
          {state.image_width && state.image_height ? (
            <span className="text-[11px] tabular-nums text-slate-400">
              {state.image_width} × {state.image_height}
            </span>
          ) : null}
        </div>

        <TextField
          label="Image description"
          required
          value={state.background_alt}
          onChange={(v) => set('background_alt', v)}
          disabled={disabled}
          hint="This activity is nothing but an image, so a learner using a screen reader has only this."
          placeholder="A labelled outline of the human digestive tract, from mouth to large intestine."
          maxLength={255}
        />
      </FieldGroup>

      {/* ---- canvas ---- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Hotspots</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Click the image to place one. Drag a marker to move it, or select it and use the arrow keys.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled || !state.background_image}
            onClick={() => addHotspotAt(50, 50)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add in the centre
          </button>
        </div>

        {state.background_image ? (
          <div
            ref={canvasRef}
            className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            style={
              state.image_width && state.image_height
                ? { aspectRatio: `${state.image_width} / ${state.image_height}` }
                : { aspectRatio: '16 / 9' }
            }
            onClick={(e) => {
              // Only a click on the picture itself places a hotspot; a click
              // that started on a marker is a selection or a drag.
              if (disabled || e.target !== e.currentTarget) return;
              const position = pointToPercent(e.clientX, e.clientY);
              if (position) addHotspotAt(position.x, position.y);
            }}
            onPointerMove={(e) => {
              if (dragging === null || disabled) return;
              const position = pointToPercent(e.clientX, e.clientY);
              if (position) patchPoint(dragging, { position_x: position.x, position_y: position.y });
            }}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.background_image}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />

            {state.points.map((point, index) => (
              <HotspotMarker
                key={index}
                index={index}
                point={point}
                defaults={{ icon: state.default_icon, color: state.default_icon_color }}
                showNumber={state.show_hotspot_numbers}
                selected={state.selected === index}
                onPointerDown={(e) => {
                  if (disabled) return;
                  e.stopPropagation();
                  set('selected', index);
                  setDragging(index);
                }}
                onKeyDown={(e) => {
                  if (disabled) return;
                  const step = e.shiftKey ? ARROW_STEP_FINE : ARROW_STEP;
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  };
                  const move = moves[e.key];
                  if (!move) return;
                  e.preventDefault();
                  patchPoint(index, {
                    position_x: Math.max(0, Math.min(100, point.position_x + move[0])),
                    position_y: Math.max(0, Math.min(100, point.position_y + move[1])),
                  });
                }}
                onFocus={() => set('selected', index)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-500">
            Upload a background image to start placing hotspots.
          </p>
        )}
      </section>

      {/* ---- the selected hotspot ---- */}
      {selected && state.selected !== null ? (
        <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Hotspot {state.selected + 1}</h2>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...state,
                  points: state.points.filter((_, i) => i !== state.selected),
                  selected: null,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Popup title"
              value={selected.header}
              onChange={(v) => patchPoint(state.selected as number, { header: v })}
              disabled={disabled}
              placeholder="Stomach"
              maxLength={255}
            />
            <SelectField<HotspotPopupType>
              label="Popup contains"
              value={selected.popup_type}
              onChange={(v) => patchPoint(state.selected as number, { popup_type: v })}
              disabled={disabled}
              options={[
                { value: 'text', label: 'A paragraph' },
                { value: 'rich', label: 'Rich content (headings, lists, links)' },
                { value: 'image', label: 'A picture' },
              ]}
            />
          </div>

          <div className="mt-4">
            {selected.popup_type === 'image' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {selected.popup_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.popup_image}
                      alt=""
                      className="h-16 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                    {uploading === 'popup' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    {selected.popup_image ? 'Replace picture' : 'Upload picture'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={disabled || uploading !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) {
                          void upload(file, 'popup', (url) =>
                            patchPoint(state.selected as number, { popup_image: url })
                          );
                        }
                      }}
                    />
                  </label>
                </div>
                <TextField
                  label="Picture description"
                  required
                  value={selected.popup_image_alt}
                  onChange={(v) => patchPoint(state.selected as number, { popup_image_alt: v })}
                  disabled={disabled}
                  maxLength={255}
                />
              </div>
            ) : (
              <TextAreaField
                label={selected.popup_type === 'rich' ? 'Popup content (HTML allowed)' : 'Popup text'}
                value={selected.body_text}
                onChange={(v) => patchPoint(state.selected as number, { body_text: v })}
                disabled={disabled}
                rows={selected.popup_type === 'rich' ? 6 : 3}
                hint={
                  selected.popup_type === 'rich'
                    ? 'Headings, lists, links and inline images. Markup is sanitised before it is shown.'
                    : undefined
                }
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Tooltip"
              value={selected.tooltip}
              onChange={(v) => patchPoint(state.selected as number, { tooltip: v })}
              disabled={disabled}
              hint="Shown on hover and on focus. Keep it to a few words."
              maxLength={255}
            />
            <TextField
              label="Accessible name"
              value={selected.aria_label}
              onChange={(v) => patchPoint(state.selected as number, { aria_label: v })}
              disabled={disabled}
              hint="What a screen reader announces. Defaults to the popup title."
              maxLength={255}
            />
            <SelectField
              label="Marker icon"
              value={selected.icon_name || ''}
              onChange={(v) => patchPoint(state.selected as number, { icon_name: v })}
              disabled={disabled}
              options={[
                { value: '', label: `Use the default (${state.default_icon})` },
                ...HOTSPOT_ICONS.map((icon) => ({ value: icon as string, label: icon })),
              ]}
            />
            <NumberField
              label="Popup width"
              value={selected.popup_width}
              onChange={(v) => patchPoint(state.selected as number, { popup_width: v })}
              min={10}
              max={100}
              suffix="% of the image"
              disabled={disabled}
            />
          </div>
        </section>
      ) : state.points.length > 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-500">
          Select a hotspot on the image to edit what it opens.
        </p>
      ) : null}

      <FieldGroup title="Markers and behaviour">
        <SelectField
          label="Default icon"
          value={state.default_icon}
          onChange={(v) => set('default_icon', v)}
          disabled={disabled}
          options={HOTSPOT_ICONS.map((icon) => ({ value: icon as string, label: icon }))}
        />
        <ColorField
          label="Default marker colour"
          value={state.default_icon_color}
          onChange={(v) => set('default_icon_color', v)}
          disabled={disabled}
        />
        <CheckField
          label="Number the hotspots"
          hint="Gives a teacher and a screen reader the same order to refer to."
          checked={state.show_hotspot_numbers}
          onChange={(v) => set('show_hotspot_numbers', v)}
          disabled={disabled}
        />
        <CheckField
          label="Close one popup when another opens"
          hint="Off lets several stand open at once, which suits comparison diagrams."
          checked={state.single_popup_open}
          onChange={(v) => set('single_popup_open', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup
        title="Scoring"
        description="H5P does not score this type. Here it is scored on coverage — one point per hotspot opened — so it appears in reports alongside everything else. It is a measure of whether the diagram was read, not of understanding."
      >
        <NumberField
          label="Points per hotspot"
          value={state.points_per_hotspot}
          onChange={(v) => set('points_per_hotspot', v)}
          min={1}
          max={100}
          disabled={disabled}
        />
        <NumberField
          label="Counts as done at"
          value={state.pass_percentage}
          onChange={(v) => set('pass_percentage', v)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
        />
        <CheckField
          label="Allow a reset"
          hint="Lets a learner clear which hotspots they have opened and start again."
          checked={state.enable_retry}
          onChange={(v) => set('enable_retry', v)}
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
