'use client';

import { PageFrame } from '@/app/fees/_components/fees-shared';
import { ModuleJourney } from '@/app/general/onboarding/_components/ModuleJourney';

/**
 * Fees → Onboarding.
 *
 * Unlike the other Fees categories this is not a tab strip over Fees menus:
 * onboarding a module is the same journey everywhere, already built and backed
 * by real data under /general/onboarding/fees. So this route renders that same
 * journey rather than the placeholder tabs it used to show. No Back button —
 * the Fees category bar above is where the user came from.
 */
export default function Page() {
  return (
    <PageFrame>
      <ModuleJourney moduleKey="fees" />
    </PageFrame>
  );
}
