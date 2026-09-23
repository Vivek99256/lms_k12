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
 * THIS PAGE MUST NOT `redirect()`. It briefly did, to
 * /enterprise-brain/foundation/students, and that is the precise behaviour this
 * screen exists to replace: sending a bursar looking for the fee position to a
 * general student-foundation view that answers none of their questions and is
 * scoped to neither the Fees module nor, on that route, the academic year the
 * header has selected. A redirect here also makes the two imports above dead
 * code, which is the visible symptom of the same mistake.
 *
 * Any Intelligence menu the user has rights to ("Fees Prediction") still comes
 * from the database and follows the workspace tab, so nothing that worked
 * before is hidden.
 */
export default function Page() {
  return (
    <FeesCategoryPage
      categoryKey="intelligence"
      staticScreens={FEES_INTELLIGENCE_SCREENS}
      // The category title card is dropped HERE and nowhere else: the Fees
      // Intelligence hero underneath already carries the heading, the sentence
      // and the organization/year/coverage/freshness facts, so the category row
      // above it was the same screen announced twice. The category's tab strip
      // is untouched, so every Intelligence menu a tenant has rights to still
      // appears beside the workspace tab.
      hideCategoryHeader
    />
  );
}
