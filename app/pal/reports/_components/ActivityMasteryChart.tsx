'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ActivityMasteryByChapter } from '@/app/pal/data/pal-activity-report';

/**
 * mastery_overview.by_chapter — mastered / learning / unseen node counts per
 * chapter, straight from learner_node_state (see pal-activity-report.ts).
 * Stacked rather than grouped: the three numbers are a partition of
 * `nodes_total` for that chapter, so stacking reads as "the whole chapter",
 * not three separate measurements.
 */
const COLORS = { mastered: '#16a34a', learning: '#f59e0b', unseen: '#94a3b8' };

export default function ActivityMasteryChart({ data }: { data: ActivityMasteryByChapter[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No chapter mastery data recorded yet.</p>;
  }

  const rows = data.map((row) => ({
    name: row.chapterName || `Chapter ${row.chapterId}`,
    mastered: row.mastered,
    learning: row.learning,
    unseen: row.unseen,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="mastered" name="Mastered" stackId="nodes" fill={COLORS.mastered} />
          <Bar dataKey="learning" name="Learning" stackId="nodes" fill={COLORS.learning} />
          <Bar dataKey="unseen" name="Unseen" stackId="nodes" fill={COLORS.unseen} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
