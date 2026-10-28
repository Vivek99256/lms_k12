'use client'

import { CheckCircle2, FlaskConical, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type { SimulationCard, SimulationStatus } from '@/app/course-master/data/simulations'
import { coverSrc } from '@/lib/simulation-format'
import { isPendingReview, type SimulationLink } from '@/lib/simulation-links'
import { cn } from '@/lib/utils'

/** The chip beside a simulation's title: the experiment icon on the Prayogshala indigo. */
export function ExperimentMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'size-11 rounded-xl' : size === 'md' ? 'size-9 rounded-lg' : 'size-7 rounded-md'
  const glyph = size === 'lg' ? 'size-6' : size === 'md' ? 'size-5' : 'size-4'
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-indigo-600 text-white', box, className)} aria-hidden="true">
      <FlaskConical className={glyph} />
    </span>
  )
}

/** Three small bars, filled up to the level: a difficulty at a glance, with the word beside it for anyone who cannot see the bars. */
export function DifficultyBars({ level, className }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden="true">
      {[1, 2, 3].map((bar) => (
        <span key={bar} className={cn('w-[3px] rounded-[1px]', bar <= level ? 'bg-indigo-600' : 'bg-slate-200')} style={{ height: 4 + bar * 3 }} />
      ))}
    </span>
  )
}

/** One fact in the row under a card's summary: an icon, then the words. */
export function MetaItem({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

const STATUS_STYLE: Record<Exclude<SimulationStatus, 'published'>, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border-amber-300 bg-amber-100 text-amber-900' },
  archived: { label: 'Archived', className: 'border-slate-200 bg-slate-100 text-slate-600' },
}

/** "Draft" or "Archived" - a published simulation carries no badge, because that is the ordinary case. */
export function StatusPill({ status, className }: { status: SimulationStatus; className?: string }) {
  if (status === 'published') return null
  const style = STATUS_STYLE[status]
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none', style.className, className)}>{style.label}</span>
}

/** Where this person stands in a simulation, as a chip. Nothing is drawn for someone who has not started it. */
export function ProgressPill({ progress, className }: { progress: SimulationCard['progress']; className?: string }) {
  if (!progress) return null
  if (progress.status === 'completed') {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-emerald-900', className)}>
        <CheckCircle2 className="size-3 text-emerald-700" aria-hidden="true" />
        Completed
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-indigo-900', className)}>
      {progress.percent}%<span className="sr-only"> done, in progress</span>
    </span>
  )
}

/** "Waiting for review": drawn for staff on a link (or a simulation) that a learner cannot see yet. */
export function PendingBadge({ className, children = 'Pending review' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-900', className)}>
      {children}
    </span>
  )
}

/** A concept the simulation is linked to. A primary concept is solid, a supporting one is outlined; a link still in review carries the pending look. */
export function ConceptChip({ link, className }: { link: SimulationLink; className?: string }) {
  const pending = isPendingReview(link)
  return (
    <span
      title={[link.topic_name, link.citation, pending ? 'Waiting for review' : null].filter(Boolean).join(' · ') || undefined}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
        link.role === 'primary' ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-700',
        pending && 'border-dashed border-amber-400 bg-amber-50 text-amber-900',
        className,
      )}
    >
      <span className="truncate">{link.concept_name ?? `Concept ${link.concept_id}`}</span>
      {pending && <span className="shrink-0 text-[10px] uppercase tracking-wide">review</span>}
    </span>
  )
}

/**
 * The picture on a simulation's card: its cover when it has a safe one, otherwise a plain panel with the experiment mark. The cover is a file
 * under /public/simulations/covers (see coverSrc), so nothing here depends on which simulations exist.
 */
export function SimulationCover({ simulation, className }: { simulation: Pick<SimulationCard, 'cover_url' | 'title'>; className?: string }) {
  const src = coverSrc(simulation.cover_url)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src !== null && failedSrc !== src
  return (
    <div className={cn('relative size-full overflow-hidden bg-slate-100', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small static cover from /public; images are unoptimized in this app
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedSrc(src)} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-indigo-50 to-slate-100">
          <ExperimentMark size="lg" />
        </div>
      )}
    </div>
  )
}
