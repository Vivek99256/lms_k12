'use client'

/**
 * Shares one useIntegrationManagement() instance across the Integration
 * layout (card grid) and whichever nested /integration/* route is active,
 * so switching between integration cards doesn't re-fetch configs from
 * scratch — same hook, same logic, one call site instead of one per route.
 */

import { createContext, useContext, type ReactNode } from 'react'

import { useIntegrationManagement } from './use-integration-management'

type IntegrationManagementValue = ReturnType<typeof useIntegrationManagement>

const IntegrationContext = createContext<IntegrationManagementValue | null>(null)

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const value = useIntegrationManagement()
  return <IntegrationContext.Provider value={value}>{children}</IntegrationContext.Provider>
}

export function useIntegrationContext(): IntegrationManagementValue {
  const ctx = useContext(IntegrationContext)
  if (!ctx) {
    throw new Error('useIntegrationContext must be used within an Integration route (app/integration/layout.tsx)')
  }
  return ctx
}
