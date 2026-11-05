'use client'

/**
 * Talent Management -> Onboarding & Employee Lifecycle Center.
 *
 * Ported from G2G's `app/(dashboard)/talent-management/onboarding/page.tsx`
 * (a thin wrapper around `OnboardingCenter`). See `components/onboarding-
 * center.tsx` for the actual screen and its module doc comment for the one
 * G2G-only dependency (`useSidebarNavigation`) that has no target equivalent
 * yet.
 */

import { OnboardingCenter } from './components'
import { TalentTheme } from '../_lib/talent-theme'

function OnboardingPageInner() {
  return <OnboardingCenter />
}

export default function OnboardingPage() {
  return (
    <TalentTheme>
      <OnboardingPageInner />
    </TalentTheme>
  )
}
