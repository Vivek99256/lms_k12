'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { fetchSection } from '@/lib/brain/api';
import { BRAIN_SECTIONS } from '@/lib/brain/navigation';
import { useBrainResource } from './useBrainResource';
import { Card, ErrorState, LoadingState, ScreenHeader } from './primitives';

/**
 * A section landing page: every screen in the section with its live counts, so
 * the section route is a real destination rather than a redirect.
 */
export default function SectionView({ section }: { section: string }) {
  const nav = BRAIN_SECTIONS.find((item) => item.key === section);
  const resource = useBrainResource(() => fetchSection(section), [section]);

  if (resource.loading && !resource.data) {
    return <LoadingState label={`Loading ${nav?.label ?? section}`} />;
  }

  if (resource.error && !resource.data) {
    return <ErrorState message={resource.error} onRetry={resource.refresh} />;
  }

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title={data.label}
        description={nav?.description}
        breadcrumb="Enterprise Brain"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.screens.map((screen) => {
          const navScreen = nav?.screens.find((item) => item.key === screen.key);
          const Icon = navScreen?.icon;

          return (
            <Link key={screen.key} href={navScreen?.href ?? '#'} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/30">
                <div className="mb-3 flex items-center gap-3">
                  {Icon && (
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0D6EFD]">
                      <Icon size={18} />
                    </span>
                  )}
                  <h2 className="flex-1 text-sm font-bold text-slate-900">{screen.title}</h2>
                  <ArrowRight size={16} className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0D6EFD]" />
                </div>
                <p className="mb-4 min-h-[2.5rem] text-sm text-slate-500">{screen.description}</p>
                <div className="flex flex-wrap gap-2">
                  {screen.metrics.length ? (
                    screen.metrics.map((metric) => (
                      <span
                        key={metric.key}
                        className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600"
                      >
                        {metric.label}{' '}
                        <span className="tabular-nums text-slate-900">
                          {metric.available ? metric.value.toLocaleString() : '—'}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400">Open the screen for details</span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
