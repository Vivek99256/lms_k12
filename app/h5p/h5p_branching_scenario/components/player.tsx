'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, Flag, Lightbulb, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { sanitizeHtml } from '@/lib/security/sanitize-html';
import type { QuestionResult } from '@/components/h5p/players/types';
import { postH5pXapiStatement, type H5pContext } from '../../data/h5p';
import { PrimaryAction, SecondaryAction } from '../../components/game';
import {
  back,
  begin,
  canGoBack,
  choose,
  continueFromFeedback,
  endingsOf,
  estimateMinutes,
  maxScore,
  orderedChoices,
  outcomeOf,
  plainText,
  proceed,
  qualityCounts,
  recap,
  restart,
  start,
  analyse,
  BS_QUALITY_LABELS,
  type BsChoice,
  type BsNode,
  type BsQuality,
  type BsScenario,
  type PlayState,
} from '@/lib/h5p/branching-scenario';

/**
 * Branching Scenario — the player.
 *
 * WHAT IT DOES NOT DECIDE. Where a choice leads, whether a step back is allowed,
 * what an ending is worth and which endings have been found are all answered by
 * `lib/h5p/branching-scenario`, which is unit-tested without a browser. This file
 * renders the state it is handed and reports what the learner did; it never
 * works out a mark or follows a link itself.
 *
 * A CHOICE IS FOLLOWED BY ITS CONSEQUENCE, NOT BY A VERDICT. Picking a choice
 * shows what it led to and why before the learner moves on -- in a calm panel
 * whose tone follows how sound the choice was but which always carries a word
 * and an icon as well as a colour. A weaker choice is "Let's rethink", not a red
 * cross: the point of the type is that a wrong turn teaches.
 *
 * NO CHOICE IS MARKED BEFORE IT IS MADE. The options look the same until one is
 * picked, so the order they are shown in (shuffled when the scenario says so)
 * gives nothing away.
 *
 * EVERYTHING FROM THE AUTHOR IS SANITISED. A screen's body is HTML, and an
 * imported .h5p can carry anything, so it goes through the project's one
 * sanitiser at render and nowhere else.
 */

export interface BranchingScenarioPlayerProps {
  scenario: BsScenario;
  /** The saved row's id; null for a draft being previewed, which records nothing. */
  contentId: number | null;
  ctx: H5pContext;
  /** A teacher looking at an unsaved draft: no telemetry, and the player says so. */
  preview?: boolean;
  /** Inside another surface that has its own header and padding. */
  embedded?: boolean;
  onResult?: (result: QuestionResult) => void;
}

const QUALITY_ICON: Record<BsQuality | 'none', typeof Check> = {
  best: Check,
  partial: Compass,
  misstep: Lightbulb,
  none: Sparkles,
};

const FEEDBACK_LABEL: Record<BsQuality | 'none', string> = {
  best: 'Sound choice',
  partial: 'Partly right',
  misstep: 'Let’s rethink',
  none: 'What happens next',
};

