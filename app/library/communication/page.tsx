'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { LIBRARY_COMMUNICATION_SCREENS } from '@/app/library/communication/_screens/library-communication-screens';

/**
 * Library Communication page.
 *
 * Mounts ModuleCategoryPage with dedicated library communication tabs
 * (Send notice, Delivery log, Notification settings) and modern pill tab strip.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="library"
      categoryKey="communication"
      staticScreens={LIBRARY_COMMUNICATION_SCREENS}
      platformModuleKey="library"
    />
  );
}

