'use client';

import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { RiasecResultItem } from '../../_lib/types';
import { getAreaMeta } from './riasecMeta';

ChartJS.register(ArcElement, Tooltip, Legend);

export function RiasecDoughnutChart({ result }: { result: RiasecResultItem[] }) {
  const data = {
    labels: result.map((item) => item.area),
    datasets: [
      {
        data: result.map((item) => item.score),
        backgroundColor: result.map((item) => getAreaMeta(item.area).chartColor),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      },
    ],
  };

  return (
    <Doughnut
      data={data}
      options={{
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.formattedValue}` } },
        },
      }}
    />
  );
}
