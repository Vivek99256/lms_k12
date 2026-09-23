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
 * describes a handful of presets and asks the engine (lib/agents via
 * /api/agents) to create, run and log them exactly as the central console
 * would. Underneath, the same `AgentManagement` component renders, scoped to
 * `module="fees"`, so the Fees admin gets the full console — agent library,
 * agent dashboard, create agent, run log and analytics — over Fees agents only,
 * while the Enterprise Brain console sees everything.
 *
 * WHAT THE PRESETS ARE FOR
 *
 * Create Agent is fully available in the console below, and a Fees admin can
 * build anything the module's tool catalogue allows. The presets are not a
 * separate mechanism: each is exactly the `CreateAgentInput` that form would
 * submit, offered as one button because the useful Fees agents are known and
 * making somebody re-derive a tool allow-list is not a feature. Enabling one
 * writes an ordinary agent that then behaves like any other.
 *
 * THESE AGENTS READ REAL FEE RECORDS
 *
 * `fees.list_defaulters` and `fees.collection_report` call the governed MCP
 * tools `fees.arrears` and `fees.collection_report` — the same read-only tools
 * the assistant uses — as the person who pressed Run, scoped to their institute
 * and academic year. Nothing is sampled, seeded or invented: a run either
 * returns the school's own rows or fails in the log saying why. Both are
 * annotated `read` on the backend, so neither can change a fee record, and
 * `fees.draft_reminder` sends nothing — its output is text a person still has to
 * read and choose to send.
 *
 * Every run is logged against the person who pressed Run, under `agents.fees`
 * rights. A preset is recognised by name within the tenant; v1 has no preset key
 * column, and the names are fixed here rather than typed by the operator.
 */

const MODULE = 'fees';

/** Kept as a named export because it is the canonical example of the preset shape. */
export const FEE_REMINDER_PRESET: CreateAgentInput = {
  name: 'Fee reminder drafter',
  description: 'Drafts a fee reminder message for one family. Sends nothing.',
  module: MODULE,
  tools_allowed: ['fees.draft_reminder'],
  instructions:
    'Write a short, plain-language reminder a parent can read in under a minute. Keep it respectful; never threaten. Mention the amount and the due date when they are given.',
  status: 'active',
};

const DEFAULTER_ANALYST_PRESET: CreateAgentInput = {
  name: 'Fee defaulter analyst',
  description: 'Reads the live fee records and reports who owes anything, and how much. Changes nothing.',
  module: MODULE,
  tools_allowed: ['fees.list_defaulters'],
  instructions:
    'Report only what the fee records return. Always state how many students were checked against the size of the cohort, so a partial sweep is never read as a school-wide figure.',
  status: 'active',
};

const COLLECTION_REPORTER_PRESET: CreateAgentInput = {
  name: 'Fee collection reporter',
  description: 'Reads what was actually collected over a date range, from the receipts. Changes nothing.',
  module: MODULE,
  tools_allowed: ['fees.collection_report'],
  instructions:
    'Report collections exactly as the receipts show them. Do not estimate a total for a period the report did not cover.',
  status: 'active',
};

/** Reads first: the two that answer from records, then the one that drafts text. */
const FEES_PRESETS: CreateAgentInput[] = [
  DEFAULTER_ANALYST_PRESET,
  COLLECTION_REPORTER_PRESET,
  FEE_REMINDER_PRESET,
];

