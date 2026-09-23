'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { CURRICULUM_PLANNING_AI_STACK_SCREENS } from '@/app/lms/curriculum-planning/ai-stack/_screens/ai-stack-screens';

/**
 * Curriculum Planning -> ai-stack, at the module's own route under /lms/curriculum-planning.
 *
 * The seeded menu row points at `/modules/curriculum-planning/ai-stack`, which serves the
 * same tabs through the shared dynamic route (see `module-static-screens.tsx`). This page
 * exists so the direct path works too, the same way Exam's `/exam/ai-stack` does.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="curriculum-planning"
      categoryKey="ai-stack"
      staticScreens={CURRICULUM_PLANNING_AI_STACK_SCREENS}
    />
  );
}
