'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_SCHEDULER_SCREENS } from '@/app/fees/scheduler/_screens/scheduler-screens';

/**
 * Fees → Scheduler. Shares FeesCategoryPage with the other Fees categories and
 * supplies its own tab, which renders the central scheduler console scoped to
 * Fees. Any real menu the user has rights to still comes from the database and
 * follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="scheduler" staticScreens={FEES_SCHEDULER_SCREENS} />;
}
