'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';

import {
  fetchAdaptiveConcepts,
  fetchChapterDiagnosticHistory,
  fetchChapterMastery,
  fetchConceptLearn,
  fetchConceptResult,
  fetchLearningPlan,
  fetchRecallQueue,
  type ConceptDiagnosticResult,
} from '@/app/pal/data/pal-diagnostic';
import { defaultLearnerId, fetchNextAction, type EsoAction } from '@/app/pal/data/pal-eso';
import { fetchChapterExperiments } from '@/app/pal/data/pal-experiments';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { JOURNEY_STAGE_BY_KEY, stageHref, type JourneyStageKey } from './journey-stages';

/**
 * The left-hand panel of the image journey: what actually happens at the stage
 * the learner just clicked.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FETCHES REAL DATA INSTEAD OF LINKING OUT
 * ---------------------------------------------------------------------------
 * The requirement is that clicking a journey image loads that step's
 * functionality on the same page, without navigating. Navigating to the step's
 * own screen is what the rail never did in the first place — it only ever
 * reported position — so a link would have been no better than the rail and
 * would have thrown away the point of the map.
 *
 * So this calls the SAME read-only endpoints each stage's own page calls
 * (`fetchChapterDiagnosticHistory`, `fetchLearningPlan`, `fetchConceptLearn`,
 * `fetchConceptResult`, `fetchChapterMastery`, `fetchRecallQueue`,
 * `fetchNextAction`), reads the same payloads, and shows the part of that stage
 * a learner needs to decide whether they want it. The full screen is still one
 * click away, for the parts that genuinely need a full screen — sitting a
 * fifteen-question paper is not something to do in a side panel, and pretending
 * otherwise would be worse than saying so.
 *
 * ---------------------------------------------------------------------------
 * WHY NOTHING HERE WRITES
 * ---------------------------------------------------------------------------
 * Every fetch above is a GET, and the only actions rendered are links to the
 * stage's own screen. Submitting answers, acknowledging a lesson read and
 * requesting support all still happen where they always did, behind their own
 * routes, with the engine watching. A journey map that could move a learner
 * three stages forward from a preview panel would be a much more dangerous
 * thing than a map, and would make the "is this done?" question unanswerable
 * from the screen showing the answer.
 */

type PanelState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; body: React.ReactNode };

const LOAD_ERROR =
  'This part of your journey could not be loaded right now. The full screen will still open it.';

export interface JourneyStagePanelProps {
  stage: JourneyStageKey;
  chapterId?: string | number | null;
  conceptId?: string | number | null;
}

