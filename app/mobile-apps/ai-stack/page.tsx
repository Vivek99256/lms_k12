'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { MOBILE_APPS_AI_STACK_SCREENS } from '@/app/mobile-apps/ai-stack/_screens/ai-stack-screens';

/**
 * Users Mobile Apps -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/mobile-apps/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * `moduleSlug="mobile-apps"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by. The AI module key is `mobile_apps`, underscored, and it is never typed
 * into a screen: every screen takes it from the descriptor in
 * `lib/mobile-apps/mobile-apps-ai-stack.ts`.
 *
 * This route claims none of the module's level-3 menu targets. Those point at Calendar,
 * Photo Gallery, Leave and Exam Schedule, which belong to the front_desk and students
 * modules - taking them to look better populated would be the cross-module leak the whole
 * design prevents.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="mobile-apps"
      categoryKey="ai-stack"
      staticScreens={MOBILE_APPS_AI_STACK_SCREENS}
    />
  );
}
