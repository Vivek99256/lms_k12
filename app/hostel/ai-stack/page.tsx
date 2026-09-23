'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { HOSTEL_AI_STACK_SCREENS } from '@/app/hostel/ai-stack/_screens/ai-stack-screens';

/**
 * Hostel -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/hostel/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too - it is
 * the address the module's other screens are written under (`/hostel/...`), and the Hostel
 * row in `ai_modules` has carried `/hostel/**` since the workspace was seeded.
 *
 * Both render the identical screen list from one module, so there is no second AI Stack to
 * keep in step.
 *
 * `moduleSlug="hostel"` is the MENU slug, which is what `ModuleCategoryPage` looks the
 * category up by. The AI module key is also `hostel`, and it is never typed into a screen:
 * every screen takes it from the descriptor in `lib/hostel/hostel-ai-stack.ts`.
 */
export default function Page() {
  return <ModuleCategoryPage moduleSlug="hostel" categoryKey="ai-stack" staticScreens={HOSTEL_AI_STACK_SCREENS} />;
}
