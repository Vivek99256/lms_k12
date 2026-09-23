'use client';

<<<<<<< HEAD
import { FeesIntelligenceScreen } from '@/app/fees/intelligence/_components/fees-intelligence-screen';
=======
import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { FEES_INTELLIGENCE_SCREENS } from '@/app/fees/intelligence/_screens/intelligence-screens';
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

/**
 * Fees → Intelligence.
 *
<<<<<<< HEAD
 * Renders the native Fees Intelligence workspace directly, matching the standard
 * module pattern. This eliminates the redundant top-level strip ("Fees Intelligence" + dot)
 * while preserving the module's hero card, analytics, and horizontal section navigation.
 */
export default function Page() {
  return <FeesIntelligenceScreen />;
=======
 * Shares ModuleCategoryPage with the other Fees categories, and supplies the
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
  return <ModuleCategoryPage moduleName="fees" categoryKey="intelligence" staticScreens={FEES_INTELLIGENCE_SCREENS} />;
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
}

