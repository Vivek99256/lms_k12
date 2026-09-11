'use client'

/**
 * The one "coming soon" look, used everywhere.
 *
 * WHY THIS IS ONE FILE
 *
 * Before this component the product had five different ways of saying the same
 * thing — a Fees placeholder card, a talent-management banner, PAL's "not built
 * yet" pills, a full-page Quiz hero, and an unused backend-gap card. Four looks
 * for one idea reads as unfinished, which is the exact impression the
 * placeholders exist to prevent. So there is one module with a fixed set of
 * shapes, and nothing else may invent another.
 *
 *   <ComingSoonPanel />     the body of a screen or tab that has no backend yet
 *   <ComingSoonBadge />     an inline lock pill on a nav item, card or tab
 *   <ComingSoonTile />      a tile sized for a dashboard grid
 *   <ComingSoonToggle />    a settings row whose switch is visible but locked
 *   <RoadmapRollupStrip />  counters standing in for many empty cards
 *
 * WORDING COMES FROM THE REGISTRY
 *
 * Pass `roadmapId` and the title, blurb, phase and tooltip are read from
 * `lib/roadmap`. Passing the copy directly is supported for one-offs, but a
 * roadmap row is preferred: rows appear on the consolidated roadmap screen,
 * hard-coded strings do not, and a roadmap that disagrees with the screens is
 * worse than no roadmap.
 *
 * STYLING
 *
 * Semantic tokens only — no hardcoded hex, no gradients (see CLAUDE.md). Note
 * that `--color-success` and `--color-warning` are not registered in the
 * Tailwind theme in app/globals.css, so the `success`/`warning` variants of
 * Badge and StatusBadge currently render unstyled. Nothing here depends on
 * them.
 */

import * as React from 'react'
import { Check, FlaskConical, Hammer, Lock } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import {
  getRoadmapItem,
  roadmapStatusLabel,
  roadmapTooltip,
  type RoadmapPhase,
  type RoadmapStatus,
} from '@/lib/roadmap'

/** Copy that every shape resolves before it renders. */
interface ResolvedCopy {
  title: string
  blurb: string
  /** Undefined when no roadmap row named one — see resolveCopy. */
  phase?: RoadmapPhase
  status: RoadmapStatus
  tooltip: string
}

interface CopySource {
  /** Preferred: an id from `lib/roadmap/registry.ts`. */
  roadmapId?: string
  title?: string
  blurb?: string
  phase?: RoadmapPhase
  status?: RoadmapStatus
}

/**
 * Registry row first, explicit props second, safe defaults last.
 *
 * Explicit props win over the registry so a screen can shorten a title to fit
 * without having to fork the roadmap row it came from.
 */
function resolveCopy(source: CopySource, fallbackTitle = 'Coming soon'): ResolvedCopy {
  const item = source.roadmapId ? getRoadmapItem(source.roadmapId) : undefined

  // Deliberately no fallback phase. Defaulting to one made every placeholder
  // without a roadmap row announce "Coming in Phase 2" — a delivery commitment
  // invented by this function rather than agreed by anyone, on 38 Fees screens
  // at once. A vaguer promise is fine; a specific unearned one is not.
  const phase = source.phase ?? item?.phase
  const status = source.status ?? item?.status ?? 'coming-soon'

  return {
    title: source.title ?? item?.title ?? fallbackTitle,
    blurb: source.blurb ?? item?.blurb ?? '',
    phase,
    status,
    tooltip: roadmapTooltip({ phase, status }),
  }
}

const STATUS_ICON: Record<RoadmapStatus, React.ComponentType<{ className?: string }>> = {
  'coming-soon': Lock,
  'in-progress': Hammer,
  pilot: FlaskConical,
  live: Check,
}

// Deliberately muted for everything that is not yet usable: a roadmap item
// should read as calm and intentional, never as a warning or an error.
const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      status: {
        'coming-soon': 'border-border bg-muted text-muted-foreground',
        'in-progress': 'border-primary/30 bg-primary/10 text-primary',
        pilot: 'border-primary/30 bg-primary/10 text-primary',
        live: 'border-border bg-background text-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        default: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { status: 'coming-soon', size: 'default' },
  },
)

