'use client';

import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Lock, X } from 'lucide-react';

import { fetchAudit, fetchAuditSummary, PlatformApiError } from '@/lib/platform/client';
import type { AuditEntry, AuditSummary, PageMeta } from '@/lib/platform/types';

import {
  Card,
  ErrorState,
  formatWhen,
  LoadingState,
  Pager,
  Pill,
  PlainShell,
  RefreshButton,
  SampleBadge,
  StatTiles,
  usePlatformRegistry,
} from '../../_components/shell';

/**
 * Platform audit - read only.
 *
 * THERE IS NO WRITE CONTROL ON THIS SCREEN because there is no write verb on the
 * API: entries are appended by other modules' own write paths, and a viewer that
 * could edit one would make the trail worthless as evidence.
 *
 * THE SUMMARY AND THE LIST SHARE ONE FILTER. The endpoint computes both over the
 * same window, so the tiles always describe exactly the rows below them.
 */

const PER_PAGE = 25;

interface Filters {
  module: string;
  component: string;
  action: string;
  actor: string;
  from: string;
  to: string;
  q: string;
}

const EMPTY: Filters = { module: '', component: '', action: '', actor: '', from: '', to: '', q: '' };

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';

function actionTone(action: string): 'green' | 'blue' | 'red' | 'amber' | 'gray' {
  if (/create|add|insert/.test(action)) return 'green';
  if (/delete|remove|reject/.test(action)) return 'red';
  if (/update|edit|change/.test(action)) return 'blue';
  if (/test|run|approve/.test(action)) return 'amber';
  return 'gray';
}

export function AuditConsole() {
  const { registry } = usePlatformRegistry();

  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([fetchAudit({ ...applied, page, per_page: PER_PAGE }), fetchAuditSummary(applied)])
      .then(([list, totals]) => {
        setRows(list.rows);
        setMeta(list.meta);
        setSummary(totals);
      })
      .catch((cause: unknown) => {
        setError({
          message: cause instanceof PlatformApiError ? cause.message : "Couldn't load the audit trail. Try again.",
          status: cause instanceof PlatformApiError ? cause.status : 0,
        });
      })
      .finally(() => setLoading(false));
  }, [applied, page]);

  useEffect(() => load(), [load]);

  const moduleOptions = useMemo(() => {
    const keys = new Set<string>(registry?.modules.map((row) => row.key) ?? []);
    for (const key of Object.keys(summary?.by_module ?? {})) keys.add(key);
    return [...keys].sort();
  }, [registry, summary]);

  const actionOptions = useMemo(() => {
    const keys = new Set<string>(Object.keys(summary?.by_action ?? {}));
    if (applied.action) keys.add(applied.action);
    return [...keys].sort();
  }, [summary, applied.action]);

  const filtered = Object.values(applied).some(Boolean);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  };

  const clear = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  };

  const set = (key: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const topModules = Object.entries(summary?.by_module ?? {}).slice(0, 3);
  const topActions = Object.entries(summary?.by_action ?? {}).slice(0, 3);

  return (
    <PlainShell
      title="Audit"
      description="A permanent record of who changed what, and when, across every module. This view is read only: entries are written by the modules themselves and cannot be edited here."
      actions={<RefreshButton onClick={load} busy={loading} />}
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Lock size={14} className="mr-1.5 inline align-text-bottom" />
        Platform audit - read only. Filters change what you see, never what is stored.
      </div>

      {summary && (
        <StatTiles
          tiles={[
            { label: 'Entries', value: summary.total, hint: filtered ? 'matching these filters' : 'in the trail' },
            {
              label: 'Modules',
              value: Object.keys(summary.by_module).length,
              hint: topModules.map(([name, count]) => `${name} ${count}`).join(', ') || undefined,
            },
            {
              label: 'Action types',
              value: Object.keys(summary.by_action).length,
              hint: topActions.map(([name, count]) => `${name} ${count}`).join(', ') || undefined,
            },
            {
              label: 'Sample entries',
              value: summary.sample_rows,
              tone: summary.sample_rows > 0 ? 'amber' : 'gray',
              hint: summary.sample_rows > 0 ? 'seeded for demonstration' : 'none',
            },
          ]}
        />
      )}

      <Card className="p-4">
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">
            Module
            <select value={draft.module} onChange={set('module')} className={`${inputClass} mt-1`}>
              <option value="">All modules</option>
              {moduleOptions.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Component
            <input value={draft.component} onChange={set('component')} placeholder="e.g. fees.collection" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Action
            <select value={draft.action} onChange={set('action')} className={`${inputClass} mt-1`}>
              <option value="">All actions</option>
              {actionOptions.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Actor
            <input value={draft.actor} onChange={set('actor')} placeholder="Name or user ID" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            From
            <input type="date" value={draft.from} onChange={set('from')} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            To
            <input type="date" value={draft.to} onChange={set('to')} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-slate-600 lg:col-span-2">
            Search
            <input value={draft.q} onChange={set('q')} placeholder="Entity, actor or action" className={`${inputClass} mt-1`} />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              Apply filters
            </button>
            {filtered && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <X size={14} />
                Clear filters
              </button>
            )}
          </div>
        </form>
      </Card>

      {loading && rows.length === 0 ? (
        <LoadingState label="Loading the audit trail" />
      ) : error ? (
        <ErrorState
          message={
            error.status === 403
              ? `${error.message} Viewing the audit trail needs the platform.audit view right in Group-wise Rights.`
              : error.message
          }
          onRetry={load}
        />
      ) : rows.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-slate-600">
          {filtered ? 'No audit entries match these filters.' : 'No audit entries have been recorded yet.'}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-8 px-3 py-2" aria-label="Details" />
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = open === row.id;
                  const hasDetail = Boolean(row.before || row.after);
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-3 py-2">
                          {hasDetail && (
                            <button
                              type="button"
                              onClick={() => setOpen(expanded ? null : row.id)}
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Hide changes' : 'Show changes'}
                              className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatWhen(row.created_at)}</td>
                        <td className="px-3 py-2 text-slate-800">
                          {row.actor_name || (row.actor_user_id ? `User ${row.actor_user_id}` : 'System')}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-slate-800">{row.module}</span>
                          {row.component && <span className="block font-mono text-[10px] text-slate-400">{row.component}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Pill tone={actionTone(row.action)}>{row.action}</Pill>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-700">
                              {[row.entity_type, row.entity_id].filter((part) => part !== null && part !== '').join(' ') || 'None'}
                            </span>
                            <SampleBadge show={row.is_sample} />
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.ip ?? 'Unknown'}</td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td />
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <ChangeBlock label="Before" value={row.before} />
                              <ChangeBlock label="After" value={row.after} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="border-t border-slate-200 px-4 py-3">
              <Pager page={meta.page} perPage={meta.per_page || PER_PAGE} total={meta.total} onPage={setPage} />
            </div>
          )}
        </Card>
      )}
    </PlainShell>
  );
}

function ChangeBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {value ? (
        <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="text-xs text-slate-500">Nothing recorded.</p>
      )}
    </div>
  );
}
