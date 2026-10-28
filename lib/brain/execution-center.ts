import type { BrainExecutionGroup, BrainOutcomeState } from './api';

/**
 * Wording and tones for the Execution Center. Pure, so the distinctions the screen depends on - a
 * COMPLETED execution is not a VERIFIED outcome, sample rows are not real ones - are testable.
 *
 * Nothing here computes a metric. Every count and state arrives from the backend, which classifies
 * them in one place (ExecutionCenterRules); this file only names them.
 */

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export const GROUP_LABEL: Record<BrainExecutionGroup, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  blocked: 'Blocked',
  rolled_back: 'Rolled back',
  other: 'Other status',
};

export const GROUP_TONE: Record<BrainExecutionGroup, Tone> = {
  queued: 'blue',
  running: 'blue',
  completed: 'gray', // completed is deliberately NOT green: it says "done", not "worked"
  failed: 'red',
  blocked: 'red',
  rolled_back: 'amber',
  other: 'gray',
};

export const GROUP_ORDER: BrainExecutionGroup[] = ['completed', 'queued', 'failed', 'blocked'];

export const OUTCOME_STATE: Record<BrainOutcomeState, { label: string; tone: Tone; hint: string }> = {
  verified: { label: 'Verified', tone: 'green', hint: 'Measured before and after, with evidence linked to the execution.' },
  measured: { label: 'Measured, no evidence', tone: 'amber', hint: 'A before and after figure was reported, but no evidence is linked.' },
  reported: { label: 'Reported only', tone: 'amber', hint: 'The reporter\'s word: no measurement and no linked evidence.' },
  no_outcome: { label: 'No outcome recorded', tone: 'red', hint: 'Marked completed, but no outcome was reported.' },
  failed: { label: 'Failed', tone: 'red', hint: 'The reported outcome was a failure.' },
  not_applicable: { label: 'Not finished', tone: 'gray', hint: 'The action has not been completed yet.' },
};

export const ATTENTION_LABEL: Record<string, string> = {
  failed: 'Failed',
  blocked: 'Blocked',
  stale_queue: 'Waiting too long',
  queued: 'Queued',
  running: 'In progress',
  outcome_missing: 'Outcome missing',
  outcome_failed: 'Outcome failed',
  evidence_missing: 'Evidence missing',
};

export const SEVERITY_TONE: Record<'high' | 'medium' | 'low', Tone> = { high: 'red', medium: 'amber', low: 'blue' };

export const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
  gray: 'bg-slate-100 text-slate-600',
};

export function ageText(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'date unknown';
  if (days === 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "n of m", never a percentage over an empty set. Used for verification so that an institute with
 * nothing finished shows "none finished yet" instead of 0%, and one record is never "100%".
 */
export function ofText(part: number, whole: number, noun: string): string {
  if (whole <= 0) return `No ${noun} yet`;
  return `${part} of ${whole}`;
}

/** The measured change in words, in the unit the reporter recorded. */
export function changeText(m: { before: number; after: number; change: number; unit: string | null }): string {
  const unit = m.unit ? ` ${m.unit}` : '';
  const dir = m.change > 0 ? 'down' : m.change < 0 ? 'up' : 'unchanged';
  const amount = Math.abs(m.change);

  return dir === 'unchanged'
    ? `${m.before}${unit} before, ${m.after}${unit} after: unchanged`
    : `${m.before}${unit} before, ${m.after}${unit} after: ${dir} ${amount}${unit}`;
}
