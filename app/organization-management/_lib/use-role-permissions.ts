'use client'

/**
 * Ported from G2G's `hooks/use-role-permissions.ts`.
 *
 * Transport adaptation only: G2G resolves a `LaravelContext` via
 * `useLaravelContext()` and drives `getRoles`/`getRights`/`saveRights`/
 * `createRole` through `@tanstack/react-query` (`useQuery`/`useMutation`/
 * `useQueryClient`). LMS-K12 doesn't use a query library (see
 * `app/talent-management/_lib/use-onboarding.ts` for the established
 * pattern), so this is plain `useState`/`useEffect`/`useCallback`, with
 * `buildSessionContext()` called fresh inside each load/save callback instead
 * of a memoised Laravel context. Every returned field, loading/error
 * handling and mutation semantics (including "saving invalidates the rights
 * query, since editing the role you are signed in under changes your own
 * menu") are otherwise unchanged - there's just no query cache to invalidate,
 * so a fresh `getRights` call takes its place.
 *
 * Drives the Role & Permissions screen off the role-permissions rights
 * endpoint: the roles list, the selected role's rights over menu levels 1-3,
 * the local edits, and the save that rewrites them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { buildSessionContext, menuRightsService, type RoleProfile, type SessionContext } from './role-permissions-api'
import { isRolePermissionsSessionReady } from './role-permissions-api'
import {
  applyAction,
  applyModuleColumn,
  applyNodeAll,
  toPermissionTree,
  toRightsPayload,
  type ActionKey,
  type PermissionNode,
} from './role-permissions-tree'

export interface RolePermissionsResult {
  roles: RoleProfile[]
  rolesLoading: boolean
  activeRoleId: string
  activeRole: RoleProfile | undefined
  setActiveRoleId: (roleId: string) => void

  permissions: PermissionNode[]
  permissionsLoading: boolean
  error: string | null

  hasChanges: boolean
  saving: boolean
  /** Bumped whenever a fresh tree is loaded, so the matrix can replay its entry animation. */
  animateKey: number

  toggleAction: (nodeId: string, action: ActionKey, value: boolean) => void
  toggleNodeAll: (nodeId: string, value: boolean) => void
  toggleModuleColumn: (moduleId: string, action: ActionKey, value: boolean) => void
  save: () => void
  createRole: (role: { name: string; description?: string }) => Promise<RoleProfile | null>
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useRolePermissions(): RolePermissionsResult {
  const [session, setSession] = useState<SessionContext | null>(null)
  useEffect(() => {
    setSession(buildSessionContext())
  }, [])
  const ready = Boolean(session && isRolePermissionsSessionReady(session))

  const [activeRoleId, setActiveRoleId] = useState('')
  const [draft, setDraft] = useState<PermissionNode[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [animateKey, setAnimateKey] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  const [roles, setRoles] = useState<RoleProfile[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [rightsError, setRightsError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const loadRoles = useCallback(async () => {
    if (!session || !ready) return
    setRolesLoading(true)
    setRolesError(null)
    try {
      const response = await menuRightsService.getRoles(session)
      setRoles(response.data ?? [])
    } catch (loadError) {
      setRolesError(toMessage(loadError, 'Failed to load roles'))
      setRoles([])
    } finally {
      setRolesLoading(false)
    }
  }, [session, ready])

  useEffect(() => {
    loadRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ready])

  /* Selection follows the loaded roles list. */
  useEffect(() => {
    if (!activeRoleId && roles.length) {
      setActiveRoleId(String(roles[0].id))
    }
  }, [activeRoleId, roles])

  const loadRights = useCallback(async () => {
    if (!session || !ready || !activeRoleId) return
    setPermissionsLoading(true)
    setRightsError(null)
    try {
      const response = await menuRightsService.getRights(session, activeRoleId)
      const tree = toPermissionTree(response.data ?? [])
      setDraft(tree)
      setHasChanges(false)
      setAnimateKey((previous) => previous + 1)
    } catch (loadError) {
      setRightsError(toMessage(loadError, 'Failed to load permissions'))
      setDraft([])
    } finally {
      setPermissionsLoading(false)
    }
  }, [session, ready, activeRoleId])

  useEffect(() => {
    loadRights()
  }, [loadRights])

  const toggleAction = useCallback((nodeId: string, action: ActionKey, value: boolean) => {
    setDraft((previous) => applyAction(previous, nodeId, action, value))
    setHasChanges(true)
  }, [])

  const toggleNodeAll = useCallback((nodeId: string, value: boolean) => {
    setDraft((previous) => applyNodeAll(previous, nodeId, value))
    setHasChanges(true)
  }, [])

  const toggleModuleColumn = useCallback((moduleId: string, action: ActionKey, value: boolean) => {
    setDraft((previous) => applyModuleColumn(previous, moduleId, action, value))
    setHasChanges(true)
  }, [])

  const save = useCallback(() => {
    if (!session || !activeRoleId) return
    setSaving(true)
    menuRightsService
      .saveRights(session, activeRoleId, toRightsPayload(draft))
      .then((response) => {
        if (Number(response.status_code) !== 1) {
          setActionError(response.message || 'Failed to save permissions')
          return
        }
        setActionError(null)
        setHasChanges(false)
        // No query cache here - a fresh fetch takes the place of invalidation.
        loadRights()
      })
      .catch((saveError) => setActionError(toMessage(saveError, 'Failed to save permissions')))
      .finally(() => setSaving(false))
  }, [session, activeRoleId, draft, loadRights])

  const createRole = useCallback(
    async (role: { name: string; description?: string }) => {
      if (!session) return null
      try {
        const response = await menuRightsService.createRole(session, role)
        if (Number(response.status_code) !== 1) return null
        setActionError(null)
        await loadRoles()
        setActiveRoleId(String(response.data.id))
        return response.data
      } catch (createError) {
        setActionError(toMessage(createError, 'Failed to create role'))
        return null
      }
    },
    [session, loadRoles],
  )

  const queryError = rolesError ?? rightsError

  return {
    roles,
    rolesLoading: ready && rolesLoading,
    activeRoleId,
    activeRole: useMemo(() => roles.find((role) => String(role.id) === activeRoleId), [roles, activeRoleId]),
    setActiveRoleId,

    permissions: draft,
    permissionsLoading: Boolean(activeRoleId) && permissionsLoading,
    error: actionError ?? queryError ?? (ready ? null : 'Sign in to manage role permissions'),

    hasChanges,
    saving,
    animateKey,

    toggleAction,
    toggleNodeAll,
    toggleModuleColumn,
    save,
    createRole,
  }
}
