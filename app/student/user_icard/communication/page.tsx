'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { USER_COMMUNICATION_SCREENS } from '@/app/user/communication/_screens/user-communication-screens';

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

