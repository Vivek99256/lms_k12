'use client';

/**
 * What's coming — the roadmap a rep opens mid-demo.
 *
 * WHEN A SCHOOL ASKS "WHAT ELSE IS COMING?"
 *
 * This is the answer. It is curated, not the raw internal tracker: rows marked
 * `audience: 'internal'` in `lib/roadmap/registry.ts` never appear here unless
 * the build explicitly enables them.
 *
 * NO SCORECARD, ON PURPOSE
 *
 * There is no "5 of 32 delivered" counter anywhere on this page, and that is a
 * deliberate choice rather than an omission. The registry holds what needed a
 * roadmap marker — it is not an inventory of the platform, which does a great
 * deal this list never mentions. A ratio computed from it would read as "only
 * five things work", which is false and would do the opposite of what a roadmap
 * shown to a customer is for. The page says what is coming and says so plainly;
 * counting belongs on screens where the count is actually true, like the course
 * catalog strip.
 *
 * Delivered rows are kept inline rather than hidden, because they carry the
 * story within a section: "CASEL/SEL is live, three more frameworks follow" is
 * a far stronger thing to show than three items that are merely not done.
 */

import { useMemo, useState } from 'react';

import { ComingSoonBadge } from '@/components/ui/coming-soon';
import {
  canSeeInternalItems,
  getRoadmapByModule,
  isDelivered,
  roadmapStatusLabel,
  type RoadmapItem,
  type RoadmapPhase,
} from '@/lib/roadmap';

type PhaseFilter = 'all' | RoadmapPhase;

const PHASE_FILTERS: { value: PhaseFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'Phase 2', label: 'Next' },
  { value: 'Phase 3', label: 'Later' },
  { value: 'Exploring', label: 'Exploring' },
];

export default function PlatformRoadmapPage() {
  // Build flag, not a role check — see canSeeInternalItems for why the
  // role-name version let every school admin through.
  const maySeeInternal = canSeeInternalItems();
  const [showInternal, setShowInternal] = useState(false);
  const [phase, setPhase] = useState<PhaseFilter>('all');

  const audience = showInternal && maySeeInternal ? 'all' : 'customer';

  /**
   * Only the timeframes that actually hold something for this viewer.
   *
   * A tab that opens onto "nothing is scheduled" is a poor thing to click in
   * front of a customer, and it happens for real: the only Exploring item is
   * internal-only, so that tab is always empty in the customer view.
   */
  const availableFilters = useMemo(() => {
    const phasesWithItems = new Set(
      getRoadmapByModule(audience)
        .flatMap((group) => group.items)
        .filter((item) => !isDelivered(item))
        .map((item) => item.phase),
    );

    return PHASE_FILTERS.filter(
      (option) => option.value === 'all' || phasesWithItems.has(option.value),
    );
  }, [audience]);

  /**
   * The filter actually in force.
   *
   * Falls back to "Everything" when the chosen timeframe is no longer offered —
   * which happens when an admin picks Exploring and then switches internal
   * items back off. Derived rather than corrected in an effect, so there is no
   * frame where the page shows an empty list under a tab that is not there.
   */
  const activePhase: PhaseFilter = availableFilters.some((option) => option.value === phase)
    ? phase
    : 'all';

  const sections = useMemo(() => {
    return getRoadmapByModule(audience)
      .map((group) => ({
        module: group.module,
        // Delivered rows are context on "Everything", where the whole roadmap is
        // in view and "CASEL/SEL is live, three more follow" tells a story.
        //
        // They must NOT survive a timeframe filter, which an earlier version let
        // them do. Every delivered row happens to be Phase 2, so clicking
        // "Exploring" listed Authentication and Roles and permissions — both
        // live, both Phase 2 — above the single item actually being explored.
        // A tab that says "Later" has to mean later.
        items: group.items.filter((item) => activePhase === 'all' || item.phase === activePhase),
      }))
      // A section left with nothing but already-delivered rows has no answer to
      // "what's coming", so it drops out rather than showing as an empty promise.
      .filter((group) => group.items.some((item) => !isDelivered(item)));
  }, [audience, activePhase]);

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1100px]">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">What&rsquo;s coming</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The capabilities we are building next, across the platform. This is the roadmap — it
            does not list everything the platform already does today.
          </p>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by timeframe">
            {availableFilters.map((option) => {
              const selected = activePhase === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setPhase(option.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {maySeeInternal && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={showInternal}
                onChange={(event) => setShowInternal(event.target.checked)}
                className="size-4 accent-current"
              />
              Show internal-only items
            </label>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing is scheduled for this timeframe.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {sections.map((group) => (
              <section key={group.module}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.module}
                </h2>

                <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {group.items.map((item) => (
                    <RoadmapRow key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoadmapRow({ item }: { item: RoadmapItem }) {
  const delivered = isDelivered(item);

  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-card-foreground">{item.title}</p>
          {item.audience === 'internal' && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Internal only
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.blurb}</p>
      </div>

      {/* Delivered rows get a quiet word rather than a badge — the badge means
          "not yet", and using it for finished work would blur the one
          distinction this page exists to draw. */}
      {delivered ? (
        <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          {roadmapStatusLabel(item.status)}
        </span>
      ) : (
        <ComingSoonBadge roadmapId={item.id} size="sm" className="shrink-0" />
      )}
    </li>
  );
}
