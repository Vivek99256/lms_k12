'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { NEW_PAL_AI_STACK_SCREENS } from '@/app/pal/new/ai-stack/_screens/ai-stack-screens';

/**
 * New PAL -> ai-stack. The seeded menu row points at `/modules/new-pal/ai-stack`, which
 * serves the same tabs through the shared dynamic route (see `module-static-screens.tsx`).
 * This page exists so the direct path under `/pal/new` works too.
 */
export default function Page() {
  return <ModuleCategoryPage moduleSlug="new-pal" categoryKey="ai-stack" staticScreens={NEW_PAL_AI_STACK_SCREENS} />;
}
