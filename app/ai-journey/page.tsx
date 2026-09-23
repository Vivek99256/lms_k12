'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LifecycleTrace } from '@/components/intelligence/LifecycleTrace';
import { useAuth } from '@/contexts/AuthContext';
import { ask, type IntelligenceContext } from '@/lib/intelligence/client';
import type {
  AnswerAction,
  AnswerSection,
  AskResult,
} from '@/lib/intelligence/types';
import { cn } from '@/lib/utils';

/**
 * The AI journey console.
 *
 * One sentence in, one answer and one full lifecycle out. Everything on this page
 * comes from a single `/ask` call — including the approve and reject buttons, which
 * are not special-cased actions but the next question with its subject pinned. A
 * button and a typed sentence therefore go down the same backend path and produce the
 * same trace, which is what makes the trace usable as evidence that the pipeline ran.
 *
 * The lifecycle panel is the point of the screen. A risk scan reaches ten of twelve
 * stages and stops: the agent is licensed up to *recommend* and cannot create the
 * intervention it proposes. Stage 11 is a person and stage 12 waits on them. Showing
 * that gate as a gate — rather than as an absence — is the difference between a
 * system that looks broken and one that looks governed.
 */

const STARTERS = [
  'Which students are at academic risk?',
  'What evidence supports this?',
  'What should the teacher do?',
  'What has the system learned?',
];

