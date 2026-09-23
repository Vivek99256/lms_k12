'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { LIBRARY_AI_STACK_SCREENS } from '@/app/library/ai-stack/_screens/ai-stack-screens';

/**
 * Library -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/library/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the library screens at `/library`, which the module's own row already
 * claims as `/library/**`.
 *
 * `moduleSlug="library"` is the MENU slug and the AI module key is also `library`. The
 * level-2 menu is shown as "Books" in the navigation, which is why the AI Stack category
 * row created for it names the module `library` and the menu `Books`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="library"
      categoryKey="ai-stack"
      staticScreens={LIBRARY_AI_STACK_SCREENS}
    />
  );
}
