'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { NEW_PAL_AI_STACK_SCREENS } from '@/app/pal/new/ai-stack/_screens/ai-stack-screens';

/**
 * New PAL -> ai-stack. The seeded menu row points at `/modules/new-pal/ai-stack`, which
 * serves the same tabs through the shared dynamic route (see `module-static-screens.tsx`).
 * This page exists so the direct path under `/pal/new` works too.
 *
 * Renders through the SAME shared `ModuleCategoryPage` (`app/_components/module-category-page`)
 * every other module's AI Stack uses — Exam, Attendance, Exam & Assessment. It takes
 * `moduleName`, not the pared-down `app/modules/_components/module-category-page`'s
 * `moduleSlug`, and critically renders `staticScreens` as a real horizontal tab strip with
 * one active pane. The pared-down component instead stacks every static screen's full
 * content vertically on one page (`<div className="space-y-4">…`), which is why Policies,
 * Models, Prompts etc. were appearing one below another instead of as tabs. Nothing else
 * about this page changed: same screens, same module slug, same route.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="new-pal" categoryKey="ai-stack" staticScreens={NEW_PAL_AI_STACK_SCREENS} />;
}
