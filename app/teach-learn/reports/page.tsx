'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { TEACH_LEARN_REPORT_SCREENS } from './_screens/teach-learn-report-screens';

/**
 * Teach/Learn → reports.
 * Renders the comprehensive Teach/Learn reporting suite including instructional delivery,
 * curriculum attainment, exam progress, question analysis, and student learning trends.
 */
export default function TeachLearnReportsPage() {
  return (
    <ModuleCategoryPage
      moduleName="teach_learn"
      categoryKey="reports"
      staticScreens={TEACH_LEARN_REPORT_SCREENS}
      platformModuleKey="teach_learn"
    />
  );
}
