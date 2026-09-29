import { moduleIntelligenceRoute } from '@/components/intelligence/module/registry';

import type { ModuleCategoriesResponse } from './module-menu-categories-api';

/**
 * The canonical module namespace: `/modules/<module-slug>/…`.
 *
 * The slug is never invented here. It is `fees_menu_categories.module_name` —
 * the module's own row — which is why a school that renames a module needs no
 * code change.
 */

/** The category bar, as the page renders it. */
export type ModuleCategoryNavItem = {
  key: string;
  label: string;
  description: string;
  href: string;
};

/**
 * The module slug carried by a pathname, or '' when the path is not a module
 * route.
 *
 * READ, NEVER GUESSED. `/students/intelligence` is a legacy module route and
 * returns '' rather than 'students': treating any first segment as a slug is
 * how a legacy page would start resolving another module's categories.
 */
export function moduleSlugFromPathname(pathname: string | null | undefined): string {
  if (!pathname) return '';

  const [withoutQuery] = pathname.split('?');
  const segments = withoutQuery.split('/').filter(Boolean);

  if (segments.length < 2 || segments[0] !== 'modules') return '';

  return segments[1];
}

/**
 * Where one category of one module opens.
 *
 * ── INTELLIGENCE IS ALWAYS CANONICALISED, AND NOTHING ELSE IS ───────────────
 *
 * Every other category keeps whatever its row configures, because those routes
 * point at pages that really exist — rewriting `/fees/master-setup` to
 * `/modules/fees/master-setup` would send a bursar to a page nobody built.
 *
 * Intelligence is the one exception: every module's Intelligence is served by
 * the same `app/modules/[moduleKey]/[categoryKey]` route, so sending it to the
 * canonical path is what makes one screen serve all of them. A module whose row
 * still spells a legacy Intelligence path is corrected here rather than in the
 * database, so the two can disagree without anything breaking.
 *
 * An empty configured route resolves inside the module rather than being
 * treated as broken.
 */
export function categoryHref(moduleSlug: string, categoryKey: string, configuredRoute: string): string {
  const slug = (moduleSlug || '').trim();
  const key = (categoryKey || '').trim();

  if (key.toLowerCase() === 'intelligence' && slug) {
    return moduleIntelligenceRoute(slug);
  }

  const configured = (configuredRoute || '').trim();
  if (configured) return configured;

  return slug ? `/modules/${slug}/${key}` : '';
}

/**
 * The category bar for a module feed.
 *
 * A response naming no module produces NO navigation. A bar built from
 * categories with no module to attach them to would point every tab at a path
 * assembled from an empty slug, which is worse than showing nothing.
 */
export function moduleCategoryItems(response: ModuleCategoriesResponse): ModuleCategoryNavItem[] {
  const moduleName = response.module?.moduleName?.trim();

  if (!moduleName) return [];

  return (response.categories ?? []).map((category) => ({
    key: category.key,
    label: category.label,
    description: category.description,
    href: categoryHref(moduleName, category.key, category.route),
  }));
}
