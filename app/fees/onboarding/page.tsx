'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';

/**
 * Fees → Onboarding.
 *
 * Unlike the other Fees categories this is not a tab strip over Fees menus:
 * onboarding a module is the same journey everywhere, already built and backed
 * by real data under /general/onboarding/fees.
 *
 * It used to render that journey directly with the key written in. It now goes
 * through the shared category page like every other module's Onboarding tab, so
 * there is one implementation of this screen rather than one per module; the
 * key comes from the category row. 'fees' stays as the fallback only for an
 * installation that has not yet run the mapping migration.
 */
export default function Page() {
  return (
    <ModuleCategoryPage moduleName="fees" categoryKey="onboarding" onboardingModuleKey="fees" />
  );
}
