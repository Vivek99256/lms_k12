'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { PETTY_CASH_AI_STACK_SCREENS } from '@/app/admin-services/petty-cash-ai-stack/_screens/ai-stack-screens';

/**
 * Petty Cash -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/petty-cash/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits in the admin-services tree beside the petty cash screens, in its own folder
 * rather than under `/admin-services/petty-cash`, which is the convention PTM's AI Stack
 * already follows in the same tree. The path is named individually in the module's route
 * patterns and is more specific than the admin-services module's `/admin-services/**`, so
 * it resolves here without admin-services losing anything.
 *
 * `moduleSlug="petty-cash"` is the MENU slug and the AI module key is `petty_cash`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="petty-cash"
      categoryKey="ai-stack"
      staticScreens={PETTY_CASH_AI_STACK_SCREENS}
    />
  );
}
