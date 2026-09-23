'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Teach/Learn → onboarding. One of the ten Teach/Learn category pages; all ten
 * share ModuleCategoryPage and differ only by which category they render.
 *
 * Onboarding renders the module's journey rather than a tab strip; 'lms' is the
 * fallback key for an installation that has not yet run the mapping migration,
 * matching /onboarding/lms, which is where this module's category row points.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="teach_learn"
      categoryKey="onboarding"
      onboardingModuleKey="lms"
    />
  );
}
