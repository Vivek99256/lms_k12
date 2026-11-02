'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { MOBILE_APPS_COMMUNICATION_SCREENS } from './_screens/mobile-apps-communication-screens';

export default function MobileAppsCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="mobile-apps"
      categoryKey="communication"
      staticScreens={MOBILE_APPS_COMMUNICATION_SCREENS}
      platformModuleKey="mobile-apps"
    />
  );
}

