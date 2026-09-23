'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ATTENDANCE_AI_STACK_SCREENS } from '@/app/attendance/ai-stack/_screens/ai-stack-screens';

/**
 * Attendance → ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/attendance/ai-stack`, which serves the same
 * tabs through the shared dynamic route. This page exists so the direct path works too —
 * it is the address the module's other screens are written under, it is what somebody
 * types, and it is the convention Fees and Teach/Learn already follow.
 *
 * Both render the identical screen list from one module, so there is no second AI Stack
 * to keep in step.
 */
export default function Page() {
  return (
    <ModuleCategoryPage moduleName="attendance" categoryKey="ai-stack" staticScreens={ATTENDANCE_AI_STACK_SCREENS} />
  );
}
