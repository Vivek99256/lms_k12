'use client';

/**
 * Platform Administration — what the platform provides, and what is still coming.
 *
 * Reached from the avatar dropdown, because it describes the platform rather
 * than any one module.
 *
 * ONE PAGE, TWO AUDIENCES
 *
 * This is deliberately both the customer-facing roadmap and the internal
 * "what's left to finish" board. Keeping them as one screen is the point: two
 * separate lists would drift, and the moment the internal list says something
 * the customer list does not, nobody trusts either. The audience switch only
 * changes which rows are shown, never their wording.
 *
 * Rows marked `audience: 'internal'` in `lib/roadmap/registry.ts` — the
 * decision approval trail and the event bus — describe gaps in our own
 * controls. They appear only on builds that opt in, never to a school.
 *
 * Everything on this page is read from `lib/roadmap`. Nothing is hard-coded
 * here, so this screen cannot disagree with the "coming soon" markers shown on
 * the real screens.
 */

import { useMemo, useState } from 'react';

import { ComingSoonBadge } from '@/components/ui/coming-soon';
import {
  canSeeInternalItems,
  getRoadmapByModule,
  isDelivered,
  roadmapStatusLabel,
  type RoadmapItem,
} from '@/lib/roadmap';

/** The sections this screen covers. The rest of the registry belongs to the roadmap screen. */
const SECTIONS = ['Platform services', 'AI and intelligence'];

export default function PlatformAdministrationPage() {
  // Build flag, not a role check — see canSeeInternalItems for why the
  // role-name version let every school admin through.
  const maySeeInternal = canSeeInternalItems();
  const [showInternal, setShowInternal] = useState(false);

  const sections = useMemo(() => {
    const audience = showInternal && maySeeInternal ? 'all' : 'customer';
    return getRoadmapByModule(audience).filter((group) => SECTIONS.includes(group.module));
  }, [showInternal, maySeeInternal]);

  const allItems = useMemo(() => sections.flatMap((group) => group.items), [sections]);
  const liveCount = allItems.filter(isDelivered).length;

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1100px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Platform administration</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              The shared services every module runs on. Each one is built once and used everywhere,
              so a change made here applies across the platform rather than in one module at a time.
            </p>
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
        </header>

        <p className="mt-4 text-sm text-muted-foreground">
          {liveCount} of {allItems.length} available today.
        </p>

        <div className="mt-6 space-y-8">
          {sections.map((group) => (
            <section key={group.module}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.module}
              </h2>

              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {group.items.map((item) => (
                  <PlatformRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlatformRow({ item }: { item: RoadmapItem }) {
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

      {/* Delivered rows get a plain word, not a badge: the roadmap badge is for
          what is coming, and dressing up finished work the same way would blur
          the one distinction this page exists to make. */}
      {delivered ? (
        <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
          {roadmapStatusLabel(item.status)}
        </span>
      ) : (
        <ComingSoonBadge
          roadmapId={item.id}
          size="sm"
          className="shrink-0"
        />
      )}
    </li>
  );
}
