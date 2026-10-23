'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, ClipboardList, Scale, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';

type Row = Record<string, unknown>;
type Summary = { studentName: string; totalPoints: number; positiveCount: number; negativeCount: number };

const POSITIVE = '#10b981';
const NEGATIVE = '#f43f5e';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function text(value: unknown) {
  if (value == null) return '';
  const result = String(value).trim();
  return result === '-' ? '' : result;
}

function Kpi({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function StudentDisciplineInsights({ rows, summary }: { rows: Row[]; summary: Summary[] }) {
  const totals = useMemo(() => {
    let positive = 0;
    let negative = 0;
    rows.forEach((row) => {
      const flag = text(row.flag_text).toLowerCase();
      if (flag === 'positive') positive += 1;
      else if (flag === 'negative') negative += 1;
    });
    // The entry rows can be empty while a summary exists (and vice versa); trust
    // whichever side actually carries counts.
    if (positive + negative === 0) {
      positive = summary.reduce((sum, row) => sum + row.positiveCount, 0);
      negative = summary.reduce((sum, row) => sum + row.negativeCount, 0);
    }
    return { positive, negative, total: positive + negative };
  }, [rows, summary]);

  const ranked = useMemo(
    () =>
      [...summary]
        .map((row) => ({ ...row, name: row.studentName.replace(/\s+/g, ' ').trim() || 'Unknown student' }))
        .sort((left, right) => right.totalPoints - left.totalPoints || right.positiveCount - left.positiveCount),
    [summary]
  );

  const maxSide = useMemo(
    () => ranked.reduce((max, row) => Math.max(max, row.positiveCount, row.negativeCount), 1),
    [ranked]
  );

  const timeline = useMemo(() => {
    const dated = rows
      .map((row) => {
        const match = text(row.date_).match(/^(\d{4})-(\d{2})-(\d{2})/);
        const flag = text(row.flag_text).toLowerCase();
        return match && (flag === 'positive' || flag === 'negative')
          ? { year: match[1], month: match[2], day: match[3], flag }
          : null;
      })
      .filter((entry): entry is { year: string; month: string; day: string; flag: string } => entry !== null);

    const months = new Set(dated.map((entry) => `${entry.year}-${entry.month}`));
    const byDay = months.size <= 1;
    const buckets = new Map<string, { label: string; positive: number; negative: number }>();

    dated.forEach((entry) => {
      const key = byDay ? `${entry.year}-${entry.month}-${entry.day}` : `${entry.year}-${entry.month}`;
      const label = byDay
        ? `${entry.day} ${MONTHS[Number(entry.month) - 1]}`
        : `${MONTHS[Number(entry.month) - 1]} ${entry.year.slice(2)}`;
      const bucket = buckets.get(key) ?? { label, positive: 0, negative: 0 };
      if (entry.flag === 'positive') bucket.positive += 1;
      else bucket.negative -= 1;
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([, bucket]) => bucket);
  }, [rows]);

  const net = totals.positive - totals.negative;
  const positiveShare = totals.total > 0 ? Math.round((totals.positive / totals.total) * 100) : 0;
  const donut = [
    { name: 'Positive', value: totals.positive, color: POSITIVE },
    { name: 'Negative', value: totals.negative, color: NEGATIVE },
  ].filter((slice) => slice.value > 0);
  const topStudent = ranked[0];
  const attention = ranked.filter((row) => row.negativeCount > 0).sort((left, right) => left.totalPoints - right.totalPoints)[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entries" value={rows.length || totals.total} hint={`${ranked.length} students`} icon={<ClipboardList className="h-5 w-5 text-indigo-600" />} accent="bg-indigo-50 ring-1 ring-indigo-100" />
        <Kpi label="Positive" value={totals.positive} hint={`${positiveShare}% of entries`} icon={<ThumbsUp className="h-5 w-5 text-emerald-600" />} accent="bg-emerald-50 ring-1 ring-emerald-100" />
        <Kpi label="Negative" value={totals.negative} hint={`${totals.total > 0 ? 100 - positiveShare : 0}% of entries`} icon={<ThumbsDown className="h-5 w-5 text-rose-600" />} accent="bg-rose-50 ring-1 ring-rose-100" />
        <Kpi
          label="Net points"
          value={net > 0 ? `+${net}` : net}
          hint={net >= 0 ? 'More praise than concerns' : 'More concerns than praise'}
          icon={<Scale className={`h-5 w-5 ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />}
          accent={net >= 0 ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-rose-50 ring-1 ring-rose-100'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Card title="Student conduct" subtitle="Positive (right) and negative (left) entries per student, best conduct first">
          {ranked.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No student summaries for these filters.</p>
          ) : (
            <ul className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
              {ranked.map((row, index) => (
                <li key={`${row.name}-${index}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                    {index === 0 && row.totalPoints > 0 ? <Award className="h-4 w-4 shrink-0 text-amber-500" /> : null}
                    <span className="truncate">{row.name}</span>
                  </span>
                  <div className="relative grid h-3 grid-cols-2 items-center">
                    <div className="flex h-full justify-end overflow-hidden rounded-l-full bg-slate-100">
                      <div className="h-full rounded-l-full" style={{ width: `${(row.negativeCount / maxSide) * 100}%`, background: NEGATIVE }} />
                    </div>
                    <div className="flex h-full overflow-hidden rounded-r-full bg-slate-100">
                      <div className="h-full rounded-r-full" style={{ width: `${(row.positiveCount / maxSide) * 100}%`, background: POSITIVE }} />
                    </div>
                    <span className="pointer-events-none absolute left-1/2 top-[-3px] h-[18px] w-px -translate-x-1/2 bg-slate-300" />
                  </div>
                  <span
                    className={`min-w-[2.75rem] rounded-full px-2 py-0.5 text-center font-semibold tabular-nums ring-1 ${
                      row.totalPoints > 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : row.totalPoints < 0
                          ? 'bg-rose-50 text-rose-700 ring-rose-200'
                          : 'bg-slate-50 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {row.totalPoints > 0 ? `+${row.totalPoints}` : row.totalPoints}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Overall balance" subtitle="Share of positive and negative entries">
            {donut.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No entries to compare.</p>
            ) : (
              <div className="flex items-center gap-5">
                <div className="relative h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={donut.length > 1 ? 4 : 0} stroke="none">
                        {donut.map((slice) => (
                          <Cell key={slice.name} fill={slice.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-950">{positiveShare}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Positive</span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2 text-xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POSITIVE }} />Positive</span>
                    <span className="font-semibold text-slate-900">{totals.positive}</span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NEGATIVE }} />Negative</span>
                    <span className="font-semibold text-slate-900">{totals.negative}</span>
                  </li>
                  {topStudent && topStudent.totalPoints > 0 ? (
                    <li className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-700">
                      <Award className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Best: {topStudent.name}</span>
                    </li>
                  ) : null}
                  {attention ? (
                    <li className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-700">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Watch: {attention.name}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Over time" subtitle="Positive above the line, negative below">
            {timeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No dated entries to chart.</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} stackOffset="sign" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={24} />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Tooltip
                      cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-semibold text-slate-900">{label}</p>
                            <p className="text-emerald-600">Positive {Math.abs(Number(payload.find((item) => item.dataKey === 'positive')?.value ?? 0))}</p>
                            <p className="text-rose-600">Negative {Math.abs(Number(payload.find((item) => item.dataKey === 'negative')?.value ?? 0))}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="positive" stackId="flag" fill={POSITIVE} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="negative" stackId="flag" fill={NEGATIVE} radius={[0, 0, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
