'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { STUDENT_ICARD_AI_STACK_SCREENS } from '@/app/student/student_icard/ai-stack/_screens/ai-stack-screens';

/**
 * Student I-Card -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/student-i-card/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the I-card screen itself at `/student/student_icard`.
 *
 * WHY `/student/student_icard` DOES NOT BELONG TO THE STUDENTS MODULE
 *
 * The Students module claims `/student/**`, and `RouteMatcher::best()` scores literal
 * segments above wildcards - `/student/student_icard` scores 20 against 11. So this page
 * resolves to `student_icard` and every other student page is untouched.
 *
 * `moduleSlug="student-i-card"` is the MENU slug, hyphenated because it is derived from the
 * level-2 menu's own name. The AI module key is `student_icard`, underscored, and it is
 * never typed into a screen.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="student-i-card"
      categoryKey="ai-stack"
      staticScreens={STUDENT_ICARD_AI_STACK_SCREENS}
    />
  );
}
