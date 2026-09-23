'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * The shared frame for every PAL journey screen.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * PAL was the odd one out in this app twice over. Every journey screen was a
 * `max-w-3xl` centred column - about 768px, so roughly 40% of a 1920px display
 * with dead margin either side - while the other 34 ERP screens run full width
 * off `ErpPageHeader` + `erpCardClass`. And across `app/pal/**` there were TEN
 * different width caps in use (md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, full,
 * none). That is not a system, it is an accident.
 *
 * ---------------------------------------------------------------------------
 * WHY TWO COLUMNS RATHER THAN SIMPLY GOING FULL WIDTH
 * ---------------------------------------------------------------------------
 * The narrow column was not purely a mistake: stretching a question, a lesson
 * or an explanation across 1900px is bad typography, and the eye loses the line
 * on the way back. So the fix is not "remove the cap" - it is to give the width
 * something worth doing.
 *
 * The main column therefore keeps a readable measure and the recovered space
 * becomes a persistent rail carrying what a learner otherwise has to remember
 * or scroll for: which stage they are on, what is left, the timer, the actions.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT FOLLOWS
 * ---------------------------------------------------------------------------
 * The design system documented in CLAUDE.md, and the house page shape already
 * used by the rest of the ERP:
 *
 *   - `<main className="mx-auto space-y-5 p-4 sm:p-6">`, matching ErpPageHeader's
 *     callers, so PAL sits in the app frame the same way every other module does
 *   - indigo brand, slate neutrals, flat fills - no gradients, glass or ornament
 *   - hairline borders, 8px-class radii, the subtle raised shadow
 *   - sentence case throughout; meaning never carried by colour alone
 *   - 4px spacing rhythm
 */

export interface PalWorkspaceProps {
  /** Page title. Sentence case - "Take the diagnostic", not "Take The Diagnostic". */
  title: string;
  /** One line saying what this screen is for. */
  description?: ReactNode;
  /** Small label above the title - the chapter or subject this sits under. */
  eyebrow?: ReactNode;
  /** Where "Back" goes. Omitted renders no back link. */
  backHref?: string;
  backLabel?: string;
  /** Primary/secondary controls, aligned right of the title on desktop. */
  actions?: ReactNode;
  /**
   * The side rail. Omitted, the main column simply runs wider - so a screen
   * with nothing useful to put beside the content does not get a hollow box.
   */
  rail?: ReactNode;
  /**
   * Caps the main column's text measure. On by default because most of these
   * screens are reading surfaces; turn it off for tables and dense grids, which
   * genuinely want the room.
   */
  constrainMeasure?: boolean;
  children: ReactNode;
  className?: string;
}

export function PalWorkspace({
  title,
  description,
  eyebrow,
  backHref,
  backLabel = 'Back',
  actions,
  rail,
  constrainMeasure = true,
  children,
  className,
}: PalWorkspaceProps) {
  return (
    <main className={cn('mx-auto w-full space-y-5 p-4 sm:p-6', className)}>
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 h-8 text-slate-600 hover:text-slate-900'
          )}
        >
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          {backLabel}
        </Link>
      )}

      {/* Matches ErpPageHeader's shape (title / description left, actions right)
          without importing it: PAL needs the eyebrow and a ReactNode
          description, and forking the house header would be worse than
          mirroring its layout. */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
          )}
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </header>

      {rail ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6">
          {/* min-w-0 is load-bearing: without it a wide child (a table, a long
              unbroken token) forces the grid track past its share and pushes the
              rail off screen. */}
          <div className={cn('min-w-0 space-y-5', constrainMeasure && '[&_p]:max-w-[68ch]')}>
            {children}
          </div>

          {/* Source order puts the rail after the content, so on a phone the
              learner gets the question first and the rail below - and on desktop
              the grid places it right regardless. */}
          <aside
            aria-label="Journey and context"
            className="space-y-4 lg:sticky lg:top-6 lg:self-start"
          >
            {rail}
          </aside>
        </div>
      ) : (
        <div className={cn('min-w-0 space-y-5', constrainMeasure && '[&_p]:max-w-[68ch]')}>
          {children}
        </div>
      )}
    </main>
  );
}

/**
 * One titled block in the side rail.
 *
 * Deliberately lighter than a Card: the rail is supporting context, and eight
 * fully shadowed cards stacked down it compete with the content they exist to
 * support.
 */
export function PalRailSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white p-3.5', className)}>
      {title && (
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

/**
 * A label/value pair for the rail - "Time left 12:04", "Questions 15".
 *
 * Numbers are tabular so a ticking clock or a climbing count does not jitter
 * the layout, which the design system calls for on figures.
 */
export function PalRailStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'warning' | 'positive';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          tone === 'default' && 'text-slate-900',
          tone === 'warning' && 'text-amber-700',
          tone === 'positive' && 'text-emerald-700'
        )}
      >
        {value}
      </span>
    </div>
  );
}
