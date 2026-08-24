'use client';

<<<<<<< HEAD
import { Suspense, useEffect, useMemo, useState } from 'react';
=======
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import { useParams, useSearchParams } from 'next/navigation';
import { Info, X } from 'lucide-react';
import {
  fetchScenario,
  h5pContextQuery,
  hasH5pContext,
<<<<<<< HEAD
=======
  postH5pXapiStatement,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  readH5pContext,
  type H5pScenario,
  type H5pScenarioPoint,
} from '../../data/h5p';
import {
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Scenario based learning — view/player page (read-only, students see this too).
 * Mirrors Laravel `resources/views/lms/h5p/scenario/show.blade.php`.
 */

/**
 * Replicates the Blade behavior: anchors linking to a YouTube video are
 * replaced with an embedded iframe player before the HTML is rendered.
 */
function embedYouTubeLinks(html: string): string {
  return html.replace(
    /<a\b[^>]*href=["'][^"']*(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    (_match, videoId: string) =>
      `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
  );
}

function ScenarioShowContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [scenario, setScenario] = useState<H5pScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePoint, setActivePoint] = useState<H5pScenarioPoint | null>(null);
<<<<<<< HEAD
=======
  const viewedPointIds = useRef<Set<number>>(new Set());
  const completedSent = useRef(false);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const [detailsOpen, setDetailsOpen] = useState(false);

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
    fetchScenario(id, ctx)
      .then((data) => {
        if (!cancelled) setScenario(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load scenario');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  const modalOpen = activePoint !== null || detailsOpen;
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePoint(null);
        setDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const points = scenario?.points ?? [];

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title={scenario?.title ?? 'Scenario'}
          description="Click a numbered marker to explore each point of interest"
          ctx={ctx}
          backHref={`/h5p/scenario_based?${contextQuery}`}
          actions={
            scenario ? (
              <Button
                variant="outline"
                onClick={() => setDetailsOpen(true)}
                className="rounded-xl"
              >
                <Info className="h-3.5 w-3.5" />
                Details
              </Button>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading scenario…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
        ) : scenario ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scenario.file_path}
                alt={scenario.title}
                className="block h-auto max-w-full rounded-xl border border-slate-200"
              />
              {points.map((point, index) => (
                <button
                  key={point.id}
                  type="button"
<<<<<<< HEAD
                  onClick={() => setActivePoint(point)}
=======
                  onClick={() => {
                    setActivePoint(point);
                    void postH5pXapiStatement({ objectId: `image_hotspot:${id}`, verb: 'attempted', ctx });
                    viewedPointIds.current.add(point.id);
                    if (!completedSent.current && viewedPointIds.current.size >= points.length && points.length > 0) {
                      completedSent.current = true;
                      void postH5pXapiStatement({ objectId: `image_hotspot:${id}`, verb: 'completed', ctx });
                    }
                  }}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                  style={{ left: point.position_x, top: point.position_y }}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow"
                  title={point.title}
                  aria-label={`Point ${index + 1}: ${point.title}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            {points.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                This scenario has no interactive points yet.
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                {points.length} interactive point{points.length === 1 ? '' : 's'} — click a marker
                to learn more.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {activePoint ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur"
          onClick={() => setActivePoint(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{activePoint.title}</h2>
              <button
                type="button"
                onClick={() => setActivePoint(null)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {activePoint.description ? (
              <div
                className="prose prose-sm mt-3 max-w-none text-sm text-slate-600 [&_a]:text-indigo-600 [&_iframe]:mt-2 [&_iframe]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: embedYouTubeLinks(activePoint.description) }}
              />
            ) : (
              <p className="mt-3 text-sm text-slate-500">No description for this point.</p>
            )}
          </div>
        </div>
      ) : null}

      {detailsOpen && scenario ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{scenario.title}</h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scenario.file_path}
                alt={scenario.title}
                className="h-40 w-auto max-w-full rounded-xl border border-slate-200 object-cover"
              />

              {scenario.description ? (
                <div
                  className="text-sm text-slate-600 [&_a]:text-indigo-600 [&_iframe]:mt-2 [&_iframe]:rounded-lg"
                  dangerouslySetInnerHTML={{ __html: embedYouTubeLinks(scenario.description) }}
                />
              ) : (
                <p className="text-sm text-slate-500">No description provided.</p>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  Interactive points ({points.length})
                </h3>
                {points.length === 0 ? (
                  <p className="text-sm text-slate-500">No interactive points.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-600">#</TableHead>
                        <TableHead className="text-slate-600">Title</TableHead>
                        <TableHead className="text-slate-600">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {points.map((point, index) => (
                        <TableRow key={point.id}>
                          <TableCell className="text-slate-600">{index + 1}</TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {point.title}
                          </TableCell>
                          <TableCell className="max-w-[320px] whitespace-normal text-slate-500">
                            {point.description ? (
                              <div
                                className="[&_a]:text-indigo-600 [&_iframe]:mt-2 [&_iframe]:rounded-lg"
                                dangerouslySetInnerHTML={{
                                  __html: embedYouTubeLinks(point.description),
                                }}
                              />
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ScenarioShowPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading scenario…" />}>
      <ScenarioShowContent />
    </Suspense>
  );
}
