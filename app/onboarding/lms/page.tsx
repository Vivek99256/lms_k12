'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Teach/Learn → Onboarding, at the route that module's category row points at.
 *
 * Renders the shared category page, which shows the journey named by the
 * category row, so this tab behaves exactly like Onboarding in every other
 * module. 'lms' is the fallback for an installation that has not yet run the
 * mapping migration.
 *
 * No back link: this sits inside the Teach/Learn category bar, which is where
 * the user came from.
 */
export default function LmsOnboardingPage() {
  return (
    <ModuleCategoryPage
      moduleName="teach_learn"
      categoryKey="onboarding"
      onboardingModuleKey="lms"
    />
  );
}
