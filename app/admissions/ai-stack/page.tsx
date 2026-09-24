'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { ADMISSIONS_AI_STACK_SCREENS } from '@/app/admissions/ai-stack/_screens/ai-stack-screens';

/**
 * Admission → ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/admission/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too — it is
 * the address the module's other screens are written under (`/admissions/…`), it is what
 * somebody types, and it is the convention Fees, Teach/Learn and Attendance already follow.
 *
 * Both render the identical screen list from one module, so there is no second AI Stack to
 * keep in step.
 *
 * `moduleSlug="admission"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by — it is derived from the level-2 menu's own name. The AI module key is
 * `admissions`, and it is never typed into a screen: every screen imports it from
 * `lib/admissions/admissions-ai-stack`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage moduleSlug="admission" categoryKey="ai-stack" staticScreens={ADMISSIONS_AI_STACK_SCREENS} />
  );
}
