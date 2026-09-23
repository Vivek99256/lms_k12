'use client';

/**
 * Attendance → AI Stack → Automations.
 *
 * ONE AGENT REGISTRY, NOT TWO
 *
 * This is the point of the tab. The Attendance Agent shown at the top is the row in
 * `ai_agents` keyed `k12_attendance` — the same manifest the chatbot resolves when
 * somebody asks "show me students with attendance below 75%", run through the same
 * `AgentRunner`, writing to the same `ai_cases`, `ai_evidence`, `ai_recommendations` and
 * `workflow_approvals`. There is no AI-Stack copy of it. Change the manifest and both the
 * chatbot and this screen change together, because there is only one thing to change.
 *
 * That matters because the alternative is what it replaces: an agent visible in the
 * assistant and absent from the console, or worse, two agents with the same name doing
 * subtly different things depending on which screen you opened.
 *
 * TWO KINDS OF AUTOMATION, AND THE DIFFERENCE IS REAL
 *
 * 1. The Attendance Agent (top). A backend domain agent. It detects, opens a case per
 *    student, cites the recorded absences as evidence, explains, and drafts a follow-up
 *    that stops at a human approval. `max_verb = recommend` — it cannot act.
 *
 * 2. Tool agents (bottom). Configurations on the central Agent Management engine, scoped
 *    to `module="attendance"`, each allowed one or more read/draft tools. These are what
 *    an operator builds for themselves; the presets are simply the useful ones written
 *    out so nobody has to re-derive a tool allow-list.
 *
 * Both read the school's own records as the person who pressed Run. Neither can mark a
 * register: every attendance tool is annotated `read_only` on the backend.
 *
 * PERMISSIONS
 *
 * The tool agents are gated on `agents.attendance`, asked of Laravel through the same
 * `/api/permissions` endpoint every content screen uses, and re-checked server-side by
 * `/api/agents` before anything is created or run. The key is registered in
 * `config/rbac_modules.php` and has a `tblmenumaster` row behind it, so it is a right an
 * administrator can actually grant — which is exactly what the Fees version of this
 * screen could not say when it shipped, and the reason it told people to ask for a right
 * that did not exist.
 *
 * The Attendance Agent is deliberately NOT gated on that key in this client. Its
 * authority is the manifest's own `allowed_roles` and `required_permissions`, enforced by
 * `AgentRunner` on the server. Adding a second, different frontend gate in front of it
 * would mean a user who is allowed to run it is told they are not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Workflow,
  XCircle,
} from 'lucide-react';

import { AgentManagement } from '@/app/enterprise-brain/automation/agents/_components/AgentManagement';
import { RunAgentDialog } from '@/app/enterprise-brain/automation/agents/_components/RunAgentDialog';
import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { usePermission } from '@/app/hooks/usePermission';
import { createAgent, fetchAgents, fetchRuns, setAgentStatus } from '@/lib/agents/client';
import { findTool, rbacModuleKey } from '@/lib/agents/registry';
import type { Agent, AgentRun, CreateAgentInput } from '@/lib/agents/types';
import {
  listAgentRuns,
  listAgents,
  listPendingApprovals,
  resolveApproval,
  runAgent,
} from '@/lib/intelligence/client';
import type { AgentRunResult, PendingApproval } from '@/lib/intelligence/types';
import {
  ATTENDANCE_MODULE,
  logAttendanceOperation,
  readAttendanceWorkspaceSession,
} from '@/lib/attendance/attendance-ai-stack';

import { AiStackCard, AiStackCardHeading, AiStackPill, formatWhen } from './attendance-ai-chrome';

/** The manifest this module is bound to in `config/ai.php`. */
const AGENT_KEY = 'k12_attendance';

/** The workflow that manifest is authorised to put a recommendation to. */
const WORKFLOW_KEY = 'attendance_followup';

// ---------------------------------------------------------------------------
// Tool-agent presets
// ---------------------------------------------------------------------------

/**
 * Each preset is exactly the `CreateAgentInput` the Create Agent form would submit,
 * offered as one button. Enabling one writes an ordinary agent that then behaves like any
 * other — there is no second mechanism here.
 */
