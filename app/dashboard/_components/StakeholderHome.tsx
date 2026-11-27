'use client';

import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Bot, Compass, FileSearch, History, Lightbulb, MessageCircleQuestion, PenLine, Send, ShieldAlert, Sparkles, Target, UserPlus, type LucideIcon,
} from 'lucide-react';
import { askAssistant } from '@/lib/exam-help';
import type { SignalItem } from '@/app/dashboard/_lib/dashboard-api';
import { EmptyNote, Panel, Pill, SURFACE, type Row, type Tone } from '@/app/dashboard/_components/PremiumKit';
import { FollowUpForm } from '@/app/dashboard/_components/WorkspaceExtras';

/*
 * The stakeholder home.
 *
 * Every dashboard answers the same five questions — what is happening, what matters to me, what needs my
 * attention, what should I do, and is it making a difference — and is organised as My work, My performance,
 * My intelligence and My history, with an assistant on every signal. The technology (signals, the knowledge
 * graph, recommendations) is never named on screen: a signal reads as a sentence about the school.
 */

const num = (n: number) => n.toLocaleString('en-IN');

/* ---------- section ---------- */

export function SectionBlock({
  id, icon: Icon, title, subtitle, badge, children,
}: {
  id: string; icon: LucideIcon; title: string; subtitle: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Icon size={16} strokeWidth={1.75} aria-hidden /></span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

/* ---------- ask ---------- */

const ASK_FIELD = 'h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-24 text-sm text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500/30';

/** "Ask ScholarClone…" — opens the assistant with the question already sent. */
export function AskBar({ suggestions, placeholder = 'Ask about your school, performance, risks or pending work…' }: { suggestions: string[]; placeholder?: string }) {
  const [q, setQ] = useState('');
  const send = (text: string) => {
    const t = text.trim();
    if (t) {
      askAssistant(t);
      setQ('');
    }
  };
  return (
    <section aria-label="Ask ScholarClone" className="mb-4">
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="relative">
        <Sparkles size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" aria-hidden />
        <label className="sr-only" htmlFor="ask-scholarclone">Ask ScholarClone about your school, performance, risks or pending work</label>
        <input id="ask-scholarclone" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={ASK_FIELD} />
        <button type="submit" disabled={!q.trim()} className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white outline-none transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:bg-slate-200 disabled:text-slate-400">
          Ask <Send size={12} aria-hidden />
        </button>
      </form>
      {suggestions.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => send(s)} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-900/[0.07] outline-none transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- today's focus: priorities, progress, intelligence ---------- */

export type PriorityItem = { key: string; text: string; count?: number; display?: string; onClick?: () => void };

function PriorityLines({ items, tone }: { items: PriorityItem[]; tone: Tone }) {
  if (items.length === 0) return <p className="text-xs text-slate-400">Nothing here right now.</p>;
  return (
    <ul className="space-y-1.5">
      {items.slice(0, 3).map((it) => {
        const inner = (
          <>
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'act' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden />
            <span className="min-w-0 flex-1 text-left text-sm text-slate-600">
              {(it.display ?? it.count != null) && <b className="mr-1 font-semibold tabular-nums text-slate-900">{it.display ?? num(it.count ?? 0)}</b>}
              {it.text}
            </span>
            {it.onClick && <ArrowRight size={13} className="mt-1 shrink-0 text-slate-300" aria-hidden />}
          </>
        );
        return (
          <li key={it.key}>
            {it.onClick
              ? <button type="button" onClick={it.onClick} className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">{inner}</button>
              : <div className="flex items-start gap-2 px-1 py-0.5">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** My priorities: what is urgent, and what needs a decision or action. */
export function PrioritiesCard({ urgent, action }: { urgent: PriorityItem[]; action: PriorityItem[] }) {
  const clear = urgent.length === 0 && action.length === 0;
  return (
    <Panel title="My priorities" description={clear ? 'Nothing needs you right now' : 'What needs you first'} icon={Target} className="h-full">
      {clear ? (
        <EmptyNote icon={Target}>You are up to date. Check the intelligence below for anything worth a look.</EmptyNote>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums leading-none text-slate-900">{urgent.length}</span><span className="text-xs font-medium text-red-700">Urgent</span></div>
            <PriorityLines items={urgent} tone="act" />
          </div>
          <div>
            <div className="mb-2 flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums leading-none text-slate-900">{action.length}</span><span className="text-xs font-medium text-amber-700">Action required</span></div>
            <PriorityLines items={action} tone="watch" />
          </div>
        </div>
      )}
    </Panel>
  );
}

export type ProgressItem = { key: string; label: string; value: number; detail: string };

/** My progress: how the things I am responsible for are going. An optional tick marks the person's own target. */
export function ProgressCard({ items, attendanceTarget }: { items: ProgressItem[]; attendanceTarget: number }) {
  return (
    <Panel title="My progress" description="Against what you are responsible for" icon={Compass} className="h-full">
      {items.length === 0 ? (
        <EmptyNote icon={Compass}>Progress appears here once there is activity to measure.</EmptyNote>
      ) : (
        <ul className="space-y-3.5">
          {items.slice(0, 4).map((p) => (
            <li key={p.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-600">{p.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">{p.value % 1 ? p.value.toFixed(1) : p.value}%</span>
              </div>
              <div className="relative h-2 rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${p.value}%` }} />
                {p.key === 'attendance' && <span className="absolute inset-y-[-3px] w-0.5 rounded bg-slate-500" style={{ left: `${attendanceTarget}%` }} title={`Your limit: ${attendanceTarget}%`} aria-hidden />}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{p.detail}{p.key === 'attendance' ? ` · your limit ${attendanceTarget}%` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------- signals ---------- */

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: 'Critical', tone: 'act' },
  high: { label: 'High', tone: 'act' },
  medium: { label: 'Medium', tone: 'watch' },
  low: { label: 'Low', tone: 'neutral' },
};

const RESULT: Record<string, { label: string; tone: Tone }> = {
  improved: { label: 'Improved', tone: 'good' },
  partial: { label: 'Partly resolved', tone: 'watch' },
  worsened: { label: 'Worse', tone: 'act' },
  no_change: { label: 'No change', tone: 'neutral' },
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function ownerLine(s: SignalItem): { text: string; tone: Tone } {
  if (s.follow_up) {
    const f = s.follow_up;
    const done = /^complete/i.test(f.status);
    return { text: `${f.owner ?? 'Someone'} has a follow-up task${f.due ? `, review by ${f.due}` : ''} — ${done ? 'completed' : f.status.toLowerCase()}`, tone: done ? 'good' : 'brand' };
  }
  if (s.decision) {
    const who = s.decision.by ? `${s.decision.by}` : 'Management';
    return s.decision.status === 'approved'
      ? { text: `${who} approved this on ${s.decision.date}${s.decision.note ? ` — “${clip(s.decision.note, 80)}”` : ''}`, tone: 'good' }
      : { text: `${who} ${s.decision.status} this on ${s.decision.date}`, tone: 'neutral' };
  }
  if (s.recommendation?.status === 'pending') return { text: 'No owner yet — waiting for someone to decide', tone: 'watch' };
  return { text: 'Being monitored', tone: 'neutral' };
}

/** The four questions a stakeholder puts to a signal, each handed to the assistant with the signal in context. */
function promptFor(level: 'explain' | 'investigate' | 'decide' | 'act', s: SignalItem): string {
  const ref = `"${s.title}" (signal ${s.id})`;
  if (level === 'explain') return `Explain this in plain words: ${ref}. What does it mean for my school?`;
  if (level === 'investigate') return `Why is this happening? Investigate ${ref} using the evidence on record, and keep confirmed facts separate from possible causes.`;
  if (level === 'decide') return `What should I do about ${ref}? Give me practical options, the expected effect of each, and the risk.`;
  return `Draft an instruction to the right owner for ${ref}. Tell me who it would go to and what approval it needs. Do not send anything until I confirm.`;
}

const LEVELS: Array<{ id: 'explain' | 'investigate' | 'decide' | 'act'; label: string; icon: LucideIcon; hint: string }> = [
  { id: 'explain', label: 'Explain', icon: MessageCircleQuestion, hint: 'What does this mean?' },
  { id: 'investigate', label: 'Why?', icon: FileSearch, hint: 'Why is this happening?' },
  { id: 'decide', label: 'What should I do?', icon: Lightbulb, hint: 'Options, effects and risks' },
  { id: 'act', label: 'Draft instruction', icon: PenLine, hint: 'Draft it — nothing is sent until you confirm' },
];

/** One signal, laid out as: what was found, why it matters, the evidence, what is recommended, who owns it, what happened. */
export function SignalCard({ s, open, canAssign, onAssigned }: { s: SignalItem; open?: () => void; canAssign?: boolean; onAssigned?: () => void }) {
  const [assigning, setAssigning] = useState(false);
  const sev = SEVERITY[s.severity] ?? SEVERITY.low;
  const owner = ownerLine(s);
  const context = [
    s.affected != null && s.total != null ? `${num(s.affected)} of ${num(s.total)} ${s.unit ?? 'records'}` : s.affected != null ? `${num(s.affected)} ${s.unit ?? 'records'}` : null,
    `from ${s.source}`,
  ].filter(Boolean).join(' · ');
  return (
    <article className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-slate-100 px-5 py-2.5">
        <Pill tone={sev.tone}>{sev.label}</Pill>
        <span className="text-xs font-medium text-slate-500">{s.topic}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
          <span>{Math.round(s.confidence * 100)}% confidence</span>
          <span aria-hidden>·</span>
          <span>{s.evidence} evidence {s.evidence === 1 ? 'record' : 'records'}</span>
          <span aria-hidden>·</span>
          <span>Raised {s.raised}</span>
        </span>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{s.title}</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm md:grid-cols-[8.5rem_1fr]">
          {s.why && (<><dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Why it matters</dt><dd className="text-slate-600">{s.why}</dd></>)}
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Context</dt><dd className="text-slate-600">{context}</dd>
          {s.recommendation && (
            <>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Recommended</dt>
              <dd className="text-slate-700">
                {s.recommendation.title}
                <span className="ml-2 align-middle"><Pill tone={s.recommendation.status === 'pending' ? 'watch' : s.recommendation.status === 'approved' ? 'good' : 'neutral'}>{s.recommendation.status === 'pending' ? 'Awaiting decision' : s.recommendation.status[0].toUpperCase() + s.recommendation.status.slice(1)}</Pill></span>
              </dd>
            </>
          )}
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Owner &amp; status</dt>
          <dd className="text-slate-600">{owner.text}</dd>
          {s.outcome && (
            <>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Outcome</dt>
              <dd className="text-slate-600"><Pill tone={(RESULT[s.outcome.result] ?? RESULT.no_change).tone}>{(RESULT[s.outcome.result] ?? { label: s.outcome.result }).label}</Pill>{s.outcome.feedback ? <span className="ml-2">{clip(s.outcome.feedback, 120)}</span> : null}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 print:hidden">
        <Bot size={14} className="text-indigo-500" aria-hidden />
        {LEVELS.map((l) => (
          <button key={l.id} type="button" title={l.hint} onClick={() => askAssistant(promptFor(l.id, s))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] outline-none transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/50">
            <l.icon size={13} aria-hidden /> {l.label}
          </button>
        ))}
        {canAssign && !s.follow_up && (
          <button type="button" onClick={() => setAssigning((a) => !a)} aria-expanded={assigning} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50">
            <UserPlus size={13} aria-hidden /> Assign follow-up
          </button>
        )}
        {open && (
          <button type="button" onClick={open} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/50">
            Open in workspace <ArrowUpRight size={13} aria-hidden />
          </button>
        )}
      </div>
      {assigning && <FollowUpForm signalId={s.id} onCancel={() => setAssigning(false)} onDone={() => { setAssigning(false); onAssigned?.(); }} />}
    </article>
  );
}

/** The most important signal, compactly, for the first screen. */
export function TopSignalCard({ s, total, seeAll }: { s: SignalItem | null; total: number; seeAll: () => void }) {
  return (
    <Panel
      title="Important intelligence" description={total > 0 ? `${num(total)} signal${total === 1 ? '' : 's'} for your role` : 'Nothing flagged for your role'} icon={ShieldAlert} className="h-full"
      action={total > 1 ? <button type="button" onClick={seeAll} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">See all <ArrowRight size={12} aria-hidden /></button> : undefined}
    >
      {!s ? (
        <EmptyNote icon={ShieldAlert}>No signal needs your attention.</EmptyNote>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2"><Pill tone={(SEVERITY[s.severity] ?? SEVERITY.low).tone}>{(SEVERITY[s.severity] ?? SEVERITY.low).label}</Pill><span className="text-xs text-slate-500">{s.topic}</span></div>
          <p className="text-sm font-semibold leading-snug text-slate-900">{s.title}</p>
          {s.why && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{clip(s.why, 150)}</p>}
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => askAssistant(promptFor('explain', s))} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] hover:bg-indigo-50 hover:text-indigo-700"><MessageCircleQuestion size={13} aria-hidden /> Explain</button>
            <button type="button" onClick={() => askAssistant(promptFor('decide', s))} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] hover:bg-indigo-50 hover:text-indigo-700"><Lightbulb size={13} aria-hidden /> What should I do?</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Where the loop stands across the school: noticed, recommended, decided, improved. */
export function LoopStrip({ loop }: { loop: { signals: number; recommendations: number; awaiting_decision: number; decided: number; improved: number; partial: number; worsened: number } }) {
  const steps = [
    { label: 'Noticed', value: loop.signals, note: 'open signals' },
    { label: 'Recommended', value: loop.recommendations, note: `${num(loop.awaiting_decision)} awaiting a decision` },
    { label: 'Decided', value: loop.decided, note: 'by management' },
    { label: 'Made a difference', value: loop.improved + loop.partial, note: `${num(loop.improved)} improved · ${num(loop.partial)} partly` },
  ];
  return (
    <ol className={`${SURFACE} mb-4 grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x`} aria-label="How signals become decisions and results">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-3 px-5 py-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2"><span className="text-xl font-semibold tabular-nums text-slate-900">{num(s.value)}</span><span className="text-sm font-medium text-slate-700">{s.label}</span></div>
            <div className="truncate text-xs text-slate-500">{s.note}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- history ---------- */

export type HistoryItem = { id: string; kind: 'decision' | 'task' | 'badge'; title: string; detail: string; status: string; result: string | null; date: string };

export function historyRows(items: HistoryItem[], dayLabel: (d: string) => string): Row[] {
  return items.map((h) => ({
    id: h.id,
    title: h.title,
    detail: h.detail,
    trailing: dayLabel(h.date),
    badge: h.result && RESULT[h.result]
      ? RESULT[h.result]
        ? { tone: RESULT[h.result].tone, text: RESULT[h.result].label }
        : undefined
      : h.kind === 'badge'
        ? { tone: 'brand' as Tone, text: 'Earned' }
      : h.kind === 'task'
        ? { tone: 'good' as Tone, text: 'Done' }
        : { tone: (h.status === 'approved' ? 'brand' : 'neutral') as Tone, text: h.status === 'approved' ? 'Approved' : h.status[0].toUpperCase() + h.status.slice(1) },
  }));
}

export function HistoryEmpty() {
  return <EmptyNote icon={History}>No decisions or finished work have been recorded yet.</EmptyNote>;
}

/* ---------- personal insights (teacher: students who need support; student: things in my own record) ---------- */

export type InsightLike = { id: string; title: string; why: string; next: string; severity: string; chips: string[]; phone: string | null };

/**
 * One insight, laid out as: what, why it matters, and what to do next. Used where the facts come straight from
 * the person's own classes or record rather than from the Brain, so there is no confidence figure to claim.
 */
export function InsightCard({
  s, audience, onCall,
}: {
  s: InsightLike; audience: 'teacher' | 'student'; onCall?: React.ReactNode;
}) {
  const sev = SEVERITY[s.severity] ?? SEVERITY.low;
  const ask = (kind: 'explain' | 'why' | 'do' | 'act') => {
    const ref = `"${s.title}"`;
    if (kind === 'explain') return askAssistant(`Explain this in plain words: ${ref}. ${s.why}`);
    if (kind === 'why') return askAssistant(`Why is this happening? Look at the records you can see for ${ref} and keep confirmed facts separate from possible causes.`);
    if (kind === 'do') return askAssistant(`What should I do about ${ref}? Give practical options, the expected effect of each, and any risk.`);
    return askAssistant(audience === 'teacher'
      ? `Draft a short, kind note to the parent about ${ref}. Do not send anything until I confirm.`
      : `Make me a simple plan for the next three days to deal with ${ref}.`);
  };
  return (
    <article className={`${SURFACE} overflow-hidden`}>
      <div className="px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Pill tone={sev.tone}>{sev.label}</Pill>
          {s.chips.slice(0, 3).map((c) => <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{c}</span>)}
          {onCall && <span className="ml-auto">{onCall}</span>}
        </div>
        <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{s.title}</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-[7.5rem_1fr]">
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Why it matters</dt><dd className="text-slate-600">{s.why}</dd>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Next step</dt><dd className="text-slate-700">{s.next}</dd>
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 print:hidden">
        <Bot size={14} className="text-indigo-500" aria-hidden />
        {([['explain', 'Explain', MessageCircleQuestion], ['why', 'Why?', FileSearch], ['do', 'What should I do?', Lightbulb], ['act', audience === 'teacher' ? 'Draft a note' : 'Make me a plan', PenLine]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => ask(k)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/[0.08] outline-none transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/50">
            <Icon size={13} aria-hidden /> {label}
          </button>
        ))}
      </div>
    </article>
  );
}

/** The one insight to look at first, compactly, for the first screen. */
export function TopInsightCard({ s, total, title, description, seeAll }: { s: InsightLike | null; total: number; title: string; description: string; seeAll: () => void }) {
  const sev = s ? (SEVERITY[s.severity] ?? SEVERITY.low) : null;
  return (
    <Panel
      title={title} description={total > 0 ? `${num(total)} ${description}` : 'Nothing flagged right now'} icon={ShieldAlert} className="h-full"
      action={total > 1 ? <button type="button" onClick={seeAll} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">See all <ArrowRight size={12} aria-hidden /></button> : undefined}
    >
      {!s || !sev ? (
        <EmptyNote icon={ShieldAlert}>Nothing needs your attention here.</EmptyNote>
      ) : (
        <div>
          <div className="mb-2"><Pill tone={sev.tone}>{sev.label}</Pill></div>
          <p className="text-sm font-semibold leading-snug text-slate-900">{s.title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{clip(s.why, 150)}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700"><b className="font-semibold">Next:</b> {clip(s.next, 120)}</p>
        </div>
      )}
    </Panel>
  );
}

/** A student's single next step. */
export function NextStepCard({ next }: { next: { kind: string; title: string; detail: string } | null }) {
  return (
    <Panel title="Your next step" description="The one thing to do now" icon={Compass} className="h-full">
      {!next ? (
        <EmptyNote icon={Compass}>You are all caught up. Pick something you enjoy from the learning path.</EmptyNote>
      ) : (
        <div>
          <Pill tone={next.kind === 'learning' ? 'brand' : 'watch'}>{next.kind === 'learning' ? 'Learning' : 'Work due'}</Pill>
          <p className="mt-2 text-base font-semibold leading-snug text-slate-900">{next.title}</p>
          <p className="mt-1 text-sm text-slate-500">{next.detail}</p>
          <button type="button" onClick={() => askAssistant(`Help me with this next step: ${next.title}. ${next.detail}`)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white outline-none transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50 print:hidden">
            <Sparkles size={13} aria-hidden /> Help me with this
          </button>
        </div>
      )}
    </Panel>
  );
}
