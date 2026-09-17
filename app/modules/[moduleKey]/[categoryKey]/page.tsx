import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Every module's category pages, from one route.
 *
 * Fees and Teach/Learn predate this and keep their own routes (/fees/…,
 * /teach-learn/…) because real pages already live there; the seeded `route`
 * column is what points each module's bar at the right place, so both
 * conventions coexist without the bar knowing the difference.
 *
 * The 62 modules seeded by
 * 2026_09_17_100001_seed_all_module_menu_categories.php all point here, which
 * is why adding a module is a row rather than a pair of files.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ moduleKey: string; categoryKey: string }>;
}) {
  const { moduleKey, categoryKey } = await params;

  return <ModuleCategoryPage moduleName={moduleKey} categoryKey={categoryKey} />;
}
