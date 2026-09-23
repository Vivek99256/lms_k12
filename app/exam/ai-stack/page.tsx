'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { EXAM_AI_STACK_SCREENS } from '@/app/exam/ai-stack/_screens/ai-stack-screens';

/**
 * Exam -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/exam/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too - it is
 * the address the module's other screens are written under (`/exam/...`), it is what
 * somebody types, and it is the convention Fees, Attendance, Admission and Student already
 * follow.
 *
 * Both render the identical screen list from one module, so there is no second AI Stack to
 * keep in step.
 *
 * `moduleSlug="exam"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by. The AI module key is also `exam`, and it is never typed into a screen:
 * every screen takes it from the descriptor in `lib/exam/exam-ai-stack.ts`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleSlug="exam" categoryKey="ai-stack" staticScreens={EXAM_AI_STACK_SCREENS} />;
}
