'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bot, Lock, Pause, Play, RefreshCw } from 'lucide-react';

import { AgentManagement } from '@/app/enterprise-brain/automation/agents/_components/AgentManagement';
import { RunAgentDialog } from '@/app/enterprise-brain/automation/agents/_components/RunAgentDialog';
import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { usePermission } from '@/app/hooks/usePermission';
import { createAgent, fetchAgents, fetchRuns, setAgentStatus } from '@/lib/agents/client';
import { findTool, rbacModuleKey } from '@/lib/agents/registry';
import type { Agent, AgentRun, CreateAgentInput } from '@/lib/agents/types';

/**
 * Fees → AI Stack → Automations.
 *
 * The first module screen on the central Agent Management engine, and the
 * pattern every other module should copy: this file owns NO agent logic. It
 * describes one preset — the "Fee reminder drafter" — and asks the engine
 * (lib/agents via /api/agents) to create, run and log it exactly as the central
 * console would. Underneath, the same `AgentManagement` component renders,
 * scoped to `module="fees"`, so the Fees admin sees only Fees agents and their
 * runs while the Enterprise Brain console sees everything.
 *
 * WHY THIS AGENT FIRST. It drafts text and sends nothing: `fees.draft_reminder`
 * is `draft` risk, touches no fee record, and its output is a message a person
 * still has to read and choose to send. Every run is logged against the person
 * who pressed Run, under `agents.fees` rights.
 *
 * The preset is recognised by name within the tenant; v1 has no preset key
 * column, and the name is fixed here rather than typed by the operator.
 */

const MODULE = 'fees';

export const FEE_REMINDER_PRESET: CreateAgentInput = {
  name: 'Fee reminder drafter',
  description: 'Drafts a fee reminder message for one family. Sends nothing.',
  module: MODULE,
  tools_allowed: ['fees.draft_reminder'],
  instructions:
    'Write a short, plain-language reminder a parent can read in under a minute. Keep it respectful; never threaten. Mention the amount and the due date when they are given.',
  status: 'active',
};

export function FeesAutomationsScreen() {
  const agents = useBrainResource(() => fetchAgents({ module: MODULE }), []);
  const runs = useBrainResource(() => fetchRuns({ module: MODULE, limit: 50 }), []);
  const canCreate = usePermission(rbacModuleKey(MODULE), 'create');
  const canRun = usePermission(rbacModuleKey(MODULE), 'update');

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  const preset = useMemo(
    () => (agents.data ?? []).find((agent) => agent.name === FEE_REMINDER_PRESET.name && agent.status !== 'archived') ?? null,
    [agents.data],
  );
  const presetRuns = useMemo(() => (runs.data ?? []).filter((run) => preset && run.agent_id === preset.id).slice(0, 5), [runs.data, preset]);
  const tool = findTool(FEE_REMINDER_PRESET.tools_allowed[0]);

  const refreshAll = useCallback(() => {
    agents.refresh();
    runs.refresh();
    setConsoleKey((key) => key + 1);
  }, [agents, runs]);

  const enable = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const agent = await createAgent(FEE_REMINDER_PRESET);
      setNote(`${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`);
      refreshAll();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : 'The agent could not be enabled.');
    } finally {
      setBusy(false);
    }
  }, [refreshAll]);

  const toggle = useCallback(async () => {
    if (!preset) return;
    setBusy(true);
    setNote(null);
    const next = preset.status === 'active' ? 'paused' : 'active';
    try {
      await setAgentStatus(preset.id, next);
      setNote(`${preset.name} is now ${next}.`);
      refreshAll();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
    } finally {
      setBusy(false);
    }
  }, [preset, refreshAll]);

  const rightsNote =
    canCreate === false && !preset
      ? `Your role cannot enable agents for Fees. Ask an administrator for ${rbacModuleKey(MODULE)} create rights.`
      : canRun === false && preset
        ? `Your role can see this agent but cannot run or pause it (${rbacModuleKey(MODULE)} update rights).`
        : null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Bot size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">{FEE_REMINDER_PRESET.name}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{FEE_REMINDER_PRESET.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Tool <span className="font-mono">{tool?.key}</span> · {tool?.risk} risk · runs as the signed-in user · logged under{' '}
                <span className="font-mono">{rbacModuleKey(MODULE)}</span>
                {preset && (
                  <>
                    {' '}
                    · <span className="font-mono">{preset.id}</span> ·{' '}
                    <span className={preset.status === 'active' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>{preset.status}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={agents.refreshing || runs.refreshing}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:opacity-60"
            >
              <RefreshCw size={14} className={agents.refreshing || runs.refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            {agents.loading && !agents.data ? (
              <span className="text-xs text-slate-400">Checking…</span>
            ) : preset ? (
              <>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={busy || canRun !== true}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {preset.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  {preset.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  onClick={() => setRunning(preset)}
                  disabled={busy || preset.status !== 'active' || canRun !== true}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={14} />
                  Draft a reminder
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enable}
                disabled={busy || canCreate !== true}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Enabling…' : 'Enable agent'}
              </button>
            )}
          </div>
        </div>

        {agents.error && !agents.data && <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">{agents.error}</p>}
        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {note && <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">{note}</p>}

        {preset && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Recent drafts</p>
            {presetRuns.length ? (
              <ul className="mt-2 divide-y divide-slate-100">
                {presetRuns.map((run) => (
                  <RecentRun key={run.id} run={run} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No drafts yet. Press “Draft a reminder” to make the first one; it will appear here and in the run log.</p>
            )}
          </div>
        )}
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">All Fees agents</h3>
        <AgentManagement key={consoleKey} moduleFilter={MODULE} embedded />
      </div>

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={() => setRunning(null)}
          onRan={() => {
            runs.refresh();
            setConsoleKey((key) => key + 1);
          }}
        />
      )}
    </div>
  );
}

function RecentRun({ run }: { run: AgentRun }) {
  const when = new Date(run.started_at);
  const message = typeof run.output?.message === 'string' ? run.output.message : null;
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-slate-500">{run.id}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${run.status === 'success' ? 'bg-emerald-50 text-emerald-600' : run.status === 'denied' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
          {run.status}
        </span>
        <span className="text-slate-500">
          {Number.isNaN(when.getTime()) ? run.started_at : when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · by{' '}
          {run.acting_user_name || run.acting_user_id} ({run.acting_profile_name || 'role unknown'})
        </span>
      </div>
      {message ? (
        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs text-slate-700">{message}</pre>
      ) : (
        run.error && <p className="mt-1 text-xs text-amber-700">{run.error}</p>
      )}
    </li>
  );
}
