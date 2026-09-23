'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Award, Check, Flame, Gauge, RotateCcw, Sparkles, Target, Timer, Trophy, X, Zap } from 'lucide-react';

/**
 * The shared game layer for every H5P player.
 *
 * WHAT THIS IS FOR
 *
 * Every player in this module had already converged on the same three screens
 * -- a start card, a question card, a result card -- and each had its own copy
 * of them. The copies drifted: four different result layouts, three different
 * progress bars, two different ways of saying "you passed". A learner moving
 * between two activities in the same chapter met two different products.
 *
 * So the screens live here once and each player passes its own words and its
 * own facts. What a player must NOT pass is a colour or a duration: those come
 * from `h5p.css`, which is the whole reason a theme change is one file.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Scoring. Every function in this file takes a number that `lib/h5p/*` already
 * worked out. Nothing here decides whether an answer was right, what an
 * attempt was worth, or whether it passed -- those are tested, and a display
 * component re-deriving them would be a second, untested answer to the same
 * question.
 *
 * REWARD IS TIED TO EFFORT, NOT TO NOISE. The celebration fires on a finished
 * attempt and on a streak, not on every tap. An interface that congratulates a
 * learner for existing teaches them the congratulation means nothing, and the
 * end of a real attempt then lands flat.
 */

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readMotionPreference = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * Whether this learner asked for less motion.
 *
 * `useSyncExternalStore` rather than state-plus-effect, because that is what
 * this is: a value owned by the browser that React has to read and subscribe
 * to. The effect version has to write state on mount, which is a cascading
 * render and which the project's lint rules reject on principle.
 *
 * The server snapshot is `false` — there is no media query to read there — so
 * the first paint may animate for a reduced-motion user for one frame. React
 * corrects it before anything that matters (the confetti, the count-up), all
 * of which is triggered by an interaction, and the CSS in `h5p.css` enforces
 * the preference independently of this hook regardless.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToMotionPreference, readMotionPreference, () => false);
}

/**
 * Count from the previous value to `value` over `duration`.
 *
 * Driven by rAF rather than by a transition because the thing being animated
 * is the TEXT, not a style. Under reduced motion it returns the target
 * immediately, which is why the hook is used even where the animation is the
 * point -- one code path, two behaviours.
 */
export function useCountUp(value: number, duration = 700): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Nothing to animate. The ref still has to follow the value so a later
    // run starts from the right place; the returned number comes from the
    // expression at the bottom, so no state is written here.
    if (reduced || duration <= 0) {
      from.current = value;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;

    if (delta === 0) return;

    const step = (at: number) => {
      const t = Math.min(1, (at - start) / duration);
      // Ease-out cubic: fast enough to feel responsive, slow enough at the
      // end that the final number registers as having landed.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + delta * eased));

      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        from.current = value;
        frame.current = null;
      }
    };

    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Whatever was on screen is where the next run starts, so an
      // interrupted count does not jump backwards before going forwards.
      from.current = value;
    };
  }, [value, duration, reduced]);

  return reduced || duration <= 0 ? value : shown;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * The one progress bar for the whole module.
 *
 * `label` is required and is not decoration: a progress bar with no accessible
 * name is announced as a number with no subject, which tells a screen-reader
 * user nothing at all.
 */
