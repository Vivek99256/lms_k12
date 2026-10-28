'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { FileText, Inbox, Paperclip, Search, UserRound } from 'lucide-react';

type RequestRow = Record<string, unknown>;

type Tone = {
  pill: string;
  dot: string;
  bar: string;
  ring: string;
};

const TONES: Tone[] = [
  { pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500', bar: 'bg-indigo-500', ring: 'ring-indigo-200' },
  { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500', ring: 'ring-amber-200' },
  { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-500', ring: 'ring-rose-200' },
  { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500', ring: 'ring-sky-200' },
  { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500', bar: 'bg-violet-500', ring: 'ring-violet-200' },
];

function text(value: unknown) {
  if (value == null) return '';
  const result = String(value).trim();
  return result === '-' ? '' : result;
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold leading-none tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function StudentRequestReportView({
  rows,
  hasSearched,
  summary,
  actions,
}: {
  rows: RequestRow[];
  hasSearched: boolean;
  summary?: string;
  actions?: ReactNode;
}) {
  const [activeType, setActiveType] = useState('all');
  const [query, setQuery] = useState('');

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = text(row.REQUEST) || 'Other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([name, count], index) => ({ name, count, tone: TONES[index % TONES.length] }));
  }, [rows]);

  const toneFor = (name: string) => types.find((entry) => entry.name === name)?.tone ?? TONES[0];

  const students = useMemo(() => new Set(rows.map((row) => text(row.enrollment_no) || text(row.student_name))).size, [rows]);
  const withDocument = useMemo(() => rows.filter((row) => text(row.PROOF_OF_DOCUMENT)).length, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeType !== 'all' && (text(row.REQUEST) || 'Other') !== activeType) return false;
      if (!needle) return true;
      return [row.student_name, row.enrollment_no, row.REQUEST, row.REASON, row.DESCRIPTION, row.standard, row.division]
        .some((value) => text(value).toLowerCase().includes(needle));
    });
  }, [activeType, query, rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Inbox className="h-7 w-7" />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-900">
          {hasSearched ? 'No requests found' : 'Student requests will show up here'}
        </p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {hasSearched
            ? 'Nothing was raised for these filters. Try a wider date range or another class.'
            : 'Choose a class and date range, then run the report to review every request with its reason.'}
        </p>
      </div>
    );
  }

  const maxCount = types[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      <div className="grid divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <Stat label="Requests" value={rows.length} icon={<FileText className="h-5 w-5" />} />
        <Stat label="Students" value={students} icon={<UserRound className="h-5 w-5" />} />
        <Stat label="Request types" value={types.length} icon={<Inbox className="h-5 w-5" />} />
        <Stat label="With document" value={withDocument} icon={<Paperclip className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Requests by type</h3>
            {summary ? <p className="mt-0.5 text-xs text-slate-500">{summary}</p> : null}
            <ul className="mt-4 space-y-3">
              {types.map((type) => (
                <li key={type.name}>
                  <button
                    type="button"
                    onClick={() => setActiveType(activeType === type.name ? 'all' : type.name)}
                    className="group w-full text-left"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${activeType === type.name ? 'text-slate-950' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {type.name}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{type.count}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${type.tone.bar} transition-all`}
                        style={{ width: `${Math.max(6, (type.count / maxCount) * 100)}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {actions ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Export</p>
            {actions}
          </div> : null}
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student, GR no., reason…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveType('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  activeType === 'all' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                All {rows.length}
              </button>
              {types.slice(0, 4).map((type) => (
                <button
                  key={type.name}
                  type="button"
                  onClick={() => setActiveType(activeType === type.name ? 'all' : type.name)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    activeType === type.name ? `${type.tone.pill} ring-2` : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type.name} {type.count}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              No requests match your search.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((row, index) => {
                const name = text(row.student_name) || 'Unknown student';
                const type = text(row.REQUEST) || 'Other';
                const tone = toneFor(type);
                const reason = text(row.REASON);
                const description = text(row.DESCRIPTION);
                const document = text(row.PROOF_OF_DOCUMENT);
                const classLabel = [text(row.standard), text(row.division)].filter(Boolean).join(' · ');
                const isLink = /^https?:\/\//i.test(document);

                return (
                  <article
                    key={`${text(row.id) || text(row.enrollment_no) || name}-${index}`}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <header className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-sm">
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          {text(row.enrollment_no) ? <span>GR {text(row.enrollment_no)}</span> : null}
                          {classLabel ? <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{classLabel}</span> : null}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {type}
                      </span>
                    </header>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">{reason || <span className="font-normal text-slate-400">Not provided</span>}</p>
                      </div>
                      {description ? (
                        <p className="line-clamp-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">{description}</p>
                      ) : null}
                    </div>

                    <footer className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      {document ? (
                        isLink ? (
                          <a
                            href={document}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            View document
                          </a>
                        ) : (
                          <span className="inline-flex max-w-full items-center gap-1.5 truncate font-medium text-slate-600">
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{document}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">No document attached</span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Showing {visible.length} of {rows.length} requests
          </p>
        </section>
      </div>
    </div>
  );
}
