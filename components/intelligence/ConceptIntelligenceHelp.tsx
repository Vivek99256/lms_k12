'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { TabGuide } from './conceptIntelligenceGuide';

/**
 * The explanatory furniture for Concept Intelligence.
 *
 * The rule these follow: anything a teacher must understand to act on the panel
 * is printed on the page, and only the second layer of detail is hidden behind
 * a hint. A tooltip nobody hovers explains nothing, so jargon that carries the
 * meaning — DOK, Bloom's, coverage, necessity — is spelled out in full view and
 * the hint carries the background.
 */

/** A small "i" that reveals one sentence of background on hover or focus. */
export function InfoHint({ text, label }: { text: string; label?: string }) {
  if (!text) return null;

  return (
    <Tooltip content={<span className="block max-w-[240px] leading-5">{text}</span>} focusable>
      <span className="inline-flex items-center text-slate-400 transition-colors hover:text-slate-600">
        <Info size={13} aria-hidden="true" />
        {/* Labels are written for display and often already end in a colon, so
            trim it rather than reading out "Built from these abilities:: …". */}
        <span className="sr-only">
          {label ? `About ${label.replace(/\s*:\s*$/, '')}: ${text}` : text}
        </span>
      </span>
    </Tooltip>
  );
}

/** An all-caps section label with an optional hint beside it. */
export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
      <span>{children}</span>
      {hint ? <InfoHint text={hint} label={typeof children === 'string' ? children : undefined} /> : null}
    </div>
  );
}

/**
 * The strip at the top of every tab saying what the tab is for.
 *
 * `label` is the institute's own name for the tab, so a renamed tab still gets
 * the right explanation underneath it.
 */
export function TabIntro({ label, guide }: { label: string; guide?: TabGuide }) {
  if (!guide) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex items-start gap-2">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm leading-6 text-slate-700">
            <span className="font-semibold text-slate-900">{label}:</span> {guide.what}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">{guide.use}</p>
          {guide.example ? (
            <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
              <span className="font-semibold text-slate-600">For example: </span>
              <span className="italic">{guide.example}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const TONE_STYLES = {
  neutral: 'border-slate-200 bg-white',
  brand: 'border-indigo-100 bg-indigo-50/50',
  warn: 'border-amber-100 bg-amber-50/50',
  good: 'border-emerald-100 bg-emerald-50/50',
  alert: 'border-red-100 bg-red-50/50',
} as const;

export type FactTone = keyof typeof TONE_STYLES;

/**
 * One labelled reading on the Overview: the field name, its value, and what the
 * value means — all visible, because this is the first screen a new user sees.
 */
export function FactTile({
  label,
  value,
  hint,
  meaning,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  meaning?: string;
  tone?: FactTone;
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold leading-6 text-slate-900">{value}</div>
      {meaning ? <p className="mt-1 text-[13px] leading-5 text-slate-600">{meaning}</p> : null}
    </div>
  );
}

/**
 * A chip that always names the field it is reporting, so "Medium" can never be
 * read without knowing that it is the difficulty.
 */
export function MetaChip({
  label,
  value,
  hint,
  className = 'bg-slate-100 text-slate-600',
}: {
  label?: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  // No info glyph here: these chips appear a dozen to a card, and a tiny "i" on
  // each one turns into noise. A help cursor plus the dotted rule is enough of
  // an affordance, and the sentence is repeated for screen readers.
  const chip = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className} ${
        hint ? 'cursor-help decoration-current/40 underline-offset-2 [text-decoration-line:underline] [text-decoration-style:dotted]' : ''
      }`}
    >
      {label ? <span className="font-semibold opacity-80">{label}:</span> : null}
      {value}
      {hint ? <span className="sr-only">. {hint}</span> : null}
    </span>
  );

  if (!hint) return chip;

  return (
    <Tooltip content={<span className="block max-w-[240px] leading-5">{hint}</span>} focusable>
      {chip}
    </Tooltip>
  );
}

/** Shown when a tab has nothing in it, saying why rather than just "no data". */
export function NothingHere({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
      <p className="text-sm font-medium text-slate-600">Nothing recorded here yet</p>
      <p className="max-w-[380px] text-[13px] leading-5 text-slate-500">
        The analysis for this concept did not produce any {what}. Re-running the extraction for this chapter may fill it in.
      </p>
    </div>
  );
}