export default function AiJourneyPage() {
  const auth = useAuth();
  const [turns, setTurns] = useState<AskResult[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  const context = useMemo<IntelligenceContext>(() => {
    const token = typeof window === 'undefined' ? null : localStorage.getItem('token');

    return {
      token,
      instituteId: auth?.menuContext?.sub_institute_id ?? null,
      academicYear:
        (auth?.academicYears?.[0] as { syear?: string | number } | undefined)?.syear ?? null,
    };
  }, [auth?.menuContext?.sub_institute_id, auth?.academicYears]);

  // The thread carries the conversation id forward, which is what makes "why is she
  // at risk?" resolvable — the backend fills the student from the previous turn and
  // reports in the trace that it did, rather than silently inventing a subject.
  const conversationId = turns.at(-1)?.conversation.id ?? null;
  const latest = turns.at(-1) ?? null;

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, busy]);

  const send = useCallback(
    async (utterance: string, payload?: AnswerAction['payload']) => {
      const text = utterance.trim();
      if (!text || busy) return;

      setBusy(true);
      setError(null);

      try {
        const result = await ask(context, text, { conversationId, payload });
        setTurns((prev) => [...prev, result]);
        setQuestion('');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That question could not be answered.');
      } finally {
        setBusy(false);
      }
    },
    [busy, context, conversationId]
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold text-slate-900">AI journey</h1>
        <p className="text-sm text-slate-500">
          Ask about academic risk. Every answer reports which of the twelve lifecycle stages ran.
        </p>
        {latest?.conversation.reference ? (
          <span className="ml-auto font-mono text-[11px] text-slate-400">
            {latest.conversation.reference} · turn {latest.conversation.turn}
          </span>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* ---- the conversation ------------------------------------------- */}
        <section className="flex min-h-[70vh] flex-col rounded-xl border border-slate-200 bg-white">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Ask about academic risk in this school.
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-600">
                  The same twelve-stage lifecycle answers every question. Each stage reports whether
                  it ran, which class did the work, and the exact call you can make to check it.
                  Stages that did not run say why.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {turns.map((turn, i) => (
              <Turn key={`${turn.conversation.turn_id ?? i}`} turn={turn} onAct={send} busy={busy} />
            ))}

            {busy ? (
              <p className="flex items-center gap-2 text-[13px] text-slate-500">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Running the pipeline…
              </p>
            ) : null}

            {error ? (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                <AlertCircle className="mt-0.5 size-4 flex-none" aria-hidden />
                {error}
              </p>
            ) : null}

            <div ref={threadEnd} />
          </div>

          <form
            className="flex gap-2 border-t border-slate-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(question);
            }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question…"
              disabled={busy}
              autoComplete="off"
            />
            <Button type="submit" disabled={busy || !question.trim()}>
              <Send className="size-4" aria-hidden />
              Ask
            </Button>
          </form>
        </section>

        {/* ---- the lifecycle ---------------------------------------------- */}
        <section className="lg:sticky lg:top-6">
          {latest ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {latest.intent.key}
                </Badge>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {Math.round(latest.intent.confidence * 100)}% confidence
                </span>
                {latest.module ? (
                  <Badge variant="outline" className="text-[11px]">
                    {latest.module.label}
                  </Badge>
                ) : null}
                {latest.depth_reached ? (
                  <span className="text-[11px] tabular-nums text-slate-500">
                    reached stage {latest.depth_reached} of 12
                  </span>
                ) : null}
              </div>

              {/*
                A module that cannot reach the deep stages says so once, above the
                ladder, rather than leaving the reader to work it out from three
                not-reached rows. The ladder stays twelve rungs long either way — a
                module without an agent is a fact about configuration, not a shorter
                lifecycle.
              */}
              {latest.module && !latest.module.reaches_recommendation ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-5 text-amber-900">
                  {latest.module.depth_reason ??
                    `No agent is registered for the ${latest.module.label} module, so this question can be answered from real data but cannot open a case or recommend an action.`}
                </p>
              ) : null}
              <LifecycleTrace
                stages={latest.lifecycle_trace}
                counts={latest.lifecycle_stage_counts}
                durationMs={latest.duration_ms}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500">
              No question asked yet. The lifecycle appears here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Turn({
  turn,
  onAct,
  busy,
}: {
  turn: AskResult;
  onAct: (utterance: string, payload?: AnswerAction['payload']) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="flex justify-end">
        <span className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3.5 py-2 text-[13px] text-white">
          {turn.question}
        </span>
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{turn.answer.headline}</p>

        <div className="mt-3 space-y-3">
          {turn.answer.sections.map((section, i) => (
            <Section key={`${section.type}-${i}`} section={section} />
          ))}
        </div>

        {turn.answer.actions.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {turn.answer.actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.style === 'danger' ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => onAct(action.utterance, action.payload)}
                className={cn(action.style === 'danger' && 'border-red-200 text-red-700 hover:bg-red-50')}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {turn.answer.follow_ups.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {turn.answer.follow_ups.map((f) => (
              <button
                key={f}
                type="button"
                disabled={busy}
                onClick={() => onAct(f)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11.5px] text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {f}
                <ArrowRight className="size-3" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ section }: { section: AnswerSection }) {
  const title = (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {section.title}
    </p>
  );

  if (section.type === 'text') {
    return (
      <div>
        {title}
        <p className="mt-1 text-[13px] leading-5 text-slate-700">{section.body}</p>
      </div>
    );
  }

  if (section.type === 'key_values') {
    return (
      <div>
        {title}
        {/*
          The backend sends a list of {label, value}, not a keyed object. This was
          `Object.entries(section.items)`, which over a list yields ["0", {...}] — so
          every row rendered its array index as the label and "[object Object]" as the
          value, on every answer with a governance or breakdown section.
        */}
        <dl className="mt-1 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
          {section.items.map((item, i) => (
            <div key={`${item.label}-${i}`} className="contents">
              <dt className="text-slate-500">{item.label}</dt>
              <dd className="text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (section.type === 'records') {
    return (
      <div>
        {title}
        <ul className="mt-1 space-y-1.5">
          {section.items.map((item, i) => {
            const rec = item as {
              title?: string;
              badge?: string;
              badge_tone?: string;
              lines?: string[];
              meta?: Record<string, string>;
            };

            return (
              <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{rec.title}</span>
                  {rec.badge ? (
                    <Badge variant={rec.badge_tone === 'danger' ? 'destructive' : 'outline'}>
                      {rec.badge}
                    </Badge>
                  ) : null}
                </div>
                {rec.lines?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {rec.lines.map((line, j) => (
                      <li key={j} className="text-[12.5px] text-slate-600">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {rec.meta ? (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[11px] tabular-nums text-slate-400">
                    {Object.entries(rec.meta).map(([k, v]) => (
                      <span key={k}>
                        {k} {v}
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (section.type === 'evidence') {
    return (
      <div>
        {title}
        {/*
          `source` is a formatted string from the backend — "attendance_student #4821".
          This read `item.source?.table`, which on a string is always undefined, so every
          row fell through to "computed" and the provenance never appeared. That is the
          one thing on this page that must be right: an evidence row a reader cannot
          trace back to a table is an assertion wearing a citation.
        */}
        <ul className="mt-1 space-y-1">
          {section.items.map((ev, i) => (
            <li key={ev.id ?? i} className="flex items-start gap-2 text-[12.5px] text-slate-700">
              <span
                className={cn(
                  'mt-1 size-1.5 flex-none rounded-full',
                  ev.verified ? 'bg-emerald-600' : 'bg-slate-300'
                )}
                aria-hidden
                title={ev.verified ? 'Verified — read from a table' : 'Unverified — may not be cited as fact'}
              />
              <span>
                {ev.summary}
                {ev.value ? <span className="text-slate-500"> = {ev.value}</span> : null}{' '}
                <span className="font-mono text-[11px] text-slate-400">{ev.source}</span>
                {ev.is_generated ? (
                  <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                    generated
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.type === 'steps') {
    return (
      <div>
        {title}
        <ol className="mt-1 space-y-1">
          {section.items.map((item, i) => {
            const step = item as { label?: string; step_key?: string; status?: string };
            const done = step.status === 'completed';

            return (
              <li key={i} className="flex items-center gap-2 text-[12.5px]">
                <span
                  className={cn(
                    'size-1.5 flex-none rounded-full',
                    done ? 'bg-emerald-600' : step.status === 'awaiting_approval' ? 'bg-amber-500' : 'bg-slate-300'
                  )}
                  aria-hidden
                />
                <span className="text-slate-700">{step.label ?? step.step_key}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-400">{step.status}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div>
      {title}
      <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600">
        {JSON.stringify(section, null, 2)}
      </pre>
    </div>
  );
}
