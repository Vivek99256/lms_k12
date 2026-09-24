'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { COMPLAINT_AI_STACK_SCREENS } from '@/app/admin-services/complaint-ai-stack/_screens/ai-stack-screens';

/**
 * Complaint -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/complaint/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits in the admin-services tree beside the complaint management and complaint report
 * screens, in its own folder - the same convention PTM, Petty Cash, Consent and Visitor
 * Management follow in that tree. The path is named individually in the module's route
 * patterns and is more specific than the admin-services module's `/admin-services/**`.
 *
 * `moduleSlug="complaint"` is the MENU slug and the AI module key is also `complaint`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="complaint"
      categoryKey="ai-stack"
      staticScreens={COMPLAINT_AI_STACK_SCREENS}
    />
  );
}
