'use client'

/**
 * Organization Management -> Employee Directory.
 *
 * Mirrors G2G's `app/organization/employees/page.tsx` wrapper convention
 * (lazy import + Suspense boundary) and this project's sibling
 * `role-and-permissions/page.tsx` layout.
 */

import { lazy, Suspense } from 'react'

const LazyEmployeeDirectory = lazy(() =>
  import('./components/employee-directory').then((module) => ({ default: module.EmployeeDirectory })),
)

export default function EmployeeDirectoryPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col p-6 md:p-8">
      <Suspense fallback={<div className="h-full rounded-2xl bg-muted/40 animate-pulse" />}>
        <LazyEmployeeDirectory />
      </Suspense>
    </div>
  )
}
