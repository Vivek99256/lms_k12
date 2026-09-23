'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { TASK_MANAGEMENT_AI_STACK_SCREENS } from '@/app/task-management/ai-stack/_screens/ai-stack-screens';

/**
 * Task Management -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/task-management/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the task screens at `/task-management`, which this module's row claims as
 * `/task-management/**`.
 *
 * The module's level-2 menu exists per institute with different ids, so
 * `fees_menu_categories` carries more than one slug for it - `task-management-253` and
 * `task-management-551` today. Both are mapped in `module-static-screens.tsx` to this same
 * screen list; there is no second AI Stack to keep in step.
 *
 * `moduleSlug="task-management"` is the slug this direct page uses; the AI module key is
 * `task_management`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="task-management"
      categoryKey="ai-stack"
      staticScreens={TASK_MANAGEMENT_AI_STACK_SCREENS}
    />
  );
}
