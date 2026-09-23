import { moduleIntelligenceRoute } from '@/components/intelligence/module/registry';
import type { ModuleCategoriesResponse } from '@/app/modules/_lib/module-menu-categories-api';

/**
 * The route arithmetic behind the canonical module namespace.
 *
 * Kept apart from the hook that uses it — no React, no session, no fetch — so
 * the rules it encodes can be asserted directly. See
 * lib/brain/module-navigation.test.ts.
 */

export type ModuleNavItem = {
  id: string;
  label: string;
  href: string;
};

function normalizePath(pathname: string | null | undefined): string {
  const value = (pathname ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');
  return path.replace(/\/+$/, '') || '/';
}

/**
 * The module slug in a `/modules/<slug>/...` path, or ''.
 *
 * The slug is taken verbatim from the URL rather than matched against a list:
 * it is a database value (`fees_menu_categories.module_name`), and the request
 * is what tells the backend which rows to look for. An unknown slug resolves to
 * no module and the navigation stays away.
 */
export function moduleSlugFromPathname(pathname: string | null | undefined): string {
  const segments = normalizePath(pathname).split('/').filter(Boolean);
  return segments[0] === 'modules' && segments[1] ? segments[1] : '';
}

/**
 * The route a category tab opens.
 *
 * The configured `route` is used as given — that is where the category's page
 * actually lives, and for Fees and Teach/Learn those are real, existing screens
 * under their own folders — except for Intelligence, which is normalized onto
 * the one canonical namespace so the sidebar item, the category tab and a typed
 * URL all land on the same screen.
 */
export function categoryHref(moduleSlug: string, key: string, route: string): string {
  if (key === 'intelligence') return moduleIntelligenceRoute(moduleSlug);
  return route || `/modules/${moduleSlug}/${key}`;
}

/** A module's category bar, as level-3 navigation items. */
export function moduleCategoryItems(response: ModuleCategoriesResponse): ModuleNavItem[] {
  const slug = response.module?.moduleName ?? '';
  if (!slug) return [];

  return response.categories.map((category) => ({
    id: `module-${slug}-${category.key}`,
    label: category.label,
    href: categoryHref(slug, category.key, category.route),
  }));
}
