'use client'

import { useRouter } from 'next/navigation'

export function useSidebarNavigation() {
  const router = useRouter()

  const resolveAccessLink = (link: string) => {
    return link
  }

  return { resolveAccessLink, router }
}

export const EMPLOYEE_DIRECTORY_ACCESS_LINK = '/organization-management/employee-directory'
export const CAPABILITY_LIBRARY_ACCESS_LINK = '/capability-intelligence/capability-library'
