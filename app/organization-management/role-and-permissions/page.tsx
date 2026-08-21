'use client'

/**
 * Organization Management -> Role and Permissions.
 *
 * G2G has no dedicated route for this screen yet (it only exists as
 * `components/domain/organization/role-permissions.tsx`, not wired to an
 * `app/organization/**` page) - this route + wrapper is new, mirroring the
 * `app/organization/employees/page.tsx` wrapper convention (max-width
 * container, `Suspense` boundary) with the height RolePermissions' own
 * `h-full min-h-0` flex layout expects.
 */

import { lazy, Suspense } from 'react'

const LazyRolePermissions = lazy(() =>
  import('./components/role-permissions').then((module) => ({ default: module.RolePermissions })),
)

export default function RoleAndPermissionsPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col p-6 md:p-8">
      <Suspense fallback={<div className="h-full rounded-2xl bg-muted/40 animate-pulse" />}>
        <LazyRolePermissions />
      </Suspense>
    </div>
  )
}
