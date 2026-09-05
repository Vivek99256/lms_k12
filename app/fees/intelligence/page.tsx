'use client';

import { FeesCategoryPage } from '@/app/fees/_components/fees-category-page';
import { FEES_INTELLIGENCE_SCREENS } from '@/app/fees/intelligence/_screens/intelligence-screens';

/**
 * Fees → intelligence. Shares FeesCategoryPage with the other Fees categories,
 * and additionally supplies the Intelligence workspace tabs, which are static
 * placeholders for now. Any real Intelligence menu the user has rights to
 * ("Fees Prediction") still comes from the database and follows them.
 */
export default function Page() {
  return <FeesCategoryPage categoryKey="intelligence" staticScreens={FEES_INTELLIGENCE_SCREENS} />;
}
