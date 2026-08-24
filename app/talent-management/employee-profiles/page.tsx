'use client'

/**
 * Ported from G2G's `components/domain/competency/cm-employee-profiles.tsx`
 * (`CmEmployeeProfiles`). This page route is new in this project's routing
 * (mirrors `mobility-and-succession/page.tsx` and every other
 * talent-management feature area): it just mounts the ported
 * `EmployeeProfilesCenter`. No `<Suspense>` boundary is needed — unlike
 * `recruitment`'s page, this screen doesn't read `useSearchParams()`.
 */

import { EmployeeProfilesCenter } from './components/employee-profiles-center'

export default function EmployeeProfilesPage() {
  return <EmployeeProfilesCenter />
}
