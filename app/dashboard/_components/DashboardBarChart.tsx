'use client';

import React, { useMemo } from 'react';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip,
  type ChartOptions, type ScriptableContext,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ACCENTS, type Accent } from '@/app/dashboard/_components/dashboard-accents';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const defaultFormat = (value: number) => value.toLocaleString('en-IN');

const TOOLTIP = { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8, displayColors: false } as const;

/**
 * Single-series bar chart. One series, so no legend — the panel title names it.
 * A visually hidden table carries the same figures for screen readers.
 * `null` values (e.g. a day with no attendance marked) draw no bar and read as "No data".
 *
 * With `accent`, bars fill with a vertical gradient of that section's colour and the
 * grid lines and ticks are tinted to match; without it the chart keeps a flat `color`.
 */
export function DashboardBarChart({
  labels,
  values,
  color = '#4F46E5',
  height = 240,
  formatValue = defaultFormat,
  max,
  label = 'Value',
  accent,
}: {
  labels: string[];
  values: Array<number | null>;
  color?: string;
  height?: number;
  /** Formats tooltip values, y-axis ticks and the table view. */
  formatValue?: (value: number) => string;
  /** Fixed y-axis maximum, e.g. 100 for percentages. */
  max?: number;
  /** What a value is — used in the tooltip and the table header. */
  label?: string;
  accent?: Accent;
}) {
  const palette = accent ? ACCENTS[accent].chart : null;

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP,
          callbacks: {
            label: (ctx) => `${label}: ${ctx.parsed.y == null ? 'No data' : formatValue(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: palette?.grid ?? '#e2e8f0' },
          ticks: { color: palette?.tick ?? '#64748b', font: { size: 11, weight: 500 }, maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          max,
          border: { display: false },
          grid: { color: palette?.grid ?? '#f1f5f9' },
          ticks: { color: palette?.tick ?? '#64748b', font: { size: 11 }, maxTicksLimit: 5, callback: (v) => formatValue(Number(v)) },
        },
      },
    }),
    [formatValue, label, max, palette],
  );

  const background = useMemo(() => {
    if (!palette) return color;
    // Light at the baseline, full colour at the top of the plot area.
    return (ctx: ScriptableContext<'bar'>) => {
      const { chart } = ctx;
      if (!chart.chartArea) return palette.bar;
      const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.bottom, 0, chart.chartArea.top);
      gradient.addColorStop(0, palette.barLight);
      gradient.addColorStop(1, palette.bar);
      return gradient;
    };
  }, [palette, color]);

  return (
    <>
      <div style={{ height }} aria-hidden>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label,
                data: values,
                backgroundColor: background,
                hoverBackgroundColor: palette?.hover ?? '#4338ca',
                borderRadius: { topLeft: 6, topRight: 6 },
                borderSkipped: 'bottom',
                maxBarThickness: 32,
                categoryPercentage: 0.7,
              },
            ],
          }}
          options={options}
        />
      </div>
      <ChartTable labels={labels} header={label} values={values.map((v) => (v == null ? 'No data' : formatValue(v)))} />
    </>
  );
}

/**
 * Part-to-whole ring (e.g. collected vs outstanding). The legend is rendered by the
 * caller as text, so the chart itself only draws the ring and the centre figure.
 */
export function DashboardDoughnut({
  segments,
  center,
  centerLabel,
  size = 132,
  formatValue = defaultFormat,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  center: string;
  centerLabel: string;
  size?: number;
  formatValue?: (value: number) => string;
}) {
  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => `${ctx.label}: ${formatValue(Number(ctx.parsed))}` } },
      },
    }),
    [formatValue],
  );

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="h-full w-full" aria-hidden>
        <Doughnut
          data={{
            labels: segments.map((s) => s.label),
            datasets: [
              {
                data: segments.map((s) => s.value),
                backgroundColor: segments.map((s) => s.color),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 4,
              },
            ],
          }}
          options={options}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{center}</span>
        <span className="text-[11px] font-medium text-slate-500">{centerLabel}</span>
      </div>
      <ChartTable labels={segments.map((s) => s.label)} header="Amount" values={segments.map((s) => formatValue(s.value))} />
    </div>
  );
}

function ChartTable({ labels, header, values }: { labels: string[]; header: string; values: string[] }) {
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">{header}</th>
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={`${l}-${i}`}>
            <th scope="row">{l}</th>
            <td>{values[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
