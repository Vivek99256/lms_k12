'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ORG_COMMUNICATION_SCREENS } from './_screens/org-communication-screens';

export default function OrganizationManagementCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="organization-management"
      categoryKey="communication"
      staticScreens={ORG_COMMUNICATION_SCREENS}
    />
  );
}