export function ProgressRail({
  value,
  max,
  label,
  className = '',
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const complete = value >= max && max > 0;

  return (
    <div
      className={`h5p-rail ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={`h5p-rail__fill${complete ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type PipOutcome = 'pending' | 'correct' | 'wrong';

/**
 * A pip per question, for a run short enough that seeing the whole shape of it
 * helps. Above `maxPips` it falls back to the rail, because forty dots is not
 * a progress indicator, it is a texture.
 */
export function StepPips({
  outcomes,
  current,
  label,
  maxPips = 20,
}: {
  outcomes: PipOutcome[];
  current: number;
  label: string;
  maxPips?: number;
}) {
  if (outcomes.length > maxPips) {
    return <ProgressRail value={current} max={outcomes.length} label={label} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={label}>
      {outcomes.map((outcome, index) => (
        <span
          key={index}
          className={`h5p-pip${
            index === current ? ' is-current' : outcome === 'correct' ? ' is-done' : outcome === 'wrong' ? ' is-missed' : ''
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score, streak, stats
// ---------------------------------------------------------------------------

/** A number that counts up to its target, with an optional +N floating off it. */
export function ScoreCounter({
  value,
  max,
  gain,
  size = 'lg',
}: {
  value: number;
  max?: number;
  /** The points just won. Rendered once and cleared by the caller. */
  gain?: number | null;
  size?: 'md' | 'lg';
}) {
  const shown = useCountUp(value);

  return (
    <span className="relative inline-flex items-baseline justify-center">
      {gain ? (
        <span key={`${value}-${gain}`} className="h5p-gain text-sm" aria-hidden="true">
          +{gain}
        </span>
      ) : null}
      <span
        className={`font-semibold tabular-nums text-[color:var(--h5p-ink)] ${
          size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-2xl'
        }`}
      >
        {shown}
      </span>
      {max !== undefined ? (
        <span className={`tabular-nums text-[color:var(--h5p-ink-faint)] ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>
          &nbsp;/ {max}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The streak. Shown from two in a row, because "streak: 1" is just "correct"
 * wearing a badge, and a counter that is always on stops being a signal.
 */
export function StreakBadge({ streak, best }: { streak: number; best?: number }) {
  if (streak < 2) return null;

  return (
    <span
      className="h5p-enter-scale inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: 'var(--h5p-reward-soft)', color: 'color-mix(in srgb, var(--h5p-reward) 80%, #000)' }}
    >
      <Flame className="h5p-streak__flame h-3.5 w-3.5" aria-hidden="true" />
      <span className="tabular-nums">{streak} in a row</span>
      {best !== undefined && best > streak ? (
        <span className="tabular-nums opacity-70">· best {best}</span>
      ) : null}
    </span>
  );
}

export interface StatItem {
  icon?: 'target' | 'timer' | 'gauge' | 'zap' | 'trophy';
  label: string;
  value: ReactNode;
}

const STAT_ICONS = { target: Target, timer: Timer, gauge: Gauge, zap: Zap, trophy: Trophy };

/** The row of small facts under a score, or across the top of a run. */
export function StatRow({ items }: { items: StatItem[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {items.map((item) => {
        const Icon = item.icon ? STAT_ICONS[item.icon] : null;
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            {Icon ? <Icon className="h-3.5 w-3.5 text-[color:var(--h5p-ink-faint)]" aria-hidden="true" /> : null}
            <dt className="text-xs text-[color:var(--h5p-ink-faint)]">{item.label}</dt>
            <dd className="text-xs font-semibold tabular-nums text-[color:var(--h5p-ink-muted)]">{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Celebration
// ---------------------------------------------------------------------------

/**
 * A one-shot confetti burst, positioned over whatever it is given as a parent
 * (which must be `relative`).
 *
 * DETERMINISTIC, NOT RANDOM. The angles come from the piece index, so the
 * server and the client agree and there is no hydration warning -- and the
 * burst looks the same every time, which reads as designed rather than as a
 * glitch. It is `aria-hidden`: the result it celebrates is already announced
 * in text, and a screen reader has no use for twenty coloured rectangles.
 *
 * Under reduced motion nothing is rendered at all. The CSS also hides it, and
 * both belong: the CSS covers a user whose preference changed mid-attempt, the
 * early return keeps forty elements out of the DOM for everyone else.
 */
export function Celebration({ show, pieces = 18 }: { show: boolean; pieces?: number }) {
  const reduced = useReducedMotion();

  const confetti = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => {
        const angle = (index / pieces) * Math.PI * 2;
        const distance = 70 + ((index * 37) % 60);
        // Three tokens, cycled -- reward, accent, success. Never a literal.
        const colour = ['var(--h5p-reward)', 'var(--h5p-accent)', 'var(--h5p-success)'][index % 3];

        return {
          key: index,
          style: {
            '--h5p-confetti-x': `${Math.cos(angle) * distance}px`,
            '--h5p-confetti-y': `${Math.sin(angle) * distance + 40}px`,
            '--h5p-confetti-r': `${(index % 2 === 0 ? 1 : -1) * (120 + index * 11)}deg`,
            '--h5p-confetti-delay': `${(index % 6) * 40}ms`,
            '--h5p-confetti-color': colour,
          } as React.CSSProperties,
        };
      }),
    [pieces]
  );

  if (!show || reduced) return null;

  return (
    <div className="h5p-burst" aria-hidden="true">
      {confetti.map((piece) => (
        <span key={piece.key} className="h5p-burst__piece" style={piece.style} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  label: string;
  detail: string;
}

/**
 * What this attempt earned.
 *
 * DERIVED FROM THE ATTEMPT, NOT STORED. These are a way of telling a learner
 * what they just did well, and they are recomputed from numbers the scorer
 * already produced. Nothing here is persisted, awarded, or comparable between
 * learners -- that would be a gradebook feature and would need the server.
 *
 * The bar is deliberately not low. A badge for finishing would appear on every
 * attempt and would say nothing.
 */
export function deriveAchievements(input: {
  percentage: number;
  passed: boolean;
  bestStreak?: number;
  questionCount?: number;
  firstTry?: boolean;
  improvedOnLast?: boolean;
}): Achievement[] {
  const earned: Achievement[] = [];

  if (input.percentage >= 100) {
    earned.push({ id: 'flawless', label: 'Flawless', detail: 'Every answer right.' });
  } else if (input.percentage >= 90) {
    earned.push({ id: 'sharp', label: 'Sharp', detail: '90% or better.' });
  }

  if ((input.bestStreak ?? 0) >= 5) {
    earned.push({
      id: 'streak',
      label: 'On a roll',
      detail: `${input.bestStreak} correct in a row.`,
    });
  }

  if (input.improvedOnLast) {
    earned.push({ id: 'improved', label: 'Better than last time', detail: 'Your score went up.' });
  }

  if (input.passed && input.firstTry && input.percentage < 90) {
    earned.push({ id: 'first-try', label: 'Passed first time', detail: 'No retries needed.' });
  }

  return earned;
}

export function AchievementList({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;

  return (
    <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {achievements.map((achievement, index) => (
        <li
          key={achievement.id}
          className="h5p-enter-scale h5p-stagger inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={
            {
              background: 'var(--h5p-reward-soft)',
              '--h5p-stagger': `${Math.min(index, 4) * 90}ms`,
            } as React.CSSProperties
          }
        >
          <Award className="h-4 w-4" style={{ color: 'var(--h5p-reward)' }} aria-hidden="true" />
          <span className="text-xs font-semibold" style={{ color: 'color-mix(in srgb, var(--h5p-reward) 82%, #000)' }}>
            {achievement.label}
          </span>
          <span className="text-xs text-[color:var(--h5p-ink-muted)]">{achievement.detail}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * "Correct" / "Not quite", with an icon as well as a colour.
 *
 * The icon is not decoration and must not be removed: colour alone is not an
 * accessible signal, and roughly one boy in twelve in any class cannot tell
 * this green from this red.
 */
export function Verdict({ correct, message }: { correct: boolean; message?: string | null }) {
  return (
    <div className="h5p-enter" aria-live="polite">
      <p
        className="flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: correct ? 'var(--h5p-success)' : 'var(--h5p-danger)' }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: correct ? 'var(--h5p-success)' : 'var(--h5p-danger)' }}
        >
          {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
        {correct ? 'Correct' : 'Not quite'}
      </p>
      {message ? <p className="mt-1.5 text-sm text-[color:var(--h5p-ink-muted)]">{message}</p> : null}
    </div>
  );
}

/**
 * The line of encouragement under a mid-attempt verdict.
 *
 * Rotated by index so a learner answering ten questions is not told "Nice
 * work!" ten times, which is how encouragement turns into wallpaper. Blame-free
 * on the wrong side: it names the next action, never the learner.
 */
const PRAISE = ['Nice work.', 'That is the one.', 'Well spotted.', 'Exactly right.', 'Good thinking.'];
const ENCOURAGE = [
  'Worth another look.',
  'Close — keep going.',
  'That one is tricky.',
  'Try the next one.',
  'You will get this.',
];

export function encouragement(correct: boolean, index: number): string {
  const list = correct ? PRAISE : ENCOURAGE;
  return list[Math.abs(index) % list.length];
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/**
 * The start screen. One per activity type, all identical apart from the words.
 *
 * `facts` is where a type says what a learner is walking into -- how many
 * questions, how long, what the pass mark is. Knowing that before starting is
 * the single cheapest way to lower the anxiety a timed activity creates.
 */
export function StartScreen({
  title,
  description,
  facts,
  actionLabel = 'Start',
  onStart,
  footer,
}: {
  title: string;
  description?: string | null;
  facts?: StatItem[];
  actionLabel?: string;
  onStart: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="h5p-surface h5p-stage overflow-hidden p-8 text-center sm:p-10">
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--h5p-accent-soft)', color: 'var(--h5p-accent)' }}
      >
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </span>

      <h2 className="mt-4 text-xl font-semibold text-[color:var(--h5p-ink)]">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--h5p-ink-muted)]">{description}</p>
      ) : null}

      {facts && facts.length > 0 ? (
        <div className="mt-5">
          <StatRow items={facts} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onStart}
        className="h5p-tappable h5p-focusable h5p-target mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{ background: 'var(--h5p-accent)', boxShadow: 'var(--h5p-shadow-raised)' }}
      >
        {actionLabel}
      </button>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

/**
 * The result screen, shared by every scored type.
 *
 * THE SCORE IS THE HEADLINE AND THE VERDICT IS SECOND. A learner who failed
 * needs to see what they scored before they are told they failed, or the
 * number becomes something to brace for rather than something to read.
 *
 * `passed` drives the chip and the celebration, and the celebration is the
 * only place in the module where a full-attempt reward fires.
 */
export function ResultScreen({
  score,
  maxScore,
  percentage,
  passed,
  passLabel,
  headline = 'Finished',
  summary,
  message,
  facts,
  achievements = [],
  actions,
  children,
}: {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  /** e.g. "Pass mark is 60%" — shown when the attempt did not pass. */
  passLabel?: string;
  headline?: string;
  summary?: ReactNode;
  message?: string | null;
  facts?: StatItem[];
  achievements?: Achievement[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const celebrate = passed;

  return (
    <div className="space-y-4">
      <div className="h5p-surface h5p-stage relative overflow-visible p-6 text-center sm:p-8">
        <Celebration show={celebrate} />

        <div className="relative">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: passed ? 'var(--h5p-success-soft)' : 'var(--h5p-accent-soft)',
              color: passed ? 'var(--h5p-success)' : 'var(--h5p-accent)',
            }}
          >
            {passed ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Target className="h-6 w-6" aria-hidden="true" />}
          </span>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-faint)]">
            {headline}
          </p>

          {/* The whole result in one announcement, rather than four separate
              ones as each number lands. */}
          <p className="sr-only" aria-live="polite">
            {`${score} out of ${maxScore}, ${Math.round(percentage)} percent. ${
              passed ? 'Passed.' : passLabel ?? 'Not passed.'
            }`}
          </p>

          <p className="mt-2" aria-hidden="true">
            <ScoreCounter value={score} max={maxScore} />
          </p>

          {summary ? <p className="mt-1 text-sm text-[color:var(--h5p-ink-muted)]">{summary}</p> : null}

          <span
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={
              passed
                ? { background: 'var(--h5p-success-soft)', color: 'color-mix(in srgb, var(--h5p-success) 80%, #000)' }
                : { background: 'var(--h5p-reward-soft)', color: 'color-mix(in srgb, var(--h5p-warning) 84%, #000)' }
            }
          >
            {passed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {passed ? 'Passed' : (passLabel ?? 'Not passed yet')}
          </span>

          {facts && facts.length > 0 ? (
            <div className="mt-4">
              <StatRow items={facts} />
            </div>
          ) : null}

          <AchievementList achievements={achievements} />

          {message ? (
            <p className="mx-auto mt-4 max-w-md text-sm text-[color:var(--h5p-ink-muted)]">{message}</p>
          ) : null}

          {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/**
 * The two buttons every player needs. Here rather than in `shared.tsx` because
 * they carry the press-and-spring behaviour, which is part of the game layer.
 */
export function PrimaryAction({
  onClick,
  children,
  disabled,
  icon,
  type = 'button',
  className = '',
  autoFocus,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit';
  className?: string;
  /**
   * Only for a button that REPLACES the control the learner just used — the
   * "Next" that appears where "Check" was. Moving focus anywhere else steals
   * it from someone reading with a keyboard.
   */
  autoFocus?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`h5p-tappable h5p-focusable h5p-target inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-40 ${className}`}
      style={{ background: 'var(--h5p-accent)', boxShadow: 'var(--h5p-shadow-raised)' }}
    >
      {icon}
      {children}
    </button>
  );
}

export function SecondaryAction({
  onClick,
  children,
  disabled,
  icon,
  ariaExpanded,
  className = '',
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  ariaExpanded?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={ariaExpanded}
      className={`h5p-tappable h5p-focusable h5p-target inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40 ${className}`}
      style={{
        borderColor: 'var(--h5p-line)',
        background: 'var(--h5p-surface)',
        color: 'var(--h5p-ink-muted)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** The retry button, which every scored type offers in the same words. */
export function RetryAction({ onClick, label = 'Try again' }: { onClick: () => void; label?: string }) {
  return (
    <PrimaryAction onClick={onClick} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
      {label}
    </PrimaryAction>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * A skeleton shaped like the activity that is coming, not a spinner.
 *
 * A spinner says "wait"; a skeleton says "this is what you are waiting for",
 * and on a slow school connection that difference is the one that stops a
 * learner from reloading and losing their place.
 */
export function PlayerSkeleton({ lines = 3, label = 'Loading activity' }: { lines?: number; label?: string }) {
  return (
    <div className="h5p-surface p-6 sm:p-8" role="status" aria-label={label}>
      <div className="h5p-skeleton h-3 w-24" />
      <div className="h5p-skeleton mt-4 h-6 w-3/4" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="h5p-skeleton h-12 w-full" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading activities">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="h5p-surface p-5">
          <div className="h5p-skeleton h-24 w-full" />
          <div className="h5p-skeleton mt-4 h-4 w-2/3" />
          <div className="h5p-skeleton mt-2 h-3 w-full" />
          <div className="h5p-skeleton mt-4 h-2 w-full" />
        </div>
      ))}
    </div>
  );
}
