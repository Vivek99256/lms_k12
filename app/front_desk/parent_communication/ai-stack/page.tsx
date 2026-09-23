'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { PARENT_COMMUNICATION_AI_STACK_SCREENS } from '@/app/front_desk/parent_communication/ai-stack/_screens/ai-stack-screens';

/**
 * Parent Communication -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/parent-communication/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the parent communication screen at `/front_desk/parent_communication`,
 * which is named literally in the module's route patterns and so beats the front_desk
 * module's `/front_desk/**` wildcard.
 *
 * `moduleName="parent-communication"` is the MENU slug; the AI module key is
 * `parent_communication`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="parent-communication"
      categoryKey="ai-stack"
      staticScreens={PARENT_COMMUNICATION_AI_STACK_SCREENS}
    />
  );
}
