'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, Play, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchExperimentBuilder,
  saveExperimentBuilder,
  submitExperimentBuilder,
  type BuilderRecord,
} from '@/app/pal/data/pal-experiment-builder';
import type { ChapterConcept } from '@/app/pal/data/pal-student-creation';
import type { ActivityScope } from '@/app/pal/data/pal-activity-scope';
import {
  MAX_TRIALS,
  autoBench,
  designFacts,
  effectiveSettings,
  emptyDesign,
  hasInstrument,
  measuredSeconds,
  missingEssentials,
  newTrial,
  nextHint,
  propLabel,
  settingLabel,
  settingsOnBench,
  withProvidedBench,
} from '@/lib/experiment-builder/engine';
import type { BuilderDesign, BuilderPhase, ExperimentModel } from '@/lib/experiment-builder/types';

import { Dictate, Feedback } from '../explanation-lab/ExplanationWorkspace';
import { LabStrip } from './LabStrip';
import { StationGrid } from './Stations';
import { VariableSorter } from './VariableSorter';

/**
 * Application Lab, activity 2: Design Your Own Experiment, as a virtual lab. The same stages for every lab.
 *
 *   1 Brief      a real problem (no method, no set-up), what a good answer must show, and the concepts it will use
 *   2 Question   your own testable question, your prediction and why
 *   3 Variables  sort the settings of the lab's equipment: what you change, what you measure, what you keep the same
 *   4 Run        trials as stations side by side; the simulation answers for YOUR set-up; you write down each reading
 *   5 Analyse    what you saw, your claim, your evidence, your reasoning, how far you trust it; then submit
 *   Report       marked on the decisions and the reasoning: what you did, your hints, and what to improve
 *
 * Hints are about the student's own work and get a little more specific each time; they never name the set-up or
 * the answer. How many were asked for is recorded and reported. Nothing about a chapter is in this file: the lab
 * (equipment, settings, measure, result model) comes from an approved lab specification.
 */

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; concepts: ChapterConcept[]; record: BuilderRecord | null };

const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50';
const PRIMARY = 'bg-sky-700 text-sm font-semibold text-white hover:bg-sky-800';
const RUN_MS = 6000;

const STEPS: { id: BuilderPhase; label: string }[] = [
  { id: 'challenge', label: 'Brief' },
  { id: 'question', label: 'Question' },
  { id: 'variables', label: 'Variables' },
  { id: 'run', label: 'Run' },
  { id: 'interpret', label: 'Analyse' },
];

const STARTERS = ['How does ___ affect ___?', 'What happens to ___ when ___ changes?', 'Which ___ makes ___ the biggest?'];

/** The hint button and what it said. A hint is about the student's own work and never names the set-up or the answer. */
function HintBox({ at, hint, count, onAsk }: { at: BuilderPhase; hint: string | null; count: number; onAsk: (phase: BuilderPhase) => void }) {
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onAsk(at)} className="h-8 gap-1.5 text-xs" data-testid="hint-button">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden /> I am stuck: give me a hint
      </Button>
      {hint ? (
        <p role="status" data-testid="hint-text" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          💡 {hint}
        </p>
      ) : null}
      {count > 0 ? <p className="text-[11px] text-slate-500">Hints asked for so far: {count}. This is shown in your report.</p> : null}
    </div>
  );
}

