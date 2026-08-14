'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Brain,
  HelpCircle,
  Image as ImageIcon,
  Layers3,
  Sparkles,
  Video,
} from 'lucide-react';
import { H5P_ROUTE_MAP, h5pContextQuery, hasH5pContext, readH5pContext } from '../data/h5p';
import { fetchHub, humanise, type H5pHub, type H5pHubModule } from '../data/h5p-model';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../components/shared';

/**
 * H5P content hub — `GET /api/pal/h5p/hub`.
 *
 * The card list is a projection of the PAL V4 H5P Model registry, not a fixed
 * set of four modules: every H5P type registered with a source table becomes a
 * card, carrying its own copy, route and icon plus this chapter's real node and
 * part counts, the pedagogies it serves, and its measured engagement.
 *
 * Registering a new H5P type is a `pal_vocabulary` row — this file does not
 * change. The icon map below is the one exception and is keyed by registry
 * code, falling back to a generic glyph for anything it has not seen.
 */

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image_hotspot: ImageIcon,
  interactive_video: Video,
  multiple_choice: HelpCircle,
  flash_cards: Layers3,
};

/** Registry route name (`scenario_based.index`) → this app's route. */
function routeFor(module: H5pHubModule): string | null {
  return module.route ? (H5P_ROUTE_MAP[module.route] ?? null) : null;
}

function ModuleCard({ module, contextQuery }: { module: H5pHubModule; contextQuery: string }) {
  const Icon = TYPE_ICONS[module.h5pType] ?? Layers3;
  const href = routeFor(module);
  const pedagogies = [...module.pedagogies.primary, ...module.pedagogies.secondary];

  const card = (
    <div
      className={`group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
        module.available ? 'border-slate-200 hover:border-indigo-200 hover:shadow-md' : 'border-amber-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums leading-none text-slate-900">{module.nodeCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {module.nodeCount === 1 ? 'item' : 'items'}
            {module.childLabel && module.childCount > 0
              ? ` · ${module.childCount} ${module.childLabel}${module.childCount === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
      </div>

      <h2 className="mt-4 text-base font-semibold text-slate-900">{module.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{module.description}</p>

      {module.available ? null : (
        <p className="mt-2 text-xs text-amber-700">{module.unavailableReason}</p>
      )}

      {pedagogies.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {pedagogies.slice(0, 3).map((code) => (
            <span
              key={code}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
            >
              {humanise(code)}
            </span>
          ))}
          {pedagogies.length > 3 ? (
            <span className="px-1 text-[10px] text-slate-400">+{pedagogies.length - 3}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 items-end justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          {module.engagement?.measured
            ? `Engagement ${module.engagement.avgEngagementScore ?? '—'}`
            : module.bloomRange.length > 0
              ? module.bloomRange.map(humanise).join(' → ')
              : ''}
        </span>
        {href ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f46e5]">
            Open
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={`${href}?${contextQuery}`} className="block h-full">
      {card}
    </Link>
  ) : (
    <div className="h-full opacity-60" title="This type has no authoring module in this ERP yet">
      {card}
    </div>
  );
}

function H5pHubContent() {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [hub, setHub] = useState<H5pHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    // Deferred so the effect body does not setState synchronously — the same
    // guard the other pages in this module use.
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError('');
      }
    });

    fetchHub(ctx, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHub(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load H5P modules');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [ctx]);

  const contextQuery = h5pContextQuery(ctx);
  const modules = hub?.modules ?? [];
  const totalNodes = modules.reduce((sum, module) => sum + module.nodeCount, 0);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="H5P content"
          description={
            hub
              ? `${modules.length} module${modules.length === 1 ? '' : 's'} · ${totalNodes} item${totalNodes === 1 ? '' : 's'} in this chapter`
              : 'Interactive learning content for this chapter'
          }
          ctx={ctx}
          actions={
            hasH5pContext(ctx) ? (
              <Link
                href={`/h5p/model?${contextQuery}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
              >
                <Brain className="h-3.5 w-3.5" />
                H5P Model
              </Link>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <div className="mb-5">
            <MissingContextNotice />
          </div>
        ) : null}

        <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

        {loading ? (
          <LoadingState label="Loading modules…" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {modules.map((module) => (
                <ModuleCard key={module.h5pType} module={module} contextQuery={contextQuery} />
              ))}
            </div>

            {hasH5pContext(ctx) ? (
              <Link
                href={`/h5p/model?${contextQuery}`}
                className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-5 py-4 transition hover:bg-indigo-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#4f46e5]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Open the H5P Model</p>
                    <p className="text-xs text-slate-600">
                      Pedagogy and framework tags per item, CASEL / NGSS / NCDG coverage for this chapter, measured
                      engagement and the xAPI pipeline.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#4f46e5]" />
              </Link>
            ) : null}

            {hub && !hub.telemetry.available ? (
              <p className="mt-3 text-[11px] text-amber-700">{hub.telemetry.reason}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function H5pHubPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading H5P content…" />}>
      <H5pHubContent />
    </Suspense>
  );
}
