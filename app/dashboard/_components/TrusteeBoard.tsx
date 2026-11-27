'use client';

import React, { useState } from 'react';
import { ArrowUpRight, Gavel, HeartPulse, Lightbulb, Pencil, ShieldQuestion, Target, UserCheck } from 'lucide-react';
import { askAssistant } from '@/lib/exam-help';
import { decideRecommendation, getDashboardSession, setTarget, type RoleWorkspaceWidgets } from '@/app/dashboard/_lib/dashboard-api';
import { EmptyNote, Panel, Pill, SURFACE, type Tone } from '@/app/dashboard/_components/PremiumKit';

/*
 * The board view. A trustee does not run the school, they watch it: is it healthy, what is waiting on me,
 * is management delivering, and can I trust the numbers. Everything operational sits one click below.
 */

const num = (n: number) => n.toLocaleString('en-IN');

type Health = NonNullable<RoleWorkspaceWidgets['health']>[number];

const STATUS: Record<string, { label: string; tone: Tone }> = {
  good: { label: 'On track', tone: 'good' },
  watch: { label: 'Slightly behind', tone: 'watch' },
  act: { label: 'Needs attention', tone: 'act' },
  no_target: { label: 'No target set', tone: 'neutral' },
  no_data: { label: 'No data yet', tone: 'neutral' },
};

/** Which subject each health indicator belongs to, for "more like this". */
const HEALTH_TOPIC: Record<string, string> = { fees_collection_rate: 'fees', attendance_rate: 'attendance', admissions_target: 'admissions', retention_rate: 'students', delivery_rate: 'communication' };
const YEAR_TOPIC = (label: string) => (/enrol|student/i.test(label) ? 'students' : /fee/i.test(label) ? 'fees' : /enquir|admission/i.test(label) ? 'admissions' : undefined);

const show = (h: Health, v: number | null) => (v == null ? '—' : h.unit === '%' ? `${v % 1 ? v.toFixed(1) : v}%` : num(v));