/** The results of the trials that have been run: a table and a bar for each, so trials can be compared. */
function Results({ model, d }: { model: ExperimentModel; d: BuilderDesign }) {
  const ran = d.trials.filter((t) => t.ran);
  if (ran.length === 0) return <p className="text-xs text-slate-500">No trials run yet. Your results will appear here.</p>;
  const longest = Math.max(1e-9, ...ran.map((t) => t.seconds ?? 0));
  const measure = model.measures[0];
  const keys = settingsOnBench(model, d.bench);
  return (
    <div className="space-y-2" data-testid="results">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="border border-slate-200 px-2 py-1">Trial</th>
              {keys.map((k) => (
                <th key={k.key} className="border border-slate-200 px-2 py-1">{k.label}</th>
              ))}
              <th className="border border-slate-200 px-2 py-1">{measure.label} ({measure.unit})</th>
            </tr>
          </thead>
          <tbody>
            {ran.map((t) => {
              const eff = effectiveSettings(model, d.bench, t.props);
              return (
                <tr key={t.id}>
                  <td className="border border-slate-200 px-2 py-1 font-semibold">{t.label}</td>
                  {keys.map((k) => (
                    <td key={k.key} className="border border-slate-200 px-2 py-1">{settingLabel(model, k.key, eff[k.key])}</td>
                  ))}
                  <td className="border border-slate-200 px-2 py-1 font-mono">{t.seconds !== null ? t.seconds.toFixed(measure.decimals ?? 1) : 'not measured'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ran.some((t) => t.seconds !== null) ? (
        <div className="space-y-1" aria-label="Result of each trial">
          {ran.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0 font-semibold text-slate-700">{t.label}</span>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div className="h-4 rounded bg-sky-500" style={{ width: `${((t.seconds ?? 0) / longest) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-slate-700">{t.seconds !== null ? `${t.seconds.toFixed(0)} ${measure.unit}` : '—'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-800">Nothing was measured. Is the instrument on your bench?</p>
      )}
    </div>
  );
}

/**
 * `preview` is for a teacher checking a lab before approving it: the same experiment students get, but nothing is
 * loaded, saved, submitted or marked, and every concept of the lab is already chosen.
 */
export function ExperimentBuilderWorkspace({ chapterId, scope, model, preview = false }: { chapterId: string; chapterName: string; scope: ActivityScope; model: ExperimentModel; preview?: boolean }) {
  const [view, setView] = useState<View>(
    preview
      ? { kind: 'ready', concepts: model.concepts.map((name) => ({ name, description: '', taught: true })), record: null }
      : { kind: 'loading' }
  );
  const [d, setD] = useState<BuilderDesign>(() => emptyDesign(model.id, preview ? model.concepts : [], model.version, autoBench(model)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hintNow, setHint] = useState<{ text: string; at: number } | null>(null);
  const [runs, setRuns] = useState<Record<number, number>>({});
  const dirty = useRef(false);
  const dRef = useRef(d);
  const raf = useRef(0);
  const status = view.kind === 'ready' ? view.record?.status ?? 'in_progress' : 'in_progress';
  const concepts = view.kind === 'ready' ? view.concepts : [];

  useEffect(() => {
    dRef.current = d;
  }, [d]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const load = useCallback(
    (signal?: AbortSignal) => {
      fetchExperimentBuilder(chapterId, model.id, scope, signal)
        .then(({ concepts: list, record }) => {
          if (signal?.aborted) return;
          dirty.current = false;
          const fresh = emptyDesign(model.id, [], model.version, autoBench(model));
          // One concept chosen means there is nothing to decide: the investigation is about it.
          if (scope.type === 'concepts' && list.length === 1) fresh.focus = [list[0].name];
          // An older design, from when students placed the equipment themselves, goes on with the equipment the lab provides.
          setD(record ? (record.status === 'in_progress' ? withProvidedBench(model, record.design) : record.design) : fresh);
          setView({ kind: 'ready', concepts: list, record });
        })
        .catch((e: unknown) => {
          if (!signal?.aborted) setView({ kind: 'error', message: errorText(e, 'Couldn’t load your experiment lab.') });
        });
    },
    [chapterId, scope, model]
  );

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, preview]);

  // Autosave.
  useEffect(() => {
    if (preview || view.kind !== 'ready' || status !== 'in_progress' || !dirty.current) return;
    const t = setTimeout(() => {
      setSaving('saving');
      saveExperimentBuilder(chapterId, scope, dRef.current)
        .then((out) => {
          if (out.message) setNotice(out.message);
          setSaving('saved');
        })
        .catch(() => setNotice('Couldn’t save just now. Keep going; it will try again.'));
    }, 1200);
    return () => clearTimeout(t);
  }, [d, view.kind, status, chapterId, scope, preview]);

  const edit = useCallback((patch: Partial<BuilderDesign>, logLine?: string) => {
    dirty.current = true;
    setD((cur) => ({
      ...cur,
      ...patch,
      actions: cur.actions + (logLine ? 1 : 0),
      log: logLine ? [...cur.log, logLine].slice(-120) : cur.log,
    }));
  }, []);

  // ---- trials ---------------------------------------------------------------------------
  const setProp = (i: number, key: string, value: string) =>
    edit({ trials: d.trials.map((t, k) => (k === i ? { ...t, props: { ...t.props, [key]: value } } : t)) });
  const addTrial = (from?: number) => {
    if (d.trials.length >= MAX_TRIALS) return;
    edit({ trials: [...d.trials, newTrial(d.trials.length + 1, from !== undefined ? d.trials[from] : undefined)] }, from !== undefined ? `copied trial ${from + 1}` : 'added a trial');
  };
  const removeTrial = (i: number) => {
    if (d.trials.length <= 1) return;
    const kept = d.trials.filter((_, k) => k !== i).map((t, k) => ({ ...t, id: `t${k + 1}`, label: `Trial ${k + 1}` }));
    edit({ trials: kept }, `removed trial ${i + 1}`);
  };
  const setRecorded = (i: number, raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw);
    edit({ trials: d.trials.map((t, k) => (k === i ? { ...t, recorded: n !== null && Number.isFinite(n) ? n : null } : t)) });
  };

  /** Runs the given stations together, as a time-lapse; each finishes with its own result. */
  const startRuns = (indices: number[]) => {
    if (Object.keys(runs).length > 0 || missingEssentials(model, d.bench).length > 0) return;
    const active = indices.filter((i) => d.trials[i] && !d.trials[i].ran);
    if (active.length === 0) return;
    const snapshot = d;
    const hasMeter = hasInstrument(snapshot.bench, model.measures[0].instrument);
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / RUN_MS);
      setRuns(Object.fromEntries(active.map((i) => [i, f])));
      if (f < 1) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      dirty.current = true;
      setD((cur) => ({
        ...cur,
        trials: cur.trials.map((t, k) => {
          if (!active.includes(k)) return t;
          const eff = effectiveSettings(model, cur.bench, t.props);
          return { ...t, ran: true, seconds: hasMeter ? measuredSeconds(model, eff, t.id, 1) : null };
        }),
        actions: cur.actions + active.length,
        log: [...cur.log, `ran ${active.length === 1 ? `trial ${active[0] + 1}` : `${active.length} trials together`}`].slice(-120),
      }));
      setRuns({});
    };
    raf.current = requestAnimationFrame(tick);
  };

  // ---- hints ----------------------------------------------------------------------------
  const askHint = (phase: BuilderPhase) => {
    const h = nextHint(model, d, phase, d.hints);
    if (!h) {
      setHint({ text: 'Nothing to point out right now. What you have so far looks sound for this step.', at: d.actions });
      return;
    }
    setHint({ text: h.text, at: d.actions + 1 });
    edit({ hints: [...d.hints, { phase, topic: h.topic, level: h.level }] }, `asked for a hint (${h.topic})`);
  };

  const adopt = (record: BuilderRecord) => {
    dirty.current = false;
    setD(record.design);
    setView((v) => (v.kind === 'ready' ? { ...v, record } : v));
  };

  const submit = () => {
    if (busy) return;
    if (preview) {
      setNotice('Preview only: nothing is saved, submitted or marked.');
      return;
    }
    setBusy(true);
    setNotice(null);
    submitExperimentBuilder(chapterId, scope, d)
      .then(({ record, message }) => {
        if (!record) {
          setNotice(message ?? 'Couldn’t submit your work.');
          return;
        }
        adopt(record);
        if (record.status === 'submitted') setNotice('Your work is saved. The marking did not finish; try “Get my feedback”.');
      })
      .catch((e: unknown) => setNotice(errorText(e, 'Couldn’t submit your work.')))
      .finally(() => setBusy(false));
  };

  const startAnother = () => {
    if (!window.confirm('Design another experiment? This one stays as it is.')) return;
    saveExperimentBuilder(chapterId, scope, emptyDesign(model.id, [], model.version, autoBench(model)), true)
      .then(({ record }) => {
        dirty.current = false;
        setD(record ? record.design : emptyDesign(model.id, [], model.version, autoBench(model)));
        setView((v) => (v.kind === 'ready' ? { ...v, record } : v));
      })
      .catch((e: unknown) => setNotice(errorText(e, 'Couldn’t start a new one.')));
  };

  if (view.kind === 'loading') {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden /> Opening your lab…
      </div>
    );
  }
  if (view.kind === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <span>{view.message}</span>
        <Button size="sm" variant="outline" onClick={() => { setView({ kind: 'loading' }); load(); }} className="h-8 gap-1.5 bg-white text-xs text-rose-700">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  const locked = status !== 'in_progress';
  const phase: BuilderPhase | 'feedback' = locked ? 'feedback' : d.phase;
  const goto = (p: BuilderPhase) => {
    setHint(null);
    edit({ phase: p });
  };
  const hint = hintNow && hintNow.at === d.actions ? hintNow.text : null;
  const facts = designFacts(model, d);
  const measure = model.measures[0];
  const stage = phase === 'feedback' ? STEPS.length : phase === 'review' ? STEPS.length - 1 : STEPS.findIndex((s) => s.id === phase);
  const needFocus = scope.type === 'chapter' ? Math.min(2, concepts.length) : 1;
  const focusOk = d.focus.length >= Math.max(1, needFocus);
  const settings = settingsOnBench(model, d.bench);
  const questionOk = d.question.trim().length >= 10;
  // The lab provides its equipment, so there is always everything an experiment needs.
  const benchOk = true;
  const variablesOk = d.iv !== '' && d.dv !== '';
  const runOk = facts.measured >= 2 && (!d.recording || facts.recordedRight >= 2);
  const interpretOk = d.interpretation.seen.trim().length >= 5 && d.interpretation.claim.trim().length >= 10;
  const toggleFocus = (name: string) => edit({ focus: d.focus.includes(name) ? d.focus.filter((n) => n !== name) : [...d.focus, name] });
  const setInterp = (patch: Partial<BuilderDesign['interpretation']>) => edit({ interpretation: { ...d.interpretation, ...patch } });
  const running = Object.keys(runs).length > 0;
  const unran = d.trials.map((t, i) => (t.ran ? -1 : i)).filter((i) => i >= 0);
  const valueFor = (t: BuilderDesign['trials'][number]) => measuredSeconds(model, effectiveSettings(model, d.bench, t.props), t.id, 1);

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progress">
        {[...STEPS, { id: 'feedback' as const, label: 'Report' }].map((s, i) => (
          <li key={s.id} aria-current={i === stage ? 'step' : undefined} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${i === stage ? 'bg-sky-600 text-white' : i < stage ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
            {i + 1}. {s.label}
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

      {phase === 'challenge' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Your challenge</p>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">{model.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-800" data-testid="scenario">{model.scenario}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-slate-700">
            <p className="font-bold text-sky-900">What you have to show</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {model.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <p className="mt-2 text-slate-600">Nobody will tell you what to build or which steps to follow. You have a lab, a shelf of equipment and a simulation. Hints are there if you get stuck.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Which concepts will your investigation use?</p>
            <div role="group" aria-label="Concepts in your scope" className="mt-2 grid gap-2 sm:grid-cols-2">
              {concepts.map((x) => (
                <button key={x.name} type="button" role="checkbox" aria-checked={d.focus.includes(x.name)} onClick={() => toggleFocus(x.name)} className={`rounded-xl border-2 p-3 text-left transition ${d.focus.includes(x.name) ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}>
                  <p className="text-sm font-semibold text-slate-900">{x.name}</p>
                  {x.description ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{x.description}</p> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => goto('question')} disabled={!focusOk} className={PRIMARY}>Start: ask my question</Button>
            {!focusOk ? <span className="text-xs text-slate-500">{needFocus > 1 ? 'Choose at least two concepts.' : 'Choose a concept.'}</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'question' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900"><strong>Problem:</strong> {model.scenario}</p>
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-900">What do you want to find out? Write a question you can test.</span>
              <input value={d.question} maxLength={300} onChange={(e) => edit({ question: e.target.value })} className={FIELD} placeholder="A question your experiment can answer…" data-testid="question" />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Need a start? Tap one and fill the blanks:</span>
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => edit({ question: s })} className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-sky-400">{s}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-900">What do you think will happen?</span>
              <textarea rows={3} value={d.prediction} onChange={(e) => edit({ prediction: e.target.value })} className={FIELD} placeholder="Your prediction" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-900">Why do you think so?</span>
              <textarea rows={3} value={d.reason} onChange={(e) => edit({ reason: e.target.value })} className={FIELD} placeholder="Use an idea from the chapter" />
            </label>
          </div>
          <HintBox at="question" hint={hint} count={d.hints.length} onAsk={askHint} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('challenge')} className="text-sm">Back</Button>
            <Button onClick={() => goto('variables')} disabled={!questionOk} className={PRIMARY}>Next: sort my variables</Button>
            {!questionOk ? <span className="text-xs text-slate-500">Write your question (a full sentence).</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'variables' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Sort the variables of your investigation</h4>
            <p className="text-xs text-slate-600">Your question: {d.question}</p>
          </div>
          <LabStrip model={model} bench={d.bench} />
          <VariableSorter
            model={model}
            settings={settings}
            value={{ iv: d.iv, dv: d.dv, controls: d.controls }}
            locked={false}
            onChange={(next) => edit({ iv: next.iv, dv: next.dv, controls: next.controls }, 'sorted the variables')}
          />
          <HintBox at="variables" hint={hint} count={d.hints.length} onAsk={askHint} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('question')} className="text-sm">Back</Button>
            <Button onClick={() => goto('run')} disabled={!variablesOk} className={PRIMARY}>Next: run my experiment</Button>
            {!variablesOk ? <span className="text-xs text-slate-500">Choose what you change and what you measure.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'run' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-600">Each station is one trial. Set it, run it, and write down what the instrument shows.</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {d.trials.length < MAX_TRIALS ? (
                <Button type="button" size="sm" variant="outline" onClick={() => addTrial()} disabled={running} className="h-8 gap-1 text-xs" data-testid="add-station"><Plus className="h-3.5 w-3.5" /> New station</Button>
              ) : null}
              <Button type="button" size="sm" onClick={() => startRuns(unran)} disabled={running || unran.length < 2 || !benchOk} className="h-8 gap-1 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800" data-testid="run-all"><Play className="h-3.5 w-3.5" /> Run all together</Button>
            </div>
          </div>
          <StationGrid
            model={model}
            d={d}
            runs={runs}
            canRun={benchOk}
            canAdd={d.trials.length < MAX_TRIALS}
            onProp={setProp}
            onRun={(i) => startRuns([i])}
            onCopy={(i) => addTrial(i)}
            onRemove={removeTrial}
            onRecord={setRecorded}
            valueFor={valueFor}
          />
          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-900">Your results</h4>
            <Results model={model} d={d} />
            <p className="mt-1 text-[11px] text-slate-500">All numbers come from a simulation of this experiment. Real measurements also vary a little, so repeating a test is worth doing.</p>
          </div>
          <HintBox at="run" hint={hint} count={d.hints.length} onAsk={askHint} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('variables')} disabled={running} className="text-sm">Back to my variables</Button>
            <Button onClick={() => goto('interpret')} disabled={!runOk || running} className={PRIMARY}>Next: what do the results show?</Button>
            {!runOk ? <span className="text-xs text-slate-500">{facts.measured < 2 ? 'Run and measure at least two trials.' : 'Write down the reading of at least two trials, as the instrument showed it.'}</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'interpret' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-900">Your results</h4>
            <Results model={model} d={d} />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">What did you observe? (what happened, not why)</span>
            <textarea rows={2} value={d.interpretation.seen} onChange={(e) => setInterp({ seen: e.target.value })} className={FIELD} placeholder="In my trials I saw…" />
            <Dictate onText={(t) => setInterp({ seen: `${d.interpretation.seen ? `${d.interpretation.seen} ` : ''}${t}` })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">My claim: the answer to my question</span>
            <textarea rows={2} value={d.interpretation.claim} onChange={(e) => setInterp({ claim: e.target.value })} className={FIELD} placeholder="My results show that…" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">My evidence: which numbers show this?</span>
            <textarea rows={2} value={d.interpretation.evidence} onChange={(e) => setInterp({ evidence: e.target.value })} className={FIELD} placeholder="In trial … the result was …, but in trial … it was …" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">My reasoning: why did it happen? Use an idea from the chapter.</span>
            <textarea rows={3} value={d.interpretation.reasoning} onChange={(e) => setInterp({ reasoning: e.target.value })} className={FIELD} placeholder="This happens because…" />
            <Dictate onText={(t) => setInterp({ reasoning: `${d.interpretation.reasoning ? `${d.interpretation.reasoning} ` : ''}${t}` })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">How far do I trust this result? What would I test next? (optional)</span>
            <textarea rows={2} value={d.interpretation.limits} onChange={(e) => setInterp({ limits: e.target.value })} className={FIELD} />
          </label>
          <HintBox at="interpret" hint={hint} count={d.hints.length} onAsk={askHint} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('run')} className="text-sm">Back to my trials</Button>
            <Button onClick={() => goto('review')} disabled={!interpretOk} className={PRIMARY}>Review and submit</Button>
            {!interpretOk ? <span className="text-xs text-slate-500">Describe what you saw and write your claim.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'review' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Review and submit</h3>
          <dl className="space-y-1.5 text-sm text-slate-700">
            <div><dt className="inline font-semibold">Question: </dt><dd className="inline">{d.question}</dd></div>
            <div><dt className="inline font-semibold">You change: </dt><dd className="inline">{d.iv ? propLabel(model, d.iv) : '—'}</dd></div>
            <div><dt className="inline font-semibold">You measure: </dt><dd className="inline">{measure.label}</dd></div>
            <div><dt className="inline font-semibold">Trials run: </dt><dd className="inline">{facts.ran} ({facts.repeats > 0 ? 'with a repeat' : 'no repeat'})</dd></div>
            <div><dt className="inline font-semibold">Hints asked for: </dt><dd className="inline">{d.hints.length}</dd></div>
          </dl>
          <Results model={model} d={d} />
          <p className="text-xs text-slate-500">After you submit you cannot change it. Your decisions and your reasoning are marked, and you get a report.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => goto('interpret')} disabled={busy} className="text-sm">Back</Button>
            <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {busy ? 'Submitting and marking…' : 'Submit my experiment'}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'feedback' ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="report-summary">
              <h4 className="mb-2 text-sm font-bold text-slate-900">What you did</h4>
              <ul className="space-y-1 text-xs text-slate-700">
                <li>Trials run: <strong>{facts.ran}</strong>; measured: <strong>{facts.measured}</strong>; repeated: <strong>{facts.repeats > 0 ? 'yes' : 'no'}</strong></li>
                <li>A fair test (one thing changed): <strong>{facts.fair ? 'yes' : 'no'}</strong></li>
                <li>Readings you wrote down correctly: <strong>{facts.recordedRight} of {facts.measured}</strong></li>
                <li>Equipment you did not need: <strong>{facts.otherItems}</strong></li>
                <li>Hints you asked for: <strong>{d.hints.length}</strong></li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="report-timeline">
              <h4 className="mb-2 text-sm font-bold text-slate-900">Your decisions, in order</h4>
              <ol className="max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-5 text-[11px] text-slate-700">
                {d.log.map((l, i) => (
                  <li key={`${i}-${l}`}>{l}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-1 text-sm font-bold text-slate-900">What you ran</h4>
            <Results model={model} d={d} />
          </div>
          <Feedback evaluation={view.record?.evaluation ?? null} busy={busy} onRetry={submit} onNew={startAnother} newLabel="Design another experiment" />
        </div>
      ) : null}
    </div>
  );
}
