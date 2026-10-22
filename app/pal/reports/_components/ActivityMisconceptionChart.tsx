'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ActivityTopMisconception } from '@/app/pal/data/pal-activity-report';

/**
 * misconception_analysis.top_misconceptions, ranked by detection_count.
 * Horizontal bars (layout="vertical" in recharts' own naming) so the
 * misconception tag — often a full phrase — reads left-to-right instead of
 * being squeezed under a rotated label.
 */
export default function ActivityMisconceptionChart({ data }: { data: ActivityTopMisconception[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No misconceptions flagged.</p>;
  }

  const rows = [...data].sort((a, b) => b.detectionCount - a.detectionCount).slice(0, 10);

  return (
    <div style={{ height: Math.max(220, rows.length * 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 16, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="tag" width={160} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="detectionCount" name="Detections" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