export function JourneyStagePanel({ stage, chapterId, conceptId }: JourneyStagePanelProps) {
  const meta = JOURNEY_STAGE_BY_KEY[stage];
  const href = stageHref(stage, { chapterId, conceptId });

  return (
    <section aria-label={meta.label} className="flex h-full min-h-0 flex-col">
      <header className="border-b px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your journey
        </p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">{meta.label}</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{meta.blurb}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        {/*
          Keyed on the stage AND the ids, so changing stage remounts this and
          the loader starts in its own initial `loading` state. That is why the
          fetch below never has to set state synchronously inside the effect —
          which is the pattern React 19 warns about, and which would otherwise
          cost a wasted render on every stage click.
        */}
        <StageLoader
          key={`${stage}|${chapterId ?? ''}|${conceptId ?? ''}`}
          stage={stage}
          chapterId={chapterId}
          conceptId={conceptId}
        />
      </div>

      {href ? (
        <footer className="border-t px-5 py-3 sm:px-6">
          <Link
            href={href}
            className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center gap-1.5')}
          >
            Open the full {meta.label.toLowerCase()} screen
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

function StageLoader({
  stage,
  chapterId,
  conceptId,
}: {
  stage: JourneyStageKey;
  chapterId?: string | number | null;
  conceptId?: string | number | null;
}) {
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    loadStageBody(stage, chapterId, conceptId, controller.signal)
      .then((body) => {
        if (!cancelled) setState({ status: 'ready', body });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: LOAD_ERROR });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [stage, chapterId, conceptId, attempt]);

  if (state.status === 'loading') return <PanelSkeleton />;

  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{state.message}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  return <>{state.body}</>;
}

function PanelSkeleton() {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading what happens here…
    </div>
  );
}

// --- one body per stage -----------------------------------------------------

async function loadStageBody(
  stage: JourneyStageKey,
  chapterId: string | number | null | undefined,
  conceptId: string | number | null | undefined,
  signal: AbortSignal
): Promise<React.ReactNode> {
  switch (stage) {
    case 'diagnostic':
      return chapterId ? diagnosticBody(chapterId, signal) : missingId('this chapter');
    case 'adaptive':
      return chapterId
        ? adaptiveChapterBody(chapterId, signal)
        : conceptId
          ? conceptResultBody(conceptId, signal)
          : missingId('this chapter or concept');
    case 'plan':
      return chapterId ? planBody(chapterId, signal) : missingId('this chapter');
    case 'learn':
      return conceptId ? learnBody(conceptId, signal) : missingId('this concept');
    case 'practice':
      return conceptId ? engineBody(conceptId, signal) : missingId('this concept');
    case 'feedback':
      return conceptId ? feedbackBody(conceptId, signal) : missingId('this concept');
    case 'check':
      return conceptId ? checkBody(conceptId, signal) : missingId('this concept');
    case 'intervention':
      return conceptId ? interventionBody(conceptId, signal) : missingId('this concept');
    case 'mastery':
      return chapterId
        ? masteryChapterBody(chapterId, signal)
        : conceptId
          ? conceptResultBody(conceptId, signal)
          : missingId('this chapter or concept');
    case 'experiment':
      return chapterId ? experimentBody(chapterId) : missingId('this chapter');
    case 'recall':
      return recallBody(chapterId ?? undefined, signal);
    default:
      return missingId('this stage');
  }
}

/**
 * Shown when the screen hosting the map did not carry the id a stage needs.
 *
 * A concept screen has no chapter and a chapter screen has no concept, and the
 * map sits behind the rail on both (see `stageHref`). Saying which id was
 * missing is more useful than a blank panel, and it is the honest answer —
 * there is no chapter to report on from a screen that is about one concept.
 */
function missingId(what: string): React.ReactNode {
  return (
    <p className="text-sm text-slate-600">
      This step is about {what}, which this screen doesn’t have. Open the full screen to see it.
    </p>
  );
}

async function diagnosticBody(chapterId: string | number, signal: AbortSignal) {
  const history = await fetchChapterDiagnosticHistory(chapterId, signal);
  const attempts = history.attempts;
  const latest = attempts[0];
  const best = attempts.reduce((max, entry) => Math.max(max, entry.percentage), 0);

  if (attempts.length === 0) {
    return (
      <Rows
        rows={[
          ['Attempts so far', 'None yet'],
          ['What it does', 'Fifteen questions across the chapter, easy to hard.'],
        ]}
      />
    );
  }

  return (
    <Rows
      rows={[
        ['Attempts so far', String(attempts.length)],
        ['Most recent', `${latest.percentage}% · ${latest.level}`],
        ['Best score', `${best}%`],
        [
          'Last one',
          `${latest.correct} right, ${latest.incorrect} wrong of ${latest.totalQuestions}`,
        ],
      ]}
    />
  );
}

async function adaptiveChapterBody(chapterId: string | number, signal: AbortSignal) {
  const list = await fetchAdaptiveConcepts(chapterId, signal);
  const servable = list.concepts.filter((concept) => concept.servable).length;

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Chapter', list.chapterName],
          ['Chapter paper', list.hasDiagnostic ? `${list.diagnosticLevel}` : 'Not taken yet'],
          ['Concepts', `${list.concepts.length} (${servable} with questions)`],
        ]}
      />
      <ul className="space-y-1.5">
        {list.concepts.slice(0, 6).map((concept) => (
          <li key={concept.conceptId} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-900">{concept.name}</span>
            <span className="shrink-0 text-xs text-slate-600">
              {concept.diagnosticPercentage === null
                ? 'not started'
                : `${concept.diagnosticPercentage}%`}
            </span>
          </li>
        ))}
      </ul>
      {list.concepts.length > 6 ? (
        <p className="text-xs text-slate-600">and {list.concepts.length - 6} more</p>
      ) : null}
    </div>
  );
}

async function planBody(chapterId: string | number, signal: AbortSignal) {
  const plan = await fetchLearningPlan(chapterId, signal);
  const { summary } = plan;

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Chapter', plan.chapterName],
          ['Concepts', `${summary.conceptsTotal} (${summary.conceptsServable} ready to practise)`],
          ['Mastered', String(summary.mastered)],
          ['Still weak', String(summary.weak)],
        ]}
      />
      <ol className="space-y-2">
        {plan.steps.slice(0, 6).map((step, index) => (
          <li key={step.key} className="flex gap-3 text-sm">
            <span aria-hidden className="mt-0.5 text-xs font-semibold text-slate-600">
              {index + 1}
            </span>
            <span>
              <span className="font-medium text-slate-900">{step.title}</span>
              {step.detail ? (
                <span className="block text-xs text-slate-600">{step.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

async function learnBody(conceptId: string | number, signal: AbortSignal) {
  const learn = await fetchConceptLearn(conceptId, signal);
  const totals = learn.resources.totals;

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Concept', learn.conceptName],
          ['Resources', `${totals.items} (${totals.conceptScoped} on this concept)`],
          ['Extra support flagged', learn.misconceptions.length ? 'Yes' : 'No'],
        ]}
      />
      {learn.message ? <p className="text-sm text-slate-600">{learn.message}</p> : null}
      {learn.misconceptions.slice(0, 3).map((item) => (
        <div key={item.misconceptionTag} className="rounded-md border p-3 text-sm">
          <p className="font-medium text-slate-900">{item.title}</p>
          {item.body ? <p className="mt-1 text-slate-600">{item.body}</p> : null}
        </div>
      ))}
    </div>
  );
}

async function engineBody(conceptId: string | number, signal: AbortSignal) {
  const action = await fetchNextAction(defaultLearnerId(), Number(conceptId), signal);
  return <EngineRows action={action} heading="What the engine says to do next" />;
}

async function feedbackBody(conceptId: string | number, signal: AbortSignal) {
  const result = await fetchConceptResult(conceptId, signal);
  const verdict = result.rationale || result.understanding;

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Concept', result.conceptName],
          ['Answered', String(result.attempted)],
          ['Accuracy', `${result.accuracy}%`],
          ['Reading', result.understanding],
        ]}
      />
      {verdict ? <p className="text-sm text-slate-600">{verdict}</p> : null}
      {result.misconception ? (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium text-slate-900">{result.misconception.tag}</p>
          <p className="mt-1 text-slate-600">{result.misconception.description}</p>
          <p className="mt-2 text-slate-900">{result.misconception.correctiveAction}</p>
        </div>
      ) : null}
    </div>
  );
}

