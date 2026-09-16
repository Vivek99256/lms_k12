'use client';

import type { VolumePoint } from '@/lib/event-bus';

/**
 * Event volume over the last 24 hours, stacked by outcome.
 *
 * NO CHART LIBRARY, following `app/enterprise-brain/_components/charts.tsx`.
 * This is twenty-four stacked bars over a GROUP BY. Recharts and chart.js are
 * both already in the bundle for screens that need axes and tooltips, but
 * neither earns its place here: the series has no continuous axis worth drawing,
 * and every library brings a colour system that then has to be argued back into
 * the platform-services palette.
 *
 * COLOUR NEVER CARRIES THE MEANING ALONE. The legend names all three series, the
 * total sits above the plot, and each bar's title attribute reads out its three
 * numbers — so the chart is usable by someone who cannot separate the fills, and
 * by someone reading it through a screen reader via the table twin on the
 * Event Stream tab.
 *
 * TONES ARE THE SIBLING CONSOLES', NOT NEW ONES. Emerald / slate / red are the
 * exact values `Pill` in app/platform-services/_components/shell.tsx already
 * uses for green / gray / red, because this page should introduce no colour
 * decision of its own. (The semantic `--success` and `--warning` custom
 * properties are not registered in app/globals.css, which is why the three
 * sibling consoles reach for literal utilities here too.)
 */

const SERIES = [
  { key: 'completed' as const, label: 'Completed', fill: 'bg-emerald-500' },
  { key: 'pending' as const, label: 'Pending', fill: 'bg-slate-300' },
  { key: 'failed' as const, label: 'Failed', fill: 'bg-red-500' },
];

export function VolumeChart({ points }: { points: VolumePoint[] }) {
  const totals = points.map((point) => point.completed + point.pending + point.failed);
  const peak = Math.max(...totals, 1);
  const grandTotal = totals.reduce((sum, value) => sum + value, 0);

  if (grandTotal === 0) {
    // A blank plot is indistinguishable from a broken one, so say which it is.
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No events were captured in this window.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {grandTotal.toLocaleString('en-IN')}
          <span className="ml-1.5 text-xs font-normal text-slate-500">events in 24 hours</span>
        </p>
        <ul className="flex items-center gap-3">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span aria-hidden="true" className={`size-2.5 rounded-sm ${series.fill}`} />
              {series.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Event volume by hour. ${grandTotal} events over 24 hours.`}>
        {points.map((point, index) => {
          const total = totals[index];
          // Share of the tallest bar, so a quiet day still fills the panel
          // rather than rendering twenty-four slivers along the baseline.
          const height = total === 0 ? 0 : Math.max((total / peak) * 100, 4);

          return (
            <div
              key={`${point.label}-${index}`}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${point.label} — ${point.completed} completed, ${point.pending} pending, ${point.failed} failed`}
            >
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${height}%` }}>
                {SERIES.map((series) => {
                  const value = point[series.key];
                  if (value === 0) return null;
                  return (
                    <div
                      key={series.key}
                      className={series.fill}
                      style={{ height: `${(value / total) * 100}%` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Every fourth tick: twenty-four labels at this width overlap into a
          smear, and the title attribute already names the hour on hover. */}
      <div className="mt-1.5 flex gap-[3px]">
        {points.map((point, index) => (
          <span key={`${point.label}-tick-${index}`} className="flex-1 text-center text-[10px] tabular-nums text-slate-400">
            {index % 4 === 0 ? point.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
