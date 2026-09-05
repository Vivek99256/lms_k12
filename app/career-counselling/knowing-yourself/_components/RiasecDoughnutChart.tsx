'use client';

import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { RiasecResultItem } from '../../_lib/types';

ChartJS.register(ArcElement, Tooltip, Legend);

// Ported verbatim from the source Interest Profile results chart — positional
// to `result[]` order, not tied to any particular RIASEC area by name.
export const RIASEC_COLORS = [
  'rgb(255, 99, 132)',
  'rgb(54, 162, 235)',
  'rgb(255, 205, 86)',
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
  'rgb(201, 203, 207)',
];

export function RiasecDoughnutChart({ result }: { result: RiasecResultItem[] }) {
  const data = {
    labels: result.map((item) => item.area),
    datasets: [
      {
        data: result.map((item) => item.score),
        backgroundColor: RIASEC_COLORS,
        hoverOffset: 4,
      },
    ],
  };

  return <Doughnut data={data} options={{ plugins: { legend: { display: false } } }} />;
}
