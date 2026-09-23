'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { PTM_AI_STACK_SCREENS } from '@/app/admin-services/ptm-ai-stack/_screens/ai-stack-screens';

/**
 * PTM -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/ptm/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too.
 *
 * WHY IT LIVES UNDER `/admin-services`
 *
 * Because the PTM screens do. `app/data/routeMapper.ts` maps every PTM Laravel route to
 * `/admin-services/ptm-attended-status`, `/admin-services/ptm-report` and
 * `/admin-services/ptm-time-slot-master`, so this follows the naming its siblings already
 * use rather than inventing a `/ptm` root that nothing else in the app serves. The route
 * is registered on the PTM module's `ai_modules` row one path at a time - never as
 * `/admin-services/**`, which belongs to the admin-services module and covers visitors,
 * complaints and petty cash as well.
 *
 * Both routes render the identical screen list from one module, so there is no second AI
 * Stack to keep in step.
 *
 * `moduleSlug="ptm"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by. The AI module key is also `ptm`, and it is never typed into a screen:
 * every screen takes it from the descriptor in `lib/ptm/ptm-ai-stack.ts`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleSlug="ptm" categoryKey="ai-stack" staticScreens={PTM_AI_STACK_SCREENS} />;
}