const LOW_ATTENDANCE_ANALYST: CreateAgentInput = {
  name: 'Low attendance analyst',
  description: 'Reads the marked register and reports who is attending least. Changes nothing.',
  module: ATTENDANCE_MODULE,
  tools_allowed: ['attendance.low_attendance'],
  instructions:
    'Report only what the register returns. Always state how many students had enough marked days to judge against how many are in scope, so a partial register is never read as a finding about the whole cohort. Never state or imply why a student was absent.',
  status: 'active',
};

const STUDENT_ATTENDANCE_READER: CreateAgentInput = {
  name: 'Student attendance reader',
  description: "Reads one student's present and absent days and the dates they were absent. Changes nothing.",
  module: ATTENDANCE_MODULE,
  tools_allowed: ['attendance.student_record'],
  instructions:
    'Report the days exactly as the register records them. If there are too few marked days to state a rate, say so rather than computing one from what little there is.',
  status: 'active',
};

const PARENT_NOTE_DRAFTER: CreateAgentInput = {
  name: 'Attendance note drafter',
  description: "Drafts a short note to one family about their child's attendance. Sends nothing.",
  module: ATTENDANCE_MODULE,
  tools_allowed: ['attendance.draft_parent_note'],
  instructions:
    'Write a short, respectful note a parent can read in under a minute. State only the days and the rate you are given. Never suggest a reason for the absence and never suggest the family is at fault — ask them to tell the school if there is something it should know.',
  status: 'active',
};

/** Reads first: the two that answer from records, then the one that drafts text. */
const ATTENDANCE_PRESETS: CreateAgentInput[] = [
  LOW_ATTENDANCE_ANALYST,
  STUDENT_ATTENDANCE_READER,
  PARENT_NOTE_DRAFTER,
];

// ---------------------------------------------------------------------------

/** The manifest as `/api/ai/agents` returns it. Loosely typed — it is a config row. */
interface AgentManifestRow {
  agent_key?: string;
  name?: string;
  purpose?: string;
  description?: string;
  max_verb?: string;
  may_execute_actions?: boolean | number;
  authorized_workflow_keys?: string[] | string;
  allowed_roles?: string[];
  allowed_tools?: string[];
  [key: string]: unknown;
}

/** One case the Attendance Agent opened, as its own output schema describes it. */
interface AttendanceCase {
  case_id: number;
  student_id: number;
  student_name: string;
  standard_name?: string | null;
  division_name?: string | null;
  attendance_rate?: number;
  present_days?: number;
  absent_days?: number;
  window_days?: number;
  severity?: string;
  signals?: Array<{ evidence?: unknown[]; evidence_count?: number; headline?: string }>;
  explanation?: { narrative?: string; governance_passed?: boolean; reason_refused?: string | null };
  recommendation?: {
    id?: number | null;
    status?: string;
    governance_passed?: boolean;
    reason_refused?: string | null;
    title?: string;
    workflow_key?: string;
  } | null;
}

