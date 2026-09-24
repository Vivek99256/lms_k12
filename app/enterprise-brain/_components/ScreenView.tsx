'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { fetchScreen } from '@/lib/brain/api';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import { toWidgetId, type DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { useBrainResource } from './useBrainResource';
import {
  BreakdownBars, Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, HeroHeader,
} from './primitives';

/**
 * Widget ids for the parts of a registry screen a user can hide for themselves,
 * built from the server's own keys. Ids are stored per user — don't change how
 * they are derived.
 */
const widgetId = {
  metric: (key: string) => toWidgetId('kpi', key),
  breakdown: (key: string) => toWidgetId('chart', `breakdown-${key}`),
  series: (key: string) => toWidgetId('chart', key),
  panel: (key: string) => toWidgetId('panel', key),
};

/**
 * The registry-driven Brain screen.
 *
 * One component renders every screen whose shape is "metrics, then one or more
 * tables of this tenant's rows", because that shape is defined once on the
 * server in App\Brain\Screens\ScreenRegistry. Screens that do more than read —
 * Capabilities, Ingestion, Settings, KASBA, AI Assistant — have their own page
 * instead of squeezing their behaviour in here.
 */
export default function ScreenView({
  screen,
  searchable = false,
  notice,
}: {
  screen: string;
  searchable?: boolean;
  /**
   * A short line shown under the header, before the data.
   *
   * For saying something about the screen itself rather than about its rows —
   * the Agentic Library uses it to state that agents built there are moving to
   * a shared service. Kept as a slot so this component stays registry-driven
   * and screen-agnostic.
   */
  notice?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const resource = useBrainResource(() => fetchScreen(screen, applied), [screen, applied]);

  // Everything on this screen a user can hide: one entry per metric, breakdown,
  // series and panel the registry sent. Each screen keeps its own choices.
  const widgets = useMemo(
    (): DashboardWidget[] =>
      resource.data
        ? [
            ...resource.data.metrics.map((metric) => ({ id: widgetId.metric(metric.key), label: metric.label, group: 'kpi' as const })),
            ...resource.data.breakdowns.map((breakdown) => ({
              id: widgetId.breakdown(breakdown.key),
              label: breakdown.title,
              group: 'chart' as const,
            })),
            ...resource.data.series.map((series) => ({ id: widgetId.series(series.key), label: series.title, group: 'chart' as const })),
            ...resource.data.panels.map((panel) => ({ id: widgetId.panel(panel.key), label: panel.title, group: 'panel' as const })),
          ]
        : [],
    [resource.data],
  );
  const prefs = useDashboardPreferences(toWidgetId('brain', screen), widgets);

  // Wait for the user's layout too, so hidden widgets never flash in.
  if ((resource.loading && !resource.data) || !prefs.ready) {
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

  const show = prefs.isVisible;
  const metrics = data.metrics.filter((metric) => show(widgetId.metric(metric.key)));
  const breakdowns = data.breakdowns.filter((breakdown) => show(widgetId.breakdown(breakdown.key)));
  const seriesList = data.series.filter((series) => show(widgetId.series(series.key)));
  const panels = data.panels.filter((panel) => show(widgetId.panel(panel.key)));
  // A lone breakdown left after hiding the others takes the full row instead of leaving a gap.
  const breakdownCols = breakdowns.length === 1 && data.breakdowns.length > 1 ? '' : 'lg:grid-cols-2';

  return (
    <div className="pb-8">
      <HeroHeader
        breadcrumb={`Enterprise Brain / ${data.sectionLabel}`}
        title={data.title}
        description={data.description}
        actions={
          <div className="flex items-center gap-2">
            {searchable ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setApplied(search.trim());
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5"
              >
                <Search size={14} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search this screen"
                  className="w-48 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                />
              </form>
            ) : null}
            <button
              type="button"
              onClick={resource.refresh}
              disabled={resource.refreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              <RefreshCw size={14} className={resource.refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <CustomizeDashboard
              widgets={widgets}
              {...prefs.customizeProps}
              className="h-auto rounded-xl border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
            />
          </div>
        }
      />

      {notice && <div className="mb-4">{notice}</div>}

      {resource.error && (
        <div className="mb-4">
          <ErrorState message={resource.error} onRetry={resource.refresh} />
        </div>
      )}

      {widgets.length > 0 && !prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      <MetricTiles metrics={metrics} />

      {breakdowns.length > 0 && (
        <div className={`mb-6 grid grid-cols-1 gap-4 ${breakdownCols}`}>
          {breakdowns.map((breakdown) => (
            <Panel key={breakdown.key} title={breakdown.title} available={breakdown.available}>
              <BreakdownBars data={breakdown.data} />
            </Panel>
          ))}
        </div>
      )}

      {seriesList.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4">
          {seriesList.map((series) => (
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

      {panels.length > 0 && (
        <div className="space-y-4">
          {panels.map((panel) => (
            <Panel key={panel.key} title={panel.title} table={panel.table} count={panel.count} available={panel.available}>
              <DataTable columns={panel.columns} rows={panel.rows} />
            </Panel>
          ))}
        </div>
      )}

      {data.panels.length === 0 && data.metrics.length === 0 && (
        <Card className="p-6 text-sm text-slate-500">This screen has no data sources configured.</Card>
      )}
    </div>
  );
}
