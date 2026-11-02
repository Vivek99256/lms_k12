'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { EXAM_COMMUNICATION_SCREENS } from './_screens/exam-communication-screens';

export default function ExamCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="exam"
      categoryKey="communication"
      staticScreens={EXAM_COMMUNICATION_SCREENS}
      platformModuleKey="exam"
    />
  );
}

