'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock, Info, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AnswerSection, EvidenceItem, KeyValueItem } from '@/lib/intelligence/types';

/**
 * The answer, drawn from the sections the backend composed rather than from prose.
 *
 * Every section here used to arrive as a string: a ranked list of students became
 * bullet points, a percentage became "- Assessment average: 61.3%", and the evidence
 * chain became a paragraph with a PHP class name in the middle of it. The content was
 * right and unreadable, which is a rendering problem wearing a data problem's clothes.
 *
 * Three rules this file follows, and they are the whole design:
 *
 *   1. **Say where a number came from.** Evidence rows are the assistant's claim on
 *      your trust; each carries whether it was verified and which table it was read
 *      from, and both are shown, not summarised away.
 *   2. **Encode state in form, not colour alone.** Severity is a chip with an icon and
 *      a word. A red dot on its own fails for anyone who cannot see red, and fails
 *      completely in print.
 *   3. **Only visualise what is worth visualising.** A percentage gets a bar because a
 *      bar makes 28% and 61% comparable at a glance. A single count does not get a
 *      chart, because a bar of one number is decoration pretending to be analysis.
 */

/* -------------------------------------------------------------------------- */
/* Status — reserved, and never colour alone                                   */
/* -------------------------------------------------------------------------- */

type Tone = 'critical' | 'serious' | 'warning' | 'good' | 'neutral';

const TONES: Record<Tone, { chip: string; bar: string; Icon: typeof Circle }> = {
  critical: { chip: 'border-red-200 bg-red-50 text-red-700', bar: 'bg-red-500', Icon: ShieldAlert },
  serious: { chip: 'border-orange-200 bg-orange-50 text-orange-700', bar: 'bg-orange-500', Icon: AlertTriangle },
  warning: { chip: 'border-amber-200 bg-amber-50 text-amber-800', bar: 'bg-amber-500', Icon: Clock },
  good: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', Icon: CheckCircle2 },
  neutral: { chip: 'border-slate-200 bg-slate-50 text-slate-600', bar: 'bg-slate-400', Icon: Circle },
};

/** Read a severity word out of whatever the backend called it. */
function toneOf(value: unknown): Tone {
  const word = String(value ?? '').toLowerCase();

  if (word.includes('critical')) return 'critical';
  if (word.includes('high') || word.includes('serious')) return 'serious';
  if (word.includes('moderate') || word.includes('medium') || word.includes('warning')) return 'warning';
  if (word.includes('low') || word.includes('ok') || word.includes('good')) return 'good';

  return 'neutral';
}

function StatusChip({ label }: { label: string }) {
  const tone = TONES[toneOf(label)];
  const { Icon } = tone;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        tone.chip
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* The one visualisation that earns its place                                  */
/* -------------------------------------------------------------------------- */

/**
 * A percentage, as a bar.
 *
 * Deliberately the only chart in this file. The data an answer carries is mostly
 * single magnitudes — "61.3%", "4 of 8 incomplete" — and the right form for a single
 * magnitude is a stat with a bar, not a chart with an axis. A bar chart of one value
 * has a category axis with one tick on it, which is a chart in costume.
 *
 * The number leads and the bar supports it, because the number is the fact and the bar
 * is the comparison; a reader who only reads the number has lost nothing.
 */
function Magnitude({ percent, tone }: { percent: number; tone: Tone }) {
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={`${width.toFixed(1)} percent`}
    >
      <div className={cn('h-full rounded-full', TONES[tone].bar)} style={{ width: `${width}%` }} />
    </div>
  );
}

/**
 * A percentage if this value is one, otherwise null — nothing is invented.
 *
 * The backend writes the unit into the value ("80 percent", "18.33 percentage_points"),
 * and the two are not the same thing: 80 percent is a magnitude that belongs on a
 * 0–100 bar, while 18.33 percentage_points is a *change* and would draw as a bar 18%
 * full, which says something false. So the delta unit is excluded rather than parsed.
 */
