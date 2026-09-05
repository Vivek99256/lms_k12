'use client'

/**
 * Administration & Governance — state hook.
 *
 * Ported from g2gv0's `hooks/use-governance.ts` (`useGovernance`). Logic,
 * debouncing, per-tab fetch-on-visible and the write wrapper are unchanged;
 * only the session/auth plumbing changed:
 *   - g2gv0's `useAuth()` + `getLaravelContext(user)` → this repo's
 *     `buildSessionContext()` (no dedicated auth hook exists here yet).
 *   - `canAdminister` was `user.role === 'admin' || user.role === 'hr'`;
 *     this repo's SessionContext carries `isAdmin` instead of a role string,
 *     so administer rights are read from that flag.
 *   - The departments list was `lmsCatalogService.getFilterOptions`; there is
 *     no package-4 equivalent, so it is sourced from the existing
 *     Organization module's `organizationService.getDepartmentsManagement`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { buildSessionContext } from '@/lib/erp-client'
import { organizationService } from '@/components/domain/organization/department-management/organization-service'
import { lmsAdministrationGovernanceService } from './administration-governance-service'
import type {
  AuditLog,
  GovernanceDepartment,
  GovernanceKpis,
  GovernanceRole,
  GovernanceUser,
  HealthCheck,
  Integration,
  IntegrationPayload,
  PermissionRow,
  RolePayload,
  Trainer,
  TrainerPayload,
  UserPayload,
  Vendor,
  VendorPayload,
} from './types'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export type GovernanceTab =
  | 'users'
  | 'roles'
  | 'trainers'
  | 'vendors'
  | 'integrations'
  | 'audit'
  | 'settings'

export function useAdministrationGovernance() {
  const session = useMemo(() => buildSessionContext(), [])
  /** The API enforces this too; the UI uses it to hide writes it would refuse. */
  const canAdminister = session.isAdmin === '1' || session.isAdmin === 'true' || session.isAdmin === '1.0'

  const [tab, setTab] = useState<GovernanceTab>('users')

  const [kpis, setKpis] = useState<GovernanceKpis | null>(null)
  const [health, setHealth] = useState<HealthCheck[]>([])

  // Users
  const [users, setUsers] = useState<GovernanceUser[]>([])
  const [userMeta, setUserMeta] = useState({ current_page: 1, last_page: 1, per_page: 10, total: 0 })
  const [userSearch, setUserSearch] = useState('')
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [userProfileId, setUserProfileId] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPerPage, setUserPerPage] = useState(10)

  const [roles, setRoles] = useState<GovernanceRole[]>([])
  const [departments, setDepartments] = useState<GovernanceDepartment[]>([])

  // Permission matrix
  const [matrixProfileId, setMatrixProfileId] = useState<number | null>(null)
  const [matrix, setMatrix] = useState<PermissionRow[]>([])
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixDirty, setMatrixDirty] = useState(false)

  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditMeta, setAuditMeta] = useState({
    current_page: 1, last_page: 1, per_page: 20, total: 0, journey_events: 0,
  })
  const [auditFilters, setAuditFilters] = useState<{ actions: string[]; entity_types: string[] }>({
    actions: [], entity_types: [],
  })
  const [auditAction, setAuditAction] = useState('')
  const [auditPage, setAuditPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch)
      setUserPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  /* ── Header: KPIs, health, and the reference data every tab needs ── */

  const loadHeader = useCallback(async () => {
    if (!session.token) {
      setLoading(false)
      setError('Your session has expired. Sign in again to manage this institute.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [kpiResult, healthResult, roleResult, deptResult] = await Promise.all([
        lmsAdministrationGovernanceService.kpis(session).catch(() => null),
        lmsAdministrationGovernanceService.systemHealth(session).catch(() => null),
        lmsAdministrationGovernanceService.roles(session).catch(() => null),
        organizationService.getDepartmentsManagement(session).catch(() => null),
      ])

      setKpis(kpiResult?.data ?? null)
      setHealth(healthResult?.data ?? [])
      setRoles(roleResult?.data ?? [])
      setDepartments(
        deptResult
          ? deptResult.main_departments.map((d) => ({ id: Number(d.id), department: d.name }))
          : [],
      )

      if (!kpiResult && !healthResult && !roleResult) {
        setError('Failed to load governance data.')
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load governance data.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadHeader()
    })
  }, [loadHeader])

  /* ── Per-tab loads ── */

  const loadUsers = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.users(session, {
        page: userPage,
        perPage: userPerPage,
        search: debouncedUserSearch || undefined,
        status: userStatus || undefined,
        profileId: userProfileId || undefined,
      })
      setUsers(response.data ?? [])
      if (response.meta) setUserMeta(response.meta)
    } catch (loadError) {
      setActionError(toMessage(loadError, 'Failed to load users.'))
      setUsers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, userPerPage, debouncedUserSearch, userStatus, userProfileId])

  const loadTrainers = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.trainers(session)
      setTrainers(response.data ?? [])
    } catch {
      setTrainers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVendors = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.vendors(session)
      setVendors(response.data ?? [])
    } catch {
      setVendors([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadIntegrations = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.integrations(session)
      setIntegrations(response.data ?? [])
    } catch {
      setIntegrations([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAudit = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.auditLogs(session, {
        page: auditPage,
        action: auditAction || undefined,
      })
      setAuditLogs(response.data ?? [])
      if (response.meta) setAuditMeta({ journey_events: 0, ...response.meta })
      if (response.filters) setAuditFilters(response.filters)
    } catch {
      setAuditLogs([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditPage, auditAction])

  useEffect(() => {
    queueMicrotask(() => {
      if (tab === 'users') void loadUsers()
      else if (tab === 'trainers') void loadTrainers()
      else if (tab === 'vendors') void loadVendors()
      else if (tab === 'integrations') void loadIntegrations()
      else if (tab === 'audit') void loadAudit()
    })
  }, [tab, loadUsers, loadTrainers, loadVendors, loadIntegrations, loadAudit])

  /* ── Permission matrix ── */

  const loadMatrix = useCallback(async (profileId: number) => {
    if (!session.token) return

    setMatrixProfileId(profileId)
    setMatrixLoading(true)
    setMatrixDirty(false)

    try {
      const response = await lmsAdministrationGovernanceService.permissions(session, profileId)
      setMatrix(response.data ?? [])
    } catch (loadError) {
      setActionError(toMessage(loadError, 'Failed to load the permission matrix.'))
      setMatrix([])
    } finally {
      setMatrixLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Toggle one flag locally; nothing is sent until the matrix is saved. */
  const togglePermission = useCallback(
    (menuId: number, field: 'can_view' | 'can_add' | 'can_edit' | 'can_delete') => {
      setMatrix((current) =>
        current.map((row) => {
          if (row.id !== menuId) return row
          const next = { ...row, [field]: !row[field] }
          if (field === 'can_view' && !next.can_view) {
            next.can_add = false
            next.can_edit = false
            next.can_delete = false
          }
          return next
        }),
      )
      setMatrixDirty(true)
    },
    [],
  )

  /* ── Shared write wrapper ── */

  const run = useCallback(async (operation: () => Promise<string>, fallback: string) => {
    setSaving(true)
    setActionError(null)
    setMessage(null)

    try {
      const success = await operation()
      setMessage(success)
      return { ok: true, message: success }
    } catch (writeError) {
      const failure = toMessage(writeError, fallback)
      setActionError(failure)
      return { ok: false, message: failure }
    } finally {
      setSaving(false)
    }
  }, [])

  const savePermissions = useCallback(
    () =>
      run(async () => {
        if (!matrixProfileId) throw new Error('Select a role first.')
        const response = await lmsAdministrationGovernanceService.savePermissions(
          session,
          matrixProfileId,
          matrix.map((row) => ({
            menu_id: row.id,
            can_view: row.can_view,
            can_add: row.can_add,
            can_edit: row.can_edit,
            can_delete: row.can_delete,
          })),
        )
        setMatrixDirty(false)
        await loadHeader()
        return response.message ?? 'Permissions saved.'
      }, 'Failed to save permissions.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, matrixProfileId, matrix, loadHeader],
  )

  /* ── Users ── */

  const saveUser = useCallback(
    (payload: UserPayload, id?: number) =>
      run(async () => {
        if (id) await lmsAdministrationGovernanceService.updateUser(session, id, payload)
        else await lmsAdministrationGovernanceService.createUser(session, payload)
        await Promise.all([loadUsers(), loadHeader()])
        return id ? 'User updated.' : `${payload.first_name} added.`
      }, 'Failed to save the user.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadUsers, loadHeader],
  )

  const removeUser = useCallback(
    (id: number) =>
      run(async () => {
        await lmsAdministrationGovernanceService.deleteUser(session, id)
        await Promise.all([loadUsers(), loadHeader()])
        return 'User deactivated.'
      }, 'Failed to deactivate the user.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadUsers, loadHeader],
  )

  /** Per-row skip reasons from the last import, surfaced rather than swallowed. */
  const [importErrors, setImportErrors] = useState<string[]>([])

  const importUsers = useCallback(async (file: File, userProfileId: number) => {
    setSaving(true)
    setActionError(null)
    setMessage(null)
    setImportErrors([])

    try {
      const response = await lmsAdministrationGovernanceService.importUsers(session, file, userProfileId)
      setImportErrors(response.errors ?? [])
      await Promise.all([loadUsers(), loadHeader()])
      const success = response.message ?? 'Users imported.'
      setMessage(success)
      return { ok: true, message: success }
    } catch (importError) {
      const failure = toMessage(importError, 'Failed to import users.')
      setActionError(failure)
      return { ok: false, message: failure }
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUsers, loadHeader])

  /* ── Roles ── */

  const saveRole = useCallback(
    (payload: RolePayload, id?: number) =>
      run(async () => {
        if (id) await lmsAdministrationGovernanceService.updateRole(session, id, payload)
        else await lmsAdministrationGovernanceService.createRole(session, payload)
        await loadHeader()
        return id ? 'Role updated.' : `${payload.name} added.`
      }, 'Failed to save the role.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadHeader],
  )

  const removeRole = useCallback(
    (id: number) =>
      run(async () => {
        await lmsAdministrationGovernanceService.deleteRole(session, id)
        await loadHeader()
        return 'Role deleted.'
      }, 'Failed to delete the role.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadHeader],
  )

  /* ── Trainers ── */

  const saveTrainer = useCallback(
    (payload: TrainerPayload, id?: number) =>
      run(async () => {
        if (id) await lmsAdministrationGovernanceService.updateTrainer(session, id, payload)
        else await lmsAdministrationGovernanceService.createTrainer(session, payload)
        await Promise.all([loadTrainers(), loadHeader()])
        return id ? 'Trainer updated.' : `${payload.name} added.`
      }, 'Failed to save the trainer.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadTrainers, loadHeader],
  )

  const removeTrainer = useCallback(
    (id: number) =>
      run(async () => {
        await lmsAdministrationGovernanceService.deleteTrainer(session, id)
        await Promise.all([loadTrainers(), loadHeader()])
        return 'Trainer removed.'
      }, 'Failed to remove the trainer.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadTrainers, loadHeader],
  )

  /* ── Vendors ── */

  const saveVendor = useCallback(
    (payload: VendorPayload, id?: number) =>
      run(async () => {
        if (id) await lmsAdministrationGovernanceService.updateVendor(session, id, payload)
        else await lmsAdministrationGovernanceService.createVendor(session, payload)
        await Promise.all([loadVendors(), loadHeader()])
        return id ? 'Vendor updated.' : `${payload.name} added.`
      }, 'Failed to save the vendor.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadVendors, loadHeader],
  )

  const removeVendor = useCallback(
    (id: number) =>
      run(async () => {
        await lmsAdministrationGovernanceService.deleteVendor(session, id)
        await Promise.all([loadVendors(), loadHeader()])
        return 'Vendor removed.'
      }, 'Failed to remove the vendor.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadVendors, loadHeader],
  )

  /* ── Integrations ── */

  const saveIntegration = useCallback(
    (payload: IntegrationPayload, id?: number) =>
      run(async () => {
        if (id) await lmsAdministrationGovernanceService.updateIntegration(session, id, payload)
        else await lmsAdministrationGovernanceService.createIntegration(session, payload)
        await Promise.all([loadIntegrations(), loadHeader()])
        return id ? 'Integration updated.' : `${payload.display_name} connected.`
      }, 'Failed to save the integration.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadIntegrations, loadHeader],
  )

  const removeIntegration = useCallback(
    (id: number) =>
      run(async () => {
        await lmsAdministrationGovernanceService.deleteIntegration(session, id)
        await Promise.all([loadIntegrations(), loadHeader()])
        return 'Integration removed.'
      }, 'Failed to remove the integration.'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, loadIntegrations, loadHeader],
  )

  /** Contracts needing attention, surfaced on the Settings tab. */
  const expiringVendors = useMemo(
    () => vendors.filter((v) => v.contract_state === 'expiring' || v.contract_state === 'expired'),
    [vendors],
  )

  return {
    tab,
    setTab,

    kpis,
    health,
    roles,
    departments,
    canAdminister,

    users,
    userMeta,
    userSearch,
    setUserSearch,
    userStatus,
    setUserStatus: (value: string) => {
      setUserStatus(value)
      setUserPage(1)
    },
    userProfileId,
    setUserProfileId: (value: string) => {
      setUserProfileId(value)
      setUserPage(1)
    },
    userPage,
    setUserPage,
    userPerPage,
    setUserPerPage: (value: number) => {
      setUserPerPage(value)
      setUserPage(1)
    },
    saveUser,
    removeUser,
    importUsers,
    importErrors,

    saveRole,
    removeRole,

    matrixProfileId,
    matrix,
    matrixLoading,
    matrixDirty,
    loadMatrix,
    togglePermission,
    savePermissions,

    trainers,
    saveTrainer,
    removeTrainer,

    vendors,
    expiringVendors,
    saveVendor,
    removeVendor,

    integrations,
    saveIntegration,
    removeIntegration,

    auditLogs,
    auditMeta,
    auditFilters,
    auditAction,
    setAuditAction: (value: string) => {
      setAuditAction(value)
      setAuditPage(1)
    },
    auditPage,
    setAuditPage,

    loading,
    error,
    saving,
    message,
    actionError,
    dismiss: () => {
      setMessage(null)
      setActionError(null)
    },
    reload: () => void loadHeader(),
  }
}

export type GovernanceState = ReturnType<typeof useAdministrationGovernance>
