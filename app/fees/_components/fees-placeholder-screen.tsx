'use client';

import { ComingSoonPanel } from '@/components/ui/coming-soon';

/**
 * The body of a Fees tab that exists in the navigation but has no backend yet.
 *
 * This is now a thin alias over the shared `ComingSoonPanel` — the product has
 * one "coming soon" look and this is not allowed to be a second one. The name
 * and prop shape are kept because ~34 Fees screens call it; new code outside
 * Fees should import `ComingSoonPanel` directly.
 *
 * When a screen is built for real, its entry stops calling this and renders the
 * real thing instead.
 */
export function FeesPlaceholderScreen({
  title,
  summary,
  points,
  roadmapId,
}: {
  title: string;
  summary: string;
  points: string[];
  /** Optional row in lib/roadmap, which supplies the phase and tooltip wording. */
  roadmapId?: string;
}) {
  return <ComingSoonPanel roadmapId={roadmapId} title={title} summary={summary} points={points} />;
}
