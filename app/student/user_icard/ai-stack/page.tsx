'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { USER_ICARD_AI_STACK_SCREENS } from '@/app/student/user_icard/ai-stack/_screens/ai-stack-screens';

/**
 * User I-Card -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/user-i-card/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the staff card screen at `/student/user_icard`, which is where
 * `routeMapper` sends the User I-Card menu. That path is named individually in the
 * module's route patterns and is more specific than the Students module's `/student/**`,
 * so it resolves here without Students losing anything.
 *
 * `/student/student_icard` next door belongs to the SEPARATE Student I-Card module and is
 * not claimed by this route. One prints a card for a member of staff and one for a child;
 * they read different tables and neither can reach the other's.
 *
 * `moduleSlug="user-i-card"` is the MENU slug; the AI module key is `user_icard`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="user-i-card"
      categoryKey="ai-stack"
      staticScreens={USER_ICARD_AI_STACK_SCREENS}
    />
  );
}
