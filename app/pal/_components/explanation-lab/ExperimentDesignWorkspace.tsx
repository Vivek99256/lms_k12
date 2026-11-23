/* eslint-disable @next/next/no-img-element -- apparatus photographs are Wikimedia pictures whose size is not known in advance */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  emptyDesign,
  fetchExperimentDesign,
  saveExperimentDesign,
  submitExperimentDesign,
  type Apparatus,
  type Design,
  type DesignPhase,
  type DesignRecord,
} from '@/app/pal/data/pal-experiment-design';
import { searchPictures, type ChapterConcept, type PictureHit } from '@/app/pal/data/pal-student-creation';
import type { ActivityScope } from '@/app/pal/data/pal-activity-scope';
import { suggestEmoji } from '@/lib/explanation-lab/emoji';

import { Dictate, Feedback } from './ExplanationWorkspace';

/**
 * Application Lab, activity 2: Design Your Own Experiment.
 *
 *   1 Question   choose the concept(s) and write the question the experiment asks
 *   2 Apparatus  pick the equipment (real photographs) and say what each is for
 *   3 Plan       a fair test: what you change, measure, keep the same, and the steps in order
 *   4 Predict    what will happen and why, what you will record, what to be careful of
 *   5 Conclude   what you would conclude and how you would improve it
 *   6 Submit     marked on the design and the reasoning
 *
 * The student is not given an experiment: each box says what to write and shows an example, nothing more.
 */

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; concepts: ChapterConcept[]; record: DesignRecord | null };

const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50';
const PRIMARY = 'bg-sky-700 text-sm font-semibold text-white hover:bg-sky-800';

/** Common school apparatus, one tap to add. The student may add anything else by typing its name. */
const KIT = ['Beaker', 'Conical flask', 'Test tube', 'Measuring cylinder', 'Thermometer', 'Stopwatch', 'Magnet', 'Weighing balance', 'Ruler', 'Funnel', 'Bunsen burner', 'Magnifying glass'];

const STARTERS = ['What happens to ___ when ___?', 'Does ___ affect ___?', 'Which ___ is best for ___?', 'How does ___ change when ___ changes?'];

const STEPS: { id: DesignPhase; label: string }[] = [
  { id: 'focus', label: 'Question' },
  { id: 'apparatus', label: 'Apparatus' },
  { id: 'plan', label: 'Plan' },
  { id: 'predict', label: 'Predict' },
  { id: 'conclude', label: 'Conclude' },
  { id: 'review', label: 'Submit' },
];

