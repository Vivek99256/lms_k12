'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { FEES_COMMUNICATION_SCREENS } from '@/app/fees/communication/_screens/communication-screens';

/**
 * Fees → communication. Shares ModuleCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <ModuleCategoryPage moduleName="fees" categoryKey="communication" staticScreens={FEES_COMMUNICATION_SCREENS} />;
}
