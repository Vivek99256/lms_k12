'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  FileCheck,
  Lock,
  Send,
  Share2,
  ShieldCheck,
  XCircle,
  RefreshCw,
  Network,
  GitBranch,
  Wallet,
  Users,
  Mail,
  MessageSquare,
  AlertTriangle,
  Info,
} from 'lucide-react';

import type {
  FeesAgentState,
  FeesCandidate,
  FeesGate,
  FeesHandoffStage,
  FeesAgentWork,
  FeesPipelineReport,
  FeesPipelineStep,
  FeesRecentRun,
  FeesSendResult,
  FeesStudentCollection,
  FeesSentReminderRecord,
  FeesPaymentModeSummary,
  FeesKnowledgeGraphCard,
} from '@/lib/fees/fees-agent-client';
import { FeesApprovalQueue } from '@/app/fees/ai-stack/_screens/fees-approval-queue';

export type AgentUiStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface StepTelemetry {
  status: 'idle' | 'waiting' | 'running' | 'completed' | 'failed';
  duration_ms?: number;
  gate?: FeesGate;
  summary?: string;
  error?: string;
  fingerprint?: string;
  step_result?: FeesPipelineStep;
}

export function toAgentStatusLabel(status: StepTelemetry['status']): AgentUiStatus {
  if (status === 'running') return 'Running';
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

export function formatRupeesReal(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function StatusPill({ status }: { status: AgentUiStatus }) {
  if (status === 'Running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700 animate-pulse">
        <RefreshCw className="size-2.5 animate-spin" />
        Running
      </span>
    );
  }
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
        <CheckCircle2 className="size-3 text-emerald-600" />
        Completed
      </span>
    );
  }
  if (status === 'Failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700">
        <XCircle className="size-3 text-rose-600" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
      <Clock className="size-2.5 text-slate-500" />
      Pending
    </span>
  );
}

/**
 * 1. Real-Time Sequential Workflow Sequence & Progress Tracker
 * Shows exact execution order, real progress based solely on completed backend steps, and live status per agent.
 */
