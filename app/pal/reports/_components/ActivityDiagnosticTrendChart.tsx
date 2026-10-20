'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ActivityDiagnosticTrendPoint } from '@/app/pal/data/pal-activity-report';

/** diagnostic_performance.trend — percentage scored per diagnostic attempt, over time. */
export default function ActivityDiagnosticTrendChart({ data }: { data: ActivityDiagnosticTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No diagnostic attempts recorded yet.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
          <Line type="monotone" dataKey="percentage" name="Score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
