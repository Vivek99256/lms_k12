'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FlaskConical, Layers, Microscope, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchScopeOptions,
  scopeId,
  scopeLabel,
  type ActivityScope,
  type ScopeOptions,
} from '@/app/pal/data/pal-activity-scope';
import { fetchExplanationLab } from '@/app/pal/data/pal-explanation-workspace';
import { fetchExperimentBuilder } from '@/app/pal/data/pal-experiment-builder';
import { fetchExperimentDesign } from '@/app/pal/data/pal-experiment-design';
import { fetchVirtualLab } from '@/app/pal/data/pal-virtual-lab';
import { fetchLabModel } from '@/app/pal/data/pal-lab-spec';
import { modelForScope } from '@/lib/experiment-builder/registry';
import type { ExperimentModel } from '@/lib/experiment-builder/types';
import { labForScope } from '@/lib/virtual-lab/registry';

import { ExplanationWorkspace } from './explanation-lab/ExplanationWorkspace';
import { ExperimentDesignWorkspace } from './explanation-lab/ExperimentDesignWorkspace';
import { ExperimentBuilderWorkspace } from './experiment-builder/ExperimentBuilderWorkspace';

// The 3D lab is large; it is loaded only when a student opens a mission.
const VirtualLabRunner = dynamic(() => import('./virtual-lab/VirtualLabRunner').then((m) => m.VirtualLabRunner), { ssr: false });

/**
 * The Application Lab.
 *
 *   1. Choose the scope: some of the concepts you have studied, or the whole
 *      chapter (open only once every concept has been studied). Nothing is
 *      chosen for the student.
 *   2. Choose how: the first activity, or an experiment you design yourself, both limited
 *      to that scope. The first activity is an interactive 3D science mission
 *      when the chapter has one that fits the scope, and otherwise an
 *      AI-generated challenge built from the chapter.
 *   3. Do it in its own workspace, explain it, and get feedback.
 *
 * Each (scope, activity) pair has its own saved progress and marking. The server
 * checks the scope on every request; this screen only asks.
 */

type Which = 'ai' | 'own';
type Status = { label: string; tone: 'idle' | 'progress' | 'done' };

const TONE: Record<Status['tone'], string> = {
  idle: 'bg-slate-100 text-slate-600',
  progress: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
};

function describe(status: string | undefined, score: number | null | undefined): Status {
  if (!status) return { label: 'Not started', tone: 'idle' };
  if (status === 'evaluated') return { label: score != null ? `Marked: ${score}%` : 'Marked', tone: 'done' };
  if (status === 'submitted') return { label: 'Submitted', tone: 'done' };
  return { label: 'In progress', tone: 'progress' };
}

