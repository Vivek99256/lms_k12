'use client';

/**
 * Guardrails — the central console's window onto one module's enforcement, computed the
 * same way `app/_components/ai-stack/guardrails-screen.tsx` computes it inside a module's
 * own AI Stack tab: no dedicated table, five real sources read live (module capability
 * flags, template `requires_review`, `ai_policies`, `agents.<module>` rights, tool risk
 * annotations), via `fetchModuleGuardrails(moduleKey)`. Selecting a module here reads that
 * exact call — not a second guardrails engine.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { CapabilityShell } from '../_components/CapabilityShell';
import { ModulePicker } from '../_components/ModulePicker';
import { fetchTemplateOptions, type TemplateModule } from '@/lib/intelligence/ai-templates';
import { fetchModuleGuardrails, type AiModuleGuardrails } from '@/lib/intelligence/ai-module';

export default function AiGuardrailsPage() {
  return (
    <CapabilityShell slug="guardrails">
      <ModuleGuardrails />
    </CapabilityShell>
  );
}

function ModuleGuardrails() {
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [data, setData] = useState<AiModuleGuardrails | null>(null);
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

    fetchModuleGuardrails(moduleKey)
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
          <h2 className="text-base font-semibold text-foreground">Guardrails, by module</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What is actually enforced for one module — read live from the same five places its own AI Stack
            &rarr; Guardrails tab reads, not a separate rule set.
          </p>
        </div>
        <ModulePicker modules={modules} value={moduleKey} onChange={setModuleKey} allowAll={false} loading={loading} />
      </header>

      {!moduleKey ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Select a module to load its guardrails.
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
      ) : data ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4" />
              Capabilities enabled
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(data.capabilities).map(([key, enabled]) => (
                <span
                  key={key}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {key}: {enabled ? 'on' : 'off'}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Review requirements</h3>
            {data.review.available ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.review.templates} template{data.review.templates === 1 ? '' : 's'}, {data.review.published} published,{' '}
                {data.review.requires_review} requiring human review, {data.review.allowed_as_evidence} allowed as evidence.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {(data.review as { reason?: string }).reason ?? 'Not available yet.'}
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Reference</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Purpose</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.refusals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                      No refused requests recorded for this module.
                    </td>
                  </tr>
                )}
                {data.refusals.map((refusal) => (
                  <tr key={refusal.id}>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{refusal.reference}</td>
                    <td className="px-3 py-2 text-muted-foreground">{refusal.purpose ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{refusal.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{refusal.reason ?? '—'}</td>
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
