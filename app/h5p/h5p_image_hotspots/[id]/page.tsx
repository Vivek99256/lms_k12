'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { RotateCcw, X } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  type H5pContext,
} from '../../data/h5p';
import {
  imageHotspotsApi,
  type H5pImageHotspotPoint,
  type H5pImageHotspots,
  type ImageHotspotPointInput,
} from '../../data/h5p-content-types';
import { hotspotFeedback, scoreHotspotVisit } from '@/lib/h5p/image-hotspots';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';
import { HotspotMarker, markerName } from '../components/marker';

/**
 * Image hotspots — player.
 *
 * COVERAGE IS THE SCORE, and the player says so rather than showing a mark out
 * of ten beside a science diagram as though it were a test. See
 * `lib/h5p/image-hotspots.ts` for why the type is scored at all.
 *
 * RICH POPUPS ARE SANITISED BEFORE THEY ARE SHOWN. A `rich` popup is authored
 * HTML, and authored is not the same as trusted: an imported .h5p package can
 * carry arbitrary markup, and a teacher account is not a reason to run a
 * script in a learner's browser. DOMPurify is already a dependency here and is
 * the only way this component ever produces markup.
 *
 * A `text` popup is NOT passed through it — it is rendered as text, which is
 * both correct and cheaper.
 */

/** Row -> the marker's input shape. The marker is shared with the editor. */
function toMarkerPoint(point: H5pImageHotspotPoint): ImageHotspotPointInput {
  return {
    position_x: Number(point.position_x),
    position_y: Number(point.position_y),
    header: point.header ?? '',
    popup_type: (point.popup_type as ImageHotspotPointInput['popup_type']) ?? 'text',
    body_text: point.body_text ?? '',
    popup_image: point.popup_image ?? '',
    popup_image_alt: point.popup_image_alt ?? '',
    icon_name: point.icon_name ?? '',
    icon_color: point.icon_color ?? '',
    icon_image: point.icon_image ?? '',
    tooltip: point.tooltip ?? '',
    aria_label: point.aria_label ?? '',
    popup_width: point.popup_width ?? 40,
  };
}