export function FeesAutomationsScreen() {
  const agents = useBrainResource(() => fetchAgents({ module: MODULE }), []);
  const runs = useBrainResource(() => fetchRuns({ module: MODULE, limit: 100 }), []);
  const canCreate = usePermission(rbacModuleKey(MODULE), 'create');
  const canRun = usePermission(rbacModuleKey(MODULE), 'update');

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  /** The agent each preset resolves to in this tenant, matched by name. */
  const configured = useMemo(() => {
    const map = new Map<string, Agent>();

    for (const preset of FEES_PRESETS) {
      const match = (agents.data ?? []).find(
        (agent) => agent.name === preset.name && agent.status !== 'archived',
      );
      if (match) map.set(preset.name, match);
    }

    return map;
  }, [agents.data]);

  const refreshAll = useCallback(() => {
    agents.refresh();
    runs.refresh();
    setConsoleKey((key) => key + 1);
  }, [agents, runs]);

  const enable = useCallback(
    async (preset: CreateAgentInput) => {
      setBusy(preset.name);
      setNote(null);
      try {
        const agent = await createAgent(preset);
        setNote(`${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The agent could not be enabled.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const toggle = useCallback(
    async (agent: Agent) => {
      setBusy(agent.name);
      setNote(null);
      const next = agent.status === 'active' ? 'paused' : 'active';
      try {
        await setAgentStatus(agent.id, next);
        setNote(`${agent.name} is now ${next}.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const rightsNote =
    canCreate === false && configured.size === 0
      ? `Your role cannot enable agents for Fees. Ask an administrator for ${rbacModuleKey(MODULE)} create rights.`
      : canRun === false && configured.size > 0
        ? `Your role can see these agents but cannot run or pause them (${rbacModuleKey(MODULE)} update rights).`
        : null;

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">Fees agents</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Each one runs on the central Agent Management engine, scoped to Fees. The two read agents answer from
              this school&apos;s own fee records; the drafter writes text and sends nothing. Every run is recorded
              against the person who pressed Run.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {agents.error && !agents.data && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">{agents.error}</p>
        )}
        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {note && <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">{note}</p>}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {FEES_PRESETS.map((preset) => (
            <PresetCard
              key={preset.name}
              preset={preset}
              agent={configured.get(preset.name) ?? null}
              runs={runs.data ?? []}
              checking={agents.loading && !agents.data}
              busy={busy === preset.name}
              canCreate={canCreate === true}
              canRun={canRun === true}
              onEnable={() => void enable(preset)}
              onToggle={(agent) => void toggle(agent)}
              onRun={setRunning}
            />
          ))}
        </div>
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Fees agent management</h3>
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

function PresetCard({
  preset,
  agent,
  runs,
  checking,
  busy,
  canCreate,
  canRun,
  onEnable,
  onToggle,
  onRun,
}: {
  preset: CreateAgentInput;
  agent: Agent | null;
  runs: AgentRun[];
  checking: boolean;
  busy: boolean;
  canCreate: boolean;
  canRun: boolean;
  onEnable: () => void;
  onToggle: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
}) {
  const tool = findTool(preset.tools_allowed[0]);
  const lastRun = agent ? runs.find((run) => run.agent_id === agent.id) ?? null : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Bot size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{preset.name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{preset.description}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        <span className="font-mono">{tool?.key}</span> ·{' '}
        <span className={tool?.risk === 'read' ? 'text-emerald-700' : 'text-slate-500'}>{tool?.risk} risk</span>
        {tool?.kind === 'mcp' && <> · reads live records</>}
        {agent && (
          <>
            {' '}
            · <span className="font-mono">{agent.id}</span> ·{' '}
            <span className={agent.status === 'active' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
              {agent.status}
            </span>
          </>
        )}
      </p>

      <div className="mt-auto pt-4">
        {checking ? (
          <span className="text-xs text-slate-400">Checking…</span>
        ) : agent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRun(agent)}
              disabled={busy || agent.status !== 'active' || !canRun}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={12} />
              Run
            </button>
            <button
              type="button"
              onClick={() => onToggle(agent)}
              disabled={busy || !canRun}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {agent.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
              {agent.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnable}
            disabled={busy || !canCreate}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Enabling…' : 'Enable agent'}
          </button>
        )}

        {lastRun && (
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Last run{' '}
            <span
              className={
                lastRun.status === 'success'
                  ? 'font-semibold text-emerald-600'
                  : lastRun.status === 'denied'
                    ? 'font-semibold text-amber-600'
                    : 'font-semibold text-slate-600'
              }
            >
              {lastRun.status}
            </span>{' '}
            · {new Date(lastRun.started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{' '}
            by {lastRun.acting_user_name || lastRun.acting_user_id}
            {lastRun.error && <span className="mt-0.5 block text-amber-700">{lastRun.error}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
