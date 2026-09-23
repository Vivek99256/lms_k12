'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Maximize2,
  MousePointerClick,
  Save,
  Square,
  Trash2,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
import {
  uploadDragDropImage,
  type DragDropElementInput,
  type DragDropSavePayload,
  type DragDropZoneInput,
  type H5pDragDrop,
} from '../../data/h5p';
import {
  normalisePointerType,
  shouldAbandonGesture,
  shouldActivateDrag,
  type DragPointerType,
} from '@/lib/h5p/drag-gesture';
import {
  canvasAspectRatio,
  fitCanvasSize,
  DEFAULT_IMAGE_FIT,
  IMAGE_FIT_CLASS,
  IMAGE_FIT_OPTIONS,
  normaliseImageFit,
  readImageSize,
  type DragDropImageFit,
} from '@/lib/h5p/drag-drop-canvas';
import { useBackgroundSize } from './use-background-size';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Drag and drop authoring canvas, shared by the create and edit pages.
 *
 * WHAT THE AUTHOR IS ACTUALLY DOING
 *
 * Placing two kinds of thing on one background: drop zones (targets) and
 * draggables (text or image). Then saying which draggable belongs in which
 * zone. Everything else -- scoring, retry, show-solution -- is a setting on the
 * task, not a per-item decision.
 *
 * WHY PERCENTAGES
 *
 * Every position and size in this editor is a percentage of the canvas, not a
 * pixel. The author works at whatever width their screen gives them and the
 * student may be on a phone; storing pixels would mean a task authored on a
 * 1600px monitor renders off-canvas on a tablet. The canvas measures itself
 * (`canvasRect`) and converts at the edges only.
 *
 * WHY MAPPING IS EDITED FROM THE ZONE
 *
 * H5P keeps two lists -- which zones a draggable MAY enter, and which
 * draggables are CORRECT in a zone -- and an author who has to keep both in
 * step by hand will get them out of step. So marking a draggable correct in a
 * zone also makes it droppable there, automatically. The element panel only
 * adds the case that cannot be inferred: a distractor, droppable somewhere but
 * correct nowhere.
 *
 * KEYBOARD
 *
 * Pointer dragging is the fast path, not the only one. A selected item moves
 * with the arrow keys and resizes with shift+arrow, one percent at a time, so
 * a task can be authored without a mouse.
 */

export interface DragDropEditorState {
  title: string;
  description: string;
  taskDescription: string;
  backgroundImage: string;
  /** How the background meets the canvas. See lib/h5p/drag-drop-canvas. */
  imageFit: DragDropImageFit;
  canvasWidth: number;
  canvasHeight: number;
  passPercentage: number;
  enableRetry: boolean;
  enableShowSolution: boolean;
  enableCheck: boolean;
  singlePoint: boolean;
  applyPenalties: boolean;
  elements: DragDropElementInput[];
  zones: DragDropZoneInput[];
}

type Selection = { kind: 'zone' | 'element'; ref: string } | null;

