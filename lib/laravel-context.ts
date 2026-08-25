import { buildSessionContext, type SessionContext } from '@/lib/erp-client'

export function getLaravelContext(user: { name?: string | null; email?: string | null } | null): SessionContext {
  return buildSessionContext()
}
