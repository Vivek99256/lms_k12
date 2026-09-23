'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { CIRCULAR_AI_STACK_SCREENS } from '@/app/front_desk/circular/ai-stack/_screens/ai-stack-screens';

/**
 * Circular -> ai-stack, at the module's own route.
 *
 * It sits beside the Circular screen itself, which `app/data/routeMapper.ts` maps
 * `circular.index` to as `/front_desk/circular`.
 *
 * WHY THIS MODULE'S CATEGORY ROW HAD TO BE CREATED
 *
 * Circular is a level-2 menu that is itself a screen - its own link is `circular.index`
 * and it has no level-3 children - so 2026_09_17_100001, which rolled the category bar out
 * to every module with children, skipped it entirely.
 * `database/migrations/2026_09_22_100200_add_circular_ai_stack_menu_category.php` adds the
 * one AI Stack row this page needs, so `/modules/circular/ai-stack` resolves to a labelled
 * page rather than "This category is not configured". The other nine categories are
 * deliberately not seeded: they group menus, and Circular has no menus to group.
 *
 * `moduleName="circular"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by. The AI module key is also `circular`, and it is never typed into a
 * screen: every screen takes it from the descriptor in
 * `lib/circulars/circulars-ai-stack.ts`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="circular" categoryKey="ai-stack" staticScreens={CIRCULAR_AI_STACK_SCREENS} />;
}
