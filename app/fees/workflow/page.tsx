'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_WORKFLOW_SCREENS } from '@/app/fees/workflow/_screens/workflow-screens';

/**
 * Fees → Workflow. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tab, which renders the central workflow console scoped to
 * Fees. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="workflow" staticScreens={FEES_WORKFLOW_SCREENS} />;
}
