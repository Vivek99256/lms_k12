'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, HelpCircle, Image as ImageIcon, Layers3, Video } from 'lucide-react';
import {
  H5P_ROUTE_MAP,
  fetchHubModules,
  h5pContextQuery,
  hasH5pContext,
  readH5pContext,
  type H5pHubModule,
} from '../data/h5p';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../components/shared';

/**
 * H5P content hub — mirrors Laravel `GET /h5p/html_contents`
 * (resources/views/lms/h5p/index.blade.php): one card per interactive
 * content type, forwarding chapter/subject/standard context.
 */

const MODULE_ICONS: Record<string, typeof ImageIcon> = {
  'scenario_based.index': ImageIcon,
  'h5p_interactive_video.index': Video,
  'h5p_mcq.index': HelpCircle,
  'h5p_flashacard.index': Layers3,
};

function H5pHubContent() {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [modules, setModules] = useState<H5pHubModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });
    fetchHubModules(ctx)
      .then((list) => {
        if (!cancelled) setModules(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load H5P modules');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Context ids are the only inputs the hub endpoint uses.
  }, [ctx]);

  const contextQuery = h5pContextQuery(ctx);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="H5P content"
          description={`${modules.length} module${modules.length === 1 ? '' : 's'} — interactive learning content for this chapter`}
          ctx={ctx}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {modules.map((module) => {
              const href = H5P_ROUTE_MAP[module.route];
              const Icon = MODULE_ICONS[module.route] ?? Layers3;
              const card = (
                <div className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-[#4f46e5]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {String(module.id).padStart(2, '0')}
                    </span>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-slate-900">{module.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-slate-500">{module.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f46e5]">
                    Explore module
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              );

              return href ? (
                <Link key={module.id} href={`${href}?${contextQuery}`} className="block h-full">
                  {card}
                </Link>
              ) : (
                <div key={module.id} className="h-full opacity-60" title="Module not available">
                  {card}
                </div>
              );
            })}
          </div>
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
