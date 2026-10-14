'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Eye, X } from 'lucide-react';

import {
  canvasAspectRatio,
  IMAGE_FIT_CLASS,
  normaliseImageFit,
} from '@/lib/h5p/drag-drop-canvas';
import {
  dragDropSolution,
  scoreDragDropAttempt,
  type DragDropAttemptResult,
  type DragDropPlacements,
} from '@/lib/h5p/drag-drop-scoring';
import type { RuntimeDragDrop } from '@/lib/h5p/question-bank-runtime';

import { PrimaryAction, ProgressRail, RetryAction, ScoreCounter, SecondaryAction } from '../../components/game';
import { DROP_TARGET_ATTRIBUTE, useDragGesture } from './use-drag-gesture';

export interface DragDropActivityResult {
  score: number;
  maxScore: number;
  passed: boolean;
  durationSeconds: number;
  /** "element:zone" pairs, enough to see which pairing a cohort keeps getting wrong. */
  response: string;
}

/**
 * Image-based drag and drop, played from a question-bank row.
 *
 * It is the manual player's interaction (pointer drag through useDragGesture, a keyboard
 * and tap "carry" mode, Check / Retry / Show solution, the same scoring and the same
 * background-image canvas), taking its activity as a prop instead of fetching a saved one
 * by id. That is the whole difference: a generated question has no h5p_drag_drop row,
 * so there is nothing to fetch and nothing to save.
 *
 * Two things differ from the manual player, both on purpose:
 *   - a label may be dropped on ANY zone. The manual player refuses a drop outside an
 *     element's allowed list; here that refusal would tell the learner which zone is
 *     right by trial.
 *   - a zone is never announced by its name. The names are the answers.
 */
