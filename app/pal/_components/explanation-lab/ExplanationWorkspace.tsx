'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mic, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  emptyWorkspace,
  fetchExplanationLab,
  generateExplanationLab,
  saveExplanationLab,
  submitExplanationLab,
  type Evaluation,
  type LabRecord,
  type Workspace,
} from '@/app/pal/data/pal-explanation-workspace';
import type { ActivityScope } from '@/app/pal/data/pal-activity-scope';

import { BoardWorkspace, type WorkspacePatch } from './BoardWorkspace';
import { SimulationWorkspace } from './SimulationWorkspace';

/**
 * Explanation Lab flow:
 *   challenge -> interactive workspace -> explain your actions and reflect
 *   -> review and submit -> marking -> feedback with evidence.
 *
 * The challenge is generated from the chapter and what the student has learned.
 * The workspace starts empty. The expected answer is never in the browser.
 */

type View =
  | { kind: 'loading' }
  | { kind: 'generating' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; record: LabRecord };

const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50';

const PRIMARY = 'bg-sky-700 text-sm font-semibold text-white hover:bg-sky-800';

export function ExplanationWorkspace({
  chapterId,
  scope,
  onEvaluated,
}: {
  chapterId: string;
  chapterName: string;
  /** What the activity is about: chosen by the student, checked again by the server. */
  scope: ActivityScope;
  onEvaluated?: () => void;
}) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [ws, setWs] = useState<Workspace>(emptyWorkspace());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dirty = useRef(false);
  const wsRef = useRef(ws);
  const doneRef = useRef(onEvaluated);
  useEffect(() => {
    wsRef.current = ws;
    doneRef.current = onEvaluated;
  }, [ws, onEvaluated]);

  const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const adopt = useCallback((record: LabRecord) => {
    dirty.current = false;
    setWs(record.workspace);
    setView({ kind: 'ready', record });
    if (record.status === 'evaluated') doneRef.current?.();
  }, []);

  const generate = useCallback(
    (fresh: boolean, signal?: AbortSignal) => {
      setNotice(null);
      setView({ kind: 'generating' });
      generateExplanationLab(chapterId, scope, fresh, signal)
        .then(({ record, message }) => {
          if (signal?.aborted) return;
          if (!record) setView({ kind: 'error', message: message ?? 'Couldn’t build your challenge.' });
          else adopt(record);
        })
        .catch((e: unknown) => {
          if (!signal?.aborted) setView({ kind: 'error', message: errorText(e, 'Couldn’t build your challenge.') });
        });
    },
    [chapterId, scope, adopt]
  );

  // Open: resume what the student has, or build the first challenge.
  useEffect(() => {
    const controller = new AbortController();
    fetchExplanationLab(chapterId, scope, controller.signal)
      .then((record) => {
        if (controller.signal.aborted) return;
        if (record) adopt(record);
        else generate(false, controller.signal);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setView({ kind: 'error', message: errorText(e, 'Couldn’t load your Explanation Lab.') });
      });
    return () => controller.abort();
  }, [chapterId, scope, adopt, generate]);

  const record = view.kind === 'ready' ? view.record : null;
  const locked = !!record && record.status !== 'in_progress';
  const status = record?.status;

  // Autosave what the student does.
  useEffect(() => {
    if (!record || status !== 'in_progress' || !dirty.current) return;
    const t = setTimeout(() => {
      setSaving('saving');
      saveExplanationLab(chapterId, scope, wsRef.current)
        .then((out) => {
          if (out.message) setNotice(out.message);
          setSaving('saved');
        })
        .catch(() => setNotice('Couldn’t save just now. Keep going; it will try again.'));
    }, 1200);
    return () => clearTimeout(t);
  }, [ws, record, status, chapterId, scope]);

  const change = useCallback((patch: WorkspacePatch, logLine?: string) => {
    dirty.current = true;
    setWs((w) => ({
      ...w,
      ...patch,
      actions: w.actions + (logLine ? 1 : 0),
      log: logLine ? [...w.log, logLine].slice(-120) : w.log,
    }));
  }, []);

  const phase = locked ? 'feedback' : ws.phase;
  const goto = (next: Workspace['phase']) => change({ phase: next });

  const submit = () => {
    if (!record || busy) return;
    setBusy(true);
    setNotice(null);
    submitExplanationLab(chapterId, scope, ws)
      .then(({ record: next, message }) => {
        if (!next) {
          setNotice(message ?? 'Couldn’t submit your work.');
          return;
        }
        adopt(next);
        if (next.status === 'submitted') setNotice('Your work is saved. The marking did not finish; try “Get my feedback”.');
      })
      .catch((e: unknown) => setNotice(errorText(e, 'Couldn’t submit your work.')))
      .finally(() => setBusy(false));
  };

  if (view.kind === 'loading' || view.kind === 'generating') {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" aria-hidden />
        {view.kind === 'loading' ? 'Opening your Explanation Lab…' : 'Designing a challenge from your chapter and what you have learned… this can take up to a minute.'}
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <span>{view.message}</span>
        <Button size="sm" variant="outline" onClick={() => generate(false)} className="h-8 gap-1.5 bg-white text-xs text-rose-700">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  const c = view.record.challenge;
  const hasWork =
    c.format === 'board'
      ? ws.placements.length > 0 || ws.extras.length > 0 || ws.ink !== null
      : ws.trials.length > 0;
  const answered = c.reflectionPrompts.filter((p) => (ws.answers[p.id] ?? '').trim() !== '').length;
  const canSubmit = hasWork && answered >= 2;

  const steps = ['Challenge', 'Workspace', 'Explain', 'Submit', 'Feedback'];
  const stepIndex = { intro: 0, work: 1, explain: 2, review: 3, feedback: 4 }[phase];

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progress">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === stepIndex ? 'step' : undefined}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${i === stepIndex ? 'bg-sky-600 text-white' : i < stepIndex ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
          >
            {i + 1}. {s}
          </li>
        ))}
        <li className="ml-auto text-[11px] text-slate-500" aria-live="polite">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' && !locked ? 'Saved' : ''}
        </li>
      </ol>

      {notice ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {notice}
        </p>
      ) : null}

      {phase === 'intro' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Your challenge
            </p>
            <h3 className="text-lg font-bold text-slate-900">{c.title}</h3>
          </div>
          <p className="text-sm text-slate-700">{c.brief}</p>
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950">{c.goal}</p>
          <div className="flex flex-wrap gap-1.5">
            {c.conceptFocus.map((n) => (
              <span key={n} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                {n}
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-bold text-slate-800">How this works</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-slate-700">
              <li>Read the situation and the goal above.</li>
              <li>{c.format === 'simulation' ? 'Try the controls and watch what happens. Record the trials that help you.' : 'Build your answer on the board: pick the parts you need, place them, join them with arrows and say what each arrow means.'}</li>
              <li>Press “I have finished”, then explain what you did and why.</li>
              <li>You get feedback on what you did and on your explanation.</li>
            </ol>
            <p className="mt-1.5 text-[11px] text-slate-500">There is no single right picture on the screen. Your choices and your reasons are what count.</p>
          </div>
          <Button onClick={() => goto('work')} className={PRIMARY}>
            Start the activity
          </Button>
        </section>
      ) : null}

      {phase === 'work' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
            <p className="text-xs text-slate-600">{c.goal}</p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-950">
            {c.format === 'board' ? (
              <>
                <strong>What to do:</strong> 1) Drag the parts you want from the <strong>PARTS</strong> row (bottom) onto the board.
                2) Press <strong>Join with arrows</strong>, click one part then another, and write what the arrow means.
                3) Add your own notes with <strong>Add label</strong>, or sketch with <strong>Draw</strong>.
                4) When you are happy, press <strong>I have finished</strong>.
              </>
            ) : (
              <>
                <strong>What to do:</strong> 1) Move the sliders and watch the bars on the right.
                2) Press <strong>Record this trial</strong> for the settings that help you understand it, and write what you noticed.
                3) When you are happy, press <strong>I have finished</strong>.
              </>
            )}
          </div>
          {c.format === 'board' && c.board ? <BoardWorkspace spec={c.board} ws={ws} locked={false} onChange={change} /> : null}
          {c.format === 'simulation' && c.simulation ? <SimulationWorkspace model={c.simulation} ws={ws} locked={false} onChange={change} /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => goto('explain')} disabled={!hasWork} className={PRIMARY}>
              I have finished. Let me explain my work
            </Button>
            {!hasWork ? <span className="text-xs text-slate-500">Do the activity first; then you can explain it.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'explain' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Explain your work</h3>
            <p className="text-xs text-slate-600">Look at what you made, then tell us in your own words.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            {c.format === 'board' && c.board ? <BoardWorkspace spec={c.board} ws={ws} locked onChange={change} /> : null}
            {c.format === 'simulation' && c.simulation ? <SimulationWorkspace model={c.simulation} ws={ws} locked onChange={change} /> : null}
          </div>
          <div className="space-y-4">
            {c.reflectionPrompts.map((p, i) => (
              <label key={p.id} className="block space-y-1">
                <span className="text-sm font-semibold text-slate-900">
                  {i + 1}. {p.prompt}
                </span>
                <textarea
                  rows={3}
                  value={ws.answers[p.id] ?? ''}
                  onChange={(e) => change({ answers: { ...ws.answers, [p.id]: e.target.value } })}
                  className={FIELD}
                  placeholder="Write, or use the microphone and speak…"
                />
                <Dictate onText={(text) => change({ answers: { ...ws.answers, [p.id]: `${ws.answers[p.id] ? `${ws.answers[p.id]} ` : ''}${text}` } })} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('work')} className="text-sm">
              Back to my workspace
            </Button>
            <Button onClick={() => goto('review')} disabled={answered < 2} className={PRIMARY}>
              Review and submit
            </Button>
            {answered < 2 ? <span className="text-xs text-slate-500">Answer at least two questions.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'review' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Review and submit</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {c.format === 'board' ? (
              <>
                <li>Parts placed on the board: {ws.placements.length} of {c.board?.items.length ?? 0}</li>
                <li>Arrows: {ws.arrows.length}. Your own labels: {ws.extras.length}. Drawing: {ws.ink ? 'yes' : 'no'}</li>
              </>
            ) : (
              <li>Trials recorded: {ws.trials.length}</li>
            )}
            <li>Reflection questions answered: {answered} of {c.reflectionPrompts.length}</li>
          </ul>
          <p className="text-xs text-slate-500">After you submit you cannot change this challenge. Your actions and your explanation are both marked.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => goto('explain')} disabled={busy} className="text-sm">
              Back
            </Button>
            <Button onClick={submit} disabled={busy || !canSubmit} className="gap-1.5 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {busy ? 'Submitting and marking…' : 'Submit my work'}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'feedback' ? (
        <Feedback
          evaluation={view.record.evaluation}
          busy={busy}
          onRetry={submit}
          onNew={() => {
            if (window.confirm('Start a new challenge? This one stays as it is.')) generate(true);
          }}
        />
      ) : null}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

export function Feedback({
  evaluation: e,
  busy,
  onRetry,
  onNew,
  newLabel = 'Try a new challenge',
}: {
  evaluation: Evaluation | null;
  busy: boolean;
  onRetry: () => void;
  onNew: () => void;
  newLabel?: string;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-live="polite">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Submitted.
      </div>
      {!e ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p>Your work is saved, but the marking is not ready yet.</p>
          <Button variant="outline" onClick={onRetry} disabled={busy} className="gap-1.5 text-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Get my feedback
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-3xl font-bold text-sky-900">{e.scorePercent}%</p>
            <p className="text-sm text-sky-800">
              {e.pointsAwarded} of {e.maxPoints} points
            </p>
          </div>
          <List title="What you actually did" items={e.evidence} />
          {e.feedback ? <p className="text-sm text-slate-700">{e.feedback}</p> : null}
          <List title="What you showed well" items={e.wentWell} />
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">How you did on each part</h4>
            {e.criteria.map((c) => (
              <div key={c.criterion} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">
                  {c.criterion} <span className="font-normal text-slate-500">{c.pointsAwarded} / {c.maxPoints}</span>
                </p>
                {c.comment ? <p className="mt-0.5 text-slate-600">{c.comment}</p> : null}
              </div>
            ))}
          </section>
          <List title="Needs another look" items={e.incorrectOrUnclear} />
          <List title="Ideas to clear up" items={e.misconceptions} />
          <List title="How to explain it better" items={e.improvements} />
          {e.nextAction ? (
            <p className="text-sm text-slate-700">
              <strong>Next step:</strong> {e.nextAction}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">{e.evidenceStatement}</p>
          <Button variant="outline" onClick={onNew} className="gap-1.5 text-sm">
            <RefreshCw className="h-4 w-4" aria-hidden /> {newLabel}
          </Button>
        </>
      )}
    </section>
  );
}

/** Speak instead of typing, where the browser supports it. */
export function Dictate({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  type Recognition = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    // Detected after mount so the server and the browser render the same first paint.
    Promise.resolve().then(() => setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition)));
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.onresult = (ev) => {
      const text = Array.from(ev.results).map((x) => x[0]?.transcript ?? '').join(' ').trim();
      if (text) onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${listening ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-600'}`}
    >
      <Mic className="h-3 w-3" aria-hidden /> {listening ? 'Listening… tap to stop' : 'Speak your answer'}
    </button>
  );
}
