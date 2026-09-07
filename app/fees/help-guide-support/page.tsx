'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_HELP_SUPPORT_SCREENS } from '@/app/fees/help-guide-support/_screens/help-guide-support-screens';

/**
 * Fees → help-guide-support. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="help-guide-support" staticScreens={FEES_HELP_SUPPORT_SCREENS} />;
}
