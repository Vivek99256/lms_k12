'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { USER_COMMUNICATION_SCREENS } from '@/app/user/communication/_screens/user-communication-screens';

/**
 * Users / Staff Communication page.
 *
 * Mounts ModuleCategoryPage with dedicated staff communication tabs
 * (Send notice, Delivery log, Notification settings) and modern pill tab strip.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="user-i-card"
      categoryKey="communication"
      staticScreens={USER_COMMUNICATION_SCREENS}
      platformModuleKey="hr"
    />
  );
}

