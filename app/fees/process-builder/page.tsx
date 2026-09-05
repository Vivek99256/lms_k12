'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_PROCESS_BUILDER_SCREENS } from '@/app/fees/process-builder/_screens/process-builder-screens';

/**
 * Fees → process-builder. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="process-builder" staticScreens={FEES_PROCESS_BUILDER_SCREENS} />;
}