export function AttendanceAutomationsScreen() {
  // Tool agents, on the central Agent Management engine.
  const agents = useBrainResource(() => fetchAgents({ module: ATTENDANCE_MODULE }), []);
  const runs = useBrainResource(() => fetchRuns({ module: ATTENDANCE_MODULE, limit: 100 }), []);
  const canCreate = usePermission(rbacModuleKey(ATTENDANCE_MODULE), 'create');
  const canRun = usePermission(rbacModuleKey(ATTENDANCE_MODULE), 'update');

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  /** The agent each preset resolves to in this tenant, matched by name. */
  const configured = useMemo(() => {
    const map = new Map<string, Agent>();

    for (const preset of ATTENDANCE_PRESETS) {
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
        setNote(
          `${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`,
        );
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

  /**
   * What to say about rights, and only when it is actually the obstacle.
   *
   * It names the key, because the whole failure this replaces was a message that told
   * people to ask for a right without saying what it was called.
   */
  const rightsNote =
    canCreate === false && configured.size === 0
      ? `Your role cannot enable tool agents for Attendance. Ask an administrator for ${rbacModuleKey(
          ATTENDANCE_MODULE,
        )} create rights — the key is registered and grantable in Group-wise Rights.`
      : canRun === false && configured.size > 0
        ? `Your role can see these agents but cannot run or pause them (${rbacModuleKey(
            ATTENDANCE_MODULE,
          )} update rights).`
        : null;

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className="space-y-6">
      <AttendanceAgentPanel />

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">Attendance tool agents</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Each one runs on the central Agent Management engine, scoped to Attendance. The two read agents answer
              from this school&apos;s own register; the drafter writes text and sends nothing. Every run is recorded
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
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">
            {agents.error}
          </p>
        )}
        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {note && (
          <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">
            {note}
          </p>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {ATTENDANCE_PRESETS.map((preset) => (
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
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Attendance agent management</h3>
        <AgentManagement key={consoleKey} moduleFilter={ATTENDANCE_MODULE} embedded />
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

// ---------------------------------------------------------------------------
// The backend Attendance Agent — the one the chatbot uses
// ---------------------------------------------------------------------------

/** The execution stages a run passes through, in the order a reader should see them. */
type StageState = 'pending' | 'ran' | 'skipped' | 'failed';

interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
}

function AttendanceAgentPanel() {
  const [manifest, setManifest] = useState<AgentManifestRow | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [loading, setLoading] = useState(true);

  const [limit, setLimit] = useState('50');
  const [studentId, setStudentId] = useState('');
  const [days, setDays] = useState('90');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState('');

  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [deciding, setDeciding] = useState<number | null>(null);
  const [token, setToken] = useState(0);

  // `setLoading(true)` lives here rather than in the effect body. Calling setState
  // synchronously inside an effect triggers a cascading render, and the lint rule that
  // catches it is right — the spinner belongs to the act of asking for a reload, not to
  // the effect that carries it out. Same shape as the other tabs in this folder.
  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const context = readAttendanceWorkspaceSession();

    // Settled, not all: the manifest, the run log and the approval queue are three reads
    // and one failing must not blank the other two.
    void Promise.allSettled([
      listAgents(context, 'k12'),
      listAgentRuns(context, AGENT_KEY, 20),
      listPendingApprovals(context, 50),
    ]).then(([agentList, runList, approvalList]) => {
      if (cancelled) return;

      if (agentList.status === 'fulfilled') {
        const found = (agentList.value.agents ?? []).find(
          (row) => (row as AgentManifestRow).agent_key === AGENT_KEY,
        ) as AgentManifestRow | undefined;

        setManifest(found ?? null);
        setManifestError(
          found
            ? ''
            : 'No active manifest for the Attendance Agent is registered for your role on this estate. It cannot run until an administrator registers one.',
        );
      } else {
        setManifestError(
          agentList.reason instanceof Error ? agentList.reason.message : 'The agent registry could not be read.',
        );
      }

      setHistory(runList.status === 'fulfilled' ? (runList.value.runs ?? []) : []);
      setApprovals(
        approvalList.status === 'fulfilled'
          ? (approvalList.value.approvals ?? []).filter((approval) => approval.workflow_key === WORKFLOW_KEY)
          : [],
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRunError('');

    /** A positive integer, or undefined so the backend applies its own default. */
    const positive = (value: string) => {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };

    const input = Object.fromEntries(
      Object.entries({
        limit: positive(limit),
        subject_id: positive(studentId),
        // The window matters more here than any other filter. A sweep over too few
        // marked days finds students but cannot cite enough of the register to support a
        // recommendation, so it detects and then stops — which reads as the agent being
        // broken when it is being careful.
        days: positive(days),
        standard_id: positive(standardId),
        division_id: positive(divisionId),
      }).filter(([, value]) => value !== undefined),
    );

    try {
      const outcome = await runAgent(readAttendanceWorkspaceSession(), AGENT_KEY, input);

      setResult(outcome);

      logAttendanceOperation('attendance_agent_run', {
        status: outcome.status === 'completed' ? 'completed' : 'failed',
        message: outcome.summary,
        agentRunId: outcome.run_id === null ? null : String(outcome.run_id),
        result: {
          status: outcome.status,
          filters: input,
          ...outcome.counters,
        },
      });

      reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The agent could not be run.';
      setRunError(message);
      // Recorded as a failure rather than swallowed: a run that was refused is a thing
      // the Activity tab should show, and it is the only place the reason survives.
      logAttendanceOperation('attendance_agent_run', { status: 'failed', message });
    } finally {
      setRunning(false);
    }
  };

  const decide = async (approval: PendingApproval, decision: 'approved' | 'rejected') => {
    setDeciding(approval.id);
    setApprovalNote('');

    try {
      const summary = await resolveApproval(readAttendanceWorkspaceSession(), approval.id, decision);
      setApprovalNote(
        `Approval #${approval.id} ${decision}. The ${WORKFLOW_KEY} run is now ${summary.status}${
          summary.current_step ? ` at "${summary.current_step}"` : ''
        }.`,
      );
      reload();
    } catch (cause) {
      setApprovalNote(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
    } finally {
      setDeciding(null);
    }
  };

  const cases = useMemo<AttendanceCase[]>(() => {
    // Cast rather than typed: `AgentRunResult.cases` is declared as the academic agent's
    // finding shape, and the Attendance agent's own output schema is a different (and
    // narrower) set of fields. Reading it through this module's own interface keeps the
    // shared type honest for its original caller instead of widening it for this one.
    const found = result?.result?.cases;

    return Array.isArray(found) ? (found as unknown as AttendanceCase[]) : [];
  }, [result]);

  const stages = useMemo(() => buildStages(result, runError, cases, approvals.length), [
    result,
    runError,
    cases,
    approvals.length,
  ]);

  const workflowKeys = useMemo(() => {
    const raw = manifest?.authorized_workflow_keys;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',').map((key) => key.trim()).filter(Boolean);
    return [];
  }, [manifest]);

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="Attendance Agent"
        hint="The same registered agent the chatbot runs. One manifest, one run log, one approval queue."
        actions={
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Refresh
          </button>
        }
      />

      <div className="space-y-5 p-5">
        {manifestError && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {manifestError}
          </p>
        )}

        {manifest && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Bot size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{manifest.name ?? 'Attendance Agent'}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{manifest.purpose ?? manifest.description}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{AGENT_KEY}</span>
                  <AiStackPill tone="blue">may {String(manifest.max_verb ?? 'recommend')}</AiStackPill>
                  {/* The single most important fact about this agent, so it is stated
                      rather than left to be inferred from the absence of a button. */}
                  <AiStackPill tone={manifest.may_execute_actions ? 'amber' : 'green'}>
                    {manifest.may_execute_actions ? 'can execute actions' : 'cannot act without a person'}
                  </AiStackPill>
                  {workflowKeys.map((key) => (
                    <span key={key} className="inline-flex items-center gap-1 font-mono">
                      <Workflow size={11} />
                      {key}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Window (days)</span>
                <input
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Students to sweep</span>
                <input
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Standard (optional)</span>
                <input
                  value={standardId}
                  onChange={(event) => setStandardId(event.target.value)}
                  inputMode="numeric"
                  placeholder="all"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Division (optional)</span>
                <input
                  value={divisionId}
                  onChange={(event) => setDivisionId(event.target.value)}
                  inputMode="numeric"
                  placeholder="all"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">One student (optional)</span>
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  inputMode="numeric"
                  placeholder="student id"
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={running}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Play className="size-4" />
                {running ? 'Running…' : 'Run agent'}
              </button>

              <p className="text-[11px] leading-4 text-slate-500">
                The institute and academic year come from your session, not from this form. A short window finds fewer
                marked days, and a case the register cannot evidence stops before it reaches an approval.
              </p>
            </div>
          </div>
        )}

        {runError && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {runError}
          </p>
        )}

        {(result || runError) && <StageTrace stages={stages} />}

        {result && cases.length > 0 && <CaseList cases={cases} />}

        {result && cases.length === 0 && !runError && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {result.result?.message ?? result.summary}
          </p>
        )}

        <ApprovalQueue
          approvals={approvals}
          deciding={deciding}
          note={approvalNote}
          onDecide={(approval, decision) => void decide(approval, decision)}
        />

        <RunHistory runs={history} />
      </div>
    </AiStackCard>
  );
}

/**
 * The stages a run actually passed through, derived from what came back.
 *
 * Every state here is read off the result rather than assumed from a successful HTTP
 * status. A run that opened no case reports `skipped` on the stages that depend on one,
 * and a refused recommendation reports the governance reason — so a partly-completed run
 * is never shown as a finished one. That is the requirement: if a stage failed, say which.
 */
function buildStages(
  result: AgentRunResult | null,
  runError: string,
  cases: AttendanceCase[],
  pendingApprovals: number,
): Stage[] {
  if (runError) {
    return [
      { key: 'request', label: 'Your request', state: 'ran', detail: 'Sent to the Attendance Agent.' },
      { key: 'agent', label: 'Agent', state: 'failed', detail: runError },
      { key: 'data', label: 'Attendance data', state: 'pending', detail: 'Not reached.' },
    ];
  }

  if (!result) return [];

  const counters = result.counters ?? {
    signals_detected: 0,
    evidence_collected: 0,
    cases_opened: 0,
    recommendations_drafted: 0,
  };

  const withRecommendation = cases.filter((entry) => entry.recommendation?.id);
  const refused = cases.filter(
    (entry) => entry.recommendation && entry.recommendation.governance_passed === false,
  );
  const awaiting = withRecommendation.filter((entry) => entry.recommendation?.status === 'pending_approval');

  return [
    { key: 'request', label: 'Your request', state: 'ran', detail: 'Sweep the register for students below the bar.' },
    {
      key: 'agent',
      label: 'Agent',
      state: result.status === 'completed' ? 'ran' : 'failed',
      detail: `${AGENT_KEY} finished as ${result.status}.`,
    },
    {
      key: 'data',
      label: 'Real attendance data',
      state: counters.signals_detected > 0 ? 'ran' : 'skipped',
      detail:
        counters.signals_detected > 0
          ? `${counters.signals_detected} signal(s) raised from the marked register.`
          : 'No student in scope met the threshold, or too few days were marked to judge.',
    },
    {
      key: 'evidence',
      label: 'Evidence',
      state: counters.evidence_collected > 0 ? 'ran' : 'skipped',
      detail:
        counters.evidence_collected > 0
          ? `${counters.evidence_collected} record(s) stored and cited — rates and the days marked absent.`
          : 'Nothing to cite, because nothing was detected.',
    },
    {
      key: 'analysis',
      label: 'Analysis',
      state: counters.cases_opened > 0 ? 'ran' : 'skipped',
      detail:
        counters.cases_opened > 0
          ? `${counters.cases_opened} case(s) opened, each explained from its own cited evidence.`
          : 'No case was warranted at the configured severity.',
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      state: counters.recommendations_drafted > 0 ? 'ran' : refused.length > 0 ? 'failed' : 'skipped',
      detail:
        counters.recommendations_drafted > 0
          ? `${counters.recommendations_drafted} follow-up drafted.${
              refused.length ? ` ${refused.length} refused by governance.` : ''
            }`
          : refused.length > 0
            ? `${refused.length} refused by governance — see the reason on each case below.`
            : 'Nothing to recommend.',
    },
    {
      key: 'approval',
      label: 'Human approval',
      state: awaiting.length > 0 || pendingApprovals > 0 ? 'pending' : 'skipped',
      detail:
        awaiting.length > 0 || pendingApprovals > 0
          ? `Waiting on a person. ${pendingApprovals} approval(s) in the queue below.`
          : 'Nothing is waiting at this gate.',
    },
    {
      key: 'action',
      label: 'Action',
      state: 'pending',
      // Stated plainly, because "pending" on this row is not a delay — it is the design.
      detail: 'This agent may not act. Any action follows a person approving it.',
    },
  ];
}

function StageTrace({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  const tone: Record<StageState, string> = {
    ran: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    pending: 'border-amber-200 bg-amber-50 text-amber-900',
    skipped: 'border-slate-200 bg-slate-50 text-slate-600',
    failed: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">What happened</p>
      <ol className="mt-3 space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.key} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${tone[stage.state]}`}>
            <span className="mt-0.5 shrink-0 text-[11px] font-semibold tabular-nums opacity-60">{index + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {stage.label}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wide opacity-70">{stage.state}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 opacity-90">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CaseList({ cases }: { cases: AttendanceCase[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Cases opened ({cases.length})
      </p>

      {cases.map((entry) => (
        <div key={entry.case_id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">
              {entry.student_name}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {[entry.standard_name, entry.division_name].filter(Boolean).join(' / ') || '—'}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {entry.severity && <AiStackPill tone={severityTone(entry.severity)}>{entry.severity}</AiStackPill>}
              <span className="font-mono text-[11px] text-slate-500">case #{entry.case_id}</span>
            </div>
          </div>

          <p className="mt-1 text-xs text-slate-600">
            {/* Every figure here came from the agent's own result. Nothing is recomputed
                in the browser, so this cannot disagree with the case record. */}
            {typeof entry.attendance_rate === 'number'
              ? `${(entry.attendance_rate * 100).toFixed(1)}% attendance`
              : 'rate not reported'}
            {typeof entry.present_days === 'number' && typeof entry.absent_days === 'number'
              ? ` · present ${entry.present_days}, absent ${entry.absent_days}`
              : ''}
            {entry.window_days ? ` · last ${entry.window_days} days` : ''}
          </p>

          {entry.explanation?.narrative && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              {entry.explanation.narrative}
            </p>
          )}

          {entry.explanation?.governance_passed === false && entry.explanation.reason_refused && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              Explanation refused: {entry.explanation.reason_refused}
            </p>
          )}

          {entry.recommendation && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <ChevronRight className="size-3.5 text-slate-400" />
              <span className="text-slate-700">{entry.recommendation.title ?? 'Follow-up drafted'}</span>
              <AiStackPill tone={entry.recommendation.status === 'pending_approval' ? 'amber' : 'gray'}>
                {entry.recommendation.status ?? 'drafted'}
              </AiStackPill>
              {entry.recommendation.governance_passed === false && entry.recommendation.reason_refused && (
                <span className="text-amber-700">refused: {entry.recommendation.reason_refused}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApprovalQueue({
  approvals,
  deciding,
  note,
  onDecide,
}: {
  approvals: PendingApproval[];
  deciding: number | null;
  note: string;
  onDecide: (approval: PendingApproval, decision: 'approved' | 'rejected') => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <Gavel className="size-3.5" />
        Waiting for a person ({approvals.length})
      </p>

      {note && (
        <p className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">{note}</p>
      )}

      {approvals.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Nothing from the attendance follow-up workflow is waiting on a decision.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {approvals.map((approval) => (
            <li
              key={approval.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <div className="min-w-0 text-xs text-amber-900">
                <p className="font-medium">
                  Approval #{approval.id} · run #{approval.run_id}
                  {approval.step_key ? ` · ${approval.step_key}` : ''}
                </p>
                <p className="mt-0.5 opacity-80">
                  {approval.subject_entity_key ? `${approval.subject_entity_key} #${approval.subject_id}` : 'no subject'}
                  {approval.case_id ? ` · case #${approval.case_id}` : ''}
                  {approval.expires_at ? ` · expires ${formatWhen(approval.expires_at)}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDecide(approval, 'approved')}
                  disabled={deciding === approval.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(approval, 'rejected')}
                  disabled={deciding === approval.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <XCircle className="size-3.5" />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunHistory({ runs }: { runs: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <ShieldCheck className="size-3.5" />
        Recent runs of this agent
      </p>

      {runs.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          No run of the Attendance Agent has been recorded for this school yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {runs.slice(0, 10).map((entry, index) => {
            const status = String(entry.status ?? 'unknown');

            return (
              <li key={String(entry.id ?? index)} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <AiStackPill
                  tone={status === 'completed' ? 'green' : status === 'rejected' ? 'amber' : status === 'failed' ? 'red' : 'gray'}
                >
                  {status}
                </AiStackPill>
                <span className="font-mono text-[11px] text-slate-500">{String(entry.run_reference ?? entry.id ?? '')}</span>
                <span className="text-slate-400">{formatWhen(String(entry.started_at ?? entry.created_at ?? ''))}</span>
                <span className="min-w-0 truncate">{String(entry.summary ?? entry.error ?? '')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function severityTone(severity: string): 'red' | 'amber' | 'blue' | 'gray' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'red';
    case 'high':
      return 'amber';
    case 'moderate':
      return 'blue';
    default:
      return 'gray';
  }
}

// ---------------------------------------------------------------------------
// Tool-agent preset card
// ---------------------------------------------------------------------------

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
  const lastRun = agent ? (runs.find((run) => run.agent_id === agent.id) ?? null) : null;

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
            <span
              className={
                agent.status === 'active' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'
              }
            >
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
            ·{' '}
            {new Date(lastRun.started_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            by {lastRun.acting_user_name || lastRun.acting_user_id}
            {lastRun.error && <span className="mt-0.5 block text-amber-700">{lastRun.error}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
