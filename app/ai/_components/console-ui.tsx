'use client';

/**
 * The small pieces the AI console's two screens share.
 *
 * They exist so the index and the capability page cannot word or colour the same
 * thing differently — the console's whole claim is that one description of a
 * capability is shown everywhere, and two screens drawing their own chips would
 * undercut that on the first edit.
 *
 * Status uses the product's existing `ComingSoonBadge` rather than a new chip.
 * There is deliberately only one "this is not built yet" look in this codebase,
 * and adding a second here would be the fifth time that mistake was made.
 */

import type { ReactNode } from 'react';

import { ComingSoonBadge } from '@/components/ui/coming-soon';
import type { CapabilityStatus, ConsumptionState } from '@shared/ai-intelligence-core';

export function StatusChip({
  status,
  roadmapId,
  size,
}: {
  status: CapabilityStatus;
  /** Lets the tooltip name a phase when the roadmap has agreed one. */
  roadmapId?: string;
  size?: 'sm' | 'default';
}) {
  return <ComingSoonBadge status={status} roadmapId={roadmapId} size={size} className="shrink-0" />;
}

const CONSUMPTION: Record<ConsumptionState, { label: string; className: string }> = {
  // Never colour alone: each state is named, so the table reads the same to
  // someone who cannot distinguish the fills.
  yes: { label: 'In use', className: 'border-primary/30 bg-primary/10 text-primary' },
  partial: { label: 'Partly', className: 'border-border bg-muted text-foreground' },
  no: { label: 'Not yet', className: 'border-dashed border-border bg-transparent text-muted-foreground' },
};

export function ConsumptionPill({ state }: { state: ConsumptionState }) {
  const { label, className } = CONSUMPTION[state];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}

/** One titled block of the capability page. */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A short list of points, matching the bullet treatment ComingSoonPanel uses. */
export function PointList({ points }: { points: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}
