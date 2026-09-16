'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_INTELLIGENCE_SCREENS } from '@/app/fees/intelligence/_screens/intelligence-screens';

/**
 * Fees → Intelligence.
 *
 * Shares FeesCategoryPage with the other Fees categories, and supplies the
 * native Fees Intelligence workspace as its first tab. The workspace renders
 * INSIDE the LMS against this institute's own fee records — it does not
 * redirect to the Enterprise Brain application or embed an external page.
 *
 * Any Intelligence menu the user has rights to ("Fees Prediction") still comes
 * from the database and follows it, so nothing that worked before is hidden.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="intelligence" staticScreens={FEES_INTELLIGENCE_SCREENS} />;
}
