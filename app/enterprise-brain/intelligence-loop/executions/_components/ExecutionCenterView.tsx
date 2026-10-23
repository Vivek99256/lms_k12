'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Search, X } from 'lucide-react';
import type { BrainExecutionCenterPayload, BrainExecutionCounts, BrainExecutionRecord } from '@/lib/brain/api';
import {
  ATTENTION_LABEL,
  GROUP_LABEL,
  GROUP_ORDER,
  GROUP_TONE,
  OUTCOME_STATE,
  SEVERITY_TONE,
  TONE_CLASS,
  ageText,
  changeText,
  formatWhen,
  ofText,
  type Tone,
} from '@/lib/brain/execution-center';
import { Card } from '../../../_components/primitives';

/**
 * The Execution Center, as a pure view of the backend payload.
 *
 * It answers, in order: what is the state of the work (health), what proves it (verification), what
 * needs doing (attention), what changed (impact), and the full record (history). Nothing is computed
 * here: counts, verification states and attention reasons all come from the backend's single set of
 * rules. Sample records are always labelled and never mixed into the real tallies.
 */

export interface ExecutionFilters {
  status: string;
  sample: string;
  q: string;
  page: number;
}

export interface ExecutionDetailState {
  record: BrainExecutionRecord | null;
  loading: boolean;
  error: string;
}

export type ExecutionSection = 'health' | 'verification' | 'attention' | 'impact' | 'history';

function Badge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

function SampleBadge() {
  return (
    <Badge tone="amber" title="Demonstration data written by the seeder. It is not a real institutional record.">
      Sample data
    </Badge>
  );
}

