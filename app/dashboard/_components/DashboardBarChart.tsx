'use client';

import React, { useMemo } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const defaultFormat = (value: number) => value.toLocaleString('en-IN');

/**
 * Single-series bar chart. One series, so no legend — the panel title names it.
 * A visually hidden table carries the same figures for screen readers.
 * `null` values (e.g. a day with no attendance marked) draw no bar and read as "No data".
 */
export function DashboardBarChart({
  labels,
  values,
  color = '#4F46E5',
  height = 240,
  formatValue = defaultFormat,
  max,
  label = 'Value',
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
}) {
  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${label}: ${ctx.parsed.y == null ? 'No data' : formatValue(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: '#e2e8f0' },
          ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 0, autoSkip: true },
        },
        y: {
          beginAtZero: true,
          max,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 5, callback: (v) => formatValue(Number(v)) },
        },
      },
    }),
    [formatValue, label, max],
  );

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
                backgroundColor: color,
                hoverBackgroundColor: '#4338ca',
                borderRadius: { topLeft: 4, topRight: 4 },
                borderSkipped: 'bottom',
                maxBarThickness: 32,
                categoryPercentage: 0.7,
              },
            ],
          }}
          options={options}
        />
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={`${l}-${i}`}>
              <th scope="row">{l}</th>
              <td>{values[i] == null ? 'No data' : formatValue(values[i] as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