function percentOf(value: unknown): number | null {
  const text = String(value ?? '');

  if (/percentage_points|percentage points/i.test(text)) return null;

  const numeric = typeof value === 'number' ? value : Number(text.replace(/[^0-9.]/g, ''));

  if (!Number.isFinite(numeric)) return null;

  const looksLikePercent = /percent|%/i.test(text);

  return looksLikePercent && numeric >= 0 && numeric <= 100 ? numeric : null;
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What clicking a row should ask, decided by the module the answer came from.
 *
 * This was `Why is ${title} at risk?` for every row in every module, which put an
 * academic-risk question on admission enquiries — the same mistake the backend was
 * making with its follow-up chips, repeated here. A row belongs to a module and the
 * only sensible question is that module's.
 *
 * Returns null rather than a generic fallback: a button that asks the wrong question is
 * worse than no button, because it looks like the flow is broken rather than absent.
 */
export function rowAction(
  module: string | undefined,
  item: { title?: string; id?: number | string | null }
): string | null {
  const name = item.title?.trim();

  switch ((module ?? '').toLowerCase()) {
    case 'admissions':
      // The confirmation flow addresses an enquiry by id. Without one the row cannot
      // start it, and asking by name would resolve against nothing.
      return item.id != null ? `Confirm the admission for enquiry ${item.id}` : null;

    case 'student':
    case 'students':
      return name ? `Why is ${name} at risk?` : null;

    case 'fees':
      return name ? `Show the fee details for ${name}` : null;

    default:
      return null;
  }
}

function Card({
  title,
  kind,
  children,
}: {
  title?: string;
  kind: 'data' | 'reasoning' | 'action';
  children: React.ReactNode;
}) {
  // The three kinds are visually distinct on purpose: a reader should be able to tell
  // "this came out of your database" from "the assistant concluded this" without
  // reading a word, because those two things carry very different weight.
  const chrome = {
    data: 'border-slate-200 bg-white',
    reasoning: 'border-indigo-100 bg-indigo-50/40',
    action: 'border-amber-200 bg-amber-50/50',
  }[kind];

  const label = { data: 'From your records', reasoning: 'AI analysis', action: 'Needs a decision' }[kind];

  return (
    <section className={cn('rounded-xl border p-3', chrome)}>
      <header className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {title ? <h4 className="text-sm font-semibold text-slate-900">{title}</h4> : null}
      </header>
      {children}
    </section>
  );
}

function TextSection({ section }: { section: Extract<AnswerSection, { type: 'text' }> }) {
  if (!section.body?.trim()) return null;

  return (
    <Card title={section.title} kind="reasoning">
      <p className="whitespace-pre-wrap text-[13px] leading-6 text-slate-700">{section.body}</p>
    </Card>
  );
}

function KeyValues({ section }: { section: Extract<AnswerSection, { type: 'key_values' }> }) {
  const items = (section.items ?? []).filter((item: KeyValueItem) => item?.value != null);

  if (!items.length) return null;

  return (
    <Card title={section.title} kind="data">
      <dl className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => {
          const percent = percentOf(item.value);

          return (
            <div key={`${item.label}-${index}`} className="rounded-lg bg-slate-50/80 px-3 py-2">
              <dt className="text-[11px] font-medium text-slate-500">{item.label}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">
                {String(item.value)}
              </dd>
              {percent !== null ? <Magnitude percent={percent} tone="neutral" /> : null}
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

function Records({
  section,
  module,
  onAsk,
}: {
  section: Extract<AnswerSection, { type: 'records' }>;
  module?: string;
  onAsk?: (question: string) => void;
}) {
  const items = section.items ?? [];

  if (!items.length) return null;

  return (
    <Card title={section.title} kind="data">
      <ul className="divide-y divide-slate-100">
        {items.map((raw, index) => {
          const item = raw as {
            title?: string;
            badge?: string;
            lines?: string[];
            meta?: Record<string, string>;
            id?: number | string | null;
          };
          const question = rowAction(module, item);

          return (
            <li key={`${item.title}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-900">
                {item.title}
                {item.lines?.length ? (
                  <span className="mt-0.5 block text-[12px] font-normal text-slate-500">
                    {item.lines.join(' · ')}
                  </span>
                ) : null}
                {item.meta && Object.keys(item.meta).length ? (
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                    {Object.entries(item.meta)
                      .map(([key, value]) => `${key} ${value}`)
                      .join(' · ')}
                  </span>
                ) : null}
              </span>

              {item.badge ? <StatusChip label={item.badge} /> : null}

              {/*
                A row you can act on. The question is typed for you rather than executed
                for you — it goes down the same audited path as anything you type, and
                you see it in the thread.
              */}
              {onAsk && question ? (
                <button
                  type="button"
                  onClick={() => onAsk(question)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-[#0D6EFD]/30 hover:text-[#0D6EFD]"
                >
                  View
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Evidence({ section }: { section: Extract<AnswerSection, { type: 'evidence' }> }) {
  const items = section.items ?? [];

  if (!items.length) return null;

  return (
    <Card title={section.title} kind="data">
      <ul className="space-y-2">
        {items.map((row: EvidenceItem, index) => {
          const percent = percentOf(row.value);

          return (
            <li key={index} className="rounded-lg bg-slate-50/80 px-3 py-2">
              <div className="flex items-start gap-2">
                {/*
                  Verified means a row was read back from its source table, not that the
                  assistant is confident. It is the difference between a citation and an
                  assertion, so it gets an icon and a word rather than a tick alone.
                */}
                {row.verified ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Verified" />
                ) : (
                  <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-label="Unverified" />
                )}
                <p className="min-w-0 flex-1 text-[13px] leading-5 text-slate-700">{row.summary}</p>
                {row.value != null ? (
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">
                    {String(row.value)}
                  </span>
                ) : null}
              </div>

              {percent !== null ? <Magnitude percent={percent} tone="neutral" /> : null}

              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {row.source}
                {row.is_generated ? ' · generated' : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Steps({ section }: { section: Extract<AnswerSection, { type: 'steps' }> }) {
  const items = section.items ?? [];

  if (!items.length) return null;

  return (
    <Card title={section.title} kind="action">
      <ol className="space-y-1.5">
        {items.map((raw, index) => {
          const step = raw as { label?: string; step_key?: string; status?: string };
          const done = /complete|success|done/i.test(step.status ?? '');
          const waiting = /await|pending|waiting/i.test(step.status ?? '');

          return (
            <li key={index} className="flex items-center gap-2 text-[13px]">
              {done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : waiting ? (
                <Clock className="size-4 shrink-0 text-amber-500" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-slate-300" aria-hidden />
              )}
              <span className={cn('flex-1', done ? 'text-slate-700' : 'text-slate-500')}>
                {step.label ?? step.step_key}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {step.status ?? 'pending'}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Comparison({ section }: { section: Extract<AnswerSection, { type: 'comparison' }> }) {
  const items = section.items ?? [];

  if (!items.length) return null;

  return (
    <Card title={section.title} kind="data">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((row, index) => (
          <dl key={index} className="rounded-lg bg-slate-50/80 px-3 py-2">
            {Object.entries(row as Record<string, unknown>).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-slate-500">{key}</dt>
                <dd className="text-[13px] font-semibold tabular-nums text-slate-900">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </Card>
  );
}

export function AnswerSections({
  sections,
  module,
  onAsk,
  className,
}: {
  sections: AnswerSection[];
  module?: string;
  onAsk?: (question: string) => void;
  className?: string;
}) {
  if (!sections?.length) return null;

  return (
    <div className={cn('space-y-2.5', className)}>
      {sections.map((section, index) => {
        switch (section.type) {
          case 'text':
            return <TextSection key={index} section={section} />;
          case 'key_values':
            return <KeyValues key={index} section={section} />;
          case 'records':
            return <Records key={index} section={section} module={module} onAsk={onAsk} />;
          case 'evidence':
            return <Evidence key={index} section={section} />;
          case 'steps':
            return <Steps key={index} section={section} />;
          case 'comparison':
            return <Comparison key={index} section={section} />;
          default:
            // A section type this build does not know is dropped rather than printed as
            // an object. The backend may grow one before the panel learns it.
            return null;
        }
      })}
    </div>
  );
}
