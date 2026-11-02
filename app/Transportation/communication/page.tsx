'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { TRANSPORT_COMMUNICATION_SCREENS } from './_screens/transport-communication-screens';

export default function TransportationCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="transport"
      categoryKey="communication"
      staticScreens={TRANSPORT_COMMUNICATION_SCREENS}
      platformModuleKey="transportation"
    />
  );
}

