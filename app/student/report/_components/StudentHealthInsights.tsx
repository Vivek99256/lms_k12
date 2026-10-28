'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Activity, CalendarDays, Ruler, Stethoscope, Syringe, Users, Weight } from 'lucide-react';

type HealthRow = Record<string, unknown>;
type HealthKind = 'infirmary' | 'vaccination' | 'height_weight' | 'health';

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function text(value: unknown) {
  if (value == null) return '';
  const result = String(value).trim();
  return result === '-' ? '' : result;
}

function toNumber(value: unknown) {
  const parsed = parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function detectKind(rows: HealthRow[]): HealthKind {
  const sample = rows[0] ?? {};
  if ('vaccination_type' in sample) return 'vaccination';
  if ('height' in sample && 'weight' in sample) return 'height_weight';
  if ('disease' in sample || 'complaint' in sample) return 'infirmary';
  return 'health';
}

function countBy(rows: HealthRow[], pick: (row: HealthRow) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = pick(row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
}

function Kpi({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-bold leading-none tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
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

function SoftTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const title = label ?? text(point.payload?.name) ?? '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {title ? <p className="font-semibold text-slate-900">{title}</p> : null}
      <p className="text-slate-600">
        <span className="font-semibold text-slate-900">{point.value}</span> {unit ?? 'entries'}
      </p>
    </div>
  );
}

export default function StudentHealthInsights({ rows }: { rows: HealthRow[] }) {
  const kind = useMemo(() => detectKind(rows), [rows]);

  const students = useMemo(() => new Set(rows.map((row) => text(row.student_id) || text(row.student_name))).size, [rows]);
  const doctors = useMemo(() => countBy(rows, (row) => text(row.doctor_name)), [rows]);

  const timeline = useMemo(() => {
    const buckets = new Map<string, number>();
    rows.forEach((row) => {
      const match = text(row.date).match(/^(\d{4})-(\d{2})/);
      if (!match) return;
      const key = `${match[1]}-${match[2]}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    return Array.from(buckets.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, entries]) => ({
        name: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(2, 4)}`,
        entries,
      }));
  }, [rows]);

  const breakdown = useMemo(() => {
    if (kind === 'infirmary') {
      return { title: 'Top conditions', subtitle: 'Most frequent diseases or complaints', items: countBy(rows, (row) => text(row.disease) || text(row.complaint)) };
    }
    if (kind === 'vaccination') {
      return { title: 'Vaccination types', subtitle: 'Share of doses recorded', items: countBy(rows, (row) => text(row.vaccination_type)) };
    }
    return { title: 'Entries by doctor', subtitle: 'Who recorded these entries', items: doctors };
  }, [doctors, kind, rows]);

  const measurements = useMemo(
    () =>
      rows
        .map((row) => ({
          name: text(row.student_name),
          height: toNumber(row.height),
          weight: toNumber(row.weight),
        }))
        .filter((point): point is { name: string; height: number; weight: number } => point.height != null && point.weight != null),
    [rows]
  );

  const donutItems = breakdown.items.slice(0, 6);
  const donutTotal = donutItems.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entries" value={rows.length} icon={<Activity className="h-5 w-5" />} />
        <Kpi label="Students" value={students} icon={<Users className="h-5 w-5" />} />
        {kind === 'height_weight' ? (
          <>
            <Kpi label="Avg height" value={average(measurements.map((point) => point.height))} icon={<Ruler className="h-5 w-5" />} />
            <Kpi label="Avg weight" value={average(measurements.map((point) => point.weight))} icon={<Weight className="h-5 w-5" />} />
          </>
        ) : (
          <>
            <Kpi label="Doctors" value={doctors.length} icon={<Stethoscope className="h-5 w-5" />} />
            <Kpi
              label={kind === 'vaccination' ? 'Vaccine types' : 'Active months'}
              value={kind === 'vaccination' ? breakdown.items.length : timeline.length}
              icon={kind === 'vaccination' ? <Syringe className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        {kind === 'height_weight' ? (
          <Card title="Height vs weight" subtitle="Each dot is one student measurement">
            {measurements.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="height" name="Height" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <YAxis type="number" dataKey="weight" name="Weight" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={36} domain={['dataMin - 5', 'dataMax + 5']} />
                    <ZAxis range={[90, 90]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-semibold text-slate-900">{text(payload[0].payload?.name) || 'Student'}</p>
                            <p className="text-slate-600">Height {payload[0].payload?.height} · Weight {payload[0].payload?.weight}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Scatter data={measurements} fill="#4f46e5" fillOpacity={0.75} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">No height and weight pairs to plot.</p>
            )}
          </Card>
        ) : (
          <Card title="Entries over time" subtitle="Monthly count of recorded entries">
            {timeline.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="health-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={28} />
                    <Tooltip content={<SoftTooltip />} />
                    <Area type="monotone" dataKey="entries" stroke="#4f46e5" strokeWidth={2.5} fill="url(#health-area)" dot={{ r: 3, fill: '#fff', stroke: '#4f46e5', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">These entries have no dates to chart.</p>
            )}
          </Card>
        )}

        {kind === 'height_weight' ? (
          <Card title="Entries by doctor" subtitle="Who recorded these measurements">
            <RankedBars items={doctors.slice(0, 6)} total={rows.length} empty="No doctor recorded." />
          </Card>
        ) : kind === 'vaccination' || kind === 'health' ? (
          <Card title={breakdown.title} subtitle={breakdown.subtitle}>
            {donutItems.length > 0 ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
                <div className="relative h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutItems} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                        {donutItems.map((item, index) => (
                          <Cell key={item.name} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<SoftTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-950">{donutTotal}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
                  </div>
                </div>
                <ul className="w-full space-y-2 text-xs">
                  {donutItems.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">Nothing to break down yet.</p>
            )}
          </Card>
        ) : (
          <Card title={breakdown.title} subtitle={breakdown.subtitle}>
            <RankedBars items={breakdown.items.slice(0, 6)} total={rows.length} empty="No conditions recorded." />
          </Card>
        )}
      </div>
    </div>
  );
}

function RankedBars({
  items,
  total,
  empty,
}: {
  items: Array<{ name: string; value: number }>;
  total: number;
  empty: string;
}) {
  if (items.length === 0) return <p className="py-12 text-center text-sm text-slate-500">{empty}</p>;
  const max = items[0].value;

  return (
    <ul className="space-y-3.5">
      {items.map((item, index) => (
        <li key={item.name}>
          <div className="flex items-center justify-between text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                {index + 1}
              </span>
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {item.value}
              <span className="ml-1 font-normal text-slate-400">· {total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(6, (item.value / max) * 100)}%`, background: PALETTE[index % PALETTE.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
