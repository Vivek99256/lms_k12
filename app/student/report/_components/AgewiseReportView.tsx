'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CalendarRange, GraduationCap, Sigma, Users } from 'lucide-react';

type AgewiseRow = Record<string, string | number>;

const BOYS = '#4f46e5';
const GIRLS = '#ec4899';

function num(value: unknown) {
  return Number(value) || 0;
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 ${tone}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200">
          {icon}
        </span>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, item) => sum + num(item.value), 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">Age {label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center justify-between gap-6 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="font-semibold text-slate-900">{item.value}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
        <span>Total</span>
        <span>{total}</span>
      </p>
    </div>
  );
}

export default function AgewiseReportView({
  classes,
  matrix,
  grandTotal,
  hasSearched,
  summary,
  actions,
}: {
  classes: string[];
  matrix: AgewiseRow[];
  grandTotal: number;
  hasSearched: boolean;
  summary?: string;
  actions?: ReactNode;
}) {
  const stats = useMemo(() => {
    const rowTotals = matrix.map((row) => {
      let boys = 0;
      let girls = 0;
      classes.forEach((className) => {
        boys += num(row[`${className}_M`]);
        girls += num(row[`${className}_F`]);
      });
      return { age: String(row.age ?? '-'), M: boys, F: girls };
    });

    const columnTotals = classes.map((className) => ({
      className,
      M: matrix.reduce((sum, row) => sum + num(row[`${className}_M`]), 0),
      F: matrix.reduce((sum, row) => sum + num(row[`${className}_F`]), 0),
    }));

    const boys = rowTotals.reduce((sum, row) => sum + row.M, 0);
    const girls = rowTotals.reduce((sum, row) => sum + row.F, 0);
    const peak = rowTotals.reduce<{ age: string; total: number } | null>(
      (best, row) => (!best || row.M + row.F > best.total ? { age: row.age, total: row.M + row.F } : best),
      null
    );
    const maxCell = matrix.reduce((max, row) => {
      classes.forEach((className) => {
        max = Math.max(max, num(row[`${className}_M`]), num(row[`${className}_F`]));
      });
      return max;
    }, 0);

    return { rowTotals, columnTotals, boys, girls, peak, maxCell };
  }, [classes, matrix]);

  if (matrix.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            <BarChart3 className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">
            {hasSearched ? 'No students match these filters' : 'Your agewise report will appear here'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {hasSearched
              ? 'Try a different grade, standard or division.'
              : 'Pick a grade, standard and division above, then run the report to see the age by class matrix.'}
          </p>
        </div>
      </div>
    );
  }

  const total = grandTotal || stats.boys + stats.girls;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total students"
          value={total}
          hint={summary}
          icon={<Sigma className="h-5 w-5" />}
          tone="bg-gradient-to-r from-indigo-500 to-violet-500"
        />
        <Kpi
          label="Boys"
          value={stats.boys}
          hint={`${percent(stats.boys, stats.boys + stats.girls)}% of students`}
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          tone="bg-indigo-500"
        />
        <Kpi
          label="Girls"
          value={stats.girls}
          hint={`${percent(stats.girls, stats.boys + stats.girls)}% of students`}
          icon={<Users className="h-5 w-5 text-pink-500" />}
          tone="bg-pink-500"
        />
        <Kpi
          label="Most common age"
          value={stats.peak ? stats.peak.age : '-'}
          hint={stats.peak ? `${stats.peak.total} students across ${classes.length} classes` : undefined}
          icon={<CalendarRange className="h-5 w-5" />}
          tone="bg-gradient-to-r from-sky-400 to-indigo-500"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Age distribution</h3>
            <p className="text-xs text-slate-500">Boys and girls at each age, all classes combined</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BOYS }} />
              Boys
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: GIRLS }} />
              Girls
            </span>
          </div>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.rowTotals} barCategoryGap="28%">
              <defs>
                <linearGradient id="agewise-boys" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4338ca" />
                </linearGradient>
                <linearGradient id="agewise-girls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#db2777" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={32} />
              <Tooltip cursor={{ fill: 'rgba(79,70,229,0.06)' }} content={<ChartTooltip />} />
              <Bar dataKey="M" name="Boys" stackId="age" fill="url(#agewise-boys)" />
              <Bar dataKey="F" name="Girls" stackId="age" fill="url(#agewise-girls)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Age by class</h3>
              <p className="text-xs text-slate-500">Darker cells mean more students</p>
            </div>
          </div>
          {actions}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-900 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Age
                </th>
                {classes.map((className) => (
                  <th
                    key={className}
                    colSpan={2}
                    className="border-b border-l border-white/10 bg-slate-900 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-white"
                  >
                    {className}
                  </th>
                ))}
                <th
                  colSpan={3}
                  className="border-b border-l border-white/10 bg-indigo-600 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Total
                </th>
              </tr>
              <tr>
                {classes.flatMap((className) => [
                  <th key={`${className}-M`} className="border-b border-l border-slate-200 bg-indigo-50 px-3 py-1.5 text-center text-[11px] font-semibold text-indigo-700">
                    Boys
                  </th>,
                  <th key={`${className}-F`} className="border-b border-slate-200 bg-pink-50 px-3 py-1.5 text-center text-[11px] font-semibold text-pink-600">
                    Girls
                  </th>,
                ])}
                <th className="border-b border-l border-slate-200 bg-indigo-50 px-3 py-1.5 text-center text-[11px] font-semibold text-indigo-700">Boys</th>
                <th className="border-b border-slate-200 bg-pink-50 px-3 py-1.5 text-center text-[11px] font-semibold text-pink-600">Girls</th>
                <th className="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-center text-[11px] font-semibold text-slate-700">All</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, index) => {
                const rowStat = stats.rowTotals[index];
                return (
                  <tr key={`${String(row.age)}-${index}`} className="group">
                    <th className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-5 py-2.5 text-left font-semibold text-slate-900 group-hover:bg-slate-50">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{String(row.age)}</span>
                    </th>
                    {classes.flatMap((className) => {
                      const boys = num(row[`${className}_M`]);
                      const girls = num(row[`${className}_F`]);
                      const strength = (value: number) => (stats.maxCell > 0 ? 0.08 + (value / stats.maxCell) * 0.3 : 0);

                      return [
                        <td
                          key={`${className}-${index}-M`}
                          className="border-b border-l border-slate-100 px-3 py-2.5 text-center tabular-nums"
                          style={boys > 0 ? { background: `rgba(79,70,229,${strength(boys)})` } : undefined}
                        >
                          <span className={boys > 0 ? 'font-semibold text-indigo-900' : 'text-slate-300'}>{boys > 0 ? boys : '–'}</span>
                        </td>,
                        <td
                          key={`${className}-${index}-F`}
                          className="border-b border-slate-100 px-3 py-2.5 text-center tabular-nums"
                          style={girls > 0 ? { background: `rgba(236,72,153,${strength(girls)})` } : undefined}
                        >
                          <span className={girls > 0 ? 'font-semibold text-pink-900' : 'text-slate-300'}>{girls > 0 ? girls : '–'}</span>
                        </td>,
                      ];
                    })}
                    <td className="border-b border-l border-slate-100 bg-slate-50/70 px-3 py-2.5 text-center font-semibold tabular-nums text-indigo-700">{rowStat.M}</td>
                    <td className="border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 text-center font-semibold tabular-nums text-pink-600">{rowStat.F}</td>
                    <td className="border-b border-slate-100 bg-slate-100 px-3 py-2.5 text-center font-bold tabular-nums text-slate-950">{rowStat.M + rowStat.F}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100 px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                  Total
                </th>
                {stats.columnTotals.flatMap((column) => [
                  <td key={`${column.className}-tM`} className="border-l border-slate-200 bg-slate-100 px-3 py-3 text-center font-bold tabular-nums text-indigo-700">
                    {column.M}
                  </td>,
                  <td key={`${column.className}-tF`} className="bg-slate-100 px-3 py-3 text-center font-bold tabular-nums text-pink-600">
                    {column.F}
                  </td>,
                ])}
                <td className="border-l border-slate-200 bg-indigo-600 px-3 py-3 text-center font-bold tabular-nums text-white">{stats.boys}</td>
                <td className="bg-indigo-600 px-3 py-3 text-center font-bold tabular-nums text-white">{stats.girls}</td>
                <td className="bg-slate-900 px-3 py-3 text-center font-bold tabular-nums text-white">{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
