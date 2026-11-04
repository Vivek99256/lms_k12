'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { HOSTEL_COMMUNICATION_SCREENS } from './_screens/hostel-communication-screens';

export default function HostelCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="hostel"
      categoryKey="communication"
      staticScreens={HOSTEL_COMMUNICATION_SCREENS}
      platformModuleKey="hostel"
    />
  );
}

