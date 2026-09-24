'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { COMMUNICATION_AI_STACK_SCREENS } from '@/app/easy_com/ai-stack/_screens/ai-stack-screens';

/**
 * Communication -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/communication/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the send screens at `/easy_com/...`, which the Communication menu's five
 * level-3 rows point at.
 *
 * `moduleSlug="communication"` is the MENU slug. The AI module key is `easy_com` - the key
 * this estate has carried since the workspace was seeded, and the one whose route patterns
 * already cover these screens. Registering a second `communication` key would split one
 * module across two policy scopes, two template lists and two ledgers, so the module keeps
 * the key it has and the route carries the slug.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="communication"
      categoryKey="ai-stack"
      staticScreens={COMMUNICATION_AI_STACK_SCREENS}
    />
  );
}
