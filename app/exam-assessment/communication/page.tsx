'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { EXAM_COMMUNICATION_SCREENS } from '@/app/exam/communication/_screens/exam-communication-screens';

export default function ExamAssessmentCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="exam-assessment"
      categoryKey="communication"
      staticScreens={EXAM_COMMUNICATION_SCREENS}
      platformModuleKey="exam"
    />
  );
}

