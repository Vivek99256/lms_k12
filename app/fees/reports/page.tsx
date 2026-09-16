'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_REPORTS_SCREENS } from '@/app/fees/reports/_screens/reports-screens';

/**
 * Fees → reports. One of the seven Fees category pages; all seven share
 * FeesCategoryPage and differ only by which category they render.
 *
 * Its database menus come first and the Audit trail tab follows, so the
 * category still opens on the collection report it always opened on.
 */
export default function Page() {
  return (
    <FeesCategoryPage
      categoryKey="reports"
      staticScreens={FEES_REPORTS_SCREENS}
      staticScreensPlacement="after"
    />
  );
}