function TargetEditor({ h, onDone }: { h: Health; onDone: () => void }) {
  const [v, setV] = useState(h.target == null ? '' : String(h.target));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const n = Number(v);
    if (!Number.isFinite(n)) return setErr('Enter a number.');
    setBusy(true);
    setErr(null);
    setTarget(getDashboardSession(), h.key, n)
      .then(onDone)
      .catch((e: Error) => setErr(e.message || "Couldn't save."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-2.5 ring-1 ring-inset ring-slate-200">
      <label className="mb-1 block text-[11px] font-medium text-slate-600" htmlFor={`t-${h.key}`}>Target{h.unit === '%' ? ' (%)' : ''}</label>
      <div className="flex gap-2">
        <input id={`t-${h.key}`} type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
          className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40" />
        <button type="button" onClick={save} disabled={busy || v === ''} className="h-8 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400">{busy ? '…' : 'Save'}</button>
        <button type="button" onClick={onDone} className="h-8 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

/** Is the school healthy? A verdict first, then each indicator against the target the school set for it. */
export function HealthCard({ indicators, canSet, onSaved, yearCompare }: { indicators: Health[]; canSet: boolean; onSaved: () => void; yearCompare?: RoleWorkspaceWidgets['year_compare'] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const judged = indicators.filter((i) => ['good', 'watch', 'act'].includes(i.status));
  const good = judged.filter((i) => i.status === 'good').length;
  const act = judged.filter((i) => i.status === 'act').length;
  const none = indicators.filter((i) => i.status === 'no_target').length;
  const verdict = judged.length === 0
    ? { text: 'No targets are set yet, so the school cannot be judged on track or not.', tone: 'neutral' as Tone }
    : act > 0
      ? { text: `${good} of ${judged.length} on track. ${act} need${act === 1 ? 's' : ''} attention.`, tone: 'act' as Tone }
      : good === judged.length
        ? { text: `All ${judged.length} measures are on track.`, tone: 'good' as Tone }
        : { text: `${good} of ${judged.length} on track; the rest are slightly behind.`, tone: 'watch' as Tone };

  return (
    <Panel title="Is the school healthy?" description="Each figure against the target the school set for it" icon={HeartPulse}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pill tone={verdict.tone}>{verdict.tone === 'good' ? 'Healthy' : verdict.tone === 'act' ? 'Needs attention' : verdict.tone === 'watch' ? 'Mostly on track' : 'Not judged'}</Pill>
        <p className="text-sm font-medium text-slate-800">{verdict.text}</p>
        {none > 0 && canSet && <span className="text-xs text-slate-500">{none} measure{none === 1 ? '' : 's'} still need a target — use “Set target”.</span>}
      </div>
      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13.5rem,1fr))]">
        {indicators.map((h) => {
          const st = STATUS[h.status] ?? STATUS.no_data;
          const pct = h.value != null && h.target ? Math.min((h.value / h.target) * 100, 100) : null;
          return (
            <li key={h.key} data-explore={HEALTH_TOPIC[h.key]} className="cursor-pointer rounded-xl bg-white p-3.5 ring-1 ring-slate-900/[0.07] transition-shadow hover:ring-indigo-300">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-slate-600">{h.label}</span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
              <div className="mt-2 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900">{show(h, h.value)}</div>
              {pct != null && (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${Math.round(pct)}% of target`}>
                  <span className={`block h-full rounded-full ${h.status === 'good' ? 'bg-emerald-500' : h.status === 'watch' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500">{h.target != null ? `Target ${show(h, h.target)} · ` : ''}{h.detail}</p>
              {canSet && editing !== h.key && (
                <button type="button" onClick={() => setEditing(h.key)} className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50">
                  {h.target == null ? <><Target size={11} aria-hidden /> Set target</> : <><Pencil size={11} aria-hidden /> Change target</>}
                </button>
              )}
              {editing === h.key && <TargetEditor h={h} onDone={() => { setEditing(null); onSaved(); }} />}
            </li>
          );
        })}
      </ul>
      {yearCompare && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">This year beside last year ({yearCompare.previous_syear})</p>
          <dl className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13.5rem,1fr))]">
            {yearCompare.items.map((i) => {
              const f = (v: number) => (i.unit === 'rupees' ? `₹${num(Math.round(v))}` : num(v));
              return (
                <div key={i.label} data-explore={YEAR_TOPIC(i.label)} className="cursor-pointer rounded-lg bg-slate-50 px-3.5 py-2.5 ring-1 ring-inset ring-slate-100 transition-shadow hover:ring-indigo-300">
                  <dt className="text-xs text-slate-500">{i.label}</dt>
                  <dd className="mt-0.5 flex items-baseline gap-2 text-slate-900"><span className="text-lg font-semibold tabular-nums">{f(i.current)}</span><span className="text-xs text-slate-500">now</span></dd>
                  <dd className="text-xs text-slate-500">{i.previous > 0 ? `${f(i.previous)} last year` : 'No record last year'}</dd>
                </div>
              );
            })}
          </dl>
          {yearCompare.caution && <p role="note" className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">{yearCompare.caution}</p>}
        </div>
      )}
    </Panel>
  );
}

/** Recommendations waiting for a decision. The decision itself is recorded in the Intelligence Workspace. */
type Verdict = 'approved' | 'rejected' | 'deferred';
const VERDICT: Record<Verdict, { label: string; done: string; cls: string }> = {
  approved: { label: 'Approve', done: 'approved', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  rejected: { label: 'Reject', done: 'rejected', cls: 'bg-red-600 text-white hover:bg-red-700' },
  deferred: { label: 'Defer', done: 'deferred', cls: 'bg-slate-700 text-white hover:bg-slate-800' },
};

/** One recommendation's decision form. Nothing is recorded until the reason is written and the button pressed. */
function DecideForm({ id, verdict, onCancel, onDone }: { id: string; verdict: Verdict; onCancel: () => void; onDone: () => void }) {
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = VERDICT[verdict];
  const submit = () => {
    setBusy(true);
    setErr(null);
    decideRecommendation(getDashboardSession(), id, verdict, why.trim())
      .then(onDone)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3 ring-1 ring-inset ring-slate-200 print:hidden">
      <label htmlFor={`why-${id}`} className="mb-1 block text-xs font-medium text-slate-700">Your reason for this decision (kept on record)</label>
      <textarea id={`why-${id}`} value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={2000} className="w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40" placeholder="For example: agreed, go ahead this month" />
      <p className="mt-1 text-[11px] text-slate-500">This records your decision in the Enterprise Brain{verdict === 'approved' ? ' and may queue the linked action; nothing else is sent' : ''}.</p>
      {err && <p role="alert" className="mt-1.5 text-xs text-red-700">{err}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || why.trim().length < 3} className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:bg-slate-200 disabled:text-slate-400 ${v.cls}`}>{busy ? 'Recording…' : `Confirm: ${v.label.toLowerCase()}`}</button>
      </div>
    </div>
  );
}

export function DecisionsCard({ data, open, canDecide, onDecided }: { data: NonNullable<RoleWorkspaceWidgets['decisions_for_me']>; open?: () => void; canDecide?: boolean; onDecided?: () => void }) {
  const [form, setForm] = useState<{ id: string; verdict: Verdict } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Panel
      title="Decisions waiting for me" icon={Gavel}
      description={data.total === 0 ? 'Nothing is waiting' : `${num(data.total)} awaiting a decision · ${num(data.urgent)} urgent`}
      action={open ? <button type="button" onClick={open} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">Open workspace <ArrowUpRight size={13} aria-hidden /></button> : undefined}
      className="h-full"
    >
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-100">{notice}</p>}
      {data.items.length === 0 ? (
        <EmptyNote icon={Gavel}>No recommendation needs your decision.</EmptyNote>
      ) : (
        <ul className="space-y-4">
          {data.items.map((d) => (
            <li key={d.id} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="mb-1 flex flex-wrap items-center gap-2"><Pill tone={d.urgency === 'high' ? 'act' : 'watch'}>{d.urgency === 'high' ? 'Urgent' : 'Normal'}</Pill>{d.impact && <span className="text-[11px] text-slate-500">Affects {d.impact}</span>}</div>
              <p className="text-sm font-semibold leading-snug text-slate-900">{d.title}</p>
              {d.why && <p className="mt-1 text-xs leading-relaxed text-slate-500">{d.why}</p>}
              <div className="mt-2 flex flex-wrap gap-2 print:hidden">
                <button type="button" onClick={() => askAssistant(`Help me decide: "${d.title}". Explain what it would change, the options, the risk of waiting, and what you would recommend.`)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] hover:bg-indigo-50 hover:text-indigo-700"><Lightbulb size={13} aria-hidden /> Help me decide</button>
                {canDecide && (['approved', 'rejected', 'deferred'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => { setNotice(null); setForm(form?.id === d.id && form.verdict === k ? null : { id: d.id, verdict: k }); }} aria-pressed={form?.id === d.id && form.verdict === k}
                    className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] hover:bg-slate-50 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 aria-pressed:ring-indigo-200">{VERDICT[k].label}</button>
                ))}
              </div>
              {form?.id === d.id && <DecideForm id={d.id} verdict={form.verdict} onCancel={() => setForm(null)} onDone={() => { setNotice(`Recorded: ${VERDICT[form.verdict].done}. It now appears in your history.`); setForm(null); onDecided?.(); }} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** What the school paid its staff. Totals only; the card always says how many people the total covers. */
export function PayrollCard({ data }: { data: NonNullable<RoleWorkspaceWidgets['payroll']> }) {
  const rs = (n: number) => `₹${num(Math.round(n))}`;
  const top = Math.max(...data.months.map((m) => m.paid), 1);
  const change = data.previous && data.previous.paid > 0 ? ((data.latest.paid - data.previous.paid) / data.previous.paid) * 100 : null;
  return (
    <Panel title="Staff salary paid" description={`Last month payroll was processed: ${data.latest.label}`} icon={UserCheck}>
      <dl className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
          <dt className="text-[11px] text-slate-500">Paid in {data.latest.label}</dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-900">{rs(data.latest.paid)}</dd>
          <dd className="text-[11px] text-slate-400">{change == null ? 'No earlier month to compare' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs ${data.previous?.label}`}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
          <dt className="text-[11px] text-slate-500">Staff covered</dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-900">{num(data.latest.staff)} <span className="text-sm font-normal text-slate-400">of {num(data.active_staff)}</span></dd>
          <dd className="text-[11px] text-slate-400">{data.coverage_pct == null ? 'Active staff unknown' : `${data.coverage_pct}% of active staff`}</dd>
        </div>
      </dl>
      <ul className="space-y-1.5" aria-label="Salary paid by month">
        {data.months.map((m) => (
          <li key={m.label} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-3 text-sm">
            <span className="text-slate-500">{m.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-indigo-400" style={{ width: `${(m.paid / top) * 100}%` }} /></span>
            <span className="text-right tabular-nums text-slate-900">{rs(m.paid)}</span>
          </li>
        ))}
      </ul>
      {data.caution && <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">{data.caution}</p>}
    </Panel>
  );
}

/** Is management delivering? What was asked, what is overdue, and who is carrying it. */
export function DeliveryCard({ data }: { data: NonNullable<RoleWorkspaceWidgets['management_delivery']> }) {
  const top = Math.max(...data.by_owner.map((o) => o.overdue), 1);
  return (
    <Panel title="Is management delivering?" description="Tasks management has given to others" icon={UserCheck}>
      {data.total === 0 ? (
        <EmptyNote icon={UserCheck}>No task has been assigned by management yet.</EmptyNote>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-3">
            {[
              { l: 'Delivered', v: data.delivered_rate == null ? '—' : `${data.delivered_rate}%`, s: `${num(data.done)} done` },
              { l: 'Open', v: num(data.open), s: 'in progress' },
              { l: 'Overdue', v: num(data.overdue), s: 'past due date', t: data.overdue > 0 ? 'text-red-700' : 'text-slate-900' },
            ].map((c) => (
              <div key={c.l} className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100"><dt className="text-[11px] text-slate-500">{c.l}</dt><dd className={`text-xl font-semibold tabular-nums ${c.t ?? 'text-slate-900'}`}>{c.v}</dd><dd className="text-[11px] text-slate-400">{c.s}</dd></div>
            ))}
          </dl>
          {data.items.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Most overdue</p>
              <ul className="mb-4 space-y-2">
                {data.items.slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0"><span className="block truncate font-medium text-slate-800" title={t.title}>{t.title}</span><span className="text-xs text-slate-500">{t.owner}</span></span><Pill tone="act">{num(t.days_late)} days late</Pill></li>
                ))}
              </ul>
            </>
          )}
          {data.by_owner.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Who is carrying the overdue work</p>
              <ul className="space-y-2">
                {data.by_owner.map((o) => (
                  <li key={o.owner} className="grid grid-cols-[minmax(5rem,9rem)_1fr_1.5rem] items-center gap-3 text-sm"><span className="truncate text-slate-600" title={o.owner}>{o.owner}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-red-400" style={{ width: `${(o.overdue / top) * 100}%` }} /></span><span className="text-right tabular-nums text-slate-900">{o.overdue}</span></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/** Can I trust these numbers? The system's own findings about the quality of its data, before the numbers are relied on. */
export function TrustCard({ data }: { data: NonNullable<RoleWorkspaceWidgets['data_trust']> }) {
  return (
    <Panel
      title="Can I trust these numbers?" icon={ShieldQuestion}
      description={data.total === 0 ? 'No serious data-quality concern is open' : `${num(data.total)} serious data-quality finding${data.total === 1 ? '' : 's'} — read the figures above with care`}
    >
      {data.items.length === 0 ? (
        <EmptyNote icon={ShieldQuestion}>Nothing has been flagged about the quality of the school’s data.</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {data.items.map((i) => (
            <li key={i.id} className={`${SURFACE} flex items-start gap-3 px-4 py-3`}>
              <Pill tone={i.severity === 'critical' ? 'act' : 'watch'}>{i.severity === 'critical' ? 'Critical' : 'High'}</Pill>
              <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{i.title}</p><p className="text-xs text-slate-500">From {i.source}</p></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
