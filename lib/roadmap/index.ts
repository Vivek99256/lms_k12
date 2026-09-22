/**
 * Lookups over the roadmap registry.
 *
 * Screens import from here, never from `registry.ts` directly, so the shape of
 * the data can change without touching every placeholder.
 */

import {
  CATALOG_CATEGORY_PLAN,
  NAMING,
  ROADMAP_ITEMS,
  type CatalogCategoryPlan,
  type RoadmapAudience,
  type RoadmapItem,
  type RoadmapPhase,
  type RoadmapStatus,
} from './registry';

export {
  CATALOG_CATEGORY_PLAN,
  NAMING,
  ROADMAP_ITEMS,
  type CatalogCategoryPlan,
  type RoadmapAudience,
  type RoadmapItem,
  type RoadmapPhase,
  type RoadmapStatus,
};

const BY_ID = new Map(ROADMAP_ITEMS.map((item) => [item.id, item]));

/**
 * One roadmap row, or `undefined` if the id is unknown.
 *
 * Unknown ids return undefined rather than throwing: a placeholder whose row was
 * removed should quietly stop claiming something is coming, not crash the page
 * it sits on.
 */
export function getRoadmapItem(id: string): RoadmapItem | undefined {
  return BY_ID.get(id);
}

/** Several rows at once, skipping any id that no longer exists. */
export function getRoadmapItems(ids: readonly string[]): RoadmapItem[] {
  return ids.map((id) => BY_ID.get(id)).filter((item): item is RoadmapItem => item !== undefined);
}

/**
 * Rows grouped by module, in registry order.
 *
 * Registry order is intentional — it is the order the roadmap screen reads in,
 * so the file itself is the running order rather than something sorted at
 * render time and quietly rearranged by a later edit.
 */
export function getRoadmapByModule(
  audience: RoadmapAudience | 'all' = 'customer'
): { module: string; items: RoadmapItem[] }[] {
  const groups: { module: string; items: RoadmapItem[] }[] = [];

  for (const item of ROADMAP_ITEMS) {
    if (audience !== 'all' && item.audience !== audience) continue;

    const existing = groups.find((group) => group.module === item.module);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ module: item.module, items: [item] });
    }
  }

  return groups;
}

/** True when the row describes something a customer can use today. */
export function isDelivered(item: RoadmapItem): boolean {
  return item.status === 'live' || item.status === 'pilot';
}

/**
 * The one sentence shown in every placeholder tooltip.
 *
 * Kept here rather than in the component so the wording is identical on a
 * catalog card, a locked toggle and a dashboard tile — the consistency is the
 * point of the shared component in the first place.
 */
export function roadmapTooltip(item: { phase?: RoadmapPhase; status: RoadmapStatus }): string {
  if (item.status === 'live') return 'Available now.';
  if (item.status === 'pilot') return 'In pilot — ask us about joining.';
  if (item.status === 'in-progress') return 'Being built now — ask us about your timeline.';
  // No phase means no roadmap row named one. Saying a phase anyway would be
  // inventing a commitment, which is worse than saying less.
  if (!item.phase || item.phase === 'Exploring') {
    return 'On the roadmap — ask us about your timeline.';
  }
  return `Coming in ${item.phase} — ask us about your timeline.`;
}

// Aliases resolve to the same plan as the canonical spelling, so a tier stored
// under two spellings is counted once rather than drawn twice.
const CATALOG_PLAN_BY_CATEGORY = new Map<string, CatalogCategoryPlan>();
for (const plan of CATALOG_CATEGORY_PLAN) {
  CATALOG_PLAN_BY_CATEGORY.set(plan.category, plan);
  for (const alias of plan.aliases ?? []) {
    CATALOG_PLAN_BY_CATEGORY.set(alias, plan);
  }
}

/**
 * The roadmap plan for one catalog category, or `undefined` for a category the
 * plan does not mention.
 *
 * Unknown categories are expected, not an error: a school can add its own
 * category at any time and it should simply show its live count with no roadmap
 * treatment, rather than being hidden or labelled as coming soon.
 */
export function getCatalogCategoryPlan(category: string): CatalogCategoryPlan | undefined {
  return CATALOG_PLAN_BY_CATEGORY.get(category);
}

/**
 * The canonical category key for a stored `content_category` value.
 *
 * Callers must count through this rather than through the raw value, or an
 * aliased spelling is tallied as a category of its own and the tier it belongs
 * to reports zero. A category the plan does not mention is returned unchanged —
 * a school may add its own at any time and it should simply show its count.
 */
export function resolveCatalogCategory(category: string): string {
  return CATALOG_PLAN_BY_CATEGORY.get(category)?.category ?? category;
}

/**
 * What the strip should claim, given what the school actually has.
 *
 * The registry status is a product statement; `active` is what this school has
 * today, and where the two disagree the data wins. Sub-institute 1 — whose
 * subjects are merged into every LMS tenant's catalog — carries 36 STEM
 * Resources and 5 Career Counselling subjects against rows planned as
 * `coming-soon`. Without this the strip read "36 active · Coming in Phase 2":
 * a working tier labelled unbuilt, which is what frozen decision #49 forbids.
 *
 * A tier with subjects and more of them planned is genuinely in progress; one
 * with subjects and no agreed number is simply live.
 */
function presentedStatus(plan: CatalogCategoryPlan, active: number): RoadmapStatus {
  if (active <= 0 || plan.status === 'live' || plan.status === 'pilot') return plan.status;
  return plan.planned && plan.planned > 0 ? 'in-progress' : 'live';
}

/**
 * What the rollup strip prints for one category.
 *
 * `active` is always counted from live data by the caller. This only decides how
 * to word it.
 */
export function catalogCategorySummary(
  category: string,
  active: number,
): { label: string; summary: string; status: RoadmapStatus; phase: RoadmapPhase } {
  const plan = getCatalogCategoryPlan(category);
  const activeLabel = `${active} active`;

  if (!plan) {
    return { label: category, summary: activeLabel, status: 'live', phase: 'Phase 2' };
  }

  return {
    label: plan.label ?? plan.category,
    summary:
      plan.planned !== undefined ? `${activeLabel} · ${plan.planned} planned` : activeLabel,
    status: presentedStatus(plan, active),
    phase: plan.phase,
  };
}


/**
 * Whether this build may show items marked `audience: 'internal'`.
 *
 * WHY THIS IS A BUILD FLAG AND NOT A ROLE CHECK
 *
 * The first version tested the signed-in profile name for "admin", "principal"
 * or "management". That looked reasonable and was wrong: the customers' own
 * role names are "School Admin" and "Vice Principal", so every one of the 174
 * school profiles in the estate passed it. A test meant to separate our staff
 * from our customers was matching the words our customers use for themselves.
 *
 * Nothing in the session distinguishes a ScholarClone employee from a school
 * user — same shape of user row, same tenant fields — so there is no honest
 * role check to write. Rather than guess again, internal items are off unless a
 * build explicitly turns them on, which only we control.
 *
 * Set NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP=true on internal builds. Anything else,
 * including unset, hides them.
 *
 * This is a visibility measure, not a security control: it decides what the
 * product advertises, and everything it hides is a "coming soon" note rather
 * than protected data. If that ever stops being true, this needs to move
 * server-side.
 */
export function canSeeInternalItems(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP === 'true';
}

/** Short label for a badge or chip. */
export function roadmapStatusLabel(status: RoadmapStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'pilot':
      return 'Pilot';
    case 'in-progress':
      return 'In progress';
    case 'coming-soon':
      return 'Coming soon';
  }
}
