'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { INTERACTIONS_AI_STACK_SCREENS } from '@/app/interactions/ai-stack/_screens/ai-stack-screens';

/**
 * Interactions -> ai-stack. The seeded menu row points at
 * `/modules/interactions/ai-stack`, which serves the same tabs through the shared dynamic
 * route (see `module-static-screens.tsx`). This page exists so the direct path works too.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="interactions" categoryKey="ai-stack" staticScreens={INTERACTIONS_AI_STACK_SCREENS} />;
}