export function ApplicationLabPanel({
  chapterId,
  chapterName,
}: {
  chapterId: string;
  chapterName: string;
}) {
  const [options, setOptions] = useState<ScopeOptions | null>(null);
  // The approved virtual lab for this chapter, if a teacher has approved one. Without it the guided form is used.
  const [labSpec, setLabSpec] = useState<ExperimentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [scope, setScope] = useState<ActivityScope | null>(null);
  const [active, setActive] = useState<Which | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);
  const [ai, setAi] = useState<Status>({ label: 'Not started', tone: 'idle' });
  const [own, setOwn] = useState<Status>({ label: 'Not started', tone: 'idle' });

  const loadOptions = useCallback(
    (signal?: AbortSignal) => {
      fetchScopeOptions(chapterId, signal)
        .then((o) => {
          if (signal?.aborted) return;
          setError(null);
          setOptions(o);
        })
        .catch((e: unknown) => {
          if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Couldn’t load your concepts.');
        });
    },
    [chapterId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLabModel(chapterId, controller.signal)
      .then((m) => {
        if (!controller.signal.aborted) setLabSpec(m);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [chapterId]);

  // Where each activity stands for the chosen scope. Reads only; nothing is generated here.
  const refresh = useCallback(
    (forScope: ActivityScope, signal?: AbortSignal) => {
      const lab = labForScope(chapterId, chapterName, forScope.concepts, forScope.type === 'chapter');
      if (lab) {
        fetchVirtualLab(chapterId, lab.id, signal)
          .then(({ record }) => setAi(describe(record?.status, record?.evaluation?.scorePercent)))
          .catch(() => undefined);
      } else {
        fetchExplanationLab(chapterId, forScope, signal)
          .then((r) => setAi(describe(r?.status, r?.evaluation?.scorePercent)))
          .catch(() => undefined);
      }
      const builder = modelForScope(labSpec, forScope.concepts, forScope.type === 'chapter');
      const status = builder
        ? fetchExperimentBuilder(chapterId, builder.id, forScope, signal)
        : fetchExperimentDesign(chapterId, forScope, signal);
      status.then(({ record }) => setOwn(describe(record?.status, record?.evaluation?.scorePercent))).catch(() => undefined);
    },
    [chapterId, chapterName, labSpec]
  );

  useEffect(() => {
    if (!scope || active || missionOpen) return;
    const controller = new AbortController();
    refresh(scope, controller.signal);
    return () => controller.abort();
  }, [scope, active, missionOpen, refresh]);

  const chooseScope = (next: ActivityScope) => {
    setAi({ label: 'Not started', tone: 'idle' });
    setOwn({ label: 'Not started', tone: 'idle' });
    setScope(next);
  };

  const builderModel = scope ? modelForScope(labSpec, scope.concepts, scope.type === 'chapter') : null;

  // ---- step 3: a workspace ----------------------------------------------------------
  if (scope && active) {
    return (
      <div className="space-y-3">
        <Button size="sm" variant="outline" onClick={() => setActive(null)} className="h-8 gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the two activities
        </Button>
        <div className="rounded-xl border border-sky-200 bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-sky-700">
            {active === 'ai' ? 'AI-Generated Activity' : 'Design Your Own Experiment'} · {scopeLabel(scope)}
          </p>
          {active === 'ai' ? (
            <ExplanationWorkspace key={`ai:${scopeId(scope)}`} chapterId={chapterId} chapterName={chapterName} scope={scope} />
          ) : builderModel ? (
            <ExperimentBuilderWorkspace key={`own:${scopeId(scope)}`} chapterId={chapterId} chapterName={chapterName} scope={scope} model={builderModel} />
          ) : (
            <ExperimentDesignWorkspace key={`own:${scopeId(scope)}`} chapterId={chapterId} chapterName={chapterName} scope={scope} />
          )}
        </div>
      </div>
    );
  }

  // ---- step 2: how ------------------------------------------------------------------
  if (scope) {
    const mission = labForScope(chapterId, chapterName, scope.concepts, scope.type === 'chapter');
    const cards: { id: Which; title: string; icon: React.ReactNode; body: string; points: string[]; status: Status }[] = [
      mission
        ? {
            id: 'ai',
            title: 'Interactive Science Mission',
            icon: <FlaskConical className="h-5 w-5 text-sky-600" aria-hidden />,
            body: `${mission.title}. Do a real investigation in a 3D lab: predict, set up a fair test with your own hands, run the experiment and explain what you found.`,
            points: ['Pick up equipment and set it up yourself', 'Watch the experiment happen and record the evidence', 'Earn points and badges as a scientist'],
            status: ai,
          }
        : {
        id: 'ai',
        title: 'AI-Generated Activity',
        icon: <Sparkles className="h-5 w-5 text-sky-600" aria-hidden />,
        body:
          scope.type === 'chapter'
            ? 'One activity that connects the important ideas of the whole chapter. You do it yourself, then explain it.'
            : `An activity made from ${scope.concepts.length === 1 ? 'the concept you chose' : 'the concepts you chose'}. You do it yourself, then explain it.`,
        points: ['Built only from your chosen scope', 'You build, arrange or experiment', 'You explain what you did and why'],
        status: ai,
      },
      {
        id: 'own',
        title: 'Design Your Own Experiment',
        icon: <Microscope className="h-5 w-5 text-violet-600" aria-hidden />,
        body: builderModel
          ? 'You get a real problem, a lab and a shelf of equipment. Build your own investigation, run it in a simulation, and explain what your results show. Nobody gives you the set-up.'
          : 'Plan an experiment like a scientist. Ask a question, choose the equipment, plan a fair test, predict the result and say what you would conclude.',
        points: builderModel
          ? ['Choose your own equipment and variables', 'Run your own trials and read your own results', 'Get a report on how you applied the concepts']
          : ['Choose apparatus with real photos', 'Plan the steps and a fair test', 'Predict, explain and get feedback'],
        status: own,
      },
    ];

    return (
      <div className="space-y-3">
        {missionOpen && mission ? (
          <VirtualLabRunner
            chapterId={chapterId}
            labId={mission.id}
            onClose={() => {
              setMissionOpen(false);
              refresh(scope);
            }}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-700">
            Scope: <strong>{scopeLabel(scope)}</strong>
            {scope.type === 'concepts' && scope.concepts.length > 1 ? ` (${scope.concepts.join('; ')})` : ''}
          </p>
          <Button size="sm" variant="outline" onClick={() => setScope(null)} className="h-7 text-xs">
            Change scope
          </Button>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Choose how you want to show it</h3>
          <p className="text-xs text-slate-600">Each has its own workspace, progress and feedback.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => (
            <section key={card.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={card.title}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <h4 className="text-sm font-bold text-slate-900">{card.title}</h4>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[card.status.tone]}`}>{card.status.label}</span>
              </div>
              <p className="text-xs text-slate-700">{card.body}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {card.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Button
                size="sm"
                onClick={() => (card.id === 'ai' && mission ? setMissionOpen(true) : setActive(card.id))}
                className={`mt-auto self-start text-xs font-semibold text-white ${card.id === 'ai' ? 'bg-sky-700 hover:bg-sky-800' : 'bg-violet-700 hover:bg-violet-800'}`}
              >
                {card.status.tone === 'idle' ? 'Start' : card.status.tone === 'progress' ? 'Continue' : 'See my result'}
              </Button>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ---- step 1: scope ----------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <span>{error}</span>
        <Button size="sm" variant="outline" onClick={() => { setError(null); loadOptions(); }} className="h-8 gap-1.5 bg-white text-xs text-rose-700">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }
  if (!options) {
    return (
      <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden /> Checking what you have studied…
      </div>
    );
  }

  const studiedNames = options.studied.map((c) => c.name);
  const allPicked = studiedNames.length > 0 && picked.length === studiedNames.length;
  const toggle = (name: string) => setPicked((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">What should your activity be about?</h3>
        <p className="text-xs text-slate-600">
          Choose some concepts you have studied in {chapterName}, or the whole chapter. You decide.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Concept-based activity">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-600" aria-hidden />
            <h4 className="text-sm font-bold text-slate-900">Concept-Based Activity</h4>
          </div>
          <p className="text-xs text-slate-700">Pick one or more concepts you have studied. Only these are used.</p>
          {studiedNames.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              You have not studied any concept in this chapter yet. Learn a concept (Step 4) or try Adaptive Practice first, then come back.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {picked.length} of {studiedNames.length} selected
                </span>
                <button type="button" onClick={() => setPicked(allPicked ? [] : studiedNames)} className="font-semibold text-sky-700 underline">
                  {allPicked ? 'Clear' : 'Select all'}
                </button>
              </div>
              <div role="group" aria-label="Concepts you have studied" className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {options.studied.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    role="checkbox"
                    aria-checked={picked.includes(c.name)}
                    onClick={() => toggle(c.name)}
                    className={`w-full rounded-lg border-2 px-3 py-2 text-left transition ${picked.includes(c.name) ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                  >
                    <span className="block text-xs font-semibold text-slate-900">{c.name}</span>
                    {c.description ? <span className="line-clamp-1 block text-[11px] text-slate-600">{c.description}</span> : null}
                  </button>
                ))}
              </div>
            </>
          )}
          <Button
            size="sm"
            disabled={picked.length === 0}
            onClick={() => chooseScope({ type: 'concepts', concepts: picked })}
            className="mt-auto self-start bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
          >
            {picked.length === 0 ? 'Choose at least one concept' : `Continue with ${picked.length} concept${picked.length === 1 ? '' : 's'}`}
          </Button>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Whole chapter activity">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-600" aria-hidden />
            <h4 className="text-sm font-bold text-slate-900">Whole Chapter Activity</h4>
          </div>
          <p className="text-xs text-slate-700">One activity that connects the important ideas of the whole chapter.</p>
          <p className="text-xs text-slate-600">
            You have studied <strong>{studiedNames.length}</strong> of <strong>{options.total}</strong> concepts.
          </p>
          {!options.chapterComplete ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              This opens when you have studied every concept in the chapter. You can still use the concepts you have studied.
            </p>
          ) : null}
          <Button
            size="sm"
            disabled={!options.chapterComplete}
            onClick={() => chooseScope({ type: 'chapter', concepts: [] })}
            className="mt-auto self-start bg-violet-700 text-xs font-semibold text-white hover:bg-violet-800"
          >
            {options.chapterComplete ? 'Use the whole chapter' : 'Not open yet'}
          </Button>
        </section>
      </div>
    </div>
  );
}
