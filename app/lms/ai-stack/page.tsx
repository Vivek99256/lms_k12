'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { LMS_AI_STACK_SCREENS } from '@/app/lms/ai-stack/_screens/ai-stack-screens';

/**
 * Learning -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/lms/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the learning screens at `/lms`, which the module's own row already claims
 * as `/lms/**`.
 *
 * `moduleName="lms"` is the MENU slug and the AI module key is also `lms`. The descriptor
 * lives in `lib/lms-ai/` rather than `lib/lms/`, which is an existing folder of LMS
 * feature code that this has no business being mixed into.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="lms"
      categoryKey="ai-stack"
      staticScreens={LMS_AI_STACK_SCREENS}
    />
  );
}
