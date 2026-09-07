'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_COMMUNICATION_SCREENS } from '@/app/fees/communication/_screens/communication-screens';

/**
 * Fees → communication. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="communication" staticScreens={FEES_COMMUNICATION_SCREENS} />;
}