function Html({ html, className = '' }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  if (clean.trim() === '') return null;
  return <div className={`h5p-prose ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

function Picture({ src, alt }: { src: string; alt: string }) {
  if (src.trim() === '') return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="mx-auto max-h-72 w-auto max-w-full rounded-xl border" style={{ borderColor: 'var(--h5p-line)' }} />;
}

export function BranchingScenarioPlayer({ scenario, contentId, ctx, preview = false, embedded = false, onResult }: BranchingScenarioPlayerProps) {
  const [state, setState] = useState<PlayState>(() => begin());
  /** Bumped on each restart, so a shuffled order differs between attempts but not within one. */
  const [attempt, setAttempt] = useState(1);
  const startedAt = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const record = !preview && contentId != null;
  const node = state.nodeKey != null ? scenario.nodes.find((n) => n.key === state.nodeKey) : undefined;
  const endings = useMemo(() => endingsOf(scenario), [scenario]);
  const problems = useMemo(() => analyse(scenario, false).errors, [scenario]);
  const minutes = useMemo(() => estimateMinutes(scenario), [scenario]);

  // Move focus to the new screen's heading, so a keyboard or screen-reader user
  // lands on what changed instead of on a button that no longer exists.
  useEffect(() => {
    if (state.phase === 'start') return;
    heading.current?.focus();
  }, [state.phase, state.nodeKey, state.pending]);

  const report = useCallback(
    (next: PlayState) => {
      if (!record || next.endingKey == null) return;
      const result = outcomeOf(scenario, next.endingKey);
      const seconds = (Date.now() - startedAt.current) / 1000;
      const response = result.max > 0 ? `${result.score}/${result.max}` : `ending:${next.endingKey}`;

      void postH5pXapiStatement({
        objectId: `branching_scenario:${contentId}`,
        verb: 'completed',
        ctx,
        success: result.passed ?? undefined,
        response,
        durationSeconds: seconds,
      });
      onResult?.({
        questionId: Number(contentId),
        score: result.max > 0 ? result.score : null,
        maxScore: result.max > 0 ? result.max : null,
        correct: result.passed,
        durationSeconds: seconds,
        response,
      });
    },
    [record, scenario, contentId, ctx, onResult]
  );

  /** Move to a new state, reporting completion the moment an ending is reached. */
  const go = useCallback(
    (next: PlayState) => {
      if (next.phase === 'end' && state.phase !== 'end') report(next);
      setState(next);
    },
    [report, state.phase]
  );

  const onStart = () => {
    startedAt.current = Date.now();
    go(start(scenario, state));
    if (record) {
      void postH5pXapiStatement({ objectId: `branching_scenario:${contentId}`, verb: 'attempted', ctx });
    }
  };

  const onChoose = (index: number) => {
    const here = node;
    const choice = here?.choices[index];
    if (record && choice) {
      void postH5pXapiStatement({
        objectId: `branching_scenario:${contentId}`,
        verb: 'answered',
        ctx,
        success: choice.quality === 'best',
        response: choice.text,
      });
    }
    go(choose(scenario, state, index));
  };

  const onRestart = () => {
    startedAt.current = Date.now();
    setAttempt((n) => n + 1);
    go(restart(scenario, state));
  };

  const wrapper = embedded ? 'space-y-4' : 'mx-auto max-w-3xl space-y-4';

  // A scenario that cannot be played says so, rather than starting and stranding the learner.
  if (scenario.nodes.length === 0) {
    return (
      <div className={wrapper}>
        <div className="h5p-surface p-6 text-center text-sm text-[color:var(--h5p-ink-muted)]">This scenario has no steps yet.</div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {preview ? (
        <p
          className="rounded-xl border px-3 py-2 text-xs font-medium"
          style={{ borderColor: 'var(--h5p-accent-line)', background: 'var(--h5p-accent-soft)', color: 'var(--h5p-accent-deep)' }}
          role="note"
        >
          Preview. Play it as a student would. Nothing you do here is recorded.
        </p>
      ) : null}

      {state.phase === 'start' ? (
        <StartCard scenario={scenario} minutes={minutes} endingCount={endings.length} brokenCount={preview ? problems.length : 0} onStart={onStart} />
      ) : state.phase === 'end' ? (
        <EndCard
          scenario={scenario}
          state={state}
          endings={endings}
          headingRef={heading}
          onRestart={onRestart}
          onBack={() => go(back(scenario, state))}
        />
      ) : node ? (
        <StepCard
          scenario={scenario}
          node={node}
          state={state}
          attempt={attempt}
          headingRef={heading}
          onProceed={() => go(proceed(scenario, state))}
          onChoose={onChoose}
          onContinue={() => go(continueFromFeedback(scenario, state))}
          onBack={() => go(back(scenario, state))}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function StartCard({
  scenario,
  minutes,
  endingCount,
  brokenCount,
  onStart,
}: {
  scenario: BsScenario;
  minutes: number;
  endingCount: number;
  brokenCount: number;
  onStart: () => void;
}) {
  return (
    <section className="h5p-surface h5p-stage overflow-hidden" aria-labelledby="bs-start-title">
      <Picture src={scenario.startImage} alt={scenario.startImageAlt} />
      <div className="p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-muted)]">Branching scenario</p>
        <h2 id="bs-start-title" className="mt-1.5 text-2xl font-semibold leading-tight text-[color:var(--h5p-ink)]">
          {scenario.startTitle || scenario.title}
        </h2>

        <Html html={scenario.startSubtitle || scenario.description} className="mt-3" />

        {scenario.objectives.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-[color:var(--h5p-ink)]">In this scenario you will</h3>
            <ul className="mt-2 space-y-1.5">
              {scenario.objectives.map((objective) => (
                <li key={objective} className="flex gap-2 text-sm text-[color:var(--h5p-ink-muted)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--h5p-success)' }} aria-hidden="true" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-5 text-xs text-[color:var(--h5p-ink-muted)]">
          About {minutes} {minutes === 1 ? 'minute' : 'minutes'}. You make choices, see what each one leads to, and can find{' '}
          {endingCount === 1 ? 'the ending' : `${endingCount} different endings`}.
        </p>

        {brokenCount > 0 ? (
          <p className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--h5p-danger-line)', background: 'var(--h5p-danger-soft)', color: 'var(--h5p-ink)' }}>
            This draft has {brokenCount} {brokenCount === 1 ? 'problem' : 'problems'} that would stop it being published. You can still play it to see how it reads.
          </p>
        ) : null}

        <div className="mt-6">
          <PrimaryAction onClick={onStart} autoFocus icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
            Start
          </PrimaryAction>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// A screen, a decision, or a choice's consequence
// ---------------------------------------------------------------------------

function StepCard({
  scenario,
  node,
  state,
  attempt,
  headingRef,
  onProceed,
  onChoose,
  onContinue,
  onBack,
}: {
  scenario: BsScenario;
  node: BsNode;
  state: PlayState;
  attempt: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onProceed: () => void;
  onChoose: (index: number) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const showingFeedback = state.phase === 'feedback' && state.pending != null;
  const picked: BsChoice | undefined = showingFeedback ? node.choices[state.pending as number] : undefined;
  const canBack = canGoBack(scenario, state);
  const step = state.trail.length + 1;
  const shown = node.title.trim() !== '' && node.showTitle;

  return (
    <section
      key={`${node.key}:${showingFeedback ? 'feedback' : 'node'}`}
      className="h5p-surface h5p-stage p-6 sm:p-8"
      aria-label={`Step ${step}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-[color:var(--h5p-ink-muted)]">
        <span className="font-semibold uppercase tracking-wider">Step {step}</span>
        {canBack ? (
          <button
            type="button"
            onClick={onBack}
            className="h5p-focusable inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-[color:var(--h5p-ink-muted)] hover:bg-[color:var(--h5p-surface-sunken)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
        ) : null}
      </div>

      {showingFeedback && picked ? (
        <Consequence node={node} choice={picked} headingRef={headingRef} onContinue={onContinue} />
      ) : (
        <>
          {shown || node.type === 'branching_question' ? (
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold leading-snug text-[color:var(--h5p-ink)] outline-none">
              {shown ? node.title : 'Make a choice'}
            </h2>
          ) : (
            <h2 ref={headingRef} tabIndex={-1} className="sr-only">
              {`Step ${step}`}
            </h2>
          )}

          {node.mediaPath ? (
            <div className="mt-4">
              <Picture src={node.mediaPath} alt={node.mediaAlt} />
            </div>
          ) : null}

          <Html html={node.body} className="mt-4" />

          {node.type === 'text' ? (
            <div className="mt-6">
              <PrimaryAction onClick={onProceed} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                {node.proceedLabel || 'Continue'}
              </PrimaryAction>
            </div>
          ) : (
            <Choices node={node} randomize={scenario.randomizeChoices} attempt={attempt} onChoose={onChoose} />
          )}
        </>
      )}
    </section>
  );
}

