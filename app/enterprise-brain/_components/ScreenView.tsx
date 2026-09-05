'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { fetchScreen } from '@/lib/brain/api';
import { useBrainResource } from './useBrainResource';
import {
  BreakdownBars, Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, ScreenHeader,
} from './primitives';

/**
 * The registry-driven Brain screen.
 *
 * One component renders every screen whose shape is "metrics, then one or more
 * tables of this tenant's rows", because that shape is defined once on the
 * server in App\Brain\Screens\ScreenRegistry. Screens that do more than read —
 * Capabilities, Ingestion, Settings, KASBA, AI Assistant — have their own page
 * instead of squeezing their behaviour in here.
 */
export default function ScreenView({ screen, searchable = false }: { screen: string; searchable?: boolean }) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const resource = useBrainResource(() => fetchScreen(screen, applied), [screen, applied]);

  if (resource.loading && !resource.data) {
    return (
      <div className="p-1">
        <LoadingState label="Loading Enterprise Brain screen" />
      </div>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <div className="p-1">
        <ErrorState message={resource.error} onRetry={resource.refresh} />
      </div>
    );
  }

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title={data.title}
        description={data.description}
        breadcrumb={`Enterprise Brain / ${data.sectionLabel}`}
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          searchable ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setApplied(search.trim());
              }}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5"
            >
              <Search size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this screen"
                className="w-48 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </form>
          ) : null
        }
      />

      {resource.error && (
        <div className="mb-4">
          <ErrorState message={resource.error} onRetry={resource.refresh} />
        </div>
      )}

      <MetricTiles metrics={data.metrics} />

      {data.breakdowns.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.breakdowns.map((breakdown) => (
            <Panel key={breakdown.key} title={breakdown.title} available={breakdown.available}>
              <BreakdownBars data={breakdown.data} />
            </Panel>
          ))}
        </div>
      )}

      {data.series.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4">
          {data.series.map((series) => (
            <Panel key={series.key} title={series.title} available={series.available} count={series.points.length}>
              {series.points.length ? (
                <div className="flex items-end gap-1 px-4 py-4" style={{ height: '9rem' }}>
                  {series.points.map((point, index) => {
                    const max = Math.max(...series.points.map((p) => Number(p.value) || 0), 1);
                    return (
                      <span
                        key={`${point.at}-${index}`}
                        title={`${point.label}: ${point.value} (${point.at})`}
                        className="flex-1 rounded-t bg-[#0D6EFD]/70"
                        style={{ height: `${Math.max(3, ((Number(point.value) || 0) / max) * 100)}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-slate-400">No points recorded for this organization yet.</p>
              )}
            </Panel>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {data.panels.map((panel) => (
          <Panel key={panel.key} title={panel.title} table={panel.table} count={panel.count} available={panel.available}>
            <DataTable columns={panel.columns} rows={panel.rows} />
          </Panel>
        ))}
      </div>

      {data.panels.length === 0 && data.metrics.length === 0 && (
        <Card className="p-6 text-sm text-slate-500">This screen has no data sources configured.</Card>
      )}
    </div>
  );
}
