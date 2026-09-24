'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { STUDENT_MEDICAL_AI_STACK_SCREENS } from '@/app/student/student_infirmary/ai-stack/_screens/ai-stack-screens';

/**
 * Student Medical -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/student-medical/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the Student Infirmary screen at `/student/student_infirmary`, the first of
 * the module's four level-3 rows. All four - infirmary, vaccination, height/weight and
 * health - are claimed by the module's `ai_modules` route patterns one path at a time, each
 * more specific than the Students module's `/student/**`.
 *
 * `moduleSlug="student-medical"` is the MENU slug. The AI module key is `student_medical`,
 * underscored, and it is never typed into a screen.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="student-medical"
      categoryKey="ai-stack"
      staticScreens={STUDENT_MEDICAL_AI_STACK_SCREENS}
    />
  );
}