export function DragDropActivity({
  item,
  onResult,
}: {
  item: RuntimeDragDrop;
  onResult?: (result: DragDropActivityResult) => void;
}) {
  const [placements, setPlacements] = useState<DragDropPlacements>({});
  const [result, setResult] = useState<DragDropAttemptResult | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [carried, setCarried] = useState<number | null>(null);
  const startedAt = useRef<number>(0);

  const { zones, elements } = item;
  const imageFit = normaliseImageFit(item.image_fit);

  // Stamped on the first touch, from an event handler, never during render.
  const markStarted = useCallback(() => {
    if (startedAt.current === 0) startedAt.current = Date.now();
  }, []);

  const place = useCallback((elementId: number, zoneId: number) => {
    markStarted();
    setResult(null);
    setShowingSolution(false);
    setPlacements((current) => {
      const next: DragDropPlacements = { ...current };
      // One label to a zone: whatever was there goes back to the tray.
      for (const [key, zoneIds] of Object.entries(next)) {
        const occupantId = Number(key);
        if (occupantId !== elementId && zoneIds.includes(zoneId)) {
          next[occupantId] = zoneIds.filter((z) => z !== zoneId);
        }
      }
      next[elementId] = [zoneId];
      return next;
    });
    setCarried(null);
  }, [markStarted]);

  const returnToTray = useCallback((elementId: number) => {
    setResult(null);
    setShowingSolution(false);
    setPlacements((current) => {
      const next = { ...current };
      delete next[elementId];
      return next;
    });
  }, []);

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
    onDragStart: () => markStarted(),
  });

  const check = () => {
    const attempt = scoreDragDropAttempt(item, placements);
    setResult(attempt);
    setShowingSolution(false);
    onResult?.({
      score: attempt.score,
      maxScore: attempt.maxScore,
      passed: attempt.passed,
      durationSeconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0,
      response: Object.entries(placements)
        .flatMap(([elementId, zoneIds]) => zoneIds.map((zoneId) => `${elementId}:${zoneId}`))
        .join(','),
    });
  };

  const retry = () => {
    setPlacements({});
    setResult(null);
    setShowingSolution(false);
    setCarried(null);
    startedAt.current = 0;
  };

  const showSolution = () => {
    setPlacements(dragDropSolution(item));
    setShowingSolution(true);
    setResult(null);
  };

  const placedIds = useMemo(
    () => new Set(Object.entries(placements).filter(([, z]) => z.length > 0).map(([k]) => Number(k))),
    [placements]
  );
  const trayElements = elements.filter((element) => !placedIds.has(element.id));
  const inZone = (zoneId: number) => elements.filter((element) => (placements[element.id] ?? []).includes(zoneId));
  const draggingElement = drag.draggingId === null ? null : elements.find((e) => e.id === drag.draggingId) ?? null;

  const renderLabel = (element: RuntimeDragDrop['elements'][number], placed: boolean) => {
    const verdict = result?.perElement[element.id];
    const carrying = carried === element.id;

    return (
      <button
        key={`${element.id}-${placed ? 'zone' : 'tray'}`}
        type="button"
        onPointerDown={drag.onPointerDown(element.id)}
        onClick={() => {
          markStarted();
          if (placed && !carrying) {
            returnToTray(element.id);
            return;
          }
          setCarried(carrying ? null : element.id);
        }}
        style={{ touchAction: 'pan-y' }}
        aria-pressed={carrying}
        aria-label={
          placed
            ? `${element.text}, placed. Select to return it to the tray.`
            : `${element.text}. Select to pick it up, then choose a place on the picture.`
        }
        className={`h5p-tappable h5p-focusable h5p-target inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
          drag.draggingId === element.id ? 'opacity-40' : ''
        } ${placed ? 'h5p-enter-scale' : ''} ${
          carrying
            ? 'border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] text-[color:var(--h5p-accent-deep)] ring-2 ring-[color:var(--h5p-accent-line)]'
            : verdict === true
              ? 'h5p-halo border-emerald-300 bg-emerald-50 text-emerald-800'
              : verdict === false
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-slate-300 bg-white text-slate-700 hover:border-[color:var(--h5p-accent)]'
        }`}
      >
        <span className="truncate">{element.text}</span>
        {verdict === true ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
        {verdict === false ? <X className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{item.task_description}</p>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Labels</h2>
        <div
          {...{ [DROP_TARGET_ATTRIBUTE]: 'tray' }}
          className={`flex min-h-[3rem] flex-wrap items-center gap-2 rounded-xl border border-dashed p-2 transition-all duration-[--h5p-dur-quick] ${
            drag.isDragging && drag.hoveredTarget === 'tray'
              ? 'border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] ring-4 ring-[color:var(--h5p-accent-line)]'
              : 'border-slate-300'
          }`}
        >
          {trayElements.length === 0 ? (
            <span className="px-1 text-xs text-slate-400">Every label has been placed.</span>
          ) : (
            trayElements.map((element) => renderLabel(element, false))
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {carried !== null
            ? 'Carrying a label — choose a place on the picture, or select it again to put it down.'
            : 'Drag a label onto the picture, or tap it to pick it up and then tap the place.'}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div
          className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          style={{
            aspectRatio: canvasAspectRatio(imageFit, item.canvas_width, item.canvas_height, {
              width: item.canvas_width,
              height: item.canvas_height,
            }),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.background_image}
            alt={item.image_alt}
            draggable={false}
            className={`pointer-events-none absolute inset-0 h-full w-full ${IMAGE_FIT_CLASS[imageFit]}`}
          />

          {zones.map((zone, index) => {
            const occupants = inZone(zone.id);
            const live = drag.isDragging && drag.hoveredTarget === `zone:${zone.id}`;
            const highlighted = carried !== null || live;

            return (
              <div
                key={zone.id}
                {...{ [DROP_TARGET_ATTRIBUTE]: `zone:${zone.id}` }}
                onClick={() => {
                  if (carried !== null) place(carried, zone.id);
                }}
                role={carried !== null ? 'button' : undefined}
                tabIndex={carried !== null ? 0 : -1}
                onKeyDown={(e) => {
                  if (carried === null) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    place(carried, zone.id);
                  }
                }}
                // Never the zone's name: that is the answer.
                aria-label={carried !== null ? `Place the label on part ${index + 1} of the picture` : undefined}
                className={`absolute flex flex-wrap content-center items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed p-0.5 transition-all duration-[--h5p-dur-quick] ${
                  live
                    ? 'scale-[1.03] border-[color:var(--h5p-accent)] bg-[color:var(--h5p-accent-soft)] ring-4 ring-[color:var(--h5p-accent-line)]'
                    : highlighted
                      ? 'border-[color:var(--h5p-accent-line)] bg-white/70'
                      : 'border-slate-500 bg-white/50'
                }`}
                style={{
                  left: `${zone.position_x}%`,
                  top: `${zone.position_y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                }}
              >
                {occupants.map((element) => renderLabel(element, true))}
              </div>
            );
          })}
        </div>
        {item.attribution ? (
          <p className="mt-2 text-[11px] text-slate-500">Picture: {item.attribution}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {result && result.scoreable ? (
          <div
            className="h5p-enter mb-3 rounded-xl border px-4 py-3"
            style={
              result.passed
                ? { borderColor: 'var(--h5p-success-line)', background: 'var(--h5p-success-soft)' }
                : { borderColor: 'var(--h5p-line)', background: 'var(--h5p-surface-sunken)' }
            }
            role="status"
          >
            <p className="sr-only">{`You scored ${result.score} out of ${result.maxScore}, ${result.percentage} percent.`}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p aria-hidden="true">
                  <ScoreCounter value={result.score} max={result.maxScore} size="md" />
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--h5p-ink-muted)]">
                  {result.correct} placed correctly
                  {result.incorrect > 0 ? `, ${result.incorrect} in the wrong place` : ''}
                  {result.missed > 0 ? `, ${result.missed} still to place` : ''}.
                </p>
              </div>
              {result.passed ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'var(--h5p-surface)', color: 'color-mix(in srgb, var(--h5p-success) 80%, #000)' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  All correct
                </span>
              ) : null}
            </div>
            <ProgressRail value={result.score} max={result.maxScore} label="Your score on this activity" className="mt-3" />
          </div>
        ) : null}

        {showingSolution ? (
          <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800" role="status">
            <p className="flex items-center gap-1.5 font-medium">
              <Eye className="h-4 w-4" aria-hidden="true" />
              This is the correct placement.
            </p>
            <p className="mt-0.5 text-xs">Select retry to try it yourself.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <PrimaryAction
            onClick={check}
            disabled={Object.keys(placements).length === 0 || showingSolution}
            icon={<Check className="h-4 w-4" aria-hidden="true" />}
          >
            Check
          </PrimaryAction>
          <RetryAction onClick={retry} label="Retry" />
          <SecondaryAction onClick={showSolution} icon={<Eye className="h-4 w-4" aria-hidden="true" />}>
            Show solution
          </SecondaryAction>
        </div>
      </section>

      {draggingElement && drag.pointer ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.pointer.x, top: drag.pointer.y, rotate: '-3deg', scale: '1.08' }}
        >
          <span
            className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-[color:var(--h5p-ink)]"
            style={{ borderColor: 'var(--h5p-accent)', background: 'var(--h5p-surface)', boxShadow: 'var(--h5p-shadow-overlay)' }}
          >
            <span className="truncate">{draggingElement.text}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
