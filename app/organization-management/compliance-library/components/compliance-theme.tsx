/**
 * Colour language for the Compliance Library screens, taken from the
 * K-12 ERP Design System (`K-12 ERP Design System/tokens/colors.css`):
 * brand indigo, slate neutrals, and emerald / amber / red / blue feedback.
 * Flat surfaces only - no gradients or glass, per the system's rules.
 *
 * The app-wide theme tokens (`--primary`, `--chart-*`) are grayscale and the
 * `success`/`warning` tokens are not registered in Tailwind, so the design
 * system scales are applied here via the matching Tailwind palette
 * (indigo-600 = brand-600 #4f46e5, emerald = success, amber = warning,
 * red = error, blue = info, slate = neutral).
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'brand' | 'info' | 'success' | 'warning' | 'error' | 'neutral'

/** Feedback-style surface / border / content trio (50 / 200 / 700-800). */
export const TONE_BADGE: Record<Tone, string> = {
  brand: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/30',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
  error: 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/30',
}

const TONE_DOT: Record<Tone, string> = {
  brand: 'bg-indigo-600',
  info: 'bg-blue-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  error: 'bg-red-600',
  neutral: 'bg-slate-400',
}

/** Light chart fills: the 300/400 steps of the design-system scales (SVG fills cannot use Tailwind classes). */
export const TONE_HEX: Record<Tone, string> = {
  brand: '#a5b4fc',
  info: '#93c5fd',
  success: '#6ee7b7',
  warning: '#fcd34d',
  error: '#fca5a5',
  neutral: '#cbd5e1',
}

export const STATUS_TONE: Record<string, Tone> = {
  Upcoming: 'neutral',
  'Due Soon': 'warning',
  'In Progress': 'info',
  'Pending Verification': 'brand',
  Completed: 'success',
  Overdue: 'error',
  Expired: 'error',
  'Not Applicable': 'neutral',
}

export const PRIORITY_TONE: Record<string, Tone> = {
  Low: 'neutral',
  Medium: 'info',
  High: 'warning',
  Critical: 'error',
}

export function ToneBadge({ tone, dot, className, children }: { tone: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ',
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>
  return <ToneBadge tone={STATUS_TONE[status] ?? 'neutral'} dot>{status}</ToneBadge>
}

export function PriorityPill({ priority }: { priority?: string | null }) {
  if (!priority) return <span className="text-muted-foreground">-</span>
  return <ToneBadge tone={PRIORITY_TONE[priority] ?? 'neutral'}>{priority}</ToneBadge>
}

/** Frequency is a descriptor, not a state, so it stays neutral; only Custom is flagged. */
export function FrequencyPill({ frequency }: { frequency?: string | null }) {
  if (!frequency) return <span className="text-muted-foreground">-</span>
  return <ToneBadge tone={frequency === 'Custom' ? 'brand' : 'neutral'}>{frequency}</ToneBadge>
}

/** Icon chip: white disc on a pastel surface, tinted glyph. */
export const TILE_SOFT: Record<Tone, string> = {
  brand: 'bg-white text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300',
  info: 'bg-white text-blue-500 dark:bg-blue-500/20 dark:text-blue-300',
  success: 'bg-white text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-300',
  warning: 'bg-white text-amber-500 dark:bg-amber-500/20 dark:text-amber-300',
  error: 'bg-white text-red-400 dark:bg-red-500/20 dark:text-red-300',
  neutral: 'bg-white text-slate-500 dark:bg-slate-500/20 dark:text-slate-300',
}

/** Pastel card surface per tone (50 fill, 100 border). */
const TONE_SURFACE: Record<Tone, string> = {
  brand: 'bg-indigo-50 border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-400/20',
  info: 'bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-400/20',
  success: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-400/20',
  warning: 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-400/20',
  error: 'bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-400/20',
  neutral: 'bg-slate-50 border-slate-100 dark:bg-slate-500/10 dark:border-slate-400/20',
}

export function IconTile({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('flex shrink-0 items-center justify-center rounded-lg p-2.5 shadow-sm', TILE_SOFT[tone], className)}>{children}</span>
}

/** Compact pastel stat card: icon chip beside the value, label underneath. */
export function StatTile({ label, value, tone, icon }: { label: string; value: ReactNode; tone: Tone; icon: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5', TONE_SURFACE[tone])} title={label}>
      <IconTile tone={tone} className="size-9 p-0">{icon}</IconTile>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-tight tabular-nums text-slate-800 dark:text-foreground">{value}</p>
        <p className="truncate text-xs text-slate-500 dark:text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/** Table header per the system: uppercase overline on surface-subtle. */
export const TABLE_HEADER_CLASS =
  'bg-indigo-50/70 dark:bg-indigo-500/10 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-indigo-500 dark:[&_th]:text-indigo-300'