async function checkBody(conceptId: string | number, signal: AbortSignal) {
  const result = await fetchConceptResult(conceptId, signal);

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Concept', result.conceptName],
          ['Ready to progress', result.readyForProgression ? 'Yes' : 'Not yet'],
          ['Bands cleared', result.ladder.bandsCleared.join(', ') || 'None yet'],
          ['Ladder', `${result.ladder.progressPct}%`],
        ]}
      />
      <p className="text-sm text-slate-600">{result.ladder.reason}</p>
    </div>
  );
}

async function interventionBody(conceptId: string | number, signal: AbortSignal) {
  const result = await fetchConceptResult(conceptId, signal);

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Concept', result.conceptName],
          ['Support needed', result.needsRemediation ? 'Yes' : 'Not flagged'],
          ['Attempts', String(result.attempted)],
          ['Accuracy', `${result.accuracy}%`],
        ]}
      />
      {result.next ? (
        <p className="text-sm text-slate-600">Next: {result.next.reason}</p>
      ) : null}
    </div>
  );
}

async function masteryChapterBody(chapterId: string | number, signal: AbortSignal) {
  const mastery = await fetchChapterMastery(chapterId, signal);
  const { summary } = mastery;

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Chapter', mastery.chapterName ?? 'This chapter'],
          ['Mastered', `${summary.mastered} of ${summary.conceptsTotal}`],
          ['Retained', String(summary.retained)],
          ['Reviews due', String(summary.recallDue)],
        ]}
      />
      <ul className="space-y-1.5">
        {mastery.concepts.slice(0, 6).map((concept) => (
          <li key={concept.conceptId} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-900">{concept.name}</span>
            <span className="shrink-0 text-xs text-slate-600">
              {concept.bktMastered ? 'mastered' : concept.stage || 'not started'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function conceptResultBody(conceptId: string | number, signal: AbortSignal) {
  const result = await fetchConceptResult(conceptId, signal);
  return <ConceptResultRows result={result} />;
}

/**
 * The chapter's Prayogshala experiments, read through the same client and the
 * same eligibility rule Course master uses. Running one needs the full screen.
 */
async function experimentBody(chapterId: string | number) {
  const { experiments } = await fetchChapterExperiments(chapterId);

  if (experiments.length === 0) {
    return (
      <p className="text-sm text-slate-600">No Prayogshala experiment has been published for this chapter yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <Rows rows={[['Experiments', String(experiments.length)]]} />
      <ul className="space-y-1.5">
        {experiments.slice(0, 6).map((activity) => (
          <li key={activity.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-900">{activity.title}</span>
            <span className="shrink-0 text-xs text-slate-600">
              {activity.lab_config ? 'lab' : activity.activity_type_label.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function recallBody(chapterId: string | number | undefined, signal: AbortSignal) {
  const queue = await fetchRecallQueue(chapterId, signal);

  if (queue.due.length === 0 && queue.upcoming.length === 0) {
    return <p className="text-sm text-slate-600">Nothing due for review yet.</p>;
  }

  return (
    <div className="space-y-4">
      <Rows
        rows={[
          ['Due now', String(queue.counts.due)],
          ['Coming up', String(queue.counts.upcoming)],
          ['Concepts tracked', String(queue.counts.totalTracked)],
        ]}
      />
      <ul className="space-y-1.5">
        {queue.due.slice(0, 6).map((item) => (
          <li key={item.nodeId} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-900">{item.conceptName}</span>
            <span className="shrink-0 text-xs text-slate-600">due</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptResultRows({ result }: { result: ConceptDiagnosticResult }) {
  return (
    <Rows
      rows={[
        ['Concept', result.conceptName],
        ['Answered', String(result.attempted)],
        ['Accuracy', `${result.accuracy}%`],
        ['Current band', result.currentDifficulty ?? '—'],
      ]}
    />
  );
}

function EngineRows({ action, heading }: { action: EsoAction; heading: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {heading}
      </p>
      <Rows rows={[['Action', action.action], ['Why', action.ruleFired]]} />
      {action.llmInstruction ? (
        <p className="text-sm text-slate-900">{action.llmInstruction}</p>
      ) : null}
    </div>
  );
}

// --- shared bits -----------------------------------------------------------

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-slate-600">{term}</dt>
          <dd className={cn('text-slate-900')}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}