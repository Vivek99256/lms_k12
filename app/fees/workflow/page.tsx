'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { FEES_WORKFLOW_SCREENS } from '@/app/fees/workflow/_screens/workflow-screens';

/**
 * Fees → Workflow. Shares ModuleCategoryPage with the other Fees categories and
 * supplies its own tab, which renders the central workflow console scoped to
 * Fees. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="workflow" staticScreens={FEES_WORKFLOW_SCREENS} />;
}
