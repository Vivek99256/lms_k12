'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { TEACH_LEARN_COMMUNICATION_SCREENS } from './_screens/teach-learn-communication-screens';

export default function TeachLearnCommunicationPage() {
  return (
    <ModuleCategoryPage
      moduleName="teach_learn"
      categoryKey="communication"
      staticScreens={TEACH_LEARN_COMMUNICATION_SCREENS}
      platformModuleKey="teach_learn"
    />
  );
}
