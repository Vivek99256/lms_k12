'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { CONSENT_AI_STACK_SCREENS } from '@/app/admin-services/consent-ai-stack/_screens/ai-stack-screens';

/**
 * Consent -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/consent/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits in the admin-services tree beside the consent master and consent report screens,
 * in its own folder - the same convention PTM's AI Stack follows in the same tree. The
 * path is named individually in the module's route patterns and is more specific than the
 * admin-services module's `/admin-services/**`.
 *
 * `moduleName="consent"` is the MENU slug and the AI module key is also `consent`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleName="consent"
      categoryKey="ai-stack"
      staticScreens={CONSENT_AI_STACK_SCREENS}
    />
  );
}