let refCounter = 0;
function nextRef(prefix: string): string {
  refCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${refCounter}`;
}

export function emptyEditorState(): DragDropEditorState {
  return {
    title: '',
    description: '',
    taskDescription: 'Drag each item onto the zone it belongs to.',
    backgroundImage: '',
    imageFit: DEFAULT_IMAGE_FIT,
    canvasWidth: 620,
    canvasHeight: 310,
    passPercentage: 100,
    enableRetry: true,
    enableShowSolution: true,
    enableCheck: true,
    singlePoint: false,
    applyPenalties: true,
    elements: [],
    zones: [],
  };
}

/**
 * Turn a saved task back into editor state.
 *
 * Real ids become refs here and never come back -- the save path only speaks
 * refs, and keeping the id as the ref string is what lets an edit preserve the
 * author's existing mapping without a second lookup table.
 */
export function editorStateFromTask(task: H5pDragDrop): DragDropEditorState {
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    taskDescription: task.task_description ?? '',
    backgroundImage: task.background_image ?? '',
    imageFit: normaliseImageFit(task.image_fit),
    canvasWidth: task.canvas_width ?? 620,
    canvasHeight: task.canvas_height ?? 310,
    passPercentage: task.pass_percentage ?? 100,
    enableRetry: Boolean(task.enable_retry),
    enableShowSolution: Boolean(task.enable_show_solution),
    enableCheck: Boolean(task.enable_check),
    singlePoint: Boolean(task.single_point),
    applyPenalties: Boolean(task.apply_penalties),
    elements: (task.elements ?? []).map((element) => ({
      ref: String(element.id),
      element_type: element.element_type,
      text: element.text ?? '',
      image_path: element.image_path ?? '',
      image_alt: element.image_alt ?? '',
      position_x: Number(element.position_x),
      position_y: Number(element.position_y),
      width: Number(element.width),
      height: Number(element.height),
      multiple: Boolean(element.multiple),
      drop_zone_refs: (element.drop_zone_ids ?? []).map(String),
    })),
    zones: (task.zones ?? []).map((zone) => ({
      ref: String(zone.id),
      label: zone.label ?? '',
      tip: zone.tip ?? '',
      position_x: Number(zone.position_x),
      position_y: Number(zone.position_y),
      width: Number(zone.width),
      height: Number(zone.height),
      single: Boolean(zone.single),
      auto_align: Boolean(zone.auto_align),
      show_label: Boolean(zone.show_label),
      correct_element_refs: (zone.correct_element_ids ?? []).map(String),
    })),
  };
}

export function toSavePayload(state: DragDropEditorState): DragDropSavePayload {
  return {
    title: state.title.trim(),
    description: state.description,
    task_description: state.taskDescription,
    background_image: state.backgroundImage,
    image_fit: state.imageFit,
    canvas_width: state.canvasWidth,
    canvas_height: state.canvasHeight,
    pass_percentage: state.passPercentage,
    enable_retry: state.enableRetry,
    enable_show_solution: state.enableShowSolution,
    enable_check: state.enableCheck,
    single_point: state.singlePoint,
    apply_penalties: state.applyPenalties,
    elements: state.elements,
    zones: state.zones,
  };
}

/**
 * What still stands between this task and a working activity.
 *
 * Shown while authoring rather than raised on save, because every item here is
 * something the author can only fix on the canvas they are already looking at.
 * The server enforces the same rules on publish -- this is the friendly copy of
 * that check, not a replacement for it.
 */
export function validateEditorState(state: DragDropEditorState): string[] {
  const problems: string[] = [];

  if (!state.title.trim()) problems.push('Give the activity a title.');
  if (state.elements.length === 0) problems.push('Add at least one draggable.');
  if (state.zones.length === 0) problems.push('Add at least one drop zone.');

  const mapped = state.zones.some((zone) => zone.correct_element_refs.length > 0);
  if (state.zones.length > 0 && state.elements.length > 0 && !mapped) {
    problems.push('Mark at least one draggable as correct in a drop zone, or the activity cannot be scored.');
  }

  const blankText = state.elements.some(
    (element) => element.element_type === 'text' && !element.text.trim()
  );
  if (blankText) problems.push('One or more text draggables are empty.');

  const missingImage = state.elements.some(
    (element) => element.element_type === 'image' && !element.image_path
  );
  if (missingImage) problems.push('One or more image draggables have no image yet.');

  return problems;
}

interface DragState {
  kind: 'zone' | 'element';
  ref: string;
  mode: 'move' | 'resize';
  /** Pointer offset inside the item at grab time, in percent. */
  offsetX: number;
  offsetY: number;
  pointerType: DragPointerType;
  /** Press origin in client px, for the activation threshold. */
  startX: number;
  startY: number;
  startedAt: number;
  /**
   * False while the press could still turn out to be a page scroll.
   *
   * The canvas is a fixed-aspect box that can easily fill a phone screen, so
   * an author scrolling past it puts a finger down on a zone every time. Until
   * this flips true nothing moves and nothing is prevented -- see the header of
   * lib/h5p/drag-gesture.ts for why the arbitration has to work this way.
   */
  active: boolean;
}

export function DragDropEditor({
  state,
  onChange,
  onSave,
  saving,
  saveLabel = 'Save activity',
  secondaryAction,
}: {
  state: DragDropEditorState;
  onChange: (next: DragDropEditorState) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  secondaryAction?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [uploading, setUploading] = useState<'background' | 'element' | null>(null);
  const [uploadError, setUploadError] = useState('');

  const problems = useMemo(() => validateEditorState(state), [state]);

  const patch = useCallback(
    (partial: Partial<DragDropEditorState>) => onChange({ ...state, ...partial }),
    [onChange, state]
  );

  // --- geometry ----------------------------------------------------------

  /** Pointer position as a percentage of the canvas, clamped to it. */
  const pointerPercent = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const updateZone = useCallback(
    (ref: string, partial: Partial<DragDropZoneInput>) => {
      patch({ zones: state.zones.map((zone) => (zone.ref === ref ? { ...zone, ...partial } : zone)) });
    },
    [patch, state.zones]
  );

  const updateElement = useCallback(
    (ref: string, partial: Partial<DragDropElementInput>) => {
      patch({
        elements: state.elements.map((element) =>
          element.ref === ref ? { ...element, ...partial } : element
        ),
      });
    },
    [patch, state.elements]
  );

  // --- pointer drag ------------------------------------------------------

  useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent) => {
      if (!drag.active) {
        const sample = {
          pointerType: drag.pointerType,
          dx: event.clientX - drag.startX,
          dy: event.clientY - drag.startY,
          elapsedMs: event.timeStamp - drag.startedAt,
        };

        // A finger that is scrolling keeps its scroll; the item stays put and
        // remains selected, which is a reasonable outcome for a stray touch.
        if (shouldAbandonGesture(sample)) {
          setDrag(null);
          return;
        }
        if (!shouldActivateDrag(sample)) return;

        setDrag({ ...drag, active: true });
        return;
      }

      // Past the threshold the drag is real, so suppressing text selection and
      // any residual panning is correct rather than theft.
      if (event.cancelable) event.preventDefault();

      const { x, y } = pointerPercent(event.clientX, event.clientY);

      if (drag.mode === 'move') {
        const nextX = Math.min(100, Math.max(0, x - drag.offsetX));
        const nextY = Math.min(100, Math.max(0, y - drag.offsetY));
        if (drag.kind === 'zone') updateZone(drag.ref, { position_x: nextX, position_y: nextY });
        else updateElement(drag.ref, { position_x: nextX, position_y: nextY });
        return;
      }

      // Resize: the item's own origin is fixed and the pointer sets the far
      // corner. Minimums keep an item from being shrunk to something that
      // cannot be grabbed again.
      const item =
        drag.kind === 'zone'
          ? state.zones.find((zone) => zone.ref === drag.ref)
          : state.elements.find((element) => element.ref === drag.ref);
      if (!item) return;

      const width = Math.min(100 - item.position_x, Math.max(4, x - item.position_x));
      const height = Math.min(100 - item.position_y, Math.max(4, y - item.position_y));
      if (drag.kind === 'zone') updateZone(drag.ref, { width, height });
      else updateElement(drag.ref, { width, height });
    };

    const onUp = () => setDrag(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, pointerPercent, state.elements, state.zones, updateElement, updateZone]);

  const startDrag = (
    event: React.PointerEvent,
    kind: 'zone' | 'element',
    ref: string,
    mode: 'move' | 'resize'
  ) => {
    // Deliberately no preventDefault here. At pointerdown this could still be
    // a scroll, and cancelling the default is how that scroll gets stolen.
    // Selection is safe to apply immediately -- a tap selects.
    event.stopPropagation();
    setSelection({ kind, ref });

    const item =
      kind === 'zone'
        ? state.zones.find((zone) => zone.ref === ref)
        : state.elements.find((element) => element.ref === ref);
    if (!item) return;

    const { x, y } = pointerPercent(event.clientX, event.clientY);
    setDrag({
      kind,
      ref,
      mode,
      offsetX: x - item.position_x,
      offsetY: y - item.position_y,
      pointerType: normalisePointerType(event.pointerType),
      startX: event.clientX,
      startY: event.clientY,
      // The event timestamp, not Date.now(): it is pure (so it is legal in a
      // handler defined during render), and it shares an origin with the move
      // events it is later subtracted from.
      startedAt: event.timeStamp,
      // A resize handle is unambiguous: it is too small to be a scroll grab and
      // has no other meaning, so it skips the threshold and drags at once.
      active: mode === 'resize',
    });
  };

  // --- keyboard nudging --------------------------------------------------

  const onCanvasKeyDown = (event: React.KeyboardEvent) => {
    if (!selection) return;
    const step = 1;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();

    const item =
      selection.kind === 'zone'
        ? state.zones.find((zone) => zone.ref === selection.ref)
        : state.elements.find((element) => element.ref === selection.ref);
    if (!item) return;

    if (event.shiftKey) {
      const width = Math.min(100 - item.position_x, Math.max(4, item.width + delta[0]));
      const height = Math.min(100 - item.position_y, Math.max(4, item.height + delta[1]));
      if (selection.kind === 'zone') updateZone(selection.ref, { width, height });
      else updateElement(selection.ref, { width, height });
      return;
    }

    const position_x = Math.min(100 - item.width, Math.max(0, item.position_x + delta[0]));
    const position_y = Math.min(100 - item.height, Math.max(0, item.position_y + delta[1]));
    if (selection.kind === 'zone') updateZone(selection.ref, { position_x, position_y });
    else updateElement(selection.ref, { position_x, position_y });
  };

  // --- add / remove ------------------------------------------------------

  const addZone = () => {
    const zone: DragDropZoneInput = {
      ref: nextRef('zone'),
      label: `Zone ${state.zones.length + 1}`,
      tip: '',
      // Staggered so a second zone does not land exactly on the first.
      position_x: Math.min(70, 10 + state.zones.length * 6),
      position_y: Math.min(70, 45 + (state.zones.length % 2) * 8),
      width: 22,
      height: 22,
      single: true,
      auto_align: true,
      show_label: true,
      correct_element_refs: [],
    };
    patch({ zones: [...state.zones, zone] });
    setSelection({ kind: 'zone', ref: zone.ref });
  };

  const addElement = (type: 'text' | 'image', imagePath = '') => {
    const element: DragDropElementInput = {
      ref: nextRef('el'),
      element_type: type,
      text: type === 'text' ? `Item ${state.elements.length + 1}` : '',
      image_path: imagePath,
      image_alt: '',
      position_x: Math.min(70, 8 + state.elements.length * 6),
      position_y: Math.min(30, 6 + (state.elements.length % 3) * 8),
      width: type === 'image' ? 16 : 18,
      height: type === 'image' ? 16 : 10,
      multiple: false,
      drop_zone_refs: [],
    };
    patch({ elements: [...state.elements, element] });
    setSelection({ kind: 'element', ref: element.ref });
  };

  const removeSelected = () => {
    if (!selection) return;

    if (selection.kind === 'zone') {
      patch({
        zones: state.zones.filter((zone) => zone.ref !== selection.ref),
        // A deleted zone must also leave every element's allowed list, or the
        // save would carry a reference to something that no longer exists.
        elements: state.elements.map((element) => ({
          ...element,
          drop_zone_refs: element.drop_zone_refs.filter((ref) => ref !== selection.ref),
        })),
      });
    } else {
      patch({
        elements: state.elements.filter((element) => element.ref !== selection.ref),
        zones: state.zones.map((zone) => ({
          ...zone,
          correct_element_refs: zone.correct_element_refs.filter((ref) => ref !== selection.ref),
        })),
      });
    }
    setSelection(null);
  };

  // --- mapping -----------------------------------------------------------

  /**
   * Mark a draggable correct (or not) in a zone.
   *
   * Marking it correct also makes it droppable there. Unmarking does not undo
   * that: an author may want a draggable that can be dropped in a zone but is
   * wrong there, and silently revoking the allowance would delete that intent.
   */
  const toggleCorrect = (zoneRef: string, elementRef: string) => {
    const zone = state.zones.find((z) => z.ref === zoneRef);
    if (!zone) return;

    const isCorrect = zone.correct_element_refs.includes(elementRef);
    const nextCorrect = isCorrect
      ? zone.correct_element_refs.filter((ref) => ref !== elementRef)
      : [...zone.correct_element_refs, elementRef];

    patch({
      zones: state.zones.map((z) => (z.ref === zoneRef ? { ...z, correct_element_refs: nextCorrect } : z)),
      elements: state.elements.map((element) => {
        if (element.ref !== elementRef || isCorrect) return element;
        if (element.drop_zone_refs.includes(zoneRef)) return element;
        return { ...element, drop_zone_refs: [...element.drop_zone_refs, zoneRef] };
      }),
    });
  };

  /**
   * Allow (or stop allowing) a draggable to be dropped into a zone, WITHOUT
   * saying it is correct there. That is the distractor case: droppable, wrong.
   *
   * Revoking the allowance also revokes the correctness that depended on it --
   * a draggable cannot be correct in a zone it may not enter. Both sides move
   * in one patch, because two sequential updates would compute the second from
   * pre-patch state and silently drop one of the changes.
   */
  const toggleAllowed = (elementRef: string, zoneRef: string) => {
    const element = state.elements.find((e) => e.ref === elementRef);
    if (!element) return;

    const allowed = element.drop_zone_refs.includes(zoneRef);

    patch({
      elements: state.elements.map((e) =>
        e.ref === elementRef
          ? {
              ...e,
              drop_zone_refs: allowed
                ? e.drop_zone_refs.filter((ref) => ref !== zoneRef)
                : [...e.drop_zone_refs, zoneRef],
            }
          : e
      ),
      zones: allowed
        ? state.zones.map((zone) =>
            zone.ref === zoneRef
              ? {
                  ...zone,
                  correct_element_refs: zone.correct_element_refs.filter((ref) => ref !== elementRef),
                }
              : zone
          )
        : state.zones,
    });
  };

  // --- uploads -----------------------------------------------------------

  const handleUpload = async (file: File, role: 'background' | 'element') => {
    setUploadError('');
    setUploading(role);
    try {
      // Measured from the picked file, before the upload, so the canvas can be
      // resized in the same patch that sets the URL -- one render, no flash of
      // the old 2:1 box, and no second round trip to ask the server how big
      // the image it just stored is.
      const natural = role === 'background' ? await readImageSize(file) : null;
      const url = await uploadDragDropImage(file, role);
      if (role === 'background') {
        // Matching the canvas to the image is what keeps every fit mode
        // honest: at this size contain, cover and stretch all agree, and a
        // percentage on the canvas is the same percentage on the diagram.
        const size = natural ? fitCanvasSize(natural.width, natural.height) : null;
        patch(
          size
            ? { backgroundImage: url, canvasWidth: size.width, canvasHeight: size.height }
            : { backgroundImage: url }
        );
      } else addElement('image', url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  // --- background geometry -----------------------------------------------

  const backgroundSize = useBackgroundSize(state.backgroundImage || null);
  const activeFitOption = IMAGE_FIT_OPTIONS.find((option) => option.value === state.imageFit);

  // True when the stored canvas no longer matches the image's own proportions,
  // which is the only case where contain has to letterbox and the other modes
  // have to crop or distort.
  const refitTarget = backgroundSize ? fitCanvasSize(backgroundSize.width, backgroundSize.height) : null;
  const canRefit =
    refitTarget !== null &&
    (Math.abs(refitTarget.width - state.canvasWidth) > 1 ||
      Math.abs(refitTarget.height - state.canvasHeight) > 1);

  const refitCanvasToImage = () => {
    if (!refitTarget) return;
    patch({ canvasWidth: refitTarget.width, canvasHeight: refitTarget.height });
  };

  const selectedZone =
    selection?.kind === 'zone' ? state.zones.find((zone) => zone.ref === selection.ref) : undefined;
  const selectedElement =
    selection?.kind === 'element'
      ? state.elements.find((element) => element.ref === selection.ref)
      : undefined;

  const elementLabel = (element: DragDropElementInput, index: number) =>
    element.element_type === 'image'
      ? element.image_alt || `Image ${index + 1}`
      : element.text || `Item ${index + 1}`;

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- */}
      {/* Task settings                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dd-title">Title</Label>
            <Input
              id="dd-title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Label the parts of a flower"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="dd-task">Instruction shown to the learner</Label>
            <Input
              id="dd-task"
              value={state.taskDescription}
              onChange={(e) => patch({ taskDescription: e.target.value })}
              placeholder="Drag each label onto the correct part."
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="dd-description">Description (for teachers)</Label>
          <Textarea
            id="dd-description"
            value={state.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            placeholder="What this activity checks, and when to use it."
            className="mt-1.5"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Canvas + inspector                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addZone}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Square className="h-3.5 w-3.5" />
              Add drop zone
            </button>
            <button
              type="button"
              onClick={() => addElement('text')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <TypeIcon className="h-3.5 w-3.5" />
              Add text draggable
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              {uploading === 'element' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              Add image draggable
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleUpload(file, 'element');
                }}
              />
            </label>

            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              {uploading === 'background' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {state.backgroundImage ? 'Replace background' : 'Background image'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleUpload(file, 'background');
                }}
              />
            </label>
          </div>

          {state.backgroundImage ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Label htmlFor="dd-fit" className="text-xs font-semibold text-slate-600">
                Image fit
              </Label>
              <select
                id="dd-fit"
                value={state.imageFit}
                onChange={(e) => patch({ imageFit: normaliseImageFit(e.target.value) })}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {IMAGE_FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500">{activeFitOption?.hint}</span>
              {/*
                Only offered when the canvas has drifted from the image -- on an
                older task, or after the author swapped the file by hand. It
                re-aligns the coordinate space without touching any zone, which
                is safe precisely because zones are percentages.
              */}
              {canRefit ? (
                <button
                  type="button"
                  onClick={refitCanvasToImage}
                  className="rounded-xl border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Fit canvas to image
                </button>
              ) : null}
              {backgroundSize ? (
                <span className="text-[11px] text-slate-400">
                  {backgroundSize.width} x {backgroundSize.height} px
                </span>
              ) : null}
            </div>
          ) : null}

          {uploadError ? (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {uploadError}
            </p>
          ) : null}

          {/*
            The canvas is focusable so arrow-key nudging has somewhere to land.
            Under the default contain fit the aspect ratio comes from the
            background image, so the whole image is visible, nothing is cropped
            and the canvas height follows the image -- portrait or landscape.
            Without a background, or under any other fit, it falls back to the
            authored canvas size. Either way the box is width:100% plus an
            aspect ratio, so desktop, tablet and phone scale proportionally.
          */}
          <div
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label="Drag and drop canvas. Select an item, then move it with the arrow keys or resize it with shift and the arrow keys."
            onKeyDown={onCanvasKeyDown}
            onPointerDown={() => setSelection(null)}
            className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            style={{
              aspectRatio: canvasAspectRatio(
                state.imageFit,
                state.canvasWidth,
                state.canvasHeight,
                backgroundSize
              ),
            }}
          >
            {state.backgroundImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.backgroundImage}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`pointer-events-none absolute inset-0 h-full w-full ${IMAGE_FIT_CLASS[state.imageFit]}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                Add a background image, or lay the task out on the plain canvas.
              </div>
            )}

            {state.zones.map((zone, index) => {
              const active = selection?.kind === 'zone' && selection.ref === zone.ref;
              return (
                <div
                  key={zone.ref}
                  onPointerDown={(e) => startDrag(e, 'zone', zone.ref, 'move')}
                  className={`absolute cursor-move rounded-lg border-2 border-dashed transition-colors ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-400 bg-white/40 hover:border-indigo-400'
                  }`}
                  style={{
                    // pan-y: a vertical swipe over a zone scrolls the page
                    // natively until the threshold in startDrag says otherwise.
                    touchAction: 'pan-y',
                    left: `${zone.position_x}%`,
                    top: `${zone.position_y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                  }}
                >
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {zone.label || `Zone ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    aria-label={`Resize ${zone.label || `zone ${index + 1}`}`}
                    onPointerDown={(e) => startDrag(e, 'zone', zone.ref, 'resize')}
                    className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500"
                  >
                    <Maximize2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}

            {state.elements.map((element, index) => {
              const active = selection?.kind === 'element' && selection.ref === element.ref;
              return (
                <div
                  key={element.ref}
                  onPointerDown={(e) => startDrag(e, 'element', element.ref, 'move')}
                  className={`absolute flex cursor-move items-center justify-center overflow-hidden rounded-lg border shadow-sm transition-colors ${
                    active
                      ? 'border-indigo-500 ring-2 ring-indigo-400'
                      : 'border-slate-300 hover:border-indigo-400'
                  } ${element.element_type === 'text' ? 'bg-white' : 'bg-slate-100'}`}
                  style={{
                    touchAction: 'pan-y',
                    left: `${element.position_x}%`,
                    top: `${element.position_y}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                  }}
                >
                  {element.element_type === 'image' && element.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={element.image_path}
                      alt={element.image_alt || ''}
                      draggable={false}
                      className="pointer-events-none h-full w-full object-contain"
                    />
                  ) : (
                    <span className="pointer-events-none truncate px-1.5 text-[11px] font-medium text-slate-700">
                      {elementLabel(element, index)}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Resize ${elementLabel(element, index)}`}
                    onPointerDown={(e) => startDrag(e, 'element', element.ref, 'resize')}
                    className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500"
                  >
                    <Maximize2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Drag to move, drag the corner handle to resize. With an item selected: arrow keys move it,
            shift + arrow keys resize it.
          </p>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Inspector                                                       */}
        {/* -------------------------------------------------------------- */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {selectedZone ? 'Drop zone' : selectedElement ? 'Draggable' : 'Selection'}
            </h2>

            {!selectedZone && !selectedElement ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <MousePointerClick className="h-3.5 w-3.5" />
                Select an item on the canvas to edit it.
              </p>
            ) : null}

            {selectedZone ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="zone-label">Label</Label>
                  <Input
                    id="zone-label"
                    value={selectedZone.label}
                    onChange={(e) => updateZone(selectedZone.ref, { label: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="zone-tip">Tip (shown on request)</Label>
                  <Input
                    id="zone-tip"
                    value={selectedZone.tip}
                    onChange={(e) => updateZone(selectedZone.ref, { tip: e.target.value })}
                    className="mt-1.5"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedZone.single}
                    onChange={(e) => updateZone(selectedZone.ref, { single: e.target.checked })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="font-medium">One item only</span>
                    <span className="block text-slate-500">
                      Clear this to let the zone hold several draggables (one-to-many).
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedZone.show_label}
                    onChange={(e) => updateZone(selectedZone.ref, { show_label: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show the label to learners
                </label>

                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-700">Correct draggables here</p>
                  {selectedZone.correct_element_refs.length === 0 && state.elements.length > 0 ? (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                      Nothing is correct in this zone yet, so dropping here can never earn a mark.
                    </p>
                  ) : null}
                  {state.elements.length === 0 ? (
                    <p className="text-xs text-slate-500">Add a draggable first.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {state.elements.map((element, index) => (
                        <label key={element.ref} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={selectedZone.correct_element_refs.includes(element.ref)}
                            onChange={() => toggleCorrect(selectedZone.ref, element.ref)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{elementLabel(element, index)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {selectedElement ? (
              <div className="space-y-3">
                {selectedElement.element_type === 'text' ? (
                  <div>
                    <Label htmlFor="el-text">Text</Label>
                    <Input
                      id="el-text"
                      value={selectedElement.text}
                      onChange={(e) => updateElement(selectedElement.ref, { text: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="el-alt">Image description</Label>
                    <Input
                      id="el-alt"
                      value={selectedElement.image_alt}
                      onChange={(e) => updateElement(selectedElement.ref, { image_alt: e.target.value })}
                      placeholder="What the image shows"
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Read aloud by screen readers, and used as this item&apos;s name in the list above.
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedElement.multiple}
                    onChange={(e) => updateElement(selectedElement.ref, { multiple: e.target.checked })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="font-medium">Can go in several zones</span>
                    <span className="block text-slate-500">
                      For one-to-many: the learner can place a copy in each zone it belongs to.
                    </span>
                  </span>
                </label>

                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-end justify-between gap-2">
                    <p className="text-xs font-medium text-slate-700">Where this belongs</p>
                    <div className="flex shrink-0 gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      <span className="w-12 text-center">Correct</span>
                      <span className="w-12 text-center">Can drop</span>
                    </div>
                  </div>

                  {state.zones.length === 0 ? (
                    <p className="text-xs text-slate-500">Add a drop zone first.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {state.zones.map((zone, index) => {
                        const correct = zone.correct_element_refs.includes(selectedElement.ref);
                        const allowed = selectedElement.drop_zone_refs.includes(zone.ref);
                        const name = zone.label || `Zone ${index + 1}`;

                        return (
                          <div key={zone.ref} className="flex items-center gap-2 text-xs text-slate-700">
                            <span className="min-w-0 flex-1 truncate">{name}</span>

                            {/* Correct implies droppable, so ticking this ticks
                                both. Untangling them is what the second column
                                is for. */}
                            <span className="flex w-12 justify-center">
                              <input
                                type="checkbox"
                                checked={correct}
                                onChange={() => toggleCorrect(zone.ref, selectedElement.ref)}
                                aria-label={`${name}: correct for this draggable`}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </span>

                            <span className="flex w-12 justify-center">
                              <input
                                type="checkbox"
                                checked={allowed}
                                disabled={correct}
                                onChange={() => toggleAllowed(selectedElement.ref, zone.ref)}
                                aria-label={`${name}: this draggable may be dropped here`}
                                title={
                                  correct
                                    ? 'A correct draggable can always be dropped here.'
                                    : 'Allow dropping here without it being correct.'
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                              />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-2 text-[11px] text-slate-500">
                    Tick <span className="font-medium">Correct</span> for every zone this belongs in.
                    Leave everything clear to make it a distractor that belongs nowhere.
                  </p>
                </div>
              </div>
            ) : null}

            {selectedZone || selectedElement ? (
              <button
                type="button"
                onClick={removeSelected}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove {selectedZone ? 'drop zone' : 'draggable'}
              </button>
            ) : null}
          </section>

          {/* ------------------------------------------------------------ */}
          {/* Scoring                                                       */}
          {/* ------------------------------------------------------------ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Scoring</h2>

            <div className="space-y-3">
              <div>
                <Label htmlFor="dd-pass">Pass mark</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    id="dd-pass"
                    type="number"
                    min={0}
                    max={100}
                    value={state.passPercentage}
                    onChange={(e) =>
                      patch({
                        passPercentage: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-slate-500">% of the maximum score</span>
                </div>
              </div>

              {[
                {
                  key: 'enableCheck' as const,
                  label: 'Check button',
                  hint: 'Lets the learner submit and see how they did.',
                },
                {
                  key: 'enableRetry' as const,
                  label: 'Retry button',
                  hint: 'Clears the answers so they can try again.',
                },
                {
                  key: 'enableShowSolution' as const,
                  label: 'Show solution button',
                  hint: 'Reveals the correct placement.',
                },
                {
                  key: 'applyPenalties' as const,
                  label: 'Subtract for wrong placements',
                  hint: 'Off means wrong placements simply do not count.',
                },
                {
                  key: 'singlePoint' as const,
                  label: 'Score as one point',
                  hint: 'The whole activity is worth 1, awarded at the pass mark.',
                },
              ].map((option) => (
                <label key={option.key} className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={state[option.key]}
                    onChange={(e) => patch({ [option.key]: e.target.checked } as Partial<DragDropEditorState>)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    <span className="block text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Save bar                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {problems.length > 0 ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-800">Before this can be published:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-700">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {secondaryAction}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !state.title.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saveLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

