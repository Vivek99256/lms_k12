'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { INWARD_AI_STACK_SCREENS } from '@/app/inward_outward/ai-stack/_screens/ai-stack-screens';

/**
 * Inward -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/inward-outward/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the inward register at `/inward_outward`, which the module's own row
 * already claims as `/inward_outward/**` - so this page resolves to Inward without any
 * new pattern and without taking anything from a neighbour.
 *
 * `moduleSlug="inward-outward"` is the MENU slug; the AI module key is `inward_outward`,
 * which is the key that row has carried since the workspace was seeded. The two differ by
 * a hyphen and that is fine: a route is how a URL is recognised, not what a module is
 * called.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="inward-outward"
      categoryKey="ai-stack"
      staticScreens={INWARD_AI_STACK_SCREENS}
    />
  );
}
