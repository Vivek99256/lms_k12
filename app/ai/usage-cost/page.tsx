'use client';

/**
 * Usage & Cost — the central console's window onto one module's own spend.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx` for the
 * `usage-cost` slug, the same way `/ai/models` and `/ai/policies` already do.
 *
 * WHERE THE DATA COMES FROM
 *
 * `fetchModuleUsage(moduleKey)` — the exact call `app/_components/ai-stack/usage-cost-screen.tsx`
 * makes from inside a module's own AI Stack tab. Selecting "Fees" here reads the same
 * `ai_conversations` / `ai_generation_requests` / `ai_generation_outputs` /
 * `ai_generated_reports` / `ai_api_keys` rows, live — not a separate central meter. This
 * page does not reuse that screen's own component directly because it is written against
 * a full `AiStackModule` descriptor (for its module-specific wording), which only some
 * modules have; this renders the same figures with module-neutral copy instead.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { CapabilityShell } from '../_components/CapabilityShell';
import { ModulePicker } from '../_components/ModulePicker';
import { fetchTemplateOptions, type TemplateModule } from '@/lib/intelligence/ai-templates';
import { fetchModuleUsage, type AiModuleUsage } from '@/lib/intelligence/ai-module';

export default function AiUsageCostPage() {
  return (
    <CapabilityShell slug="usage-cost">
      <ModuleUsageCost />
    </CapabilityShell>
  );
}

function money(value: number | null): string {
  if (value === null) return '—';
  return `₹${value.toFixed(2)}`;
}

function ModuleUsageCost() {
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [usage, setUsage] = useState<AiModuleUsage | null>(null);
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
      setUsage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchModuleUsage(moduleKey)
      .then((next) => {
        if (cancelled) return;
        setUsage(next);
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

  const generation = usage?.generation;
  const conversations = usage?.conversations;

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Usage & cost, by module</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a module to see the exact spend and conversation figures its own AI Stack &rarr; Usage &amp;
            Cost tab shows.
          </p>
        </div>
        <ModulePicker modules={modules} value={moduleKey} onChange={setModuleKey} allowAll={false} loading={loading} />
      </header>

      {!moduleKey ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Select a module to load its usage and cost.
        </div>
      ) : loading && !usage ? (
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
      ) : usage ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label="Conversations"
              value={conversations?.available ? String(conversations.total) : '—'}
              hint={conversations?.available ? undefined : (conversations as { reason?: string })?.reason}
            />
            <Metric
              label="Generation outputs"
              value={generation?.available ? String(generation.total) : '—'}
              hint={generation?.available ? undefined : (generation as { reason?: string })?.reason}
            />
            <Metric
              label="Reviewed outputs"
              value={generation?.available ? String(generation.tokens.reviewed) : '—'}
            />
            <Metric
              label="Cost"
              value={generation?.available ? money(generation.tokens.cost) : '—'}
              hint={generation?.available ? (generation.tokens.cost_reason ?? undefined) : undefined}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Provider</h3>
            {usage.provider.available ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {usage.provider.bound
                  ? `Bound: ${usage.provider.provider ?? 'unknown'} / ${usage.provider.model ?? 'unknown'} (${usage.provider.scope ?? 'estate'})`
                  : 'This module shares an unbound credential with every other module.'}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {(usage.provider as { reason?: string }).reason ?? 'Not available on this estate.'}
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Question</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Intent</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usage.recent_turns.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                      No recent turns recorded for this module.
                    </td>
                  </tr>
                )}
                {usage.recent_turns.map((turn) => (
                  <tr key={turn.id}>
                    <td className="px-3 py-2 text-foreground">{turn.question}</td>
                    <td className="px-3 py-2 text-muted-foreground">{turn.intent ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{turn.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{turn.created_at ?? '—'}</td>
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

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
