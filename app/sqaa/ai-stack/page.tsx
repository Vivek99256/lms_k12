'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { SQAA_AI_STACK_SCREENS } from '@/app/sqaa/ai-stack/_screens/ai-stack-screens';

/**
 * Quality assurance -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/sqaa/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the SQAA screens at `/sqaa`, which the module's own row already claims as
 * `/sqaa/**`.
 *
 * `moduleName="sqaa"` is the MENU slug and the AI module key is also `sqaa`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="sqaa"
      categoryKey="ai-stack"
      staticScreens={SQAA_AI_STACK_SCREENS}
    />
  );
}
