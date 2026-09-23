'use client';

import { ModuleCategoryPage } from '@/app/modules/_components/module-category-page';
import { VISITOR_AI_STACK_SCREENS } from '@/app/admin-services/visitor-ai-stack/_screens/ai-stack-screens';

/**
 * Visitor Management -> ai-stack, at the module's own route.
 *
 * The seeded menu row points at `/modules/visitor-management/ai-stack`, which serves the same tabs
 * through the shared dynamic route. This page exists so the direct path works too, and it
 * renders the identical screen list - there is no second AI Stack to keep in step.
 *
 * It sits in the admin-services tree beside the add-visitor and visitor-report screens, in
 * its own folder - the same convention PTM's AI Stack follows in the same tree.
 *
 * The Hostel module's `/hostel/visitor-details` and `/hostel/visitor-report` are NOT
 * claimed by this module. They are a different register over a different table, kept by
 * different people, and taking them would merge two counts that must stay apart.
 *
 * `moduleSlug="visitor-management"` is the MENU slug and the AI module key is
 * `visitor_management`.
 */
export default function Page() {
  return (
    <ModuleCategoryPage
      moduleSlug="visitor-management"
      categoryKey="ai-stack"
      staticScreens={VISITOR_AI_STACK_SCREENS}
    />
  );
}
