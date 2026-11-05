'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { TALENT_MANAGEMENT_COMMUNICATION_SCREENS } from './_screens/talent-communication-screens';

/** Talent Management -> communication, at the module's own route; same tabs as the shared dynamic route. */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="talent-management"
      categoryKey="communication"
      staticScreens={TALENT_MANAGEMENT_COMMUNICATION_SCREENS}
    />
  );
}