function Popup({
  point,
  index,
  onClose,
}: {
  point: H5pImageHotspotPoint;
  index: number;
  onClose: () => void;
}) {
  const name = markerName(toMarkerPoint(point), index);
  const width = Math.max(10, Math.min(100, point.popup_width ?? 40));

  // Positioned so a popup near the right edge opens leftwards instead of off
  // the image. Percentages throughout, like everything else in this type.
  const left = Number(point.position_x) > 60 ? undefined : `${Number(point.position_x)}%`;
  const right = Number(point.position_x) > 60 ? `${100 - Number(point.position_x)}%` : undefined;

  return (
    <div
      role="dialog"
      aria-label={name}
      className="absolute z-20 max-h-[70%] overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
      style={{
        left,
        right,
        top: `${Math.min(80, Number(point.position_y) + 4)}%`,
        width: `${width}%`,
        minWidth: '10rem',
      }}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        {point.header ? <h3 className="text-sm font-semibold text-slate-900">{point.header}</h3> : <span />}
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          aria-label={`Close ${name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {point.popup_type === 'image' && point.popup_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.popup_image}
          alt={point.popup_image_alt ?? ''}
          className="w-full rounded-lg border border-slate-100"
        />
      ) : point.popup_type === 'rich' ? (
        <div
          className="prose prose-sm max-w-none text-sm text-slate-700 [&_a]:text-indigo-600 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
          // Sanitised, always. See the file header.
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(point.body_text ?? '') }}
        />
      ) : (
        <p className="whitespace-pre-line text-sm text-slate-700">{point.body_text}</p>
      )}
    </div>
  );
}

/**
 * The activity itself, as its own component.
 *
 * Split out from the page for a concrete reason, not tidiness: the page's job
 * is to load an item and render chrome around it, and a `body()` helper called
 * during render puts every handler it references on the render path — which is
 * both what the React lint rules object to and, more importantly, an easy way
 * to end up reading a ref or the clock during render by accident.
 *
 * With the activity as a component, `item` is non-null by construction, the
 * attempt state belongs to the thing being attempted, and remounting it (a new
 * `key`) is how a clean attempt would be forced if that is ever wanted.
 */
function HotspotActivity({ item, ctx }: { item: H5pImageHotspots; ctx: H5pContext }) {
  // Memoised rather than derived inline: `item.points ?? []` is a new array
  // identity on every render when an item has no hotspots, which would
  // rebuild the `open` callback below on every render.
  const points = useMemo(() => item.points ?? [], [item]);

  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [showing, setShowing] = useState<number[]>([]);

  // Refs, not state: changing either must never re-render, and seeding them
  // from render would call Date.now() during render. The same pattern the
  // drag-and-drop player uses, for the same reasons.
  const startedAt = useRef(0);
  const completedSent = useRef(false);

  useEffect(() => {
    // The attempt starts when the activity mounts, not when the route was
    // entered — a slow load must not count against the learner.
    startedAt.current = Date.now();
  }, []);

  const result = scoreHotspotVisit(
    points.map((point) => ({ id: point.id, sort_order: point.sort_order })),
    opened,
    { points_per_hotspot: item.points_per_hotspot, pass_percentage: item.pass_percentage }
  );

  const open = useCallback(
    (point: H5pImageHotspotPoint, index: number) => {
      // Tapping an open hotspot closes it. Nothing is re-counted: `opened` is
      // a set of hotspots READ, not of taps.
      if (showing.includes(point.id)) {
        setShowing(showing.filter((openId) => openId !== point.id));
        return;
      }

      setShowing(item.single_popup_open ? [point.id] : [...showing, point.id]);

      if (opened.has(point.id)) return;

      const next = new Set(opened);
      next.add(point.id);
      setOpened(next);

      void postH5pXapiStatement({
        objectId: `image_hotspots:${item.id}`,
        verb: 'progressed',
        ctx,
        response: markerName(toMarkerPoint(point), index),
      });

      // The completion statement is sent from HERE — the event that can
      // complete the activity — rather than from an effect watching the score.
      // `completedSent` guards it because re-opening a hotspot must not report
      // a second completion, which the pipeline would count as a second attempt.
      if (!completedSent.current && points.length > 0 && next.size === points.length) {
        completedSent.current = true;

        const covered = scoreHotspotVisit(
          points.map((p) => ({ id: p.id, sort_order: p.sort_order })),
          next,
          { points_per_hotspot: item.points_per_hotspot, pass_percentage: item.pass_percentage }
        );

        void postH5pXapiStatement({
          objectId: `image_hotspots:${item.id}`,
          verb: 'completed',
          ctx,
          success: covered.passed,
          response: `${covered.openedCount}/${covered.hotspotCount} hotspots`,
          durationSeconds: (Date.now() - startedAt.current) / 1000,
        });
      }
    },
    [item, ctx, opened, showing, points]
  );

  const reset = useCallback(() => {
    setOpened(new Set());
    setShowing([]);
    startedAt.current = Date.now();
    completedSent.current = false;
  }, []);

  if (!item.background_image) {
    return <InlineBanner kind="error" message="This activity has no background image yet." />;
  }

  const message = hotspotFeedback(result.percentage, item.feedback_bands);

  return (
    <>
      {item.task_description ? <p className="mb-4 text-sm text-slate-600">{item.task_description}</p> : null}

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
        style={
          item.image_width && item.image_height
            ? { aspectRatio: `${item.image_width} / ${item.image_height}` }
            : { aspectRatio: '16 / 9' }
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.background_image}
          alt={item.background_alt ?? ''}
          className="absolute inset-0 h-full w-full object-contain"
        />

        {points.map((point, index) => (
          <HotspotMarker
            key={point.id}
            index={index}
            point={toMarkerPoint(point)}
            defaults={{ icon: item.default_icon, color: item.default_icon_color }}
            showNumber={item.show_hotspot_numbers}
            opened={showing.includes(point.id)}
            onClick={() => open(point, index)}
          />
        ))}

        {points
          .filter((point) => showing.includes(point.id))
          .map((point) => (
            <Popup
              key={point.id}
              point={point}
              index={points.indexOf(point)}
              onClose={() => setShowing(showing.filter((openId) => openId !== point.id))}
            />
          ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm text-slate-700">
            <span className="font-semibold tabular-nums">
              {result.openedCount} of {result.hotspotCount}
            </span>{' '}
            hotspots explored
          </p>
          {/* Said plainly, because a percentage beside a diagram invites being
              read as a test result. */}
          <p className="mt-0.5 text-[11px] text-slate-500">
            {result.completed ? 'You have opened every hotspot.' : `${result.remaining.length} still to open.`}
          </p>
          {message ? (
            <p aria-live="polite" className="mt-1.5 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </div>

        {item.enable_retry && result.openedCount > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start again
          </button>
        ) : null}
      </div>
    </>
  );
}

function ImageHotspotsPlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [item, setItem] = useState<H5pImageHotspots | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

    imageHotspotsApi
      .get(id, ctx)
      .then((data) => {
        if (!cancelled) setItem(data);
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
  }, [ctx, id]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <H5pPageHeader
          title={item?.title || 'Image hotspots'}
          description={item?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_image_hotspots?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading activity…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : item ? (
          <HotspotActivity item={item} ctx={ctx} />
        ) : null}
      </div>
    </div>
  );
}

export default function ImageHotspotsPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading activity…" />}>
      <ImageHotspotsPlayerContent />
    </Suspense>
  );
}
