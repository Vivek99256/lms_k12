'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { STUDENT_REQUEST_AI_STACK_SCREENS } from '@/app/students/requests/ai-stack/_screens/ai-stack-screens';

/**
 * Student Request -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/student-request/ai-stack`, which serves the same
 * tabs through the shared dynamic route. This page exists so the direct path works too -
 * it sits beside the Student Request screens themselves, which the level-3 menu points at
 * as `/students/requests/`.
 *
 * WHY `/students/requests/**` DOES NOT BELONG TO THE STUDENTS MODULE
 *
 * The Students module claims `/students/**`, and `RouteMatcher::best()` scores literal
 * segments above wildcards - `/students/requests` scores 20 against `/students/**` at 11.
 * So this page resolves to `student_request` and every other student page is untouched.
 * Nothing was removed from the Students row to make that work.
 *
 * `moduleName="student-request"` is the MENU slug, hyphenated because it is derived from
 * the level-2 menu's own name. The AI module key is `student_request`, underscored, and it
 * is never typed into a screen: every screen takes it from the descriptor in
 * `lib/student-requests/student-requests-ai-stack.ts`. The two spellings are each correct
 * for what they name and neither has to match the other.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="student-request"
      categoryKey="ai-stack"
      staticScreens={STUDENT_REQUEST_AI_STACK_SCREENS}
    />
  );
}