function Choices({
  node,
  randomize,
  attempt,
  onChoose,
}: {
  node: BsNode;
  randomize: boolean;
  attempt: number;
  onChoose: (index: number) => void;
}) {
  const ordered = useMemo(() => orderedChoices(node, randomize, attempt), [node, randomize, attempt]);

  return (
    <div className="mt-5" role="group" aria-label="Your choices">
      <ul className="space-y-2.5">
        {ordered.map(({ choice, index }, position) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => onChoose(index)}
              className="h5p-option h5p-tappable h5p-focusable h5p-target"
            >
              <span className="h5p-option__marker" aria-hidden="true">
                {String.fromCharCode(65 + position)}
              </span>
              <span>{choice.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Consequence({
  node,
  choice,
  headingRef,
  onContinue,
}: {
  node: BsNode;
  choice: BsChoice;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onContinue: () => void;
}) {
  const tone: BsQuality | 'none' = choice.quality ?? 'none';
  const Icon = QUALITY_ICON[tone];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-muted)]">You chose</p>
      <div className="h5p-option bs-choice-picked mt-1.5" aria-label="Your choice">
        <span className="h5p-option__marker" aria-hidden="true">
          <Check className="h-3.5 w-3.5" />
        </span>
        <span>{choice.text}</span>
      </div>

      <div className="bs-feedback mt-4" data-quality={tone} role="status">
        <p className="bs-feedback__label flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {FEEDBACK_LABEL[tone]}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1.5 text-lg font-semibold leading-snug text-[color:var(--h5p-ink)] outline-none">
          {plainText(choice.feedbackTitle) || FEEDBACK_LABEL[tone]}
        </h2>
        <Html html={choice.feedbackText} className="mt-2" />
        {choice.feedbackImage ? (
          <div className="mt-3">
            <Picture src={choice.feedbackImage} alt={choice.feedbackImageAlt} />
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <PrimaryAction onClick={onContinue} autoFocus icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          {node.proceedLabel || 'Continue'}
        </PrimaryAction>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// An ending
// ---------------------------------------------------------------------------

function EndCard({
  scenario,
  state,
  endings,
  headingRef,
  onRestart,
  onBack,
}: {
  scenario: BsScenario;
  state: PlayState;
  endings: BsNode[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
  onBack: () => void;
}) {
  const ending = scenario.nodes.find((n) => n.key === state.endingKey);

  if (state.stuck || !ending) {
    return (
      <section className="h5p-surface h5p-stage p-6 text-center sm:p-8" role="alert">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[color:var(--h5p-ink)] outline-none">
          This path doesn’t lead anywhere yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--h5p-ink-muted)]">
          A link in this scenario is broken. Tell your teacher which choice you made, then try another path.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <PrimaryAction onClick={onRestart} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
            Start again
          </PrimaryAction>
        </div>
      </section>
    );
  }

  const outcome = outcomeOf(scenario, ending.key);
  const entries = recap(scenario, state);
  const counts = qualityCounts(entries);
  const marked = maxScore(scenario) > 0;
  const good = outcome.passed === true || (!marked && counts.misstep === 0);
  const found = state.found.length;

  return (
    <section className="space-y-4" aria-label="Ending">
      <div className="h5p-surface h5p-stage p-6 sm:p-8">
        <Picture src={ending.mediaPath} alt={ending.mediaAlt} />

        <div className={ending.mediaPath ? 'mt-5' : ''}>
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: good ? 'var(--h5p-success-soft)' : 'var(--h5p-accent-soft)',
              color: good ? 'var(--h5p-success)' : 'var(--h5p-accent)',
            }}
          >
            {good ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Flag className="h-6 w-6" aria-hidden="true" />}
          </span>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-muted)]">You reached an ending</p>
          <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-semibold leading-tight text-[color:var(--h5p-ink)] outline-none">
            {ending.title || 'The end'}
          </h2>

          <Html html={ending.body} className="mt-3" />

          {marked ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold tabular-nums" style={{ background: 'var(--h5p-reward-soft)', color: 'color-mix(in srgb, var(--h5p-reward) 55%, #000)' }}>
                Score {outcome.score} of {outcome.max}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                style={
                  outcome.passed
                    ? { background: 'var(--h5p-success-soft)', color: 'color-mix(in srgb, var(--h5p-success) 80%, #000)' }
                    : { background: 'var(--h5p-accent-soft)', color: 'var(--h5p-accent-deep)' }
                }
              >
                {outcome.passed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {outcome.passed ? 'Passed' : `Pass mark is ${scenario.passPercentage}%. Another path may take you further.`}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="h5p-surface p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-[color:var(--h5p-ink)]">Your path</h3>
          <ol className="mt-3 space-y-3">
            {entries.map((entry) => (
              <li key={`${entry.nodeKey}-${entry.choiceText}`} className="text-sm">
                <p className="text-[color:var(--h5p-ink-muted)]">{entry.title || entry.question}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[color:var(--h5p-ink)]">
                  <span>{entry.choiceText}</span>
                  {entry.quality ? (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--h5p-surface-sunken)', color: 'var(--h5p-ink-muted)' }}>
                      {BS_QUALITY_LABELS[entry.quality]}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="h5p-surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-semibold text-[color:var(--h5p-ink)]">
            Endings found: {found} of {endings.length}
          </p>
          <p className="mt-1 flex items-center gap-1.5" aria-hidden="true">
            {endings.map((e) => (
              <span key={e.key} className={`bs-dot${state.found.includes(e.key) ? ' is-found' : ''}`} />
            ))}
          </p>
          <p className="mt-1 text-xs text-[color:var(--h5p-ink-muted)]">
            {found < endings.length ? 'Try a different path to see what else could happen.' : 'You found every ending.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canGoBack(scenario, state) ? (
            <SecondaryAction onClick={onBack} icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Step back
            </SecondaryAction>
          ) : null}
          <PrimaryAction onClick={onRestart} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
            Try a different path
          </PrimaryAction>
        </div>
      </div>
    </section>
  );
}
