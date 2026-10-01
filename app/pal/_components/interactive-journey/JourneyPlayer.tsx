'use client';

import { Fragment, useCallback, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, Loader2, Route, Sparkles, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JourneyRecipe, VisualComponentName, VisualComponentProps } from './types';
import { BarModel } from './visuals/BarModel';
import { FractionBar } from './visuals/FractionBar';
import { GeometryCanvas } from './visuals/GeometryCanvas';
import { NumberLine } from './visuals/NumberLine';
import { PracticeStep } from './PracticeStep';

/**
 * Orchestrates the 7-step Interactive Learning Journey for one concept.
 *
 * Mounted by the Learn page for every concept, with a recipe dynamically
 * generated from that concept's own real data (see `generateJourneyRecipe`
 * in generate.ts) — never a concept-id lookup. This component owns nothing
 * outside its own subtree: closing it (`onExit`) never navigates, same as
 * the existing inline-activity views on that page.
 */

// Same registry-of-components shape H5PActivityPlayer already uses for its
// own heterogeneous set of players — each entry's prop types genuinely
// differ per component, so a shared `any` here is the same trade this
// codebase already made there, not a new pattern.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VISUAL_COMPONENTS: Record<VisualComponentName, (props: VisualComponentProps<any>) => React.ReactElement> = {
  BarModel,
  FractionBar,
  GeometryCanvas,
  NumberLine,
};

type StepKey = 'hook' | 'visual' | 'explore' | 'explain' | 'animate' | 'guided' | 'practice' | 'complete';

const STEP_ORDER: StepKey[] = ['hook', 'visual', 'explore', 'explain', 'animate', 'guided', 'practice', 'complete'];

const STEP_LABEL: Record<StepKey, string> = {
  hook: 'Hook',
  visual: 'Visual',
  explore: 'Explore',
  explain: 'Explain',
  animate: 'Animate',
  guided: 'Guided',
  practice: 'Practice',
  complete: 'Complete',
};

// The 7 pedagogical steps shown in the progress rail — "Complete" is a
// closing screen the journey adds on top, not one of the 7.
const PROGRESS_STEPS: StepKey[] = ['hook', 'visual', 'explore', 'explain', 'animate', 'guided', 'practice'];

export function JourneyPlayer({
  conceptId,
  conceptName,
  recipe,
  onExit,
  onContinue,
  continuing,
  continueError,
}: {
  conceptId: string;
  conceptName: string;
  recipe: JourneyRecipe;
  onExit: () => void;
  onContinue: () => void;
  continuing: boolean;
  continueError: string | null;
}) {
  const [step, setStep] = useState<StepKey>('hook');
  const [stepComplete, setStepComplete] = useState<Partial<Record<StepKey, boolean>>>({});
  const stepIndex = STEP_ORDER.indexOf(step);
  const Visual = VISUAL_COMPONENTS[recipe.component];

  const goTo = useCallback((next: StepKey) => setStep(next), []);
  const markComplete = useCallback((key: StepKey) => setStepComplete((prev) => ({ ...prev, [key]: true })), []);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Back to learning
      </button>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          <Route aria-hidden className="h-3.5 w-3.5" />
          Interactive learning journey
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{conceptName}</h2>
      </div>

      <JourneyProgress step={step} />

      {step === 'hook' && (
        <ScenarioCard
          eyebrow="Why am I learning this? A real situation first"
          icon={Sparkles}
          text={recipe.hook.scenario}
          prompt={recipe.hook.prompt}
        >
          <Visual params={recipe.hook.params} mode="reveal" onComplete={() => markComplete('hook')} />
          <StepFooter show={Boolean(stepComplete.hook)} label="See it another way" onNext={() => goTo('visual')} />
        </ScenarioCard>
      )}

      {step === 'visual' && (
        <ScenarioCard eyebrow="Look closely" icon={Sparkles} prompt={recipe.visual.prompt}>
          <Visual params={recipe.visual.params} mode="reveal" onComplete={() => markComplete('visual')} />
          <StepFooter show={Boolean(stepComplete.visual)} label="Now try it yourself" onNext={() => goTo('explore')} />
        </ScenarioCard>
      )}

      {step === 'explore' && (
        <ScenarioCard eyebrow="Explore" icon={Compass} prompt={recipe.explore.prompt}>
          <Visual params={recipe.explore.params} mode="explore" />
          <StepFooter show label="See the rule behind it" onNext={() => goTo('explain')} />
        </ScenarioCard>
      )}

      {step === 'explain' && (
        <ExplainCard rule={recipe.explain.rule}>
          <Visual params={recipe.explain.params} mode="summary" />
          <StepFooter show label="Watch another example" onNext={() => goTo('animate')} />
        </ExplainCard>
      )}

      {step === 'animate' && (
        <ScenarioCard eyebrow="Watch" icon={Sparkles} prompt={recipe.animate.prompt}>
          <Visual params={recipe.animate.params} mode="animate" onComplete={() => markComplete('animate')} />
          <StepFooter show={Boolean(stepComplete.animate)} label="Your turn" onNext={() => goTo('guided')} />
        </ScenarioCard>
      )}

      {step === 'guided' && (
        <ScenarioCard eyebrow="Guided interaction" icon={Compass} prompt={recipe.guided.prompt}>
          <Visual params={recipe.guided.params} mode="guided" target={recipe.guided.target} onComplete={() => markComplete('guided')} />
          <StepFooter show={Boolean(stepComplete.guided)} label="Continue to practice" onNext={() => goTo('practice')} />
        </ScenarioCard>
      )}

      {step === 'practice' && <PracticeStep conceptId={conceptId} onDone={() => goTo('complete')} />}

      {step === 'complete' && (
        <CompleteCard conceptName={conceptName} onContinue={onContinue} continuing={continuing} continueError={continueError} />
      )}

      {stepIndex > 0 && step !== 'complete' && (
        <button
          type="button"
          onClick={() => goTo(STEP_ORDER[stepIndex - 1])}
          className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          Back to {STEP_LABEL[STEP_ORDER[stepIndex - 1]].toLowerCase()}
        </button>
      )}
    </div>
  );
}

