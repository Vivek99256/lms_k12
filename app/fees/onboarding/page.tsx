'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_ONBOARDING_SCREENS } from '@/app/fees/onboarding/_screens/onboarding-screens';

/**
 * Fees → onboarding. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tabs, which are static placeholders until these screens are
 * built. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="onboarding" staticScreens={FEES_ONBOARDING_SCREENS} />;
}
