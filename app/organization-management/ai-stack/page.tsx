'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { INSTITUTE_AI_STACK_SCREENS } from '@/app/organization-management/ai-stack/_screens/ai-stack-screens';

/**
 * Institute -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/institute/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits under `/organization-management`, which is where this estate's institute screens
 * live - `/Institute_Detail` is the route the seeded `institute` module row carries but
 * has no page in this application.
 *
 * `moduleSlug="institute"` is the MENU slug and the AI module key is also `institute`. The
 * seeded menu row points at `/modules/institute/ai-stack`, which serves the same tabs
 * through the shared dynamic route.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="institute"
      categoryKey="ai-stack"
      staticScreens={INSTITUTE_AI_STACK_SCREENS}
    />
  );
}