/**
 * A connected step tracker — filled circles joined by a line that fills in
 * as the student progresses, labels beneath each one — so "where am I?" is
 * answered by a single glance rather than by reading a row of pill labels.
 */
function JourneyProgress({ step }: { step: StepKey }) {
  const currentIndex = PROGRESS_STEPS.indexOf(step);

  return (
    <div aria-label="Interactive learning journey progress" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
      <div className="flex items-center">
        {PROGRESS_STEPS.map((key, i) => {
          const state = currentIndex < 0 ? 'done' : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          const isLast = i === PROGRESS_STEPS.length - 1;
          return (
            <Fragment key={key}>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-300',
                  state === 'done' && 'bg-emerald-500 text-white',
                  state === 'current' && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                  state === 'upcoming' && 'bg-slate-100 text-slate-400'
                )}
              >
                {state === 'done' ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn('mx-1 h-0.5 flex-1 rounded-full transition-colors duration-500', i < currentIndex ? 'bg-emerald-400' : 'bg-slate-200')}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      <div className="mt-1.5 flex">
        {PROGRESS_STEPS.map((key, i) => {
          const state = currentIndex < 0 ? 'done' : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
          return (
            <span
              key={key}
              className={cn(
                'flex-1 text-center text-[10px] font-medium first:text-left last:text-right',
                state === 'current' && 'font-semibold text-indigo-700',
                state === 'done' && 'text-emerald-700',
                state === 'upcoming' && 'text-slate-400'
              )}
            >
              {STEP_LABEL[key]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioCard({
  eyebrow,
  icon: Icon,
  text,
  prompt,
  children,
}: {
  eyebrow: string;
  icon: typeof Sparkles;
  text?: string;
  prompt: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          <Icon aria-hidden className="h-3.5 w-3.5" />
          {eyebrow}
        </p>
        {text && <p className="mt-2 text-sm font-medium text-slate-900">{text}</p>}
        <p className="mt-1 text-sm text-slate-600">{prompt}</p>
      </div>
      {children}
    </section>
  );
}

function ExplainCard({ rule, children }: { rule: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Now the general rule
        </p>
        <p className="mt-2 text-sm text-slate-700">{rule}</p>
      </div>
      {children}
    </section>
  );
}

function StepFooter({ show, label, onNext }: { show: boolean; label: string; onNext: () => void }) {
  if (!show) return null;
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={onNext}>
        {label}
        <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CompleteCard({
  conceptName,
  onContinue,
  continuing,
  continueError,
}: {
  conceptName: string;
  onContinue: () => void;
  continuing: boolean;
  continueError: string | null;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Trophy aria-hidden className="h-6 w-6" />
        </span>
        <p className="mt-1 text-base font-semibold text-emerald-900">Topic complete</p>
        <p className="max-w-sm text-sm text-emerald-800">
          You worked through {conceptName.toLowerCase()} — a real scenario, the rule behind it, and a chance to try it
          yourself before practising it for real.
        </p>
      </div>

      {continueError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{continueError}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={continuing}>
          {continuing && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
          Continue to next topic
          {!continuing && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
    </section>
  );
}

/**
 * The always-visible entry point, for every concept. Rendered where the
 * ordinary "Interactive activities" resource card would be — deliberately
 * NOT dependent on one existing, since most concepts have no resource
 * authored at all. Nothing here replaces the resource grid; it renders
 * alongside it.
 *
 * Opens `WebConceptVisual` (a real, openly-licensed web image for the
 * concept) first; this player is what that surface falls back to
 * automatically when no usable image is found, never something the student
 * picks separately.
 */
export function JourneyEntryCard({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-white px-4 py-3.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
        <Route aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
          <Sparkles aria-hidden className="h-3 w-3" />
          Interactive activities
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-slate-900">Learn this concept visually</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-300 group-hover:scale-105">
        Start
        <ArrowRight aria-hidden className="h-3 w-3" />
      </span>
    </button>
  );
}