function SectionTitle({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-sm font-semibold tracking-tight text-slate-800">
        {title}
      </h2>
      {note ? <p className="text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- health */

function HealthSection({ data }: { data: BrainExecutionCenterPayload }) {
  const real = data.health.real;
  const sample = data.health.sample;
  const tile = (group: (typeof GROUP_ORDER)[number], counts: BrainExecutionCounts) => (
    <div key={group} className="rounded-xl border border-slate-200 bg-white p-4" title={data.definitions.statuses[group]}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{GROUP_LABEL[group]}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{counts[group]}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{data.definitions.statuses[group]}</p>
    </div>
  );

  return (
    <section aria-labelledby="ec-health" className="mb-8">
      <SectionTitle id="ec-health" title="Execution health" note={`${real.total} real execution${real.total === 1 ? '' : 's'}`} />
      {real.total === 0 ? (
        <Card className="p-5 text-sm text-slate-600">
          No real executions have been recorded yet. Executions are created when a recommendation is approved on the Decisions step.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{GROUP_ORDER.map((g) => tile(g, real))}</div>
      )}
      {real.other + real.running + real.rolled_back > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Also: {real.running} running, {real.rolled_back} rolled back, {real.other} with another status.
        </p>
      ) : null}
      {sample.total > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <SampleBadge />
          {sample.total} demonstration execution{sample.total === 1 ? '' : 's'} are held separately and are not in the figures above:{' '}
          {sample.completed} completed, {sample.queued} queued, {sample.failed} failed.
        </p>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------- verification */

function VerificationSection({ data }: { data: BrainExecutionCenterPayload }) {
  const v = data.verification.real;
  const o = data.verification.outcomes;
  const finished = v.finished ?? 0;

  const rows: Array<{ label: string; value: string; hint: string; tone: Tone }> = [
    { label: 'Completed with an outcome', value: ofText(v.withOutcome ?? 0, finished, 'finished executions'), hint: 'An outcome record is linked to the execution through its decision.', tone: 'gray' },
    { label: 'Verified', value: ofText(v.verified ?? 0, finished, 'finished executions'), hint: data.definitions.verification.verified, tone: 'green' },
    { label: 'Measured, no evidence', value: String(v.measured ?? 0), hint: data.definitions.verification.measured, tone: 'amber' },
    { label: 'Reported only', value: String(v.reported ?? 0), hint: data.definitions.verification.reported, tone: 'amber' },
    { label: 'No outcome recorded', value: String(v.noOutcome ?? 0), hint: data.definitions.verification.no_outcome, tone: 'red' },
    { label: 'Evidence linked to the execution', value: ofText(v.withEvidence ?? 0, finished, 'finished executions'), hint: data.definitions.evidence.execution, tone: 'blue' },
  ];

  return (
    <section aria-labelledby="ec-verify" className="mb-8">
      <SectionTitle id="ec-verify" title="Evidence and outcome verification" note="Completed does not mean verified" />
      <Card className="p-5">
        {finished === 0 ? (
          <p className="text-sm text-slate-600">No real execution has finished yet, so there is nothing to verify.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label}>
                <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <span className={`h-2 w-2 rounded-full ${TONE_CLASS[r.tone].split(' ')[0]} ring-1 ring-inset ring-slate-300`} />
                  {r.label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{r.value}</dd>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{r.hint}</p>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 flex items-start gap-1.5 border-t border-gray-100 pt-3 text-xs text-slate-600">
          <Info size={13} className="mt-0.5 shrink-0 text-indigo-500" />
          <span>
            {o.total} outcome record{o.total === 1 ? '' : 's'} in total: {o.linkedToAnExecution} linked to an execution,{' '}
            {o.notLinked} not linked. Linked means the outcome&apos;s decision matches an execution&apos;s decision. Records that are not linked are never
            counted as verified.
          </span>
        </p>
        {finished > 0 && (v.withEvidence ?? 0) === 0 ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              No execution has evidence linked to it, so none can be verified yet. Evidence from the finding behind each action can be linked from the
              execution&apos;s detail view. Nothing is linked automatically.
            </span>
          </p>
        ) : null}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------- attention */

function AttentionSection({ data, onSelect }: { data: BrainExecutionCenterPayload; onSelect: (id: string) => void }) {
  const real = data.attention.filter((a) => !a.isSample);
  const sample = data.attention.filter((a) => a.isSample);
  const row = (a: (typeof data.attention)[number]) => (
    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SEVERITY_TONE[a.severity]}>{ATTENTION_LABEL[a.kind] ?? a.kind}</Badge>
          {a.isSample ? <SampleBadge /> : null}
          <button type="button" onClick={() => onSelect(a.id)} className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-700">
            {a.title}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-600">{a.reason}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          <span className="font-semibold">Next:</span> {a.nextStep}
        </p>
      </div>
      <p className="shrink-0 text-[11px] text-slate-400">
        {a.executor} · approved {ageText(a.ageDays)}
      </p>
    </li>
  );

  return (
    <section aria-labelledby="ec-attention" className="mb-8">
      <SectionTitle id="ec-attention" title="Actions needing attention" note={`${real.length} real, ${sample.length} sample`} />
      <Card className="px-5">
        {data.attention.length === 0 ? (
          <p className="py-5 text-sm text-slate-600">Nothing needs attention: no queued, failed, blocked or evidence-missing execution.</p>
        ) : (
          <>
            {real.length === 0 ? <p className="py-4 text-sm text-slate-600">No real execution needs attention.</p> : null}
            <ul className="divide-y divide-gray-100">{real.map(row)}</ul>
            {sample.length > 0 ? (
              <details className={real.length ? 'border-t border-gray-100 py-3' : 'pb-3'}>
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  {sample.length} sample record{sample.length === 1 ? '' : 's'} (demonstration data)
                </summary>
                <ul className="divide-y divide-gray-100">{sample.map(row)}</ul>
              </details>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------- impact */

function ImpactSection({ data, onSelect }: { data: BrainExecutionCenterPayload; onSelect: (id: string) => void }) {
  const real = data.impact.filter((i) => !i.isSample);
  const sample = data.impact.filter((i) => i.isSample);
  const card = (i: (typeof data.impact)[number]) => {
    const state = OUTCOME_STATE[i.outcomeState];

    return (
      <li key={i.id} className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state.tone} title={state.hint}>
            {state.label}
          </Badge>
          {i.isSample ? <SampleBadge /> : null}
          <button type="button" onClick={() => onSelect(i.id)} className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-700">
            {i.title}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-700">
          Reported result: <span className="font-semibold">{i.result}</span>
          {i.feedback ? ` - "${i.feedback}"` : ''}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {i.measurement ? (
            <>
              <span className="font-semibold">Measured:</span> {changeText(i.measurement)}
              {i.measurement.accountsAffected !== null ? ` (${i.measurement.accountsAffected} affected)` : ''}
            </>
          ) : (
            'No before and after measurement was recorded, so the size of the change is unknown.'
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Recorded {formatWhen(i.recordedAt)} by {i.recordedBy}. {i.confidenceMeaning}
        </p>
      </li>
    );
  };

  return (
    <section aria-labelledby="ec-impact" className="mb-8">
      <SectionTitle id="ec-impact" title="Outcome impact" note="What changed, as reported and measured" />
      <Card className="px-5">
        {data.impact.length === 0 ? (
          <p className="py-5 text-sm text-slate-600">No outcome has been recorded yet. Outcomes are recorded when an execution is reported back.</p>
        ) : (
          <>
            {real.length === 0 ? <p className="py-4 text-sm text-slate-600">No real outcome has been recorded yet.</p> : null}
            <ul className="divide-y divide-gray-100">{real.map(card)}</ul>
            {sample.length > 0 ? (
              <details className={real.length ? 'border-t border-gray-100 py-3' : 'pb-3'}>
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  {sample.length} sample outcome{sample.length === 1 ? '' : 's'} (demonstration data, not institutional results)
                </summary>
                <ul className="divide-y divide-gray-100">{sample.map(card)}</ul>
              </details>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}

/* --------------------------------------------------------------- history */

function HistorySection({
  data,
  filters,
  onFilters,
  onSelect,
}: {
  data: BrainExecutionCenterPayload;
  filters: ExecutionFilters;
  onFilters: (patch: Partial<ExecutionFilters>) => void;
  onSelect: (id: string) => void;
}) {
  const h = data.history;
  const [draft, setDraft] = useState(filters.q);

  return (
    <section aria-labelledby="ec-history" className="mb-8">
      <SectionTitle id="ec-history" title="Execution history" note="The full technical record" />
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onFilters({ q: draft.trim(), page: 1 });
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5"
          >
            <Search size={13} className="text-slate-400" />
            <input
              aria-label="Search executions"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search action, id, person"
              className="w-52 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
            />
          </form>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => onFilters({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="all">All statuses</option>
            {(['queued', 'running', 'completed', 'failed', 'blocked', 'rolled_back', 'other'] as const).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by data type"
            value={filters.sample}
            onChange={(e) => onFilters({ sample: e.target.value, page: 1 })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="all">Real and sample</option>
            <option value="real">Real only</option>
            <option value="sample">Sample only</option>
          </select>
          <span className="ml-auto text-[11px] text-slate-400">{h.total} match{h.total === 1 ? '' : 'es'}</span>
        </div>

        {h.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {filters.q || filters.status !== 'all' || filters.sample !== 'all' ? 'No execution matches these filters.' : 'No executions have been recorded.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-bold">Action</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Status</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Outcome</th>
                  <th scope="col" className="py-2 pr-3 font-bold">By</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Started</th>
                  <th scope="col" className="py-2 font-bold">Completed</th>
                </tr>
              </thead>
              <tbody>
                {h.data.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="max-w-md py-2.5 pr-3">
                      <button type="button" onClick={() => onSelect(r.id)} className="text-left font-semibold text-slate-900 hover:text-indigo-700">
                        {r.title}
                      </button>
                      {r.isSample ? <span className="ml-2"><SampleBadge /></span> : null}
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{r.id}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={GROUP_TONE[r.group]}>{GROUP_LABEL[r.group]}</Badge>
                      {r.error ? <p className="mt-1 max-w-[12rem] text-[11px] text-red-700">{r.error}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={OUTCOME_STATE[r.outcomeState].tone}>{OUTCOME_STATE[r.outcomeState].label}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{r.executor.label}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{formatWhen(r.startedAt ?? r.createdAt)}</td>
                    <td className="py-2.5 text-slate-600">{r.completedAt ? formatWhen(r.completedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {h.lastPage > 1 ? (
          <nav aria-label="Execution history pages" className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-600">
            <button type="button" disabled={h.page <= 1} onClick={() => onFilters({ page: h.page - 1 })} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span>
              Page {h.page} of {h.lastPage}
            </span>
            <button type="button" disabled={h.page >= h.lastPage} onClick={() => onFilters({ page: h.page + 1 })} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </nav>
        ) : null}
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------- detail */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export function ExecutionDetail({
  detail,
  onClose,
  onLinkEvidence,
  linking,
  linkError,
}: {
  detail: ExecutionDetailState;
  onClose: () => void;
  onLinkEvidence?: (executionId: string, evidenceIds: string[]) => void;
  linking?: boolean;
  linkError?: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const r = detail.record;
  const linkedIds = new Set(r?.evidence.execution.map((e) => e.id) ?? []);
  const linkable = (r?.evidence.finding ?? []).filter((e) => !linkedIds.has(e.id));

  return (
    <aside role="dialog" aria-modal="false" aria-label="Execution details" className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Execution details</h2>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900">
          <X size={14} />
        </button>
      </div>

      {detail.loading && !r ? <p className="text-sm text-slate-500">Loading the record…</p> : null}
      {detail.error && !r ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn&apos;t load this execution: {detail.error}</p> : null}

      {r ? (
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone={GROUP_TONE[r.group]}>{GROUP_LABEL[r.group]}</Badge>
              <Badge tone={OUTCOME_STATE[r.outcomeState].tone} title={OUTCOME_STATE[r.outcomeState].hint}>
                {OUTCOME_STATE[r.outcomeState].label}
              </Badge>
              {r.isSample ? <SampleBadge /> : null}
            </div>
            <p className="text-sm font-semibold text-slate-900">{r.title}</p>
          </div>

          {r.attention ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">{ATTENTION_LABEL[r.attention.kind] ?? r.attention.kind}:</span> {r.attention.reason}{' '}
              <span className="font-semibold">Next:</span> {r.attention.nextStep}
            </p>
          ) : null}

          <dl className="space-y-3">
            <Field label="Why it was proposed">{r.reason ?? 'No reason is recorded for this action.'}</Field>
            <Field label="Decision">
              {r.decision ? (
                <>
                  {r.decision.status} by {r.decision.decidedBy} on {formatWhen(r.decision.decidedAt)}
                  {r.decision.rationale ? <span className="block text-slate-600">&quot;{r.decision.rationale}&quot;</span> : null}
                </>
              ) : (
                'No decision is linked to this execution.'
              )}
            </Field>
            <Field label="Action taken by">
              {r.executor.label} ({r.executor.type || 'type not recorded'})
            </Field>
            <Field label="Timeline">
              Approved {formatWhen(r.createdAt)} · started {r.startedAt ? formatWhen(r.startedAt) : 'not recorded'} · completed {r.completedAt ? formatWhen(r.completedAt) : 'not yet'}
            </Field>
            {r.error ? <Field label="Error"><span className="text-red-700">{r.error}</span></Field> : null}
          </dl>

          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Outcome</h3>
            {r.outcome ? (
              <div className="space-y-1 text-sm text-slate-800">
                <p>
                  Reported result: <span className="font-semibold">{r.outcome.result}</span> - recorded {formatWhen(r.outcome.recordedAt)} by {r.outcome.recordedBy}
                </p>
                {r.outcome.feedback ? <p className="text-slate-600">&quot;{r.outcome.feedback}&quot;</p> : null}
                <p>{r.outcome.measurement ? changeText(r.outcome.measurement) : 'No before and after measurement was recorded.'}</p>
                <p className="text-xs text-slate-500">{r.outcome.confidenceMeaning}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{r.group === 'completed' ? 'No outcome is recorded for this completed execution.' : 'No outcome yet: the action has not been completed.'}</p>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Evidence that the action was carried out</h3>
            {r.evidence.execution.length === 0 ? (
              <p className="text-sm text-slate-600">None is linked. Without it this execution cannot be verified. Evidence must be linked by a person.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-700">
                {r.evidence.execution.map((e) => (
                  <li key={e.id}>{e.summary || e.type || e.id} <span className="text-slate-400">({e.source ?? 'source not recorded'})</span></li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Evidence behind the finding ({r.evidence.findingTotal})</h3>
            {r.evidence.finding.length === 0 ? (
              <p className="text-sm text-slate-600">No evidence is attached to the finding that led to this action.</p>
            ) : (
              <>
                <p className="mb-2 text-[11px] text-slate-500">Explains why the action was proposed. It does not prove the action was carried out.</p>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {r.evidence.finding.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      {onLinkEvidence && !linkedIds.has(e.id) ? (
                        <input
                          type="checkbox"
                          aria-label={`Select evidence ${e.summary || e.id}`}
                          checked={picked.includes(e.id)}
                          onChange={(ev) => setPicked((p) => (ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)))}
                          className="mt-0.5"
                        />
                      ) : null}
                      <span>
                        {e.summary || e.type || e.id} <span className="text-slate-400">({e.source ?? 'source not recorded'})</span>
                        {linkedIds.has(e.id) ? <span className="ml-1 text-emerald-700">linked</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {r.evidence.findingTotal > r.evidence.finding.length ? (
                  <p className="mt-1 text-[11px] text-slate-400">Showing {r.evidence.finding.length} of {r.evidence.findingTotal}.</p>
                ) : null}
                {onLinkEvidence && linkable.length > 0 ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={linking || picked.length === 0}
                      onClick={() => onLinkEvidence(r.id, picked)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {linking ? 'Linking…' : picked.length === 0 ? 'Select evidence to link' : `Link ${picked.length} selected as proof the action was carried out`}
                    </button>
                    {linkError ? <p className="mt-1 text-xs text-red-700">{linkError}</p> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">Technical identifiers</summary>
            <dl className="mt-2 space-y-1 font-mono text-[11px]">
              {Object.entries(r.technical).map(([k, v]) => (
                <div key={k} className="break-all">
                  <dt className="inline text-slate-400">{k}: </dt>
                  <dd className="inline">{v === null || v === undefined || v === '' ? '—' : typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ view */

export function ExecutionCenterView({
  data,
  filters,
  onFilters,
  onSelect,
  show = () => true,
}: {
  data: BrainExecutionCenterPayload;
  filters: ExecutionFilters;
  onFilters: (patch: Partial<ExecutionFilters>) => void;
  onSelect: (id: string) => void;
  show?: (section: ExecutionSection) => boolean;
}) {
  if (!data.available) {
    return (
      <Card className="p-6 text-sm text-slate-600">
        The Execution Center is unavailable{data.reason ? `: ${data.reason}` : '.'}
      </Card>
    );
  }

  return (
    <div>
      {data.partial ? <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{data.partial}</p> : null}
      {show('health') && <HealthSection data={data} />}
      {show('verification') && <VerificationSection data={data} />}
      {show('attention') && <AttentionSection data={data} onSelect={onSelect} />}
      {show('impact') && <ImpactSection data={data} onSelect={onSelect} />}
      {show('history') && <HistorySection data={data} filters={filters} onFilters={onFilters} onSelect={onSelect} />}
      <p className="text-[11px] text-slate-400">{data.definitions.confidence}</p>
    </div>
  );
}