function Help({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-slate-700">
      <p className="font-bold text-sky-900">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function Thumb({ a, size = 64 }: { a: Apparatus; size?: number }) {
  if (a.image) {
    return <img src={a.image} alt={a.name} referrerPolicy="no-referrer" loading="lazy" className="rounded-lg border border-slate-200 bg-slate-100 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl" style={{ width: size, height: size }} aria-hidden>
      {a.icon || '🧪'}
    </span>
  );
}

export function ExperimentDesignWorkspace({ chapterId, scope }: { chapterId: string; chapterName: string; scope: ActivityScope }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [d, setD] = useState<Design>(emptyDesign());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [typed, setTyped] = useState('');
  const [options, setOptions] = useState<Record<string, PictureHit[]>>({});
  const [choosing, setChoosing] = useState<string | null>(null);
  const dirty = useRef(false);
  // Apparatus ids only need to be unique inside one design; saved ones are "a1", "a2" ... so start above them.
  const nextId = useRef(100);
  const dRef = useRef(d);
  const status = view.kind === 'ready' ? view.record?.status ?? 'in_progress' : 'in_progress';
  const concepts = view.kind === 'ready' ? view.concepts : [];

  useEffect(() => {
    dRef.current = d;
  }, [d]);

  const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const load = useCallback(
    (signal?: AbortSignal) => {
      fetchExperimentDesign(chapterId, scope, signal)
        .then(({ concepts: list, record }) => {
          if (signal?.aborted) return;
          dirty.current = false;
          const fresh = emptyDesign();
          // One concept chosen means there is nothing to decide: the experiment is about it.
          if (scope.type === 'concepts' && list.length === 1) fresh.focus = [list[0].name];
          setD(record ? record.design : fresh);
          setView({ kind: 'ready', concepts: list, record });
        })
        .catch((e: unknown) => {
          if (!signal?.aborted) setView({ kind: 'error', message: errorText(e, 'Couldn’t load your experiment.') });
        });
    },
    [chapterId, scope]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Autosave.
  useEffect(() => {
    if (view.kind !== 'ready' || status !== 'in_progress' || !dirty.current) return;
    const t = setTimeout(() => {
      setSaving('saving');
      saveExperimentDesign(chapterId, scope, dRef.current)
        .then((out) => {
          if (out.message) setNotice(out.message);
          setSaving('saved');
        })
        .catch(() => setNotice('Couldn’t save just now. Keep going; it will try again.'));
    }, 1200);
    return () => clearTimeout(t);
  }, [d, view.kind, status, chapterId, scope]);

  const edit = useCallback((patch: Partial<Design>, logLine?: string) => {
    dirty.current = true;
    setD((cur) => ({
      ...cur,
      ...patch,
      actions: cur.actions + (logLine ? 1 : 0),
      log: logLine ? [...cur.log, logLine].slice(-120) : cur.log,
    }));
  }, []);

  const editVar = (key: 'change' | 'measure' | 'same', value: string) => edit({ variables: { ...d.variables, [key]: value } });

  // ---- apparatus ------------------------------------------------------------------------
  const patchApparatus = (id: string, patch: Partial<Apparatus>, logLine?: string) =>
    edit({ apparatus: d.apparatus.map((a) => (a.id === id ? { ...a, ...patch } : a)) }, logLine);

  /** Fetches photographs of the apparatus and puts the best one on it, unless the student already chose one. */
  const findPhotos = (id: string, name: string) => {
    searchPictures(name)
      .then((hits) => {
        const found = hits.slice(0, 8);
        setOptions((o) => ({ ...o, [id]: found }));
        if (found.length > 0) {
          dirty.current = true;
          setD((cur) => ({
            ...cur,
            apparatus: cur.apparatus.map((a) => (a.id === id && !a.image ? { ...a, image: found[0].url, credit: found[0].credit } : a)),
          }));
        }
      })
      .catch(() => undefined);
  };

  const addApparatus = (raw: string) => {
    const name = raw.trim().slice(0, 40);
    if (!name || d.apparatus.length >= 14) return;
    if (d.apparatus.some((a) => a.name.toLowerCase() === name.toLowerCase())) return;
    nextId.current += 1;
    const id = `a${nextId.current}`;
    const icon = suggestEmoji(name) ?? '🧪';
    edit({ apparatus: [...d.apparatus, { id, name, image: '', credit: '', icon, purpose: '' }] }, `added apparatus "${name}"`);
    setTyped('');
    findPhotos(id, name);
  };

  const removeApparatus = (id: string) =>
    edit(
      {
        apparatus: d.apparatus.filter((a) => a.id !== id),
        steps: d.steps.map((s) => ({ ...s, uses: s.uses.filter((u) => u !== id) })),
      },
      'removed apparatus'
    );

  // ---- steps ----------------------------------------------------------------------------
  const patchStep = (i: number, patch: Partial<Design['steps'][number]>) =>
    edit({ steps: d.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const addStep = () => {
    if (d.steps.length >= 14) return;
    edit({ steps: [...d.steps, { id: `s${d.steps.length + 1}`, text: '', uses: [] }] }, 'added a step');
  };
  const moveStep = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= d.steps.length) return;
    const next = [...d.steps];
    [next[i], next[j]] = [next[j], next[i]];
    edit({ steps: next }, 'reordered the steps');
  };
  const removeStep = (i: number) => {
    if (d.steps.length <= 1) return;
    edit({ steps: d.steps.filter((_, k) => k !== i) }, 'removed a step');
  };
  const toggleUse = (i: number, id: string) =>
    patchStep(i, { uses: d.steps[i].uses.includes(id) ? d.steps[i].uses.filter((u) => u !== id) : [...d.steps[i].uses, id] });

  const adopt = (record: DesignRecord) => {
    dirty.current = false;
    setD(record.design);
    setView((v) => (v.kind === 'ready' ? { ...v, record } : v));
  };

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    submitExperimentDesign(chapterId, scope, d)
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
    saveExperimentDesign(chapterId, scope, emptyDesign(), true)
      .then(({ record }) => {
        dirty.current = false;
        setD(record ? record.design : emptyDesign());
        setView((v) => (v.kind === 'ready' ? { ...v, record } : v));
      })
      .catch((e: unknown) => setNotice(errorText(e, 'Couldn’t start a new one.')));
  };

  if (view.kind === 'loading') {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden /> Opening your experiment…
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
  const phase: DesignPhase | 'feedback' = locked ? 'feedback' : d.phase;
  const goto = (p: DesignPhase) => edit({ phase: p });
  const stepIndex = phase === 'feedback' ? STEPS.length : STEPS.findIndex((s) => s.id === phase);
  const focusText = d.focus.join(', ');
  const needFocus = scope.type === 'chapter' ? Math.min(2, concepts.length) : 1;
  const focusOk = d.focus.length >= Math.max(1, needFocus) && d.question.trim().length >= 10;
  const apparatusOk = d.apparatus.length >= 2;
  const writtenSteps = d.steps.filter((s) => s.text.trim().length >= 5).length;
  const planOk = writtenSteps >= 3;
  const predictOk = d.prediction.trim() !== '';
  const concludeOk = d.conclusion.trim() !== '';
  const toggleFocus = (name: string) => edit({ focus: d.focus.includes(name) ? d.focus.filter((n) => n !== name) : [...d.focus, name] });

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progress">
        {[...STEPS, { id: 'feedback' as const, label: 'Feedback' }].map((s, i) => (
          <li key={s.id} aria-current={i === stepIndex ? 'step' : undefined} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${i === stepIndex ? 'bg-sky-600 text-white' : i < stepIndex ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
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

      {phase === 'focus' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Design your own experiment</h3>
            <p className="mt-1 text-sm text-slate-700">
              You will plan an experiment like a scientist: ask a question, choose the equipment, plan a fair test, predict what will happen and say what you would conclude. You do not run it here; you design it.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">1. What is your experiment about?</p>
            <div role="group" aria-label="Concepts in your scope" className="mt-2 grid gap-2 sm:grid-cols-2">
              {concepts.length === 0 ? <p className="text-sm text-slate-600">There are no concepts in this scope.</p> : null}
              {concepts.map((x) => (
                <button
                  key={x.name}
                  type="button"
                  role="checkbox"
                  aria-checked={d.focus.includes(x.name)}
                  onClick={() => toggleFocus(x.name)}
                  className={`rounded-xl border-2 p-3 text-left transition ${d.focus.includes(x.name) ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{x.name}</p>
                  {x.description ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{x.description}</p> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-900">2. Write the question your experiment will answer</span>
              <input value={d.question} maxLength={300} onChange={(e) => edit({ question: e.target.value })} className={FIELD} placeholder="e.g. Does warm water dissolve sugar faster than cold water?" />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Need a start? Tap one and fill the blanks:</span>
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => edit({ question: s })} className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-sky-400">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => goto('apparatus')} disabled={!focusOk} className={PRIMARY}>
              Next: choose apparatus
            </Button>
            {!focusOk ? <span className="text-xs text-slate-500">{d.focus.length < Math.max(1, needFocus) ? (needFocus > 1 ? 'Choose at least two concepts.' : 'Choose a concept.') : 'Write your question (a full sentence).'}</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'apparatus' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <Help title="What to do">
            <p>Choose the equipment you would use. Tap an item below, or type your own. A real photo is added; change it if it is not right.</p>
            <p>Then write what each one is <strong>for</strong> in your experiment.</p>
          </Help>
          <p className="text-xs text-slate-600">
            Your question: <strong>{d.question}</strong>
          </p>
          <div className="flex flex-wrap gap-1.5" aria-label="Common apparatus">
            {KIT.map((k) => {
              const added = d.apparatus.some((a) => a.name.toLowerCase() === k.toLowerCase());
              return (
                <button key={k} type="button" disabled={added} onClick={() => addApparatus(k)} className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${added ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'}`}>
                  {added ? '✓' : <Plus className="h-3 w-3" aria-hidden />} {k}
                </button>
              );
            })}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addApparatus(typed);
            }}
          >
            <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={40} className={FIELD} placeholder="Something else? Type its name, e.g. Spring balance" aria-label="Add other apparatus" />
            <Button type="submit" variant="outline" disabled={typed.trim() === ''} className="shrink-0 text-sm">
              Add
            </Button>
          </form>

          {d.apparatus.length === 0 ? <p className="text-xs text-slate-500">Nothing chosen yet. Pick at least two.</p> : null}
          <ul className="space-y-3" aria-label="Your apparatus">
            {d.apparatus.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <Thumb a={a} size={84} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{a.name}</p>
                      <button type="button" onClick={() => removeApparatus(a.id)} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${a.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <input value={a.purpose} maxLength={200} onChange={(e) => patchApparatus(a.id, { purpose: e.target.value })} className={FIELD} placeholder={`What is the ${a.name.toLowerCase()} for in your experiment?`} aria-label={`What ${a.name} is for`} />
                    <button type="button" onClick={() => setChoosing(choosing === a.id ? null : a.id)} className="text-[11px] font-semibold text-sky-700 underline">
                      {choosing === a.id ? 'Close photos' : 'Change photo'}
                    </button>
                  </div>
                </div>
                {choosing === a.id ? (
                  <div className="mt-2 space-y-1.5">
                    {(options[a.id] ?? []).length === 0 ? (
                      <button type="button" onClick={() => findPhotos(a.id, a.name)} className="text-xs font-semibold text-sky-700 underline">
                        Look for photos of “{a.name}”
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(options[a.id] ?? []).map((p, k) => (
                          <button key={`${k}-${p.url}`} type="button" title={p.title} onClick={() => patchApparatus(a.id, { image: p.url, credit: p.credit })} className={`overflow-hidden rounded-lg border-2 ${a.image === p.url ? 'border-sky-600' : 'border-slate-200 hover:border-sky-400'}`}>
                            <img src={p.url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => patchApparatus(a.id, { image: '', credit: '' })} className="text-[11px] font-semibold text-slate-500 underline">
                      Use the emoji instead
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {d.apparatus.some((a) => a.credit) ? (
            <details className="text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold">Picture credits</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {d.apparatus.filter((a) => a.credit).map((a) => (
                  <li key={a.id}>{a.credit}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('focus')} className="text-sm">Back</Button>
            <Button onClick={() => goto('plan')} disabled={!apparatusOk} className={PRIMARY}>Next: plan the test</Button>
            {!apparatusOk ? <span className="text-xs text-slate-500">Choose at least two pieces of apparatus.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'plan' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <Help title="What to do">
            <p>A fair test changes <strong>only one thing</strong>. Say what you change, what you measure, and what you keep the same. Then list the steps in order.</p>
            <p className="text-slate-600">Example: change = temperature of water · measure = time for the sugar to dissolve · keep the same = amount of sugar, amount of water, stirring.</p>
          </Help>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-800">I will change (one thing)</span>
              <input value={d.variables.change} maxLength={200} onChange={(e) => editVar('change', e.target.value)} className={FIELD} placeholder="e.g. the temperature" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-800">I will measure</span>
              <input value={d.variables.measure} maxLength={200} onChange={(e) => editVar('measure', e.target.value)} className={FIELD} placeholder="e.g. the time taken" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-800">I will keep the same</span>
              <input value={d.variables.same} maxLength={300} onChange={(e) => editVar('same', e.target.value)} className={FIELD} placeholder="e.g. amount of sugar, amount of water" />
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Steps, in order</p>
            <ol className="mt-2 space-y-3">
              {d.steps.map((s, i) => (
                <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{i + 1}</span>
                    <textarea rows={2} value={s.text} maxLength={400} onChange={(e) => patchStep(i, { text: e.target.value })} className={FIELD} placeholder={i === 0 ? 'e.g. Pour 100 mL of cold water into a beaker.' : 'What do you do next?'} aria-label={`Step ${i + 1}`} />
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} className="rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === d.steps.length - 1} aria-label={`Move step ${i + 1} down`} className="rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => removeStep(i)} disabled={d.steps.length <= 1} aria-label={`Remove step ${i + 1}`} className="rounded p-0.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8" role="group" aria-label={`Apparatus used in step ${i + 1}`}>
                    <span className="text-[11px] text-slate-500">Uses:</span>
                    {d.apparatus.map((a) => (
                      <button key={a.id} type="button" role="checkbox" aria-checked={s.uses.includes(a.id)} onClick={() => toggleUse(i, a.id)} className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px] font-semibold ${s.uses.includes(a.id) ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-600'}`}>
                        {a.image ? <img src={a.image} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full object-cover" /> : <span className="px-1" aria-hidden>{a.icon || '🧪'}</span>}
                        {a.name}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            {d.steps.length < 14 ? (
              <Button type="button" size="sm" variant="outline" onClick={addStep} className="mt-2 h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add a step
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('apparatus')} className="text-sm">Back</Button>
            <Button onClick={() => goto('predict')} disabled={!planOk} className={PRIMARY}>Next: predict</Button>
            {!planOk ? <span className="text-xs text-slate-500">Write at least three steps.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'predict' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <Help title="What to do">
            <p>Before an experiment, scientists predict the result and give a reason. Use what you learned in the chapter for the reason.</p>
          </Help>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">What do you think will happen?</span>
            <textarea rows={2} value={d.prediction} onChange={(e) => edit({ prediction: e.target.value })} className={FIELD} placeholder="e.g. The sugar will dissolve faster in warm water." />
            <Dictate onText={(t) => edit({ prediction: `${d.prediction ? `${d.prediction} ` : ''}${t}` })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">Why do you think so?</span>
            <textarea rows={3} value={d.reason} onChange={(e) => edit({ reason: e.target.value })} className={FIELD} placeholder="Use an idea from the chapter." />
            <Dictate onText={(t) => edit({ reason: `${d.reason ? `${d.reason} ` : ''}${t}` })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">What will you write down while you do it?</span>
            <textarea rows={2} value={d.recordPlan} onChange={(e) => edit({ recordPlan: e.target.value })} className={FIELD} placeholder="e.g. A table of temperature and time, measured three times." />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">What must you be careful about? (optional)</span>
            <input value={d.safety} maxLength={400} onChange={(e) => edit({ safety: e.target.value })} className={FIELD} placeholder="e.g. Hot water can burn; hold the beaker with a cloth." />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('plan')} className="text-sm">Back</Button>
            <Button onClick={() => goto('conclude')} disabled={!predictOk} className={PRIMARY}>Next: conclude</Button>
            {!predictOk ? <span className="text-xs text-slate-500">Write your prediction.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'conclude' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <Help title="What to do">
            <p>You are not running the experiment here. Say what result would answer your question, and what you would conclude if it happened.</p>
          </Help>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">If it works as you expect, what is your conclusion?</span>
            <textarea rows={3} value={d.conclusion} onChange={(e) => edit({ conclusion: e.target.value })} className={FIELD} placeholder="Answer your question in your own words." />
            <Dictate onText={(t) => edit({ conclusion: `${d.conclusion ? `${d.conclusion} ` : ''}${t}` })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">How could you make the experiment better? (optional)</span>
            <textarea rows={2} value={d.improve} onChange={(e) => edit({ improve: e.target.value })} className={FIELD} placeholder="e.g. Repeat it three times and take the average." />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goto('predict')} className="text-sm">Back</Button>
            <Button onClick={() => goto('review')} disabled={!concludeOk} className={PRIMARY}>Review and submit</Button>
            {!concludeOk ? <span className="text-xs text-slate-500">Write your conclusion.</span> : null}
          </div>
        </section>
      ) : null}

      {phase === 'review' ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Review and submit</h3>
          <dl className="space-y-1.5 text-sm text-slate-700">
            <div><dt className="inline font-semibold">About: </dt><dd className="inline">{focusText}</dd></div>
            <div><dt className="inline font-semibold">Question: </dt><dd className="inline">{d.question}</dd></div>
            <div><dt className="inline font-semibold">Change / measure / same: </dt><dd className="inline">{d.variables.change || '—'} / {d.variables.measure || '—'} / {d.variables.same || '—'}</dd></div>
            <div><dt className="inline font-semibold">Prediction: </dt><dd className="inline">{d.prediction}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {d.apparatus.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 pr-2 text-xs font-semibold text-slate-800"><Thumb a={a} size={28} /> {a.name}</span>
            ))}
          </div>
          <p className="text-sm text-slate-700">{writtenSteps} step{writtenSteps === 1 ? '' : 's'} written.</p>
          <p className="text-xs text-slate-500">After you submit you cannot change it. Your design and your reasoning are both marked.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => goto('conclude')} disabled={busy} className="text-sm">Back</Button>
            <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {busy ? 'Submitting and marking…' : 'Submit my experiment'}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'feedback' ? (
        <Feedback evaluation={view.record?.evaluation ?? null} busy={busy} onRetry={submit} onNew={startAnother} newLabel="Design another experiment" />
      ) : null}
    </div>
  );
}
