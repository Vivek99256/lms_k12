'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { CERTIFICATE_AI_STACK_SCREENS } from '@/app/student/student_certificate/ai-stack/_screens/ai-stack-screens';

/**
 * Certificate -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/certificate/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits beside the Certificate screen itself at `/student/student_certificate`, which is
 * more specific than the Students module's `/student/**` and therefore wins that route
 * without anything being removed from the Students row.
 *
 * `moduleName="certificate"` is the MENU slug and the AI module key is also `certificate`;
 * for this module the two happen to agree, and nothing depends on their agreeing.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="certificate"
      categoryKey="ai-stack"
      staticScreens={CERTIFICATE_AI_STACK_SCREENS}
    />
  );
}
