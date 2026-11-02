'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { ALUMNI_AI_STACK_SCREENS } from '@/app/alumni/ai-stack/_screens/ai-stack-screens';

/**
 * Alumni Management -> ai-stack, at the module's own route.
 *
 * The category row points at `/modules/alumni-management/ai-stack`, which serves the same
 * tabs through the shared dynamic route. This page exists so the direct path works too, and
 * it renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * `moduleSlug="alumni-management"` is the MENU slug; the AI module key is `alumni`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="alumni-management"
      categoryKey="ai-stack"
      staticScreens={ALUMNI_AI_STACK_SCREENS}
    />
  );
}
