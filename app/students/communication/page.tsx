'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { STUDENT_COMMUNICATION_SCREENS } from '@/app/student/communication/_screens/student-communication-screens';

export default function StudentsCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="students"
      categoryKey="communication"
      staticScreens={STUDENT_COMMUNICATION_SCREENS}
      platformModuleKey="students"
    />
  );
}

