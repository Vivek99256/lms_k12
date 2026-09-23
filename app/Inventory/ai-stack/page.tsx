'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { INVENTORY_AI_STACK_SCREENS } from '@/app/Inventory/ai-stack/_screens/ai-stack-screens';

/**
 * Inventory -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/inventory/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the inventory screens at `/Inventory`, which the module's own row already
 * claims as `/Inventory/**` - so this page resolves to Inventory without any new pattern
 * and without taking anything from a neighbour.
 *
 * `moduleSlug="inventory"` is the MENU slug and the AI module key is also `inventory`,
 * which that row has carried since the workspace was seeded.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="inventory"
      categoryKey="ai-stack"
      staticScreens={INVENTORY_AI_STACK_SCREENS}
    />
  );
}
