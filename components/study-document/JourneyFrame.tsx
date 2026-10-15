'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';

import { themeVars } from '@/lib/study-deck/theme';
import type { Journey } from '@/lib/study-document/journey';

/** Fades and lifts a screen in when it appears; off for a reader who asked for less motion. */
export const ENTER = 'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none';

export type StepState = 'done' | 'current' | 'todo';

export interface FrameStep {
  id: string;
  label: string;
  /** What the learner does here, as a tooltip-length phrase. */
  does: string;
  state: StepState;
  /** "3/5", shown small beside the label. */
  count?: string;
  disabled?: boolean;
}

/**
 * The shell shared by the three experiences: a coloured banner naming the experience, the workflow as a row of steps, and a
 * progress bar. It sets the colour family on its wrapper, so the study deck's interaction views and question cards inside
 * it take the experience's colours (they read `--sd-*`). It holds no state and no rules.
 */
export function JourneyFrame({
  journey,
  progress,
  progressLabel,
  steps,
  onStep,
  testId,
  children,
}: {
  journey: Journey;
  /** 0 to 100. */
  progress: number;
  progressLabel: string;
  steps: FrameStep[];
  onStep: (id: string) => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ ...themeVars(journey.theme), backgroundColor: journey.theme.softer } as CSSProperties} data-sd-theme={journey.theme.key} data-testid={testId}>
      <div className="border-b border-sd-line bg-sd-soft px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-xs font-bold uppercase tracking-wider text-sd-strong">{journey.name}</p>
            <p className="text-sm text-slate-800">{journey.tagline}</p>
          </div>
          <div className="w-full sm:w-64" role="group" aria-label="Your progress">
            <div className="flex items-baseline justify-between text-xs font-semibold text-sd-strong">
              <span>{progressLabel}</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-sd-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={progressLabel}>
              <div className="h-full rounded-full bg-sd-accent transition-all duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Steps">
          {steps.map((step, i) => (
            <li key={step.id} className="min-w-[7.5rem] flex-1 basis-0">
              <button
                type="button"
                disabled={step.disabled}
                aria-current={step.state === 'current' ? 'step' : undefined}
                title={step.does}
                onClick={() => onStep(step.id)}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                  step.state === 'current'
                    ? 'border-sd-accent bg-sd-accent text-white shadow-sm'
                    : step.state === 'done'
                      ? 'border-sd-line bg-white text-sd-strong hover:bg-sd-softer'
                      : 'border-sd-line bg-white/60 text-slate-800 hover:bg-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.state === 'current' ? 'bg-white text-sd-accent' : step.state === 'done' ? 'bg-sd-accent text-white' : 'bg-sd-soft text-sd-strong'}`}
                >
                  {step.state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                {step.count ? <span className={`hidden shrink-0 text-xs font-medium tabular-nums sm:inline ${step.state === 'current' ? 'text-white/90' : 'text-slate-700'}`}>{step.count}</span> : null}
                {step.state === 'done' ? <span className="sr-only"> (done)</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** The one button that moves to what comes next. */
export function NextButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-sd-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** A small tag: "Recommended for you", "Topic complete". Always words, never colour alone. */
export function Chip({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'plain' }) {
  const tones = {
    accent: 'bg-sd-soft text-sd-strong border-sd-line',
    good: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    warn: 'bg-amber-50 text-amber-900 border-amber-300',
    plain: 'bg-white text-slate-800 border-slate-300',
  } as const;

  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
