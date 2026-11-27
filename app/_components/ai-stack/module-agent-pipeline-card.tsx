'use client';

/**
 * AI Stack → Automations: the continuous, sequential agent automation (Users, Attendance).
 *
 * The Teach/Learn model. Press Start once and the whole agent sequence runs by itself, cycle after
 * cycle, on the latest database data, until Stop is pressed. Nobody clicks Run per agent.
 *
 *   · The backend owns the switch (active / interval / next cycle). The scheduler continues a
 *     started automation even with this screen closed.
 *   · While this screen is open it runs the due cycle itself, one agent per request, so every agent
 *     is seen as it works. A lease on the backend means the browser and the scheduler never run the
 *     same cycle twice.
 *   · Each agent receives what the previous one handed over (held server-side, bound to the
 *     institute and the caller) and passes its output on only if its quality gate passes.
 *   · Stop cancels the cycle in flight before its next agent.
 *
 * This component owns no agent logic and no data: every count, row and check shown is what the
 * backend returned for the step that ran.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Bot,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Loader2,
  Network,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';

import {
  getPipelineEso,
  getPipelineState,
  PipelineError,
  runPipelineStep,
  setPipelineInterval,
  startPipelineAutomation,
  stopPipelineAutomation,
  type PipelineAction,
  type PipelineAgentSpec,
  type PipelineAutomation,
  type PipelineEso,
  type PipelineGate,
  type PipelineHandoff,
  type PipelineModule,
  type PipelineState,
  type PipelineStepResponse,
  type PipelineStepResult,
  type PipelineTable,
} from '@/lib/ai-pipeline/module-agent-pipeline-client';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

type Status = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface StepState {
  result: PipelineStepResult;
  gate: PipelineGate | null;
  failedReason?: string;
}

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'Waiting', cls: 'bg-slate-100 text-slate-600' },
  running: { label: 'Running', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Stopped at gate', cls: 'bg-red-50 text-red-700' },
  skipped: { label: 'Not needed', cls: 'bg-slate-100 text-slate-500' },
};

const INTERVALS = [
  { seconds: 60, label: 'every minute' },
  { seconds: 300, label: 'every 5 minutes' },
  { seconds: 900, label: 'every 15 minutes' },
  { seconds: 1800, label: 'every 30 minutes' },
  { seconds: 3600, label: 'every hour' },
];
const DAYS = [7, 14, 30, 60, 90];
const THRESHOLDS = [60, 65, 70, 75, 80, 85];

const fmt = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v));
const when = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');
const human = (v?: string | null) => (v ? v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—');

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'failed' && <XCircle className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h5>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm leading-6 text-slate-700">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          <span className="whitespace-pre-line">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionRow({ a }: { a: PipelineAction }) {
  const Icon = a.type === 'graph' ? Network : a.type === 'tool' ? Wrench : a.type === 'sql' ? Database : ShieldCheck;
  const kind = a.type === 'graph' ? 'Knowledge Graph' : a.type === 'tool' ? 'Tool' : a.type === 'sql' ? 'Database' : 'Check';
  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.success ? 'text-slate-500' : 'text-red-500'}`} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800">{a.tool} <span className="ml-1 font-normal text-slate-500">· {kind}</span></p>
        <p className="mt-0.5 break-words text-slate-500">{a.summary}</p>
        {a.pattern && <p className="mt-0.5 font-mono text-[11px] text-slate-500">{a.pattern}</p>}
      </div>
      <div className="shrink-0 text-right tabular-nums text-slate-500">
        {typeof a.rows === 'number' && <p>{a.rows.toLocaleString()} rows</p>}
        <p>{a.duration_ms} ms</p>
      </div>
    </li>
  );
}

function DataTable({ table }: { table: PipelineTable }) {
  if (table.rows.length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-700">{table.title}</p>
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">Nothing found.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-700">
        {table.title} <span className="font-normal text-slate-500">· showing {table.rows.length} of {table.total.toLocaleString()}</span>
      </p>
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>{table.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rows.map((row, i) => (
              <tr key={i} className="align-top">
                {table.columns.map((c) => <td key={c.key} className="px-3 py-2 text-slate-700">{fmt(row[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Checks({ checks }: { checks: Record<string, { status: string; message: string }> }) {
  return (
    <ul className="space-y-1.5">
      {Object.entries(checks).map(([key, c]) => (
        <li key={key} className="flex items-start gap-2 text-sm">
          {c.status === 'passed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
          <span className="text-slate-700"><span className="font-semibold">{key.replace(/_/g, ' ')}</span> — {c.message}</span>
        </li>
      ))}
    </ul>
  );
}

function AgentPanel({ spec, status, step, open, onToggle, prevName }: { spec: PipelineAgentSpec; status: Status; step: StepState | null; open: boolean; onToggle: () => void; prevName: string | null }) {
  const r = step?.result;
  return (
    <div className={`rounded-2xl border bg-white ${status === 'running' ? 'border-amber-300' : status === 'failed' ? 'border-red-200' : 'border-slate-200'}`}>
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${status === 'completed' ? 'bg-emerald-600 text-white' : status === 'failed' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{spec.order}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{spec.name} <span className="ml-1 font-mono text-[11px] font-normal text-slate-400">{spec.agent_id}</span></p>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{spec.purpose}</p>
        </div>
        {r && (
          <div className="hidden text-right text-xs tabular-nums text-slate-500 sm:block">
            <p>Fetched <b className="text-slate-800">{r.records.fetched.toLocaleString()}</b> · Processed <b className="text-slate-800">{r.records.processed.toLocaleString()}</b> · Produced <b className="text-slate-800">{r.records.produced.toLocaleString()}</b></p>
            <p className="mt-0.5 flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> {r.duration_ms} ms · gate {r.gate_score}%</p>
          </div>
        )}
        <StatusPill status={status} />
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Section title="What this agent does"><Bullets items={spec.tasks} /></Section>
            <Section title="What it reads">
              <ul className="space-y-1.5 text-sm text-slate-700">
                {spec.tables.length > 0 && <li className="flex gap-2"><Database className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />Tables: {spec.tables.join(', ')}</li>}
                {spec.graph.map((g) => <li key={g} className="flex gap-2"><Network className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="font-mono text-xs leading-6">{g}</span></li>)}
                {spec.tools.map((t) => <li key={t} className="flex gap-2"><Wrench className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />Tool: {t}</li>)}
              </ul>
              <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div><dt className="inline font-semibold text-slate-700">Receives: </dt><dd className="inline">{spec.receives}</dd></div>
                <div><dt className="inline font-semibold text-slate-700">Produces: </dt><dd className="inline">{spec.produces}</dd></div>
                <div><dt className="inline font-semibold text-slate-700">Passes on: </dt><dd className="inline">{spec.passes_to}</dd></div>
              </dl>
            </Section>
          </div>

          {!r && status !== 'running' && <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">No result yet. Its real counts, trace and output appear here as soon as the automation runs this agent.</p>}
          {status === 'running' && <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"><Loader2 className="h-4 w-4 animate-spin" /> Reading the database and the Knowledge Graph…</p>}

          {r && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Section title="Input received">
                  {r.received ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">From {prevName}: {r.received.message}</p>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">First agent — reads the database directly.</p>
                  )}
                  <p className="mt-1.5 break-words font-mono text-[11px] text-slate-500">{Object.entries(r.input).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') || '—'}</p>
                </Section>
                <Section title="Output passed on">
                  {r.passed_to_next ? (
                    <p className={`rounded-lg px-3 py-2 text-xs leading-5 ${r.passed_to_next.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{r.passed_to_next.valid ? 'Accepted — ' : 'Rejected — '}{r.passed_to_next.message}</p>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">Final agent — its output is the final draft or findings below.</p>
                  )}
                </Section>
              </div>

              <Section title="What it found">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {r.metrics.map((m) => (
                    <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{m.label}</p>
                      <p className="text-base font-semibold tabular-nums text-slate-900">{fmt(m.value)}</p>
                    </div>
                  ))}
                </div>
                {r.findings.length > 0 && <div className="mt-3"><Bullets items={r.findings} /></div>}
              </Section>

              <Section title={`What it actually ran (${r.actions.length} step${r.actions.length === 1 ? '' : 's'})`}>
                <ul className="space-y-1.5">{r.actions.map((a, i) => <ActionRow key={i} a={a} />)}</ul>
              </Section>

              {r.tables.length > 0 && <Section title="Output"><div className="space-y-4">{r.tables.map((t) => <DataTable key={t.key} table={t} />)}</div></Section>}

              {step?.gate && <Section title={`Validation — ${step.gate.name} (${step.gate.passed_checks}/${step.gate.total_checks} passed)`}><Checks checks={step.gate.checks} /></Section>}
              {step?.failedReason && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{step.failedReason}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Handoff({ handoff }: { handoff: PipelineHandoff | null | undefined }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs text-slate-500">
      <ArrowDown className={`h-4 w-4 ${handoff?.valid ? 'text-emerald-600' : 'text-slate-300'}`} />
      {handoff ? <span><b className={handoff.valid ? 'text-emerald-700' : 'text-red-700'}>{handoff.valid ? 'Passed on' : 'Handoff rejected'}</b> — {handoff.message}</span> : <span>The next agent starts automatically when this one passes its gate.</span>}
    </div>
  );
}

export function ModuleAgentPipelineCard({
  module,
  title,
  description,
  withWindow = false,
  onRan,
}: {
  module: PipelineModule;
  title: string;
  description: string;
  /** Attendance only: the window and threshold the first agent reads with. */
  withWindow?: boolean;
  onRan?: () => void;
}) {
  const context = useMemo(() => {
    const s = readModuleWorkspaceSession();
    return { token: s.token ?? undefined, instituteId: s.instituteId ?? undefined, academicYear: s.academicYear ?? undefined, baseUrl: s.baseUrl ?? undefined };
  }, []);

  const [eso, setEso] = useState<PipelineEso | null>(null);
  const [live, setLive] = useState<PipelineState | null>(null);
  const [auto, setAuto] = useState<PipelineAutomation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<number, StepState>>({});
  const [handoffs, setHandoffs] = useState<Record<number, PipelineHandoff | null>>({});
  const [running, setRunning] = useState<number | null>(null);
  const [final, setFinal] = useState<PipelineStepResponse | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true });
  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState(75);
  const [interval, setIntervalSeconds] = useState(300);
  const [now, setNow] = useState(() => Date.now());
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [liveSync, setLiveSync] = useState(true);
  // When each agent of the cycle on screen started and finished, so the strip can say when it completed.
  const [startedAt, setStartedAt] = useState<Record<number, number>>({});
  const [doneAt, setDoneAt] = useState<Record<number, number>>({});

  // Refs so the cycle driver always sees the latest switch without re-subscribing.
  const cycleRunning = useRef(false);
  const stopRequested = useRef(false);
  const lastCycleSeen = useRef<string | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const liveSyncRef = useRef(true);
  useEffect(() => {
    liveSyncRef.current = liveSync;
  }, [liveSync]);
  const onRanRef = useRef(onRan);
  useEffect(() => {
    onRanRef.current = onRan;
  }, [onRan]);

  const refreshState = useCallback(async () => {
    try {
      const s = await getPipelineState(module, context);
      setLive(s);
      if (s.automation) {
        setAuto(s.automation);
        setServerOffset(new Date(s.automation.server_time).getTime() - Date.now());
        // A cycle finished somewhere else (the scheduler): tell dependants to reload their results.
        if (s.automation.last_cycle_at && s.automation.last_cycle_at !== lastCycleSeen.current) {
          if (lastCycleSeen.current !== null) onRanRef.current?.();
          lastCycleSeen.current = s.automation.last_cycle_at;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the automation state.');
    }
  }, [module, context]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setEso(await getPipelineEso(module, context));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the agents.');
      }
      await refreshState();
    }, 0);
    return () => clearTimeout(t);
  }, [module, context, refreshState]);

  // Clock + state poll. The poll is what shows a cycle the scheduler is running.
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => { if (liveSyncRef.current) void refreshState(); }, 5000);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [refreshState]);

  /** One complete sequential cycle, agent after agent, each receiving the previous one's output. */
  // "manual" is the one-off "Run Full Sweep Now": it runs the same sequence once without switching the
  // automation on, so it must not be treated as a cancellable automatic cycle.
  const runCycle = useCallback(async (manual = false) => {
    if (cycleRunning.current) return;
    cycleRunning.current = true;
    stopRequested.current = false;
    setError(null);
    setSuccessNote(null);
    setStartedAt({});
    setDoneAt({});
    setSteps({});
    setHandoffs({});
    setFinal(null);
    setCancelled(false);

    let runId: string | undefined;
    const total = eso?.agents.length ?? 4;
    try {
      for (let n = 1; n <= total; n++) {
        if (stopRequested.current) {
          setCancelled(true);
          break;
        }
        setRunning(n);
        setStartedAt((t) => ({ ...t, [n]: Date.now() }));
        setOpen((o) => ({ ...o, [n]: true }));
        try {
          const res = await runPipelineStep(module, context, { step: n, run_id: runId, auto: !manual, ...(n === 1 && withWindow ? { days: auto?.options?.days ?? days, threshold: auto?.options?.threshold ?? threshold } : {}) });
          runId = res.run_id;
          setDoneAt((t) => ({ ...t, [n]: Date.now() }));
          setSteps((s) => ({ ...s, [n]: { result: res.step_result, gate: res.gate ?? null } }));
          setHandoffs((h) => ({ ...h, [n]: res.step_result.passed_to_next ?? res.handoff ?? null }));
          if (res.report_complete) {
            setFinal(res);
            setSuccessNote(`${total}-agent pipeline completed in ${typeof res.total_duration_ms === 'number' ? res.total_duration_ms.toLocaleString() + ' ms' : 'one cycle'}.`);
            break;
          }
        } catch (err) {
          if (err instanceof PipelineError) {
            const d = err.failure?.details as { step_result?: PipelineStepResult; cancelled?: boolean; cycle_in_progress?: boolean; automation_stopped?: boolean; [k: string]: unknown } | undefined;
            if (d?.cycle_in_progress) break; // the scheduler holds this cycle; the poll will show it
            if (d?.cancelled || d?.automation_stopped) {
              setCancelled(true);
              break;
            }
            if (d?.step_result) {
              const gate = (d[`gate_${n}`] as PipelineGate | undefined) ?? null;
              setSteps((s) => ({ ...s, [n]: { result: d.step_result!, gate, failedReason: err.message } }));
            }
            setError(err.message);
          } else {
            setError(err instanceof Error ? err.message : 'An agent could not run.');
          }
          break; // a failed gate ends this cycle; the next one starts on schedule
        }
      }
    } finally {
      setRunning(null);
      cycleRunning.current = false;
      await refreshState();
      onRanRef.current?.();
    }
  }, [eso, module, context, withWindow, days, threshold, auto, refreshState]);

  const startCycleNow = () => void runCycle(true);

  // The driver: while active and a cycle is due (and nobody else holds it), run it.
  useEffect(() => {
    // Not gated on `eso`: the agent specification is for display; a failed spec call must never stop the automation.
    if (!auto?.active || auto.cycle_running || cycleRunning.current) return;
    const due = auto.next_run_at ? new Date(auto.next_run_at).getTime() <= now + serverOffset : true;
    if (due) void runCycle();
  }, [auto, now, runCycle, serverOffset]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await startPipelineAutomation(module, context, interval, withWindow ? { days, threshold } : {});
      // Take the server's clock now, so the first cycle is seen as due immediately and starts at once.
      setServerOffset(new Date(started.server_time).getTime() - Date.now());
      setAuto(started);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the automation.');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    stopRequested.current = true;
    setBusy(true);
    try {
      setAuto(await stopPipelineAutomation(module, context));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop the automation.');
    } finally {
      setBusy(false);
    }
  };

  const changeInterval = async (seconds: number) => {
    setIntervalSeconds(seconds);
    if (auto?.active) {
      try {
        setAuto(await setPipelineInterval(module, context, seconds));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not change the interval.');
      }
    }
  };

  const agents = eso?.agents ?? [];
  const active = auto?.active ?? false;
  const nextIn = auto?.next_run_at ? Math.max(0, Math.round((new Date(auto.next_run_at).getTime() - (now + serverOffset)) / 1000)) : null;
  const completedMax = Math.max(0, ...Object.keys(steps).map(Number).filter((n) => steps[n].result.status === 'success'));

  const statusOf = (n: number): Status => {
    if (running === n) return 'running';
    const st = steps[n];
    if (st) return st.result.status === 'success' ? 'completed' : 'failed';
    if (final && n > completedMax) return 'skipped';
    return 'pending';
  };

  const chipTone = ['bg-indigo-100 text-indigo-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800'];
  const shortName = (n: string) => n.replace(/^(Knowledge Graph|Class-Teacher)\s+/i, '');
  const working = running !== null ? agents.find((a) => a.order === running) ?? null : null;
  const lastDone = Object.keys(doneAt).map(Number).sort((x, y) => y - x)[0];
  const lastDoneSpec = lastDone ? agents.find((a) => a.order === lastDone) ?? null : null;
  const serverBusy = !working && !!auto?.cycle_running;
  const chain = agents.map((a) => shortName(a.name)).join(' ➔ ');

  return (
    <section className="space-y-4">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Header and primary controls: the Exam & Assessment layout */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-100">
              <Workflow className="size-6" />
              {active && (
                <span className="absolute -right-1 -top-1 flex size-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-4 rounded-full bg-emerald-500 ring-2 ring-white" />
                </span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${active ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}>
                  <span className={`size-2 rounded-full ${active ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                  {active ? 'Continuous Loop Active' : 'Stopped / Idle'}
                </span>
                {chain && <span className="rounded-md border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{chain}</span>}
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {active ? (
              <button type="button" onClick={() => void stop()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-60">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
                Stop Agent
              </button>
            ) : (
              <button type="button" onClick={() => void start()} disabled={busy || agents.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                Start Agent
              </button>
            )}
            <button type="button" onClick={startCycleNow} disabled={busy || running !== null || serverBusy || agents.length === 0} title="Run every agent once, in order, right now, without switching the loop on" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60">
              <Zap className={`size-3.5 ${running !== null ? 'animate-bounce' : ''}`} />
              {running !== null ? 'Evaluating…' : 'Run Full Sweep Now'}
            </button>
            <button type="button" onClick={() => void refreshState()} title="Refresh current state" className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900">
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <div className="flex-1"><strong className="font-semibold">Operation Notice: </strong>{error}</div>
            <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-900">×</button>
          </div>
        )}
        {successNote && !error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="flex-1">{successNote}</div>
            <button type="button" onClick={() => setSuccessNote(null)} className="text-emerald-600 hover:text-emerald-900">×</button>
          </div>
        )}

        {/* Agent collaboration bar: every chip is that agent's live status */}
        <div className="space-y-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Bot className="mt-0.5 size-5 shrink-0 text-indigo-600" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Agent Collaboration Pipeline:</span>
                  {agents.map((a, i) => {
                    const st = statusOf(a.order);
                    return (
                      <span key={a.agent_id} className="inline-flex items-center gap-2">
                        <span title={`${a.name}: ${STATUS_STYLE[st].label}`} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${st === 'failed' ? 'bg-red-100 text-red-800' : chipTone[i % chipTone.length]} ${st === 'running' ? 'ring-2 ring-amber-400' : ''} ${st === 'pending' || st === 'skipped' ? 'opacity-70' : ''}`}>
                          {st === 'running' ? <Loader2 className="size-3 animate-spin" /> : st === 'completed' ? <CheckCircle2 className="size-3" /> : st === 'failed' ? <XCircle className="size-3" /> : <Bot className="size-3" />}
                          Agent {a.order}: {shortName(a.name)}
                        </span>
                        {i < agents.length - 1 && <ArrowRight className="size-3.5 text-indigo-400" />}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] leading-normal text-slate-600">
                  Start once: the agents run one after another, each receiving the previous agent&apos;s output, and the loop repeats on its cycle until Stop is pressed.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Autonomous Monitoring:</span>
                <button type="button" onClick={() => void (active ? stop() : start())} disabled={busy || agents.length === 0} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${active ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {active ? <><CheckCheck className="size-3.5" /> ON (Active Loop)</> : <><Pause className="size-3.5" /> OFF (Idle)</>}
                </button>
              </div>
              {withWindow && (
                <div className="flex items-center gap-1.5">
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={active} aria-label="Window" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-xs disabled:opacity-50">
                    {DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                  <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} disabled={active} aria-label="Threshold" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-xs disabled:opacity-50">
                    {THRESHOLDS.map((t) => <option key={t} value={t}>below {t}%</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-600">Cycle:</span>
                <select value={active && auto ? auto.interval_seconds : interval} onChange={(e) => void changeInterval(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none">
                  {INTERVALS.map((i) => <option key={i.seconds} value={i.seconds}>{i.label}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-slate-600">
                <input type="checkbox" checked={liveSync} onChange={(e) => setLiveSync(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Live Sync</span>
              </label>
            </div>
          </div>

          {/* Who is working right now, on what, and the handoff that just happened */}
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5 text-xs text-slate-700">
            {working ? (
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-600" />
                <div>
                  <p><b>Agent {working.order}: {working.name}</b> is working{startedAt[working.order] ? ` · ${Math.max(0, Math.round((now - startedAt[working.order]) / 1000))}s` : ''}</p>
                  <p className="mt-0.5 text-slate-600">Task: {working.tasks[0] ?? working.purpose}</p>
                  <p className="mt-0.5 text-slate-500">Reading: {working.tables.join(', ')}{working.graph.length ? ' and the Knowledge Graph' : ''}</p>
                </div>
              </div>
            ) : serverBusy ? (
              <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin text-amber-600" /> A cycle is running on the server{auto?.running_run_id ? ` (run ${auto.running_run_id.slice(0, 8)})` : ''}; its result appears here when it completes.</p>
            ) : lastDoneSpec ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div>
                  <p><b>Agent {lastDoneSpec.order}: {lastDoneSpec.name}</b> {steps[lastDoneSpec.order]?.result.status === 'failed' ? 'stopped at its gate' : 'completed'} at {new Date(doneAt[lastDone]).toLocaleTimeString()}{steps[lastDoneSpec.order] ? ` · ${steps[lastDoneSpec.order].result.duration_ms} ms` : ''}</p>
                  {handoffs[lastDoneSpec.order] ? (
                    <p className="mt-0.5 text-slate-600"><b className={handoffs[lastDoneSpec.order]!.valid ? 'text-emerald-700' : 'text-red-700'}>{handoffs[lastDoneSpec.order]!.valid ? 'Handed to' : 'Handoff rejected for'} Agent {handoffs[lastDoneSpec.order]!.to}:</b> {handoffs[lastDoneSpec.order]!.message}</p>
                  ) : final ? (
                    <p className="mt-0.5 text-slate-600">Last agent in the sequence: the cycle is complete.</p>
                  ) : null}
                </div>
              </div>
            ) : active ? (
              <p className="flex items-center gap-2"><Clock className="size-4 text-slate-400" /> {nextIn === null ? 'Waiting for the next cycle.' : nextIn <= 0 ? 'The next cycle is starting now.' : `Waiting: the next cycle starts in ${Math.floor(nextIn / 60)}m ${nextIn % 60}s.`}</p>
            ) : (
              <p className="flex items-center gap-2"><Clock className="size-4 text-slate-400" /> Idle. Press <b>Start Agent</b> once and every agent runs in order, then repeats until you press Stop.</p>
            )}
          </div>
        </div>

        {live && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>Academic year <b className="text-slate-700">{fmt(live.academic_year)}</b></span>
            {Object.entries(live.live).map(([k, v]) => <span key={k}>{k.replace(/_/g, ' ')} <b className="text-slate-700">{fmt(v)}</b></span>)}
            <span className="inline-flex items-center gap-1"><Network className="h-3 w-3" /> Knowledge Graph <b className={live.knowledge_graph.ok ? 'text-emerald-700' : 'text-red-700'}>{live.knowledge_graph.ok ? `connected (${live.knowledge_graph.ms} ms)` : 'unreachable'}</b></span>
          </div>
        )}

        {auto && (
          <dl className="grid gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="inline font-semibold text-slate-700">Started: </dt><dd className="inline">{auto.started_at ? `${when(auto.started_at)}${auto.started_by?.name ? ` by ${auto.started_by.name}` : ''}` : '—'}</dd></div>
            <div><dt className="inline font-semibold text-slate-700">Cycles completed: </dt><dd className="inline">{auto.cycles}</dd></div>
            <div><dt className="inline font-semibold text-slate-700">Last cycle: </dt><dd className="inline">{auto.last_cycle_at ? `${human(auto.last_cycle_status)} · ${when(auto.last_cycle_at)}` : 'none yet'}</dd></div>
            <div><dt className="inline font-semibold text-slate-700">{active ? 'Next cycle: ' : 'Stopped: '}</dt><dd className="inline">{active ? (auto.cycle_running || running ? 'in progress' : nextIn === null ? '—' : nextIn <= 0 ? 'starting now' : `in ${Math.floor(nextIn / 60)}m ${nextIn % 60}s`) : auto.stopped_at ? `${when(auto.stopped_at)}${auto.stopped_by?.name ? ` by ${auto.stopped_by.name}` : ''}` : 'not started'}</dd></div>
          </dl>
        )}
        {eso?.safety && <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{eso.safety} Starting again resumes on the latest data.</p>}
        {cancelled && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Automation was stopped; the cycle in progress was cancelled before the next agent.</p>}
        {auto?.last_error && !error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Last cycle: {auto.last_error}</p>}
      </div>

      {agents.length === 0 && !error && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading the agents…</div>
      )}

      <div>
        {agents.map((spec, i) => (
          <div key={spec.agent_id}>
            <AgentPanel spec={spec} status={statusOf(spec.order)} step={steps[spec.order] ?? null} open={open[spec.order] ?? false} onToggle={() => setOpen((o) => ({ ...o, [spec.order]: !o[spec.order] }))} prevName={i > 0 ? agents[i - 1].name : null} />
            {agents[i + 1] && <Handoff handoff={handoffs[spec.order]} />}
          </div>
        ))}
      </div>

      {final && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-5 py-5">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="text-sm font-semibold text-slate-900">Latest cycle result</h3></div>
          <p className="mt-2 text-sm leading-6 text-slate-800">{final.final_output?.headline ?? final.note}</p>
          {final.final_output?.persist_error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{final.final_output.persist_error}</p>}
          {(final.final_output?.drafts?.length ?? 0) > 0 && (
            <p className="mt-2 text-sm text-slate-700"><b>{final.final_output!.drafts!.length} follow-up draft(s)</b> generated and shown in the Admin Dashboard. Nothing has been sent.</p>
          )}
          {final.final_output?.approval_note && <p className="mt-2 text-xs text-slate-600">{final.final_output.approval_note}</p>}
          {final.final_output?.next_action && <p className="mt-2 text-sm text-slate-700"><b>Next:</b> {final.final_output.next_action}</p>}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            {final.quality_scorecard && <span>Quality score <b className="text-slate-900">{final.quality_scorecard.composite_score}%</b> ({final.quality_scorecard.overall_status})</span>}
            {typeof final.total_duration_ms === 'number' && <span>Cycle took <b className="text-slate-900">{(final.total_duration_ms / 1000).toFixed(1)} s</b></span>}
            <span>Agents run <b className="text-slate-900">{Object.keys(steps).length} of {agents.length}</b></span>
          </div>
        </div>
      )}
    </section>
  );
}
