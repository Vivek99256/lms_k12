'use client';

/**
 * Final outputs and agent history for the Users / Attendance agent pipelines.
 *
 * Shown in the Admin Dashboard and in each module's AI Stack → Automations tab, from one place so
 * the two cannot disagree. Everything comes from what the backend persisted: the final draft /
 * findings (`ai_audit_logs` `pipeline_final`), the live approval state (`workflow_approvals`,
 * read now rather than copied), and every executed agent step. Nothing here is a default, a
 * constant or a placeholder; where there is no record yet it says so.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, Clock, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

import { fetchAgents, fetchRuns } from '@/lib/agents/client';
import type { Agent, AgentRun } from '@/lib/agents/types';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getPipelineOutputs,
  getPipelineState,
  type PipelineAutomation,
  type PipelineDraft,
  type PipelineModule,
  type PipelineOutput,
  type PipelineQueueItem,
  type PipelineRosterAgent,
} from '@/lib/ai-pipeline/module-agent-pipeline-client';

const AGENT_MODULE: Record<PipelineModule, string> = { users: 'user', attendance: 'attendance' };
const LABEL: Record<PipelineModule, string> = { users: 'Users', attendance: 'Attendance' };

const when = (v?: string | null) => (v ? new Date(v.replace(' ', 'T')).toLocaleString() : '—');
const human = (v?: string | null) => (v ? v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—');

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate' | 'blue'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

const sevTone = (s: string) => (s === 'critical' || s === 'high' ? 'red' : s === 'medium' ? 'amber' : 'slate');

function DraftCard({ d, output }: { d: PipelineDraft; output: PipelineOutput }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Follow-up for {d.teacher} <span className="font-normal text-slate-500">· {d.students} student(s)</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{d.class} · {d.severity}</p>
        </div>
        <Pill tone="blue">Draft — nothing sent</Pill>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Draft message</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-3 font-sans text-sm leading-6 text-slate-800">{d.message}</pre>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Students and attendance</p>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    {['Student', 'Class', 'Rate', 'Present', 'Absent', 'Streak', 'Last 7 days', 'Severity', 'Prior term', 'Change'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.student_rows.map((s) => (
                    <tr key={s.student_id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.name} <span className="text-slate-400">#{s.student_id}</span></td>
                      <td className="px-3 py-2">{s.class}</td>
                      <td className="px-3 py-2 tabular-nums">{s.rate_percent}</td>
                      <td className="px-3 py-2 tabular-nums">{s.present}</td>
                      <td className="px-3 py-2 tabular-nums">{s.absent}</td>
                      <td className="px-3 py-2 tabular-nums">{s.absent_streak}</td>
                      <td className="px-3 py-2 tabular-nums">{s.absent_last_7}</td>
                      <td className="px-3 py-2"><Pill tone={sevTone(s.severity)}>{s.severity}</Pill></td>
                      <td className="px-3 py-2 tabular-nums">{s.prior_term_percent === null ? '—' : `${s.prior_term_percent}%`}</td>
                      <td className="px-3 py-2 tabular-nums">{s.change_points === null ? '—' : `${s.change_points > 0 ? '+' : ''}${s.change_points} pts`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <div><dt className="inline font-semibold text-slate-700">Made by: </dt><dd className="inline">Follow-up Drafter (agent run #{output.agent_run_ids['4'] ?? '—'}), pipeline <span className="font-mono">{output.pipeline_run_id?.slice(0, 8)}</span></dd></div>
            <div><dt className="inline font-semibold text-slate-700">Generated: </dt><dd className="inline">{when(output.generated_at)}</dd></div>
          </dl>
        </div>
      )}
    </li>
  );
}

function QueueTable({ queue }: { queue: PipelineQueueItem[] }) {
  if (queue.length === 0) return <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">The agents found nothing that needs review.</p>;
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{['Finding', 'Severity', 'Count', 'Accounts', 'Suggested action', 'Approver', 'Found by'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {queue.map((q) => (
            <tr key={q.category} className="align-top">
              <td className="px-3 py-2 font-medium text-slate-800">{q.category}</td>
              <td className="px-3 py-2"><Pill tone={sevTone(q.severity)}>{q.severity}</Pill></td>
              <td className="px-3 py-2 tabular-nums">{q.count}</td>
              <td className="px-3 py-2">{q.accounts.length ? q.accounts.map((a) => `${a.name} (#${a.id})`).join(', ') + (q.count > q.accounts.length ? ` … +${q.count - q.accounts.length} more` : '') : '—'}</td>
              <td className="px-3 py-2">{q.action}</td>
              <td className="px-3 py-2">{q.approver}</td>
              <td className="px-3 py-2">Agent {q.found_by_agent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinalOutputView({ module, output }: { module: PipelineModule; output: PipelineOutput }) {
  const f = output.final;
  const drafts = f.drafts ?? [];
  const status =
    module === 'attendance'
      ? drafts.length === 0
        ? <Pill tone="green">Nothing to follow up</Pill>
        : <Pill tone="amber">{drafts.length} draft(s) generated</Pill>
      : <Pill tone="amber">Pending administrator review</Pill>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-semibold leading-6 text-slate-900">{f.headline}</p>
          {f.next_action && <p className="mt-1 text-sm text-slate-600"><b>Next:</b> {f.next_action}</p>}
          {f.approval_note && <p className="mt-1 text-xs text-slate-500">{f.approval_note}</p>}
          {f.persist_error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{f.persist_error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{status}<Pill tone="blue">Draft — nothing sent</Pill></div>
      </div>

      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>Generated {when(output.generated_at)}</span>
        <span>Started by <b className="text-slate-700">{output.started_by.name ?? (output.started_by.id ? `User #${output.started_by.id}` : '—')}</b></span>
        <span>Academic year <b className="text-slate-700">{output.academic_year ?? '—'}</b></span>
        {f.window && <span>Window <b className="text-slate-700">{f.window.start} → {f.window.end}</b> · below {f.threshold_percent}%</span>}
        <span>Pipeline <b className="font-mono text-slate-700">{output.pipeline_run_id?.slice(0, 8)}</b></span>
      </p>

      {/* The sequence, exactly as it ran. */}
      <div className="flex flex-wrap items-stretch gap-2">
        {output.steps.map((s, i) => (
          <Fragment key={s.step}>
            <div className={`min-w-[10rem] flex-1 rounded-lg border px-3 py-2 text-xs ${s.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
              <p className="font-semibold text-slate-800">{s.step}. {s.agent_name}</p>
              <p className="mt-0.5 text-slate-500">{s.records ? `${s.records.fetched.toLocaleString()} read → ${s.records.produced.toLocaleString()} out` : '—'} · {s.duration_ms ?? '—'} ms · gate {s.gate_score ?? '—'}%</p>
              <p className="text-slate-400">{when(s.started_at)}</p>
            </div>
            {i < output.steps.length - 1 && <ArrowRight className="mt-5 h-4 w-4 shrink-0 text-slate-300" />}
          </Fragment>
        ))}
      </div>

      {module === 'attendance' ? (
        <>
          {drafts.length > 0 ? (
            <ul className="space-y-2">{drafts.map((d) => <DraftCard key={`${d.teacher_id}-${d.workflow_run_id ?? d.class}`} d={d} output={output} />)}</ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">No follow-up draft was produced by this run.</p>
          )}
          {(f.unassigned_classes?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
              <b>No class teacher assigned:</b> {f.unassigned_classes!.map((u) => `${u.class} (${u.students} student(s))`).join(', ')}. {f.unassigned_classes![0].action}
            </div>
          )}
        </>
      ) : (
        <QueueTable queue={f.queue ?? []} />
      )}
    </div>
  );
}

/** One expandable table row. Top-level, so it is not re-created on every render of the table. */
function Row({ k, open, setOpen, cells, detail }: { k: string; open: string | null; setOpen: (v: string | null) => void; cells: React.ReactNode[]; detail?: React.ReactNode }) {
  return (
    <Fragment>
      <tr className="cursor-pointer align-top hover:bg-slate-50" onClick={() => setOpen(open === k ? null : k)}>
        {cells.map((c, i) => <td key={i} className="px-3 py-2.5">{c}</td>)}
        <td className="px-3 py-2.5"><ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open === k ? 'rotate-180' : ''}`} /></td>
      </tr>
      {open === k && detail && <tr><td colSpan={cells.length + 1} className="bg-slate-50/70 px-4 py-4">{detail}</td></tr>}
    </Fragment>
  );
}

/** One row per agent involved in the workflow, with real execution history. */
function AgentsTable({
  roster,
  registry,
  runs,
  automation,
}: {
  automation: PipelineAutomation | null;
  roster: PipelineRosterAgent[];
  registry: Agent[];
  runs: AgentRun[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = useMemo(() => new Map(registry.map((a) => [a.id, a])), [registry]);
  const rosterIds = new Set(roster.map((r) => r.agent_id));
  const tools = registry.filter((a) => !rosterIds.has(a.id) && a.status !== 'archived');

  const toolStats = (id: string) => {
    const mine = runs.filter((r) => r.agent_id === id).sort((a, b) => a.started_at.localeCompare(b.started_at));
    return { n: mine.length, first: mine[0], last: mine[mine.length - 1] };
  };

  const statusPill = (reg: Agent | undefined, last: string) => (
    <div className="flex flex-wrap gap-1">
      <Pill tone={reg ? (reg.status === 'paused' ? 'amber' : 'green') : automation?.cycle_running ? 'amber' : automation?.active ? 'green' : 'slate'}>{reg ? human(reg.status) : automation?.cycle_running ? 'Running a cycle' : automation?.active ? 'Automation on' : automation ? 'Automation stopped' : '—'}</Pill>
      <Pill tone={last === 'completed' ? 'green' : last === 'failed' ? 'red' : 'slate'}>{last === 'never_run' ? 'Never run' : human(last)}</Pill>
    </div>
  );

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{['#', 'Agent', 'Tool / source', 'Status', 'Registered', 'First run', 'Latest run', 'Started by', 'Runs', 'Latest result', ''].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roster.map((r) => {
            const reg = byId.get(r.agent_id);
            return (
              <Row
              open={open}
              setOpen={setOpen}
                key={r.agent_id}
                k={r.agent_id}
                cells={[
                  <b key="o">{r.order}</b>,
                  <div key="n"><p className="font-semibold text-slate-900">{r.name}</p><p className="font-mono text-[11px] text-slate-500">{r.agent_id}</p></div>,
                  <span key="t">{[...r.tools, ...r.graph.map(() => 'Knowledge Graph')].filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Database'}</span>,
                  statusPill(reg, r.last_status),
                  when(reg?.created_at ?? r.first_run_at),
                  when(r.first_run_at),
                  when(r.last_run_at),
                  r.last_started_by?.name ?? '—',
                  r.runs,
                  r.last_records ? `${r.last_records.fetched.toLocaleString()} fetched · ${r.last_records.processed.toLocaleString()} processed · ${r.last_duration_ms ?? '—'} ms` : '—',
                ]}
                detail={
                  <div className="grid gap-4 text-xs text-slate-700 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <p><b>Purpose:</b> {r.purpose}</p>
                      <p><b>Tables read:</b> {(r.last_tables_read?.length ? r.last_tables_read : r.tables).join(', ')}</p>
                      {r.graph.length > 0 && <p><b>Graph:</b> <span className="font-mono">{r.graph.join(' · ')}</span></p>}
                      <p><b>Passed to next agent:</b> {r.passes_to}</p>
                      {r.last_summary && r.last_summary.length > 0 && <p><b>Latest output:</b> {r.last_summary.map((s) => `${s.label} ${s.value}`).join(' · ')}</p>}
                    </div>
                    <div>
                      <p className="mb-1"><b>{r.gate_name}</b> — gate {r.last_gate?.score ?? '—'}%</p>
                      {r.last_gate ? (
                        <ul className="space-y-1">
                          {Object.entries(r.last_gate.checks).map(([k, c]) => (
                            <li key={k} className="flex gap-1.5">
                              {c.status === 'passed' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}
                              <span><b>{k.replace(/_/g, ' ')}</b> — {c.message}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-slate-500">No run has been recorded yet.</p>}
                    </div>
                  </div>
                }
              />
            );
          })}

          {tools.map((a) => {
            const st = toolStats(a.id);
            return (
              <Row
              open={open}
              setOpen={setOpen}
                key={a.id}
                k={a.id}
                cells={[
                  '—',
                  <div key="n"><p className="font-semibold text-slate-900">{a.name}</p><p className="font-mono text-[11px] text-slate-500">{a.id}</p></div>,
                  a.tools_allowed.join(', ') || '—',
                  statusPill(a, st.last ? (st.last.status === 'success' ? 'completed' : 'failed') : 'never_run'),
                  when(a.created_at),
                  when(st.first?.started_at),
                  when(st.last?.started_at),
                  st.last?.acting_user_name ?? '—',
                  st.n,
                  st.last ? `${human(st.last.status)} · ${st.last.duration_ms} ms${st.last.error ? ` · ${st.last.error}` : ''}` : '—',
                ]}
                detail={<p className="text-xs text-slate-700"><b>Purpose:</b> {a.description || a.instructions}</p>}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PipelineOutputsPanel({ module, title }: { module: PipelineModule; title?: string }) {
  const [data, setData] = useState<{ outputs: PipelineOutput[]; roster: PipelineRosterAgent[] } | null>(null);
  const [registry, setRegistry] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState(0);
  const [automation, setAutomation] = useState<PipelineAutomation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = readModuleWorkspaceSession();
    const ctx = { token: s.token ?? undefined, instituteId: s.instituteId ?? undefined, academicYear: s.academicYear ?? undefined, baseUrl: s.baseUrl ?? undefined };
    const am = AGENT_MODULE[module];
    const [o, reg, rn, st] = await Promise.allSettled([
      getPipelineOutputs(module, ctx, 8),
      fetchAgents({ module: am }),
      fetchRuns({ module: am, limit: 300 }),
      getPipelineState(module, ctx),
    ]);
    if (st.status === 'fulfilled') setAutomation(st.value.automation ?? null);
    if (o.status === 'fulfilled') {
      setData(o.value);
      setError(null);
    } else {
      setError(o.reason instanceof Error ? o.reason.message : 'Could not load the agent outputs.');
    }
    if (reg.status === 'fulfilled') setRegistry(reg.value);
    if (rn.status === 'fulfilled') setRuns(rn.value);
    setLoading(false);
  }, [module]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const output = data?.outputs[pick] ?? null;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title ?? `${LABEL[module]} agents — final output`}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
            Drafts and findings from the last completed cycle. Nothing is sent and no record is changed by the agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && data.outputs.length > 1 && (
            <select value={pick} onChange={(e) => setPick(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
              {data.outputs.map((o, i) => <option key={o.audit_id} value={i}>{when(o.generated_at)}</option>)}
            </select>
          )}
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {loading && !data && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}

      {data && !output && !error && (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
          <Clock className="h-4 w-4" /> No completed {LABEL[module]} agent run has been recorded for this institute yet. Run the agents from AI Stack → Automations and the final draft will appear here.
        </p>
      )}

      {output && <FinalOutputView module={module} output={output} />}

      {data && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            Agents and execution history
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {data.roster.length + registry.filter((a) => a.status !== 'archived' && !data.roster.some((r) => r.agent_id === a.id)).length} agents · {data.roster.length} in the pipeline
            </span>
          </h3>
          <AgentsTable roster={data.roster} registry={registry} runs={runs} automation={automation} />
        </div>
      )}
    </section>
  );
}
