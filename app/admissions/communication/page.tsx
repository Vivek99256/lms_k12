'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ADMISSION_COMMUNICATION_SCREENS } from '@/app/admissions/communication/_screens/admission-communication-screens';

/**
 * Admissions → Communication page.
 *
 * Mounts ModuleCategoryPage with dedicated admission communication tabs
 * (Send notice, Delivery log, Notification settings) and modern pill tab strip.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="admission"
      categoryKey="communication"
      staticScreens={ADMISSION_COMMUNICATION_SCREENS}
    />
  );
}

