'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { STUDENTS_AI_STACK_SCREENS } from '@/app/student/ai-stack/_screens/ai-stack-screens';

/**
 * Student → ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/student/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too — it is
 * the address the module's other screens are written under (`/student/…`), it is what
 * somebody types, and it is the convention Fees, Teach/Learn and Attendance already follow.
 *
 * Both render the identical screen list from one module, so there is no second AI Stack to
 * keep in step.
 *
 * `moduleName="student"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by — it is derived from the level-2 menu's own name. The AI module key is
 * `students`, and it is never typed into a screen: every screen imports it from
 * `lib/students/students-ai-stack`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="student" categoryKey="ai-stack" staticScreens={STUDENTS_AI_STACK_SCREENS} />;
}
