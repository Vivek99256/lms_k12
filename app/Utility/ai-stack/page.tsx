'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { UTILITY_AI_STACK_SCREENS } from '@/app/Utility/ai-stack/_screens/ai-stack-screens';

/**
 * Utility -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/utility/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the Utility screens at `/Utility`, which the `migration-modules` row has
 * claimed as `/Utility/**` since the workspace was seeded - so this page resolves without
 * any new pattern.
 *
 * `moduleName="utility"` is the MENU slug; the AI module KEY is `migration-modules`,
 * because that is the row that owns these routes. See
 * `lib/utility/utility-ai-stack.ts` for why it was not given a new one.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="utility"
      categoryKey="ai-stack"
      staticScreens={UTILITY_AI_STACK_SCREENS}
    />
  );
}