/* ────────────────────────────────────────────────────────────────────────── */
/* Badge                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ComingSoonBadgeProps
  extends CopySource,
    Omit<VariantProps<typeof statusChipVariants>, 'status'> {
  /** Overrides the status word. Use sparingly — consistency is the point. */
  label?: string
  /** Set false where a tooltip cannot be reached, e.g. inside a link. */
  withTooltip?: boolean
  className?: string
}

/**
 * The inline pill. Sits next to the name of the thing that is not ready — a
 * framework card, a nav item, a catalog category.
 */
export function ComingSoonBadge({
  label,
  withTooltip = true,
  size,
  className,
  ...source
}: ComingSoonBadgeProps) {
  const copy = resolveCopy(source)
  const Icon = STATUS_ICON[copy.status]

  const chip = (
    <span className={cn(statusChipVariants({ status: copy.status, size }), className)}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {label ?? roadmapStatusLabel(copy.status)}
    </span>
  )

  if (!withTooltip) return chip

  // `focusable` because the badge itself is not an interactive element, so
  // without it the explanation is mouse-only.
  return (
    <Tooltip content={copy.tooltip} focusable>
      {chip}
    </Tooltip>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Panel                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ComingSoonPanelProps extends CopySource {
  /**
   * `summary` is the same thing as `blurb`, kept because the Fees placeholder
   * this replaces used that name across 34 call sites.
   */
  summary?: string
  /** What the screen will do, once built. Shown as a short list. */
  points?: string[]
  className?: string
  children?: React.ReactNode
}

/**
 * The body of a screen or tab that is agreed but not built.
 *
 * Shows the shape of the feature so a customer can see it is planned, and never
 * shows invented figures, records or working controls that could be mistaken
 * for live data.
 */
export function ComingSoonPanel({
  summary,
  points,
  className,
  children,
  ...source
}: ComingSoonPanelProps) {
  const copy = resolveCopy({ ...source, blurb: source.blurb ?? summary })
  const Icon = STATUS_ICON[copy.status]

  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card px-5 py-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <Icon className="size-4.5" />
        </span>

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-card-foreground">{copy.title}</h2>
          {copy.blurb && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{copy.blurb}</p>
          )}
        </div>
      </div>

      {points && points.length > 0 && (
        <ul className="mt-4 space-y-2 pl-12">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {children && <div className="mt-5 pl-12">{children}</div>}

      <div className="mt-5 pl-12">
        <Tooltip content={copy.tooltip} focusable>
          <span className={statusChipVariants({ status: copy.status })}>
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            {copy.status === 'coming-soon' && copy.phase && copy.phase !== 'Exploring'
              ? `Coming in ${copy.phase}`
              : roadmapStatusLabel(copy.status)}
          </span>
        </Tooltip>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Tile                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ComingSoonTileProps extends CopySource {
  /** Replaces the status icon, to match the tiles it sits beside. */
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}

/**
 * One cell of a dashboard grid.
 *
 * Sized and bordered to sit beside real stat tiles without pretending to be
 * one — dashed border and muted fill mark it as not-yet-real at a glance.
 *
 * THE TILE DOES NOT SET ITS OWN HEIGHT, DELIBERATELY
 *
 * It used to carry `h-full`, to match the height of the stat cards in its row.
 * That was both unnecessary and harmful. Unnecessary because a grid item already
 * stretches to its row (`align-self: stretch` is the default), so the tile fills
 * its cell without asking. Harmful because `height: 100%` means something else
 * entirely in a flex column with a definite height: on the G2G dashboard the
 * tile claimed the whole scroll container and, laying out `justify-between`,
 * strung its icon, text and chip down an otherwise empty box.
 *
 * Letting the container decide is what makes one tile safe in a grid cell, a
 * flex column and a plain block alike. Do not reintroduce a height here — set it
 * at the call site if some future layout genuinely needs one.
 */
export function ComingSoonTile({ icon, className, ...source }: ComingSoonTileProps) {
  const copy = resolveCopy(source)
  const Icon = icon ?? STATUS_ICON[copy.status]

  // The tooltip sits on the chip rather than round the whole tile: Tooltip
  // renders an `inline-block` wrapper, which would stop the tile from filling
  // its cell in the dashboard grid it has to sit in.
  return (
    <div
      className={cn(
        'flex w-full flex-col justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-left',
        className,
      )}
    >
      <span
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>

      <div>
        <p className="text-sm font-semibold text-card-foreground">{copy.title}</p>
        {copy.blurb && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.blurb}</p>
        )}
      </div>

      <Tooltip content={copy.tooltip} focusable>
        <span className={statusChipVariants({ status: copy.status, size: 'sm' })}>
          {copy.status === 'coming-soon' && copy.phase && copy.phase !== 'Exploring'
            ? `Coming in ${copy.phase}`
            : roadmapStatusLabel(copy.status)}
        </span>
      </Tooltip>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Locked toggle                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ComingSoonToggleProps extends CopySource {
  /** The setting's name. Falls back to the roadmap row's title. */
  label?: string
  /** What the setting will do once it works. */
  description?: string
  /** A value this setting will carry, e.g. a threshold. Shown greyed out. */
  hint?: string
  className?: string
}

/**
 * A settings row whose control is visible but locked.
 *
 * Showing the switch greyed out, rather than hiding the setting entirely, is
 * the point: it proves the capability is designed and coming, where a missing
 * row just reads as a feature that does not exist.
 *
 * The switch is `disabled`, which takes it out of the tab order, so the tooltip
 * explaining why sits on a focusable wrapper instead — otherwise a keyboard
 * user would meet a dead control with no explanation.
 */
export function ComingSoonToggle({
  label,
  description,
  hint,
  className,
  ...source
}: ComingSoonToggleProps) {
  const copy = resolveCopy(source)

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-card-foreground">{label ?? copy.title}</p>
        {(description ?? copy.blurb) && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description ?? copy.blurb}
          </p>
        )}
        {hint && (
          <p className="mt-2 text-xs text-muted-foreground/70">{hint}</p>
        )}
      </div>

      <Tooltip content={copy.tooltip} side="left" focusable>
        <span className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <Switch
            checked={false}
            disabled
            readOnly
            aria-label={`${label ?? copy.title} — ${copy.tooltip}`}
          />
        </span>
      </Tooltip>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Rollup strip                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RoadmapRollupEntry {
  key: string
  label: string
  /** Already-formatted counts, e.g. "4 active · 18 planned". */
  summary: string
  status: RoadmapStatus
  phase: RoadmapPhase
}

/**
 * A row of counters summarising a set of categories.
 *
 * This is the alternative to drawing an empty card for every planned item. A
 * hundred zero-content cards reads as broken; one line saying "4 active · 18
 * planned" says the same thing as a plan. Categories that are genuinely live
 * carry no roadmap badge at all, so nothing already built is talked down.
 */
export function RoadmapRollupStrip({
  entries,
  className,
}: {
  entries: RoadmapRollupEntry[]
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {entries.map((entry) => {
        const delivered = entry.status === 'live' || entry.status === 'pilot'
        const Icon = STATUS_ICON[entry.status]

        return (
          <div
            key={entry.key}
            className={cn(
              'flex min-w-[9rem] flex-col gap-1 rounded-lg border px-3 py-2',
              delivered
                ? 'border-border bg-card'
                : 'border-dashed border-border bg-muted/40',
            )}
          >
            <div className="flex items-center gap-1.5">
              {!delivered && (
                <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="text-sm font-medium text-card-foreground">{entry.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">{entry.summary}</span>
            {!delivered && (
              <Tooltip content={roadmapTooltip(entry)} focusable>
                <span className={statusChipVariants({ status: entry.status, size: 'sm' })}>
                  {entry.status === 'coming-soon' && entry.phase !== 'Exploring'
                    ? `Coming in ${entry.phase}`
                    : roadmapStatusLabel(entry.status)}
                </span>
              </Tooltip>
            )}
          </div>
        )
      })}
    </div>
  )
}
