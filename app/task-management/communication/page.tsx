'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { TASK_MANAGEMENT_COMMUNICATION_SCREENS } from './_screens/task-communication-screens';

/** Task Management -> communication, at the module's own route; same tabs as the shared dynamic route. */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="task-management"
      categoryKey="communication"
      staticScreens={TASK_MANAGEMENT_COMMUNICATION_SCREENS}
    />
  );
}
