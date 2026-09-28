'use client';

/**
 * Activity — the central console's window onto one module's execution ledger.
 *
 * `fetchModuleActivity(moduleKey)` — the exact call `app/_components/ai-stack/activity-screen.tsx`
 * makes from inside a module's own AI Stack tab, reading `ai_audit_logs` rows filtered to
 * `event_type = module.<key>.*`. Selecting "Fees" here reads the same rows, live.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { CapabilityShell } from '../_components/CapabilityShell';
import { ModulePicker } from '../_components/ModulePicker';
import { fetchTemplateOptions, type TemplateModule } from '@/lib/intelligence/ai-templates';
import { fetchModuleActivity, type AiModuleActivity } from '@/lib/intelligence/ai-module';

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  denied: 'bg-amber-100 text-amber-800',
  skipped: 'bg-slate-200 text-slate-700',
};

export default function AiAuditPage() {
  return (
    <CapabilityShell slug="audit">
      <ModuleActivity />
    </CapabilityShell>
  );
}

function ModuleActivity() {
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [data, setData] = useState<AiModuleActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchTemplateOptions()
      .then((options) => {
        if (cancelled) return;
        setModules(options.modules);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!moduleKey) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchModuleActivity(moduleKey, { limit: 100 })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Activity, by module</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The execution ledger for one module — what ran, which template or agent it used, and how it
            ended. The same rows that module&rsquo;s own AI Stack &rarr; Activity tab shows.
          </p>
        </div>
        <ModulePicker modules={modules} value={moduleKey} onChange={setModuleKey} allowAll={false} loading={loading} />
      </header>

      {!moduleKey ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Select a module to load its activity.
        </div>
      ) : loading && !data ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setModuleKey((key) => key)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
        </div>
      ) : data && !data.available ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {data.reason ?? 'Activity is not available for this module on this estate.'}
        </div>
      ) : data ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Total entries</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{data.total}</div>
            </div>
            {data.by_operation.slice(0, 3).map((row) => (
              <div key={`${row.operation}-${row.outcome}`} className="rounded-lg border border-border bg-card p-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {row.operation} · {row.outcome}
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">{row.count}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Operation</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Used</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Subject</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                      No activity recorded for this module yet.
                    </td>
                  </tr>
                )}
                {data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 text-foreground">{entry.operation_label ?? entry.operation}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[entry.status] ?? 'bg-slate-200 text-slate-700'}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.used.template?.name ?? entry.used.prompt?.name ?? entry.used.agent?.name ?? entry.used.workflow ?? entry.used.tool ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.subject_label ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.created_at ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
