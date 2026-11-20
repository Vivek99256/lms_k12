'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { FEES_RECOMMENDATION_SCREENS } from '@/app/fees/recommendation/_screens/recommendation-screens';

/**
 * Fees → Recommendation.
 *
 * A dedicated route, like Fees' other categories (`intelligence`,
 * `ai-stack`, `communication`), rather than the generic
 * `/modules/[moduleKey]/[categoryKey]` dynamic route the platform-wide
 * Knowledge Graph tab uses — Fees pages bypass that route entirely, so
 * `module-static-screens.tsx` needs no change for this.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="recommendation" staticScreens={FEES_RECOMMENDATION_SCREENS} />;
}
