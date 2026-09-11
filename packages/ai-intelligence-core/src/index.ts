/**
 * Lookups over the AI capability registry.
 *
 * Consumers import from here, never from `registry.ts` directly, so the shape of
 * the data can change without touching every screen that reads it. This mirrors
 * how `lib/roadmap/index.ts` sits in front of its own registry — the same
 * arrangement, for the same reason.
 */

export {
  AI_CAPABILITIES,
  type AiCapability,
  type CapabilityStatus,
  type ConsumptionState,
  type SolutionConsumption,
} from './registry';

export {
  SOLUTIONS,
  SOLUTION_IDS,
  SOLUTION_ID_HEADER,
  getSolution,
  type Solution,
  type SolutionId,
  type SolutionKind,
} from './solutions';

import { AI_CAPABILITIES, type AiCapability, type CapabilityStatus } from './registry';
import type { SolutionId } from './solutions';

/**
 * One capability by id, or `undefined`.
 *
 * Unknown ids return undefined rather than throwing, for the same reason the
 * roadmap lookups do: a screen whose capability was renamed should stop claiming
 * it exists, not take the page down with it.
 */
export function getCapability(id: string): AiCapability | undefined {
  return AI_CAPABILITIES.find((capability) => capability.id === id);
}

/** One capability by its URL segment. This is what `/ai/<slug>` resolves through. */
export function getCapabilityBySlug(slug: string): AiCapability | undefined {
  const wanted = slug.trim().toLowerCase();
  return AI_CAPABILITIES.find((capability) => capability.slug === wanted);
}

/**
 * Where a capability's menu entry should point.
 *
 * A capability with a working screen points at it. Everything else points at the
 * shared console page, which explains the capability rather than announcing that
 * a name is under construction — the console page knows what the thing is for,
 * which is the whole difference this registry makes.
 */
export function capabilityHref(capability: AiCapability): string {
  return capability.href ?? `/ai/${capability.slug}`;
}

/** Capabilities a given product consumes today, in registry order. */
export function capabilitiesForSolution(solutionId: SolutionId): AiCapability[] {
  return AI_CAPABILITIES.filter((capability) => capability.solutions[solutionId].today !== 'no');
}

/** How many capabilities are in each state. Used for the console's summary line. */
export function capabilityStatusCounts(): Record<CapabilityStatus, number> {
  const counts: Record<CapabilityStatus, number> = {
    live: 0,
    'in-progress': 0,
    'coming-soon': 0,
  };
  for (const capability of AI_CAPABILITIES) counts[capability.status] += 1;
  return counts;
}

const STATUS_LABELS: Record<CapabilityStatus, string> = {
  live: 'Live',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
};

/**
 * The one word each state is described with.
 *
 * Kept here so a badge, a table cell and a page header cannot word the same
 * state three different ways — the consistency is the point of a shared package.
 *
 * These strings match `roadmapStatusLabel` in `lib/roadmap`, and a test pins
 * that. They are duplicated rather than imported on purpose: this package must
 * stay importable by products that have no `lib/roadmap` of their own.
 */
export function capabilityStatusLabel(status: CapabilityStatus): string {
  return STATUS_LABELS[status];
}
