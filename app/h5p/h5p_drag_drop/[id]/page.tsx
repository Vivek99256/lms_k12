'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, CheckCircle2, Eye, Lightbulb, X } from 'lucide-react';
import {
  dragDropSolution,
  fetchDragDrop,
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  scoreDragDropAttempt,
  type DragDropAttemptResult,
  type H5pDragDrop,
  type H5pDragDropElement,
} from '../../data/h5p';
import {
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';
import {
  Celebration,
  PrimaryAction,
  ProgressRail,
  RetryAction,
  ScoreCounter,
  SecondaryAction,
} from '../../components/game';
import { DROP_TARGET_ATTRIBUTE, useDragGesture } from '../components/use-drag-gesture';
import { useBackgroundSize } from '../components/use-background-size';
import {
  canvasAspectRatio,
  IMAGE_FIT_CLASS,
  normaliseImageFit,
} from '@/lib/h5p/drag-drop-canvas';

/**
 * Drag and drop — player. This is what a student sees.
 *
 * PLACEMENT MODEL
 *
 * `placements` maps element id -> the zone ids it currently sits in. A list,
 * not a single value, because a one-to-many draggable can legitimately be in
 * several zones at once. Everything else — the tray, the ticks, the score — is
 * derived from this one piece of state, so there is nothing to keep in sync.
 *
 * INPUT
 *
 * Pointer drag is the primary interaction, via useDragGesture — which will not
 * take the gesture until it is unmistakably a drag, so the page keeps scrolling
 * normally under a finger or a trackpad.
 *
 * It is not the only interaction: every draggable is also a button that can be
 * picked up with the keyboard, after which the zones become buttons that accept
 * it. Same state, same scoring — a student using a keyboard or a switch does the
 * identical activity, which is what WCAG 2.2 asks for and what H5P's own player
 * does not give us. That path is also the reason a drag must never fire on a
 * plain tap: the tap belongs to carry mode.
 *
 * TELEMETRY
 *
 * One `attempted` on first interaction, one `answered` per check with the
 * score and time spent, one `completed` when the attempt passes. That is the
 * verb set config/pal_h5p.php registers for this type, and `answered` is the
 * one PAL's BKT mastery pipeline acts on.
 */

type Placements = Record<number, number[]>;

/**
 * Opt-in diagnostics: append `?h5pDebug=1` to the player URL.
 *
 * Deliberately not an unconditional console.log. This runs in a classroom on a
 * student's screen; a player that chatters into the console on every drop is
 * noise in production and buries the one session someone is actually trying to
 * debug. Gated, it prints exactly what is needed to tell a mapping problem
 * apart from a scoring problem: the ids on both sides, and what the author
 * declared.
 */
function debugLog(enabled: boolean, label: string, detail: Record<string, unknown>): void {
  if (!enabled) return;
  console.info('[h5p:drag_and_drop] ' + label, detail);
}

function DragDropPlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);
  const debug = searchParams?.get('h5pDebug') === '1';

  const [task, setTask] = useState<H5pDragDrop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [placements, setPlacements] = useState<Placements>({});
  const [result, setResult] = useState<DragDropAttemptResult | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [carried, setCarried] = useState<number | null>(null);
  const [tip, setTip] = useState<string>('');

  // The student's canvas has to resolve the background exactly the way the
  // authoring canvas did, or zones drawn over a label land somewhere else.
  const backgroundSize = useBackgroundSize(task?.background_image ?? null);
  const imageFit = normaliseImageFit(task?.image_fit);

  // Telemetry bookkeeping. Refs, not state: changing them must never re-render.
  // Seeded on load rather than at render: Date.now() during render is impure
  // and would drift with every re-render, which is exactly the number we do
  // not want attached to a reported duration.
  const startedAt = useRef<number>(0);
  const attemptSent = useRef(false);
  const completedSent = useRef(false);
  const attemptCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!hasH5pContext(ctx) || !id) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });

    fetchDragDrop(id, ctx)
      .then((data) => {
        if (cancelled) return;
        setTask(data);
        startedAt.current = Date.now();
        debugLog(debug, 'loaded', {
          taskId: data.id,
          status: data.status,
          singlePoint: data.single_point,
          passPercentage: data.pass_percentage,
          zones: (data.zones ?? []).map((zone) => ({
            zoneId: zone.id,
            label: zone.label,
            single: zone.single,
            correctElementIds: zone.correct_element_ids ?? [],
          })),
          elements: (data.elements ?? []).map((element) => ({
            elementId: element.id,
            label: element.text ?? element.image_alt,
            multiple: element.multiple,
            allowedZoneIds: element.drop_zone_ids ?? [],
          })),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id, debug]);

  // Memoised because the place() callback closes over both: a fresh [] each render would
  // give every zone a new drop handler on every keystroke.
  const elements = useMemo(() => task?.elements ?? [], [task]);
  const zones = useMemo(() => task?.zones ?? [], [task]);

  /** Fired once, the first time the student touches anything. */
  const markAttempted = useCallback(() => {
    if (attemptSent.current || !task) return;
    attemptSent.current = true;
    void postH5pXapiStatement({ objectId: `drag_and_drop:${task.id}`, verb: 'attempted', ctx });
  }, [ctx, task]);

  // --- placement ---------------------------------------------------------

  const place = useCallback(
    (elementId: number, zoneId: number) => {
      const element = elements.find((e) => e.id === elementId);
      const zone = zones.find((z) => z.id === zoneId);
      if (!element || !zone) return;

      // The author decided where this draggable may go. Refusing here rather
      // than accepting and marking it wrong is what makes the task teachable:
      // a wrong drop is a wrong ANSWER, not a mis-aimed pointer.
      const allowed = (element.drop_zone_ids ?? []).map(Number);
      const correctHere = (zone.correct_element_ids ?? []).map(Number).includes(elementId);

      debugLog(debug, 'drop', {
        draggableId: elementId,
        draggableLabel: element.text ?? element.image_alt,
        droppedIntoZoneId: zoneId,
        zoneLabel: zone.label,
        allowedZoneIds: allowed,
        zoneAcceptsElementIds: (zone.correct_element_ids ?? []).map(Number),
        refused: allowed.length > 0 && !allowed.includes(zoneId),
        countsAsCorrect: correctHere,
      });

      if (allowed.length > 0 && !allowed.includes(zoneId)) return;

      markAttempted();
      setResult(null);
      setShowingSolution(false);
      setTip(zone.tip ?? '');

      setPlacements((current) => {
        const next: Placements = { ...current };

        // A one-item zone holds one thing: whatever was there goes back to the
        // tray so the student can see what they displaced.
        if (zone.single) {
          for (const [key, zoneIds] of Object.entries(next)) {
            const occupantId = Number(key);
            if (occupantId === elementId) continue;
            if (zoneIds.includes(zoneId)) {
              next[occupantId] = zoneIds.filter((z) => z !== zoneId);
            }
          }
        }

        const existing = next[elementId] ?? [];
        // A draggable that cannot be in several zones moves rather than copies.
        next[elementId] = element.multiple
          ? Array.from(new Set([...existing, zoneId]))
          : [zoneId];

        return next;
      });

      setCarried(null);
    },
    [elements, markAttempted, zones, debug]
  );

  const returnToTray = useCallback((elementId: number) => {
    setResult(null);
    setShowingSolution(false);
    setPlacements((current) => {
      const next = { ...current };
      delete next[elementId];
      return next;
    });
  }, []);

  /**
   * Resolve a pointer drop.
   *
   * Target keys are "zone:<id>" or "tray". Releasing anywhere else — the
   * background, another panel, off-screen — is a cancelled drag and leaves the
   * item where it was, which is the forgiving reading of an ambiguous action.
   */
  const drag = useDragGesture({
    onDrop: (elementId, targetKey) => {
      if (!targetKey) return;
      if (targetKey === 'tray') {
        returnToTray(elementId);
        return;
      }
      const zoneId = Number(targetKey.slice('zone:'.length));
      if (Number.isFinite(zoneId)) place(elementId, zoneId);
    },
    onDragStart: () => markAttempted(),
  });

  // --- check / retry / solution -----------------------------------------

  const check = () => {
    if (!task) return;
    const attempt = scoreDragDropAttempt(task, placements);
    attemptCount.current += 1;
    debugLog(debug, 'checked', { attempt: attemptCount.current, placements, result: attempt });
    setResult(attempt);
    setShowingSolution(false);

    const seconds = Math.round((Date.now() - startedAt.current) / 1000);

    void postH5pXapiStatement({
      objectId: `drag_and_drop:${task.id}`,
      verb: 'answered',
      ctx,
      success: attempt.passed,
      // Placements as "element:zone" pairs — enough for a reviewer to see which
      // specific pairing a cohort keeps getting wrong, which is the whole point
      // of sending a response rather than just a score.
      response: Object.entries(placements)
        .flatMap(([elementId, zoneIds]) => zoneIds.map((zoneId) => `${elementId}:${zoneId}`))
        .join(','),
      durationSeconds: seconds,
    });

    if (attempt.passed && !completedSent.current) {
      completedSent.current = true;
      void postH5pXapiStatement({
        objectId: `drag_and_drop:${task.id}`,
        verb: 'completed',
        ctx,
        success: true,
        durationSeconds: seconds,
      });
    }
  };

  const retry = () => {
    setPlacements({});
    setResult(null);
    setShowingSolution(false);
    setCarried(null);
    setTip('');
    // The clock restarts, so the duration on the next `answered` is the time
    // spent on THAT attempt rather than a total that grows without meaning.
    startedAt.current = Date.now();
  };

  const showSolution = () => {
    if (!task) return;
    setPlacements(dragDropSolution(task));
    setShowingSolution(true);
    setResult(null);
  };

  // --- rendering helpers -------------------------------------------------

  const placedElementIds = useMemo(
    () => new Set(Object.entries(placements).filter(([, zoneIds]) => zoneIds.length > 0).map(([k]) => Number(k))),
    [placements]
  );

  const trayElements = elements.filter(
    (element) => element.multiple || !placedElementIds.has(element.id)
  );

  const elementsInZone = (zoneId: number): H5pDragDropElement[] =>
    elements.filter((element) => (placements[element.id] ?? []).includes(zoneId));

  const elementLabel = (element: H5pDragDropElement) =>
    element.element_type === 'image'
      ? element.image_alt || 'Image'
      : element.text || 'Item';

  const canDrop = (elementId: number | null, zoneId: number) => {
    if (elementId === null) return false;
    const element = elements.find((e) => e.id === elementId);
    if (!element) return false;
    const allowed = (element.drop_zone_ids ?? []).map(Number);
    return allowed.length === 0 || allowed.includes(zoneId);
  };

  const draggingElement =
    drag.draggingId === null ? null : elements.find((e) => e.id === drag.draggingId) ?? null;

  const renderDraggable = (element: H5pDragDropElement, inZone: boolean) => {
    const verdict = result?.perElement[element.id];
    const carrying = carried === element.id;

    return (
      <button
        key={`${element.id}-${inZone ? 'zone' : 'tray'}`}
        type="button"
        onPointerDown={drag.onPointerDown(element.id)}
        onClick={() => {
          // Only reached when the gesture never became a drag, so this is a
          // genuine tap or click and carry mode is the right response.
          markAttempted();
          if (inZone && !carrying) {
            returnToTray(element.id);
            return;
          }
          setCarried(carrying ? null : element.id);
        }}
        // pan-y hands vertical scrolling to the browser until the hook decides
        // this is a drag. It is what makes a swipe over the tray scroll the
        // page at native smoothness instead of fighting a JS handler.
        style={{ touchAction: 'pan-y' }}
        aria-pressed={carrying}
        aria-label={
          inZone
            ? `${elementLabel(element)}, placed. Select to return it to the tray.`
            : `${elementLabel(element)}. Select to pick it up, then choose a drop zone.`
        }
        // An item that has landed in a zone animates in, so the placement is
        // visible as an event rather than as the tray quietly getting shorter.
        // Keyed by zone above, so the animation runs per placement.
        className={`h5p-tappable h5p-focusable h5p-target inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
          drag.draggingId === element.id ? 'opacity-40' : ''
        } ${inZone ? 'h5p-enter-scale' : ''} ${
          carrying
            ? 'border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] text-[color:var(--h5p-accent-deep)] ring-2 ring-[color:var(--h5p-accent-line)]'
            : verdict === true
              ? 'h5p-halo border-emerald-300 bg-emerald-50 text-emerald-800'
              : verdict === false
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-slate-300 bg-white text-slate-700 hover:border-[color:var(--h5p-accent)]'
        }`}
      >
        {element.element_type === 'image' && element.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={element.image_path}
            alt={element.image_alt || ''}
            className="h-8 w-8 rounded object-contain"
          />
        ) : (
          <span className="truncate">{element.text}</span>
        )}
        {verdict === true ? <Check className="h-3 w-3 shrink-0" /> : null}
        {verdict === false ? <X className="h-3 w-3 shrink-0" /> : null}
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto">
        <H5pPageHeader
          title={task?.title ?? 'Drag and drop'}
          description={task?.task_description || 'Drag each item onto the zone it belongs to'}
          ctx={ctx}
          backHref={`/h5p/h5p_drag_drop?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading activity…" />
            ) : task ? (
              <div className="space-y-4">
                {task.status !== 'published' ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Draft preview — students cannot see this activity until it is published.
                  </p>
                ) : null}
                {/* ------------------------------------------------------ */}
                {/* Tray                                                     */}
                {/* ------------------------------------------------------ */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Items to place
                  </h2>
                  <div
                    {...{ [DROP_TARGET_ATTRIBUTE]: 'tray' }}
                    className={`flex min-h-[3rem] flex-wrap items-center gap-2 rounded-xl border border-dashed p-2 transition-all duration-[--h5p-dur-quick] ${
                      drag.isDragging && drag.hoveredTarget === 'tray'
                        ? 'border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] ring-4 ring-[color:var(--h5p-accent-line)]'
                        : 'border-slate-300'
                    }`}
                  >
                    {trayElements.length === 0 ? (
                      <span className="px-1 text-xs text-slate-400">
                        Everything has been placed.
                      </span>
                    ) : (
                      trayElements.map((element) => renderDraggable(element, false))
                    )}
                  </div>
                  {carried !== null ? (
                    <p className="mt-2 text-xs text-indigo-700">
                      Carrying an item — choose a drop zone below, or select it again to put it down.
                    </p>
                  ) : trayElements.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Drag an item onto a zone, or tap it to pick it up and then tap the zone.
                    </p>
                  ) : null}
                </section>

                {/* ------------------------------------------------------ */}
                {/* Canvas                                                   */}
                {/* ------------------------------------------------------ */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div
                    className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    style={{
                      aspectRatio: canvasAspectRatio(
                        imageFit,
                        task.canvas_width,
                        task.canvas_height,
                        backgroundSize
                      ),
                    }}
                  >
                    {task.background_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={task.background_image}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className={`pointer-events-none absolute inset-0 h-full w-full ${IMAGE_FIT_CLASS[imageFit]}`}
                      />
                    ) : null}

                    {zones.map((zone, index) => {
                      const occupants = elementsInZone(zone.id);
                      const targetable = canDrop(carried, zone.id);
                      // Two ways to be the live target: carried by keyboard, or
                      // hovered by a pointer drag.
                      const highlighted =
                        (carried !== null && targetable) ||
                        (drag.isDragging &&
                          drag.hoveredTarget === `zone:${zone.id}` &&
                          canDrop(drag.draggingId, zone.id));

                      return (
                        <div
                          key={zone.id}
                          {...{ [DROP_TARGET_ATTRIBUTE]: `zone:${zone.id}` }}
                          onClick={() => {
                            if (carried !== null) place(carried, zone.id);
                          }}
                          role={carried !== null ? 'button' : undefined}
                          tabIndex={carried !== null && targetable ? 0 : -1}
                          onKeyDown={(e) => {
                            if (carried === null) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              place(carried, zone.id);
                            }
                          }}
                          aria-label={
                            carried !== null
                              ? `Drop into ${zone.label || `zone ${index + 1}`}`
                              : undefined
                          }
                          // A zone under the pointer, or waiting for a carried
                          // item, is lit and lifted rather than only tinted:
                          // on a phone the finger covers the tint, and a ring
                          // that extends past the fingertip is the part the
                          // learner can actually see.
                          className={`absolute flex flex-wrap content-start items-start gap-1 overflow-auto rounded-lg border-2 border-dashed p-1 transition-all duration-[--h5p-dur-quick] ${
                            highlighted
                              ? 'scale-[1.03] border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] ring-4 ring-[color:var(--h5p-accent-line)]'
                              : carried !== null
                                ? 'border-[color:var(--h5p-accent-line)] bg-white/70'
                                : 'border-slate-400 bg-white/50'
                          }`}
                          style={{
                            left: `${zone.position_x}%`,
                            top: `${zone.position_y}%`,
                            width: `${zone.width}%`,
                            height: `${zone.height}%`,
                          }}
                        >
                          {zone.show_label && zone.label ? (
                            <span className="pointer-events-none w-full truncate rounded bg-white/85 px-1 text-[10px] font-medium text-slate-600">
                              {zone.label}
                            </span>
                          ) : null}
                          {occupants.map((element) => renderDraggable(element, true))}
                        </div>
                      );
                    })}
                  </div>

                  {tip ? (
                    <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-slate-600">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {tip}
                    </p>
                  ) : null}
                </section>

                {/* ------------------------------------------------------ */}
                {/* Result + controls                                        */}
                {/* ------------------------------------------------------ */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  {result && !result.scoreable ? (
                    <div
                      className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
                      role="status"
                    >
                      <p className="font-medium">This activity cannot be marked yet.</p>
                      <p className="mt-0.5 text-xs">
                        No drop zone has a correct draggable set, so there is nothing to score
                        against. A teacher needs to finish setting it up in the editor.
                      </p>
                    </div>
                  ) : null}

                  {result && result.scoreable ? (
                    <div className="h5p-enter relative mb-3 overflow-visible rounded-xl border px-4 py-3"
                      style={
                        result.passed
                          ? { borderColor: 'var(--h5p-success-line)', background: 'var(--h5p-success-soft)' }
                          : { borderColor: 'var(--h5p-line)', background: 'var(--h5p-surface-sunken)' }
                      }
                      role="status"
                    >
                      <Celebration show={result.passed} pieces={14} />

                      <div className="relative flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="sr-only">
                            {`You scored ${result.score} out of ${result.maxScore}, ${result.percentage} percent.`}
                          </p>
                          <p aria-hidden="true">
                            <ScoreCounter value={result.score} max={result.maxScore} size="md" />
                          </p>
                          <p className="mt-0.5 text-xs text-[color:var(--h5p-ink-muted)]">
                            {result.correct} placed correctly
                            {result.incorrect > 0 ? `, ${result.incorrect} in the wrong place` : ''}
                            {result.missed > 0 ? `, ${result.missed} still to place` : ''}.
                            {result.passed ? '' : ` The pass mark is ${task.pass_percentage}%.`}
                          </p>
                        </div>

                        {result.passed ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                              background: 'var(--h5p-surface)',
                              color: 'color-mix(in srgb, var(--h5p-success) 80%, #000)',
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Passed
                          </span>
                        ) : null}
                      </div>

                      <ProgressRail
                        value={result.score}
                        max={result.maxScore}
                        label="Your score on this activity"
                        className="relative mt-3"
                      />
                    </div>
                  ) : null}

                  {showingSolution ? (
                    <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800" role="status">
                      <p className="flex items-center gap-1.5 font-medium">
                        <Eye className="h-4 w-4" />
                        This is the correct placement.
                      </p>
                      <p className="mt-0.5 text-xs">Select retry to try it yourself.</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {task.enable_check ? (
                      <PrimaryAction
                        onClick={check}
                        disabled={Object.keys(placements).length === 0 || showingSolution}
                        icon={<Check className="h-4 w-4" aria-hidden="true" />}
                      >
                        Check
                      </PrimaryAction>
                    ) : null}

                    {task.enable_retry ? <RetryAction onClick={retry} label="Retry" /> : null}

                    {task.enable_show_solution ? (
                      <SecondaryAction onClick={showSolution} icon={<Eye className="h-4 w-4" aria-hidden="true" />}>
                        Show solution
                      </SecondaryAction>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/*
        The ghost: a copy of the item pinned to the pointer while dragging.

        Fixed-positioned and pointer-events-none, both load-bearing. Fixed
        because the page scrolls underneath during an edge auto-scroll and the
        ghost must stay with the finger, not with the document. Pointer-events
        none because the hook finds its drop target with elementFromPoint, and a
        ghost sitting directly under the pointer would otherwise be the only
        thing it ever hit.
      */}
      {draggingElement && drag.pointer ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          // Lifted and tilted while it is in the air, and a little larger than
          // the item it came from, so it reads as picked up rather than as a
          // duplicate that appeared. The tilt is what makes it feel physical;
          // it costs one transform on an already-composited layer.
          style={{
            left: drag.pointer.x,
            top: drag.pointer.y,
            rotate: '-3deg',
            scale: '1.08',
          }}
        >
          <span
            className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-[color:var(--h5p-ink)]"
            style={{
              borderColor: 'var(--h5p-accent)',
              background: 'var(--h5p-surface)',
              boxShadow: 'var(--h5p-shadow-overlay)',
            }}
          >
            {draggingElement.element_type === 'image' && draggingElement.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draggingElement.image_path}
                alt=""
                className="h-8 w-8 rounded object-contain"
              />
            ) : (
              <span className="truncate">{draggingElement.text}</span>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function DragDropPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading activity…" />}>
      <DragDropPlayerContent />
    </Suspense>
  );
}
