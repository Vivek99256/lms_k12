'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ATTENDANCE_COMMUNICATION_SCREENS } from '@/app/attendance/communication/_screens/attendance-communication-screens';

/**
 * Attendance Communication page.
 *
 * Mounts ModuleCategoryPage with dedicated attendance communication tabs
 * (Send notice, Delivery log, Notification settings) and modern pill tab strip.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="attendance"
      categoryKey="communication"
      staticScreens={ATTENDANCE_COMMUNICATION_SCREENS}
      platformModuleKey="attendance"
    />
  );
}

