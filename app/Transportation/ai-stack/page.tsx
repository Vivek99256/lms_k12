'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { TRANSPORT_AI_STACK_SCREENS } from '@/app/Transportation/ai-stack/_screens/ai-stack-screens';

/**
 * Transport -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/transport/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the transport screens at `/Transportation`, which the module's own row
 * already claims as `/Transportation/**` - so this page resolves to Transport without any
 * new pattern and without taking anything from a neighbour.
 *
 * `moduleName="transport"` is the MENU slug; the AI module key is `transportation`, which
 * is the key that row has carried since the workspace was seeded.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="transport"
      categoryKey="ai-stack"
      staticScreens={TRANSPORT_AI_STACK_SCREENS}
    />
  );
}