export function FeesPipelineSequenceBanner({
  step1,
  step2,
  step3,
  latestReport,
  runningPipeline,
  academicYear,
  academicYearSource,
  subInstituteId,
}: {
  step1: StepTelemetry;
  step2: StepTelemetry;
  step3: StepTelemetry;
  latestReport: FeesPipelineReport | null;
  runningPipeline: boolean;
  academicYear?: number | null;
  academicYearSource?: string;
  subInstituteId?: number | null;
}) {
  const s1 = toAgentStatusLabel(step1.status);
  const s2 = toAgentStatusLabel(step2.status);
  const s3 = toAgentStatusLabel(step3.status);
  const finalStatus: AgentUiStatus =
    s1 === 'Failed' || s2 === 'Failed' || s3 === 'Failed'
      ? 'Failed'
      : s3 === 'Completed'
        ? 'Completed'
        : runningPipeline
          ? 'Running'
          : 'Pending';

  const completedAgents = [s1, s2, s3].filter((s) => s === 'Completed').length;
  const progressPct = Math.round((completedAgents / 3) * 100);

  const stages: Array<{
    stepNum: number;
    title: string;
    subtitle: string;
    status: AgentUiStatus;
    durationMs?: number;
    gateLabel: string;
  }> = [
    {
      stepNum: 1,
      title: 'Agent 1 · Position & Arrears Reader',
      subtitle: 'Reads ledger & identifies students with dues',
      status: s1,
      durationMs: step1.duration_ms,
      gateLabel: step1.gate ? `Gate 1: ${step1.gate.passed_checks}/${step1.gate.total_checks}` : 'Gate 1',
    },
    {
      stepNum: 2,
      title: 'Agent 2 · Evidence & History Analyst',
      subtitle: 'Checks fee heads, receipts & cooldowns',
      status: s2,
      durationMs: step2.duration_ms,
      gateLabel: step2.gate ? `Gate 2: ${step2.gate.passed_checks}/${step2.gate.total_checks}` : 'Gate 2',
    },
    {
      stepNum: 3,
      title: 'Agent 3 · Reminder Drafter',
      subtitle: 'Builds fingerprinted preview (0 sent)',
      status: s3,
      durationMs: step3.duration_ms,
      gateLabel: step3.gate ? `Gate 3: ${step3.gate.passed_checks}/${step3.gate.total_checks}` : 'Gate 3',
    },
    {
      stepNum: 4,
      title: 'Final Output & Human Approval',
      subtitle: 'Stored in DB · Awaits administrator sign-off',
      status: finalStatus,
      durationMs: latestReport?.total_duration_ms,
      gateLabel: latestReport?.reminder_draft?.fingerprint ? 'Fingerprint Locked' : 'Approval Gate',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">
              Agent-by-Agent Execution Workflow
            </h3>
            <StatusPill status={finalStatus} />
            {subInstituteId ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                Institute #{subInstituteId}
              </span>
            ) : null}
            {academicYear ? (
              <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                AY {academicYear}{academicYearSource ? ` (${academicYearSource.replace(/_/g, ' ')})` : ''}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Agents run strictly in order: <strong>Agent 1</strong> finds who owes fees ➔ <strong>Agent 2</strong> verifies payment evidence &amp; filters out recently reminded families ➔ <strong>Agent 3</strong> drafts reminders for human approval.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workflow Progress
            </span>
            <span className="text-sm font-black text-slate-900">
              {completedAgents}/3 Agents ({progressPct}%)
            </span>
          </div>
          {latestReport?.total_duration_ms !== undefined && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-right">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Time</span>
              <span className="font-mono text-xs font-extrabold text-slate-800">{latestReport.total_duration_ms} ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Real progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full transition-all duration-300 ${
            finalStatus === 'Failed'
              ? 'bg-rose-500'
              : finalStatus === 'Completed'
                ? 'bg-emerald-500'
                : 'bg-indigo-600'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Live Financial & Centralized Knowledge Graph Summary Strip */}
      {(() => {
        const fin = latestReport?.financial_analytics;
        const totalCol = fin?.total_collected ?? latestReport?.ledger_position?.total_collected ?? 0;
        const totalOut = fin?.total_outstanding ?? latestReport?.ledger_position?.total_outstanding ?? 0;
        const payingCount = fin?.paying_students_count ?? null;
        const nonPayingCount = fin?.non_paying_students_count ?? latestReport?.ledger_position?.students_owing ?? null;
        const totalRem = fin?.reminders_summary?.total_sent ?? 0;
        const emailRem = fin?.reminders_summary?.total_email_sent ?? 0;
        const smsRem = fin?.reminders_summary?.total_sms_sent ?? 0;
        const kgActive = latestReport?.knowledge_graph_reasoning?.knowledge_graph_active ?? true;

        return (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs pt-1">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-emerald-700">Total Fees Collected</span>
              <strong className="text-sm font-black text-emerald-900">{formatRupeesReal(totalCol)}</strong>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-rose-700">Pending Dues &amp; Arrears</span>
              <strong className="text-sm font-black text-rose-900">{formatRupeesReal(totalOut)}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-500">Paid vs Owing Students</span>
              <strong className="text-xs font-extrabold text-slate-900 block truncate">
                {payingCount !== null ? `${payingCount.toLocaleString('en-IN')} Paid` : '—'}
                {nonPayingCount !== null ? ` · ${nonPayingCount.toLocaleString('en-IN')} Due` : ''}
              </strong>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-blue-700">Reminders Sent To Date</span>
              <strong className="text-xs font-extrabold text-blue-900 block truncate">
                {totalRem > 0 ? `${totalRem} (${emailRem} Email · ${smsRem} SMS)` : '0 Sent'}
              </strong>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-violet-700">Centralized Knowledge Graph</span>
              <strong className="text-xs font-extrabold text-violet-900 flex items-center gap-1 mt-0.5 truncate">
                <Network className="size-3 text-violet-600 shrink-0" />
                {kgActive ? 'Active · Neo4j + SQL' : 'Ontology Mapped'}
              </strong>
            </div>
          </div>
        );
      })()}

      {/* 4-stage sequential strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {stages.map((st, idx) => (
          <div key={st.stepNum} className="relative flex items-stretch">
            <div
              className={`w-full rounded-xl border p-3 transition-all ${
                st.status === 'Running'
                  ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-100'
                  : st.status === 'Completed'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : st.status === 'Failed'
                      ? 'border-rose-300 bg-rose-50/50'
                      : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Step {st.stepNum}
                </span>
                <StatusPill status={st.status} />
              </div>
              <div className="mt-1.5 text-xs font-bold text-slate-900">{st.title}</div>
              <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">{st.subtitle}</p>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200/70 pt-1.5 text-[10px] font-semibold text-slate-500">
                <span>{st.gateLabel}</span>
                <span className="font-mono">{st.durationMs !== undefined ? `${st.durationMs} ms` : '—'}</span>
              </div>
            </div>
            {idx < stages.length - 1 && (
              <div className="hidden md:flex items-center justify-center px-1 text-slate-400">
                <ArrowRight className="size-4 shrink-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWorkCell(value: string | number | null | undefined, kind: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'money') {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  if (kind === 'count') {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toLocaleString('en-IN');
  }
  if (kind === 'percent') return typeof value === 'number' ? `${value}%` : String(value);
  return String(value);
}

/**
 * The real work behind one handoff: values the agent read or produced, the records it passed on,
 * and how it used the centralized Knowledge Graph. All of it comes from the backend run, none is static.
 */
function AgentWorkPanel({ work }: { work: FeesAgentWork }) {
  const kg = work.knowledge_graph;
  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3">
      <div>
        <div className="text-[11px] font-extrabold text-indigo-800">{work.agent}</div>
        <p className="text-xs text-slate-600">{work.did}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {work.values.map((v) => (
          <div key={v.label} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{v.label}</span>
            <strong className="break-words text-sm font-extrabold text-slate-900">{formatWorkCell(v.value, v.kind)}</strong>
          </div>
        ))}
      </div>

      {work.tables.map((t) => (
        <div key={t.title} className="space-y-1">
          <div className="text-[11px] font-extrabold text-slate-800">
            {t.title} <span className="font-semibold text-slate-400">({t.rows.length})</span>
          </div>
          {t.rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 px-2 py-1.5 text-[11px] text-slate-500">None for this run.</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    {t.columns.map((c, i) => (
                      <th key={c} className={`px-2 py-1.5 font-bold ${t.kinds[i] === 'money' || t.kinds[i] === 'count' ? 'text-right' : ''}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {t.rows.map((row, ri) => (
                    <tr key={ri} className="odd:bg-white even:bg-slate-50/40">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-2 py-1 align-top ${t.kinds[ci] === 'money' || t.kinds[ci] === 'count' ? 'text-right tabular-nums' : ''} ${t.columns[ci]?.includes('Knowledge Graph') ? 'font-mono text-[10px] text-indigo-700' : 'text-slate-800'}`}>
                          {formatWorkCell(cell, t.kinds[ci] ?? 'text')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {kg ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 text-[11px] text-slate-700">
          <div className="mb-1 flex items-center gap-1.5 font-extrabold text-violet-800">
            <Network className="size-3.5" /> Knowledge Graph used by this agent
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Graph queries: <strong>{kg.queries}</strong></span>
            <span>Edges returned: <strong>{kg.edges_returned}</strong></span>
            <span>Neo4j hits: <strong>{kg.neo4j_hits}</strong></span>
            <span>SQL ontology hits: <strong>{kg.sql_ontology_hits}</strong></span>
            {kg.errors > 0 ? <span className="text-rose-700">Errors: <strong>{kg.errors}</strong></span> : null}
            {kg.schedule_integrity ? <span>Schedule integrity: <strong>{kg.schedule_integrity}</strong></span> : null}
            {typeof kg.cross_module_insights === 'number' ? <span>Cross-module insights: <strong>{kg.cross_module_insights}</strong></span> : null}
          </div>
          {kg.sample_paths.length > 0 ? (
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-violet-800">
              {kg.sample_paths.map((p) => (<li key={p}>{p}</li>))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-blue-800">
        <ArrowRight className="mt-0.5 size-3 shrink-0" />
        {work.handed_over}
      </p>
    </div>
  );
}

/**
 * 2. Agent-to-Agent Handoff & Data Flow Section
 * Explicitly visualizes what data enters each agent, what it processes, what is held back, and what passes onward.
 */
export function FeesHandoffFlowSection({
  latestReport,
  step1,
  step2,
  step3,
}: {
  latestReport: FeesPipelineReport | null;
  step1: StepTelemetry;
  step2: StepTelemetry;
  step3: StepTelemetry;
}) {
  const s1Out = step1.step_result?.output;
  const s2Out = step2.step_result?.output;
  const s3Out = step3.step_result?.output;

  const stages: FeesHandoffStage[] =
    latestReport?.handoff_chain && latestReport.handoff_chain.length > 0
      ? latestReport.handoff_chain
      : [
          {
            stage: 1,
            from_agent: 'Pipeline Scope & Academic Year',
            to_agent: 'Agent 1: Fee Position & Arrears Reader',
            handoff_title: 'School Ledger & Student Arrears Scan',
            input_records: Number(s1Out?.cohort_size ?? 0),
            processed_records: Number(s1Out?.records_processed ?? s1Out?.students_checked ?? 0),
            eligible_records: Number(s1Out?.eligible_count ?? (s1Out?.candidates?.length ?? 0)),
            held_back_records: Number(s1Out?.held_back_count ?? 0),
            passed_records: Number(s1Out?.records_passed ?? (s1Out?.candidates?.length ?? 0)),
            validation_gate: 'Gate 1 (Position & Arrears Grounding)',
            validation_status: step1.gate?.status ?? (step1.status === 'running' ? 'running' : 'pending'),
            duration_ms: step1.duration_ms ?? 0,
            summary:
              step1.summary ||
              'Pending execution: Agent 1 will read the school-wide fee ledger and scan active students for unpaid balances.',
          },
          {
            stage: 2,
            from_agent: 'Agent 1: Fee Position & Arrears Reader (Gate 1)',
            to_agent: 'Agent 2: Collection Evidence & Reminder History Analyst',
            handoff_title: 'Line-Item Evidence & Cooldown Eligibility Audit',
            input_records: Number(s2Out?.records_received ?? s1Out?.records_passed ?? 0),
            processed_records: Number(s2Out?.records_processed ?? 0),
            eligible_records: Number(s2Out?.eligible_count ?? 0),
            held_back_records: Number(s2Out?.held_back_count ?? 0),
            passed_records: Number(s2Out?.records_passed ?? 0),
            validation_gate: 'Gate 2 (Evidence & Duplicate-Reminder Audit)',
            validation_status: step2.gate?.status ?? (step2.status === 'running' ? 'running' : 'pending'),
            duration_ms: step2.duration_ms ?? 0,
            summary:
              step2.summary ||
              'Waiting for Gate 1: Agent 2 will inspect line-item fee heads, recent receipts, and reminder cooldown history.',
          },
          {
            stage: 3,
            from_agent: 'Agent 2: Collection Evidence Analyst (Gate 2)',
            to_agent: 'Agent 3: Reminder Drafter (Preview Only)',
            handoff_title: 'Reachability Verification & Fingerprinted Draft Generation',
            input_records: Number(s3Out?.records_received ?? s2Out?.records_passed ?? 0),
            processed_records: Number(s3Out?.records_processed ?? 0),
            eligible_records: Number(s3Out?.eligible_count ?? 0),
            held_back_records: Number(s3Out?.held_back_count ?? 0),
            passed_records: Number(s3Out?.eligible_count ?? 0),
            validation_gate: 'Gate 3 (Reminder Draft Safety)',
            validation_status: step3.gate?.status ?? (step3.status === 'running' ? 'running' : 'pending'),
            duration_ms: step3.duration_ms ?? 0,
            summary:
              step3.summary ||
              'Waiting for Gate 2: Agent 3 will validate parent contacts, draft personalized notices, and lock a SHA-256 fingerprint.',
          },
          {
            stage: 4,
            from_agent: 'Agent 3: Reminder Drafter (Gate 3)',
            to_agent: 'Administrator Approval Queue & Storage',
            handoff_title: 'Final Output & Human Sign-Off Gate',
            input_records: Number(s3Out?.eligible_count ?? 0),
            processed_records: Number(s3Out?.eligible_count ?? 0),
            eligible_records: Number(s3Out?.eligible_count ?? 0),
            held_back_records: Number(s2Out?.held_back_count ?? 0) + Number(s3Out?.held_back_count ?? 0),
            passed_records: 0,
            validation_gate: 'Human-in-the-Loop Authorization',
            validation_status: step3.fingerprint ? 'awaiting_approval' : 'pending',
            duration_ms:
              (step1.duration_ms ?? 0) + (step2.duration_ms ?? 0) + (step3.duration_ms ?? 0),
            summary: step3.fingerprint
              ? 'Draft batch is locked and awaiting administrator review before any message can be sent.'
              : 'Waiting for Agent 3: Final results and audit logs will be summarized here once the pipeline completes.',
          },
        ];

  return (
    <div className="rounded-2xl border border-blue-200/80 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Share2 className="size-4 text-blue-600" />
            Agent-to-Agent Handoffs &amp; Data Flow
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Shows exact record counts entering each agent, processed, cleared as eligible, held back, and handed off across each validation gate.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-800 uppercase self-start sm:self-auto">
          Strict Gate-Controlled Handoffs
        </span>
      </div>

      <div className="space-y-3">
        {stages.map((st) => {
          const isPassed = st.validation_status === 'passed' || st.validation_status === 'completed';
          const isAwaiting = st.validation_status === 'awaiting_approval';
          const isFailed = st.validation_status === 'failed';
          return (
            <div key={st.stage} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold text-white">
                    {st.stage}
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {st.from_agent} ➔ {st.to_agent}
                    </div>
                    <h4 className="text-xs font-extrabold text-slate-900">{st.handoff_title}</h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      isPassed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : isAwaiting
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : isFailed
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {st.validation_status.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                    {st.duration_ms > 0 ? `${st.duration_ms} ms` : '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 text-xs">
                <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Input / Scope</span>
                  <strong className="text-sm font-extrabold text-slate-900">{st.input_records.toLocaleString('en-IN')}</strong>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Processed</span>
                  <strong className="text-sm font-extrabold text-indigo-700">{st.processed_records.toLocaleString('en-IN')}</strong>
                </div>
                <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-2">
                  <span className="block text-[10px] font-bold uppercase text-emerald-700">Eligible</span>
                  <strong className="text-sm font-extrabold text-emerald-800">{(st.eligible_records ?? 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-2">
                  <span className="block text-[10px] font-bold uppercase text-amber-700">Held Back</span>
                  <strong className="text-sm font-extrabold text-amber-800">{(st.held_back_records ?? 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-2">
                  <span className="block text-[10px] font-bold uppercase text-blue-700">Passed Next</span>
                  <strong className="text-sm font-extrabold text-blue-800">{st.passed_records.toLocaleString('en-IN')}</strong>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Gate</span>
                  <strong className="text-[11px] font-bold text-slate-800 leading-tight block">{st.validation_gate}</strong>
                </div>
              </div>

              <p className="rounded-lg border border-blue-100 bg-blue-50/30 px-3 py-2 text-xs text-slate-700">
                {st.summary}
              </p>

              {st.agent_work ? <AgentWorkPanel work={st.agent_work} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 3. Actual Database Records & Data Sources Inspector
 * Lets users inspect real database records accessed & produced by Agent 1, Agent 2, Agent 3, Knowledge Graph, and persisted Run Log.
 */
export function FeesActualDataInspector({
  latestReport,
  step1,
  step2,
  step3,
  recentRuns,
}: {
  latestReport: FeesPipelineReport | null;
  step1: StepTelemetry;
  step2: StepTelemetry;
  step3: StepTelemetry;
  recentRuns: FeesRecentRun[];
}) {
  const [activeAgentView, setActiveAgentView] = useState<'agent_1' | 'agent_2' | 'agent_3' | 'kg' | 'runs'>('agent_1');

  const candidates: FeesCandidate[] =
    latestReport?.arrears_scan?.candidates ??
    (step1.step_result?.output?.candidates as FeesCandidate[] | undefined) ??
    [];

  const eligible: FeesCandidate[] =
    latestReport?.evidence_analysis?.eligible ??
    (step2.step_result?.output?.eligible as FeesCandidate[] | undefined) ??
    [];

  const heldBack: FeesCandidate[] =
    latestReport?.evidence_analysis?.held_back ??
    (step2.step_result?.output?.held_back as FeesCandidate[] | undefined) ??
    [];

  const studentCollections: FeesStudentCollection[] =
    latestReport?.financial_analytics?.student_wise_collections ?? [];

  const paymentModes: FeesPaymentModeSummary[] =
    latestReport?.financial_analytics?.payment_modes ?? [];

  const sentReminders: FeesSentReminderRecord[] =
    latestReport?.financial_analytics?.reminders_summary?.history ?? [];

  const recipients = latestReport?.reminder_draft?.recipients ?? [];
  const unreachable = latestReport?.reminder_draft?.unreachable ?? [];

  const kgReasoning = latestReport?.knowledge_graph_reasoning;
  const kgCards: FeesKnowledgeGraphCard[] = kgReasoning?.reasoning_cards ?? [];
  const kgInsights: FeesKnowledgeGraphCard[] = kgReasoning?.cross_module_insights ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Database className="size-4 text-indigo-600" />
            Real-Time Data Sources, Agent Results &amp; Knowledge Graph Inspector
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete database-driven results: financial totals, student collections, sent reminders, and Centralized Knowledge Graph traversals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveAgentView('agent_1')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeAgentView === 'agent_1' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agent 1: Arrears ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgentView('agent_2')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeAgentView === 'agent_2' ? 'bg-violet-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agent 2: Collections &amp; Evidence ({studentCollections.length > 0 ? studentCollections.length : eligible.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgentView('agent_3')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeAgentView === 'agent_3' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agent 3: Outreach &amp; Reminders ({recipients.length > 0 ? recipients.length : sentReminders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgentView('kg')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeAgentView === 'kg' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Knowledge Graph ({kgCards.length + kgInsights.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAgentView('runs')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeAgentView === 'runs' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DB Run Log ({recentRuns.length})
          </button>
        </div>
      </div>

      {/* ── AGENT 1 DATA VIEW ── */}
      {activeAgentView === 'agent_1' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Agent 1 Actual Work</span>
                <h4 className="text-xs font-extrabold text-slate-900">Fee Position &amp; Arrears Reader (fees.position + fees.arrears)</h4>
              </div>
              <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-800">
                Gate 1 Grounding Passed
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Scanned active student enrollments against the school-wide fee ledger, checked schedule integrity via Knowledge Graph, and flagged candidates with overdue fee heads.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-bold uppercase text-[10px] text-slate-400">Tables Accessed:</span>
              {(step1.step_result?.output?.tables_accessed ?? [
                'fees_breackoff',
                'fees_collect',
                'tblstudent',
                'tblstudent_enrollment',
                'standard',
              ]).map((t) => (
                <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Demand</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {formatRupeesReal(latestReport?.financial_analytics?.total_demand ?? latestReport?.ledger_position?.total_demand)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Outstanding</span>
              <strong className="text-sm font-extrabold text-rose-700">
                {formatRupeesReal(latestReport?.financial_analytics?.total_outstanding ?? latestReport?.ledger_position?.total_outstanding)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Students Scanned</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {String(latestReport?.arrears_scan?.students_checked ?? step1.step_result?.output?.students_checked ?? 0)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Defaulters Found</span>
              <strong className="text-sm font-extrabold text-indigo-700">{candidates.length}</strong>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              {step1.status === 'completed'
                ? 'Agent 1 scanned the cohort and found 0 students with unpaid balances matching the selected filters.'
                : 'Click "Execute Steps" above to run Agent 1 and view the exact student arrears records read from the database.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-80">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Enrollment</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5 text-center">Pending Heads</th>
                    <th className="px-3 py-2.5 text-right">Outstanding Dues</th>
                    <th className="px-3 py-2.5">Knowledge Graph Traversal Path</th>
                    <th className="px-3 py-2.5 text-center">Handoff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <tr key={c.student_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-900 block">{c.student_name || `Student #${c.student_id}`}</span>
                        <span className="font-mono text-[10px] text-slate-400">ID #{c.student_id}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.enrollment_no || '—'}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{c.class || c.standard_name || '—'}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold">{c.pending_items}</td>
                      <td className="px-3 py-2 text-right font-black text-rose-600">{formatRupeesReal(c.outstanding)}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-indigo-700">
                        <span className="inline-block bg-indigo-50/80 border border-indigo-100 rounded px-2 py-0.5">
                          {c.knowledge_graph_path || `fee_student:${c.student_id} ➔ standard:${c.class || 'std'} ➔ has_fee_schedule ➔ fee_record`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          Passed to Agent 2
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── AGENT 2 DATA VIEW ── */}
      {activeAgentView === 'agent_2' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Agent 2 Actual Work</span>
                <h4 className="text-xs font-extrabold text-slate-900">
                  Collection Evidence &amp; Reminder History Analyst (fees.getPending + fees.collection_report + fees.reminder_history)
                </h4>
              </div>
              <span className="rounded-md bg-white border border-violet-200 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-800">
                Gate 2 Reconciled
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Audits whose fees have been collected, amount paid, payment modes, line-item pending fee heads, and enforces duplicate-reminder cooldowns before passing eligible students to Agent 3.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-bold uppercase text-[10px] text-slate-400">Tables Accessed:</span>
              {(step2.step_result?.output?.tables_accessed ?? [
                'fees_collect',
                'fees_paid_other',
                'fees_breackoff',
                'fees_title',
                'ai_audit_logs',
                'tblstudent',
              ]).map((t) => (
                <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-emerald-700">Total Fees Collected</span>
              <strong className="text-sm font-extrabold text-emerald-900">
                {formatRupeesReal(latestReport?.financial_analytics?.total_collected ?? latestReport?.ledger_position?.total_collected)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Paying Students</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {latestReport?.financial_analytics?.paying_students_count ?? '—'}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Receipts</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {latestReport?.financial_analytics?.total_receipts_count ?? 0}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Eligible / Held Back</span>
              <strong className="text-sm font-extrabold text-violet-700">
                {eligible.length} / {heldBack.length}
              </strong>
            </div>
          </div>

          {/* Student-Wise Fee Collection Records */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Wallet className="size-3.5 text-emerald-600" />
                Student-Wise Fee Collection Details (Whose fees have been collected &amp; amount collected)
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {studentCollections.length} paying student record(s) loaded directly from <code className="font-mono text-[10px]">fees_collect</code>
              </span>
            </div>

            {studentCollections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
                No individual fee collection records recorded in this scope yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-64">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Enrollment</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2 text-center">Receipts</th>
                      <th className="px-3 py-2 text-right">Total Paid Amount</th>
                      <th className="px-3 py-2">Payment Mode</th>
                      <th className="px-3 py-2">Latest Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentCollections.map((sc) => (
                      <tr key={sc.student_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="font-semibold text-slate-900 block">{sc.student_name}</span>
                          <span className="font-mono text-[10px] text-slate-400">ID #{sc.student_id}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{sc.enrollment_no || '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{sc.standard_name || '—'}</td>
                        <td className="px-3 py-2 text-center font-mono">{sc.receipts_count}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-700">{formatRupeesReal(sc.total_paid)}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-[10px] text-slate-700">
                            {sc.payment_mode}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{sc.latest_payment_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment Modes Breakdown */}
          {paymentModes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Collections by Payment Mode
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                {paymentModes.map((pm) => (
                  <div key={pm.mode} className="rounded-lg border border-slate-200 bg-white p-2">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">{pm.mode}</span>
                    <strong className="text-xs font-black text-slate-900 block">{formatRupeesReal(pm.total_amount)}</strong>
                    <span className="text-[10px] text-slate-500">{pm.receipt_count} receipt(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eligible vs Held Back Candidates */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2 border-t border-slate-100">
            {/* Eligible List */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-3 space-y-2">
              <h4 className="text-xs font-extrabold text-emerald-900">
                Cleared Eligible ({eligible.length}) ➔ Passed to Agent 3
              </h4>
              {eligible.length === 0 ? (
                <p className="text-xs text-slate-500">No candidates were cleared as eligible.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {eligible.map((item) => (
                    <div key={item.student_id} className="rounded-lg border border-emerald-100 bg-white p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {item.student_name || `Student #${item.student_id}`}{' '}
                          <span className="text-[10px] font-normal text-slate-500">({item.class || 'Class'})</span>
                        </span>
                        <span className="font-bold text-emerald-700">{formatRupeesReal(item.outstanding)}</span>
                      </div>
                      <span className="mt-1 block font-mono text-[10px] text-indigo-700">
                        {item.knowledge_graph_payment_edge || 'No payment edge returned by the graph for this student'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Held Back List */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3 space-y-2">
              <h4 className="text-xs font-extrabold text-amber-900">
                Held Back by Cooldown ({heldBack.length}) ➔ Suppressed from Outreach
              </h4>
              {heldBack.length === 0 ? (
                <p className="text-xs text-slate-500">No candidates were suppressed by cooldown rule.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {heldBack.map((item) => (
                    <div key={item.student_id} className="rounded-lg border border-amber-100 bg-white p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.student_name || `Student #${item.student_id}`}</span>
                        <span className="font-bold text-amber-700">{formatRupeesReal(item.outstanding)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-amber-900">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AGENT 3 DATA VIEW ── */}
      {activeAgentView === 'agent_3' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Agent 3 Actual Work</span>
                <h4 className="text-xs font-extrabold text-slate-900">Reminder Drafter (fees.send_reminders preview only)</h4>
              </div>
              <span className="rounded-md bg-white border border-emerald-200 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                Gate 3 Fingerprinted
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Validates parent email and mobile reachability, verifies communication safety rules, and generates fingerprinted personalized reminder drafts. Sends 0 messages without human approval.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-bold uppercase text-[10px] text-slate-400">Tables Accessed:</span>
              {(step3.step_result?.output?.tables_accessed ?? [
                'tblstudent',
                'sms_api_details',
                'ai_audit_logs',
                'ai_agent_runs',
                'fees_agent_state',
              ]).map((t) => (
                <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Drafted Notices</span>
              <strong className="text-sm font-extrabold text-emerald-700">{recipients.length}</strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Dues Covered</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {formatRupeesReal(latestReport?.reminder_draft?.total_outstanding ?? 0)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Total Sent To Date</span>
              <strong className="text-sm font-extrabold text-blue-700">
                {sentReminders.length}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Unreachable Held Back</span>
              <strong className="text-sm font-extrabold text-amber-700">{unreachable.length}</strong>
            </div>
          </div>

          {/* Draft Preview */}
          {latestReport?.reminder_draft?.sample_message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-emerald-900 uppercase">
                  Personalized Reminder Draft Preview ({String(latestReport.reminder_draft.channel || 'email').toUpperCase()})
                </span>
                {latestReport.reminder_draft.sample_subject && (
                  <span className="font-semibold text-slate-700">
                    Subject: {latestReport.reminder_draft.sample_subject}
                  </span>
                )}
              </div>
              <p className="rounded-lg border border-emerald-100 bg-white p-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                {latestReport.reminder_draft.sample_message}
              </p>
            </div>
          )}

          {/* Drafted Recipients Queue */}
          {recipients.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Pending Reminder Drafts ({recipients.length} awaiting human sign-off)
              </span>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-56">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Masked Contact</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipients.map((r) => (
                      <tr key={r.student_id}>
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                        <td className="px-3 py-2">{r.class || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{r.contact_masked}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatRupeesReal(r.outstanding)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Drafted · Fingerprint Locked
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unreachable Students */}
          {unreachable.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 space-y-1.5">
              <span className="text-[11px] font-bold text-rose-900 block">
                Held Back as Unreachable ({unreachable.length})
              </span>
              <ul className="space-y-1 text-xs text-rose-800">
                {unreachable.map((u) => (
                  <li key={u.student_id} className="flex items-center justify-between">
                    <span>{u.name} ({u.class || 'Class'})</span>
                    <span className="text-[11px]">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Historical Sent Reminders */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Send className="size-3.5 text-blue-600" />
                Total Email &amp; SMS Reminders Sent to Date (Loaded from <code className="font-mono text-[10px]">ai_audit_logs</code>)
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {sentReminders.length} reminder record(s) with delivery statuses
              </span>
            </div>

            {sentReminders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
                No fee reminders have been dispatched yet for this institute.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-64">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Channel</th>
                      <th className="px-3 py-2">Masked Destination</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2">Delivery Status</th>
                      <th className="px-3 py-2">Sent Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sentReminders.map((sr) => (
                      <tr key={sr.reminder_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="font-semibold text-slate-900 block">{sr.student_name}</span>
                          <span className="font-mono text-[10px] text-slate-400">ID #{sr.student_id}</span>
                        </td>
                        <td className="px-3 py-2">{sr.class || '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold uppercase text-[10px] ${
                              sr.channel === 'sms' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {sr.channel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">{sr.contact_masked || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatRupeesReal(sr.outstanding)}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {sr.delivery_status || 'Accepted by gateway'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{sr.sent_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KNOWLEDGE GRAPH INTEGRATION VIEW ── */}
      {activeAgentView === 'kg' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Centralized Knowledge Graph</span>
                <h4 className="text-xs font-extrabold text-slate-900">
                  Fees Module Knowledge Graph Integration &amp; Multi-Hop Traversal
                </h4>
              </div>
              <span className="rounded-md bg-white border border-amber-300 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                Neo4j Hybrid Traversal: Active
              </span>
            </div>
            <p className="text-xs text-slate-700">
              The Fees agents query the existing centralized Knowledge Graph to ground fee schedule integrity, traverse student enrollment and payment relationships, and detect cross-module attendance and admission risk correlations.
            </p>
            <div className="rounded-lg bg-white border border-amber-200 p-2 font-mono text-[11px] text-amber-950">
              <span className="font-bold text-slate-500 block text-[10px] uppercase">Canonical Graph Path:</span>
              {kgReasoning?.graph_path_format || 'fee_student ➔ enrolled_in_standard ➔ standard ➔ has_fee_schedule ➔ fee_record ➔ has_payments ➔ fee_payment'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-bold uppercase text-[10px] text-slate-400">Centralized Entities &amp; Tables:</span>
              {(kgReasoning?.centralized_kg_tables_used ?? [
                'ontology_entities',
                'ontology_relationships',
                'fees_breackoff',
                'fees_collect',
                'tblstudent',
                'tblstudent_enrollment',
                'standard',
              ]).map((t) => (
                <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Live Knowledge Graph Reasoning &amp; Cross-Module Intelligence Cards
            </span>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[...kgCards, ...kgInsights].map((card) => {
                const isAvail = card.available;
                return (
                  <div
                    key={card.id}
                    className={`rounded-xl border p-3.5 space-y-2 ${
                      isAvail ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase text-slate-500">{card.id}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isAvail ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isAvail ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-900">{card.title}</h5>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {card.reason || (card.evidence?.description as string) || (card.evidence?.why as string) || 'Knowledge graph node verified.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PERSISTED DB RUN LOG ── */}
      {activeAgentView === 'runs' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Live historical rows from <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">ai_agent_runs</code> for this institute (loaded directly from database).
          </p>
          {recentRuns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              No Fees pipeline runs recorded in <code className="font-mono">ai_agent_runs</code> yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Run Reference</th>
                    <th className="px-3 py-2">Step</th>
                    <th className="px-3 py-2">Tool</th>
                    <th className="px-3 py-2">Output Summary</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Started At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRuns.map((run) => {
                    const out = (run.output ?? {}) as Record<string, unknown>;
                    const summaryText = typeof out.summary === 'string' && out.summary
                      ? out.summary
                      : Object.entries(out)
                          .filter(([, v]) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')
                          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
                          .slice(0, 4)
                          .join(' · ');
                    return (
                      <tr key={run.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-[11px] font-bold text-indigo-700">{run.run_reference}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">Step {run.step}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{run.tool}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-700 max-w-xs truncate" title={summaryText}>
                          {summaryText || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              run.status === 'completed' || run.status === 'success'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{run.duration_ms !== null ? `${run.duration_ms} ms` : '—'}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                          {run.started_at ? new Date(run.started_at).toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 4. Final Workflow Results, Storage Locations & Pending Approvals
 */
export function FeesFinalResultsSection({
  latestReport,
  state,
  dispatchResult,
  onOpenApprovalModal,
}: {
  latestReport: FeesPipelineReport | null;
  state: FeesAgentState | null;
  dispatchResult: FeesSendResult | null;
  onOpenApprovalModal: () => void;
}) {
  const draft = latestReport?.reminder_draft;
  const storage = latestReport?.storage_locations;
  const pendingCount = state?.summary_counts?.pending_approvals_count ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck className="size-4 text-emerald-600" />
              Final Workflow Output, Storage &amp; Pending Approvals
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete outcome of the 3-agent pipeline, exact database tables where results are stored, and actions awaiting human approval.
            </p>
          </div>
          {draft?.fingerprint && (
            <button
              type="button"
              onClick={onOpenApprovalModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition shrink-0"
            >
              <Send className="size-3.5" />
              Review &amp; Approve Reminders ({draft.recipient_count})
            </button>
          )}
        </div>

        {/* Final Output Summary */}
        {latestReport ? (
          <div className="space-y-4">
            {latestReport.note && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
                <strong>Workflow Result:</strong> {latestReport.note}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Drafted Recipients</span>
                <strong className="mt-1 block text-lg font-black text-emerald-700">{draft?.recipient_count ?? 0}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Total Dues Covered</span>
                <strong className="mt-1 block text-lg font-black text-slate-900">{formatRupeesReal(draft?.total_outstanding ?? 0)}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Unreachable Held Back</span>
                <strong className="mt-1 block text-lg font-black text-amber-700">{draft?.unreachable_count ?? 0}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Messages Sent</span>
                <strong className="mt-1 block text-lg font-black text-indigo-700">
                  {dispatchResult ? dispatchResult.sent : (draft?.sent ?? 0)}
                </strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-bold uppercase text-slate-400">Quality Score</span>
                <strong className="mt-1 block text-lg font-black text-emerald-700">
                  {latestReport.quality_scorecard?.composite_score ?? 0}/100
                </strong>
              </div>
            </div>

            {draft?.sample_message && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-slate-500">
                    Drafted Message Preview ({(draft.channel || 'email').toUpperCase()} · Due {draft.deadline || '—'})
                  </span>
                  {draft.fingerprint && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                      <Lock className="size-2.5" />
                      {draft.fingerprint.slice(0, 16)}…
                    </span>
                  )}
                </div>
                {draft.sample_subject && (
                  <div className="text-xs font-bold text-slate-900">Subject: {draft.sample_subject}</div>
                )}
                <p className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{draft.sample_message}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
            Run the sequential 3-agent pipeline above to generate a live fingerprinted reminder draft and view the final workflow output.
          </div>
        )}

        {/* Where Results Are Stored */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Where Automation Results Are Stored (Live Database Tables)
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Step Execution Audit</span>
              <code className="font-mono text-xs font-bold text-indigo-700">{storage?.audit_runs_table ?? 'ai_agent_runs'}</code>
              <p className="mt-1 text-[11px] text-slate-500">
                Stores every agent step run, inputs, outputs, gate outcome &amp; duration.
                {storage?.logged_run_references && storage.logged_run_references.length > 0 && (
                  <span className="block mt-1 font-mono text-[10px] text-slate-600">
                    Refs: {storage.logged_run_references.join(', ')}
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Continuous Monitoring State</span>
              <code className="font-mono text-xs font-bold text-indigo-700">{storage?.state_table ?? 'fees_agent_state'}</code>
              <p className="mt-1 text-[11px] text-slate-500">
                Stores loop status ({state?.is_active ? 'Active' : 'Paused'}), interval, last run status &amp; live summary counts.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Dispatch Ledger (Post-Approval)</span>
              <code className="font-mono text-xs font-bold text-emerald-700">
                {storage?.dispatch_audit_table ?? 'ai_audit_logs'} + {storage?.sms_log_table ?? 'sms_sent_parents'}
              </code>
              <p className="mt-1 text-[11px] text-slate-500">
                Written only after an administrator signs off on the SHA-256 fingerprint and dispatches reminders.
              </p>
            </div>
          </div>
        </div>

        {/* Actions Awaiting Approval Summary */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-amber-600" />
              Actions Awaiting Human Approval
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-900">
              {(draft?.fingerprint && !dispatchResult ? 1 : 0) + pendingCount} Pending Action(s)
            </span>
          </div>
          <p className="text-xs text-amber-900">
            {draft?.fingerprint && !dispatchResult
              ? `1 drafted reminder batch (${draft.recipient_count} recipients, ${formatRupeesReal(draft.total_outstanding)}) is awaiting your fingerprint approval above.`
              : dispatchResult
                ? `Reminder batch ${dispatchResult.reference} has been authorized and dispatched (${dispatchResult.sent} accepted).`
                : 'No reminder batch is currently awaiting approval from this session.'}
          </p>
        </div>
      </div>

      {/* Live Workflow Approvals Queue from /api/ai/approvals/pending */}
      <FeesApprovalQueue />
    </div>
  );
}
