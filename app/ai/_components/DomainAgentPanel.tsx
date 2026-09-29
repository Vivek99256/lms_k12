'use client';

/**
 * The central console's window onto one module's backend domain agent — the same
 * `ai_agents` manifest `app/_components/ai-stack/automations-screen.tsx`'s top panel
 * reads from inside a module's own AI Stack &rarr; Automations tab. Read-only here: running
 * the agent or deciding an approval stays that module's own screen, since that action is
 * consequential and belongs where the module's own context (filters, the record on
 * screen) already is. Visibility is what was asked for centrally; write is a natural,
 * separate follow-up on the same data once this lands.
 *
 * WHERE THE MODULE &rarr; AGENT BINDING COMES FROM
 *
 * `listLifecycleModules()` (`GET /api/ai/ask/modules`) is the same lookup the chatbot's
 * own module resolution uses — it reports each module's bound `agent_key`/`workflow_key`,
 * verified against real `ai_agents`/`workflow_definitions` rows on the backend (never a
 * per-module frontend descriptor this panel would otherwise have to import one by one).
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Loader2 } from 'lucide-react';

import { listAgentRuns, listAgents, listLifecycleModules, listPendingApprovals } from '@/lib/intelligence/client';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import type { LifecycleModule, PendingApproval } from '@/lib/intelligence/types';
import { ModulePicker } from './ModulePicker';

interface AgentManifestRow {
  agent_key?: string;
  name?: string;
  purpose?: string;
  description?: string;
  max_verb?: string;
  may_execute_actions?: boolean | number;
  status?: number;
  [key: string]: unknown;
}

export function DomainAgentPanel() {
  const [modules, setModules] = useState<LifecycleModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [manifest, setManifest] = useState<AgentManifestRow | null>(null);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const context = readModuleWorkspaceSession();

    listLifecycleModules(context)
      .then((result) => {
        if (cancelled) return;
        setModules(result.modules);
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
  }, []);

  const selected = useMemo(() => modules.find((module) => module.key === moduleKey) ?? null, [modules, moduleKey]);

  useEffect(() => {
    if (!selected?.agent_key) {
      setManifest(null);
      setRuns([]);
      setApprovals([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    const context = readModuleWorkspaceSession();
    const agentKey = selected.agent_key;

    Promise.allSettled([
      listAgents(context, 'k12'),
      listAgentRuns(context, agentKey, 20),
      listPendingApprovals(context, 50),
    ]).then(([agentList, runList, approvalList]) => {
      if (cancelled) return;

      if (agentList.status === 'fulfilled') {
        const found = (agentList.value.agents ?? []).find(
          (row) => (row as AgentManifestRow).agent_key === agentKey,
        ) as AgentManifestRow | undefined;
        setManifest(found ?? null);
      } else {
        setError(agentList.reason instanceof Error ? agentList.reason.message : 'The agent registry could not be read.');
      }

      setRuns(runList.status === 'fulfilled' ? (runList.value.runs ?? []) : []);
      setApprovals(
        approvalList.status === 'fulfilled'
          ? (approvalList.value.approvals ?? []).filter((approval) => approval.workflow_key === selected.workflow_key)
          : [],
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Bot className="size-4" />
            Domain agent, by module
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The chatbot&rsquo;s own registered agent for one module — the exact manifest, run log and approval
            queue its AI Stack &rarr; Automations tab shows. Running it or deciding an approval stays that
            module&rsquo;s own screen.
          </p>
        </div>
        <ModulePicker modules={modules} value={moduleKey} onChange={setModuleKey} allowAll={false} loading={loading} />
      </div>

      {!moduleKey ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Select a module to see its bound agent.
        </div>
      ) : loading ? (
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
        </div>
      ) : !selected?.agent_key ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {selected?.depth_reason ?? `${selected?.label ?? moduleKey} has no agent of its own yet.`}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{manifest?.name ?? selected.agent_key}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${manifest?.status ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {manifest?.status ? 'Active' : 'Unregistered'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{manifest?.purpose ?? manifest?.description ?? 'No description recorded.'}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono">{selected.agent_key}</span> · may {manifest?.max_verb ?? 'recommend'} ·{' '}
              {manifest?.may_execute_actions ? 'may execute approved actions' : 'never acts on its own'} · bound to{' '}
              <span className="font-mono">{selected.workflow_key ?? 'no workflow'}</span>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Recent runs</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {runs.length === 0 && <li>No runs recorded yet.</li>}
                {runs.slice(0, 10).map((run, index) => (
                  <li key={index} className="border-b border-border/60 pb-1.5 last:border-0">
                    {String(run.status ?? 'unknown')} · {String(run.created_at ?? run.started_at ?? '—')}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Pending approvals</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {approvals.length === 0 && <li>Nothing waiting on a decision.</li>}
                {approvals.map((approval) => (
                  <li key={approval.id} className="border-b border-border/60 pb-1.5 last:border-0">
                    Approval #{approval.id} · {approval.subject_entity_key ?? 'record'} #{approval.subject_id ?? '—'} · requested{' '}
                    {approval.created_at ?? '—'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
