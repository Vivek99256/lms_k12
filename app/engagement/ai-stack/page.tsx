'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ENGAGEMENT_AI_STACK_SCREENS } from '@/app/engagement/ai-stack/_screens/ai-stack-screens';

/**
 * Engagement -> ai-stack. The seeded menu row points at
 * `/modules/engagement/ai-stack`, which serves the same tabs through the shared dynamic
 * route (see `module-static-screens.tsx`). This page exists so the direct path works too.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="engagement" categoryKey="ai-stack" staticScreens={ENGAGEMENT_AI_STACK_SCREENS} />;
}
