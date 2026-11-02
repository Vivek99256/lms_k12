'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { STUDENT_COMMUNICATION_SCREENS } from './_screens/student-communication-screens';

export default function StudentCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="student"
      categoryKey="communication"
      staticScreens={STUDENT_COMMUNICATION_SCREENS}
      platformModuleKey="students"
    />
  );
}

