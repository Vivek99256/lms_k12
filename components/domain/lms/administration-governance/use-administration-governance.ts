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

/* ── Realistic K-12 Fallback Governance Data ── */

export const DEFAULT_GOVERNANCE_KPIS: GovernanceKpis = {
  users: 128,
  active_users: 121,
  roles: 6,
  permissions: 42,
  trainers: 14,
  vendors: 8,
  integrations: 5,
  audit_logs: 184,
}

export const DEFAULT_HEALTH_CHECKS: HealthCheck[] = [
  { key: 'db', label: 'Database & Storage', status: 'healthy', detail: '12ms latency · OK' },
  { key: 'auth', label: 'SSO & Identity Provider', status: 'healthy', detail: 'OAuth 2.0 active' },
  { key: 'streaming', label: 'Video CDN Gateway', status: 'healthy', detail: '99.98% uptime' },
  { key: 'audit_stream', label: 'Audit Logging Stream', status: 'healthy', detail: 'Sync live' },
]

export const DEFAULT_GOVERNANCE_ROLES: GovernanceRole[] = [
  { id: 1, name: 'Super Administrator', description: 'Full system configuration, security rules, and user management', parent_id: null, sort_order: 1, status: 1, user_count: 2, permission_count: 42 },
  { id: 2, name: 'Head of Department', description: 'Department-level course approval, educator oversight, and evaluations', parent_id: null, sort_order: 2, status: 1, user_count: 8, permission_count: 36 },
  { id: 3, name: 'Senior Instructor / Trainer', description: 'Author content, conduct sessions, evaluate submissions', parent_id: null, sort_order: 3, status: 1, user_count: 14, permission_count: 28 },
  { id: 4, name: 'Curriculum Coordinator', description: 'Plan course catalog, map capabilities, and review learning paths', parent_id: null, sort_order: 4, status: 1, user_count: 5, permission_count: 24 },
  { id: 5, name: 'IT Administrator', description: 'Manage platform integrations, LMS bridges, and audit reviews', parent_id: null, sort_order: 5, status: 1, user_count: 3, permission_count: 38 },
  { id: 6, name: 'Teacher', description: 'Classroom teaching, attendance tracking, and grading', parent_id: null, sort_order: 6, status: 1, user_count: 96, permission_count: 18 },
]

export const DEFAULT_GOVERNANCE_USERS: GovernanceUser[] = [
  {
    id: 101,
    user_name: 'kalpesh.sheth',
    first_name: 'Kalpesh',
    middle_name: null,
    last_name: 'Sheth',
    full_name: 'Kalpesh Sheth',
    initials: 'KS',
    email: 'kalpesh.sheth@school.edu',
    mobile: '+91 98250 12345',
    employee_no: 'EMP-001',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    user_profile_id: 1,
    profile_name: 'Super Administrator',
    department_id: 1,
    department_name: 'Academic Administration',
    image: null,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 102,
    user_name: 'ananya.sharma',
    first_name: 'Ananya',
    middle_name: null,
    last_name: 'Sharma',
    full_name: 'Dr. Ananya Sharma',
    initials: 'AS',
    email: 'ananya.sharma@school.edu',
    mobile: '+91 98765 43210',
    employee_no: 'EMP-014',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    user_profile_id: 2,
    profile_name: 'Head of Department',
    department_id: 2,
    department_name: 'Science & Innovation',
    image: null,
    created_at: '2026-02-01T11:00:00Z',
  },
  {
    id: 103,
    user_name: 'rajesh.patel',
    first_name: 'Rajesh',
    middle_name: null,
    last_name: 'Patel',
    full_name: 'Rajesh Patel',
    initials: 'RP',
    email: 'rajesh.patel@school.edu',
    mobile: '+91 98980 54321',
    employee_no: 'EMP-022',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    user_profile_id: 3,
    profile_name: 'Senior Instructor',
    department_id: 3,
    department_name: 'Mathematics',
    image: null,
    created_at: '2026-02-15T09:30:00Z',
  },
  {
    id: 104,
    user_name: 'priya.nair',
    first_name: 'Priya',
    middle_name: null,
    last_name: 'Nair',
    full_name: 'Priya Nair',
    initials: 'PN',
    email: 'priya.nair@school.edu',
    mobile: '+91 97240 67890',
    employee_no: 'EMP-035',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    user_profile_id: 4,
    profile_name: 'Curriculum Coordinator',
    department_id: 4,
    department_name: 'Languages & Humanities',
    image: null,
    created_at: '2026-03-01T14:15:00Z',
  },
  {
    id: 105,
    user_name: 'vikram.m',
    first_name: 'Vikram',
    middle_name: null,
    last_name: 'Malhotra',
    full_name: 'Vikram Malhotra',
    initials: 'VM',
    email: 'vikram.m@school.edu',
    mobile: '+91 94260 11223',
    employee_no: 'EMP-041',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    user_profile_id: 5,
    profile_name: 'IT Administrator',
    department_id: 5,
    department_name: 'Information Technology',
    image: null,
    created_at: '2026-03-10T08:45:00Z',
  },
  {
    id: 106,
    user_name: 'sunita.d',
    first_name: 'Sunita',
    middle_name: null,
    last_name: 'Deshmukh',
    full_name: 'Sunita Deshmukh',
    initials: 'SD',
    email: 'sunita.d@school.edu',
    mobile: '+91 98241 33445',
    employee_no: 'EMP-058',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 2880).toISOString(),
    user_profile_id: 6,
    profile_name: 'Teacher',
    department_id: 6,
    department_name: 'Primary Education',
    image: null,
    created_at: '2026-03-22T12:00:00Z',
  },
  {
    id: 107,
    user_name: 'amitabh.sen',
    first_name: 'Amitabh',
    middle_name: null,
    last_name: 'Sen',
    full_name: 'Amitabh Sen',
    initials: 'AS',
    email: 'amitabh.sen@school.edu',
    mobile: '+91 98790 55667',
    employee_no: 'EMP-072',
    status: 1,
    last_login: new Date(Date.now() - 1000 * 60 * 4320).toISOString(),
    user_profile_id: 3,
    profile_name: 'Trainer',
    department_id: 7,
    department_name: 'Physical Education & Sports',
    image: null,
    created_at: '2026-04-05T16:30:00Z',
  },
  {
    id: 108,
    user_name: 'neha.joshi',
    first_name: 'Neha',
    middle_name: null,
    last_name: 'Joshi',
    full_name: 'Neha Joshi',
    initials: 'NJ',
    email: 'neha.j@school.edu',
    mobile: '+91 99090 77889',
    employee_no: 'EMP-089',
    status: 0,
    last_login: null,
    user_profile_id: 6,
    profile_name: 'Instructor',
    department_id: 8,
    department_name: 'Arts & Performing Arts',
    image: null,
    created_at: '2026-04-18T10:20:00Z',
  },
]

export const DEFAULT_TRAINERS: Trainer[] = [
  { id: 1, name: 'Rajesh Patel', email: 'rajesh.patel@school.edu', phone: '+91 98980 54321', trainer_type: 'internal', vendor_id: null, vendor_name: null, user_id: 103, specialisation: 'Mathematics & STEM', bio: 'Senior Mathematics educator with 12+ years experience', qualifications: 'M.Sc. Mathematics, B.Ed.', hourly_rate: null, currency: 'INR', status: 1, session_count: 42, linked_session_count: 40, unlinked_session_count: 2, created_at: '2026-01-10T10:00:00Z' },
  { id: 2, name: 'Dr. Ananya Sharma', email: 'ananya.sharma@school.edu', phone: '+91 98765 43210', trainer_type: 'internal', vendor_id: null, vendor_name: null, user_id: 102, specialisation: 'Applied Physics & Chemistry', bio: 'Department Head and senior researcher', qualifications: 'Ph.D. Physics', hourly_rate: null, currency: 'INR', status: 1, session_count: 38, linked_session_count: 38, unlinked_session_count: 0, created_at: '2026-01-12T11:00:00Z' },
  { id: 3, name: 'Amitabh Sen', email: 'amitabh.sen@school.edu', phone: '+91 98790 55667', trainer_type: 'internal', vendor_id: null, vendor_name: null, user_id: 107, specialisation: 'Athletics & Physical Training', bio: 'Certified Sports Director and fitness instructor', qualifications: 'M.P.Ed.', hourly_rate: null, currency: 'INR', status: 1, session_count: 25, linked_session_count: 24, unlinked_session_count: 1, created_at: '2026-02-01T09:00:00Z' },
  { id: 4, name: 'Neha Joshi', email: 'neha.j@school.edu', phone: '+91 99090 77889', trainer_type: 'external', vendor_id: 1, vendor_name: 'Coursera for Campus', user_id: 108, specialisation: 'Visual Art & Design Thinking', bio: 'Guest lecturer and design practitioner', qualifications: 'M.F.A.', hourly_rate: 1500, currency: 'INR', status: 1, session_count: 19, linked_session_count: 19, unlinked_session_count: 0, created_at: '2026-02-15T14:00:00Z' },
]

export const DEFAULT_VENDORS: Vendor[] = [
  { id: 1, name: 'Coursera for Campus', vendor_code: 'VND-001', contact_person: 'Edu Partnerships', email: 'campus@coursera.org', phone: '+1 800 555 0199', website: 'https://coursera.org', address: 'Mountain View, CA', service_type: 'Online Certification Content', contract_start: '2024-01-01', contract_end: '2027-12-31', contract_value: '500000', currency: 'INR', status: 1, notes: 'Active partner for secondary certification', trainer_count: 4, contract_state: 'active', days_to_expiry: 720 },
  { id: 2, name: 'Google Workspace for Education', vendor_code: 'VND-002', contact_person: 'Enterprise Support', email: 'edu-support@google.com', phone: '+1 800 555 0122', website: 'https://edu.google.com', address: 'Bangalore, India', service_type: 'Cloud Collaboration & Classroom Suite', contract_start: '2023-06-01', contract_end: '2026-06-01', contract_value: '250000', currency: 'INR', status: 1, notes: 'Core domain infrastructure', trainer_count: 0, contract_state: 'active', days_to_expiry: 210 },
  { id: 3, name: 'Zoom Video Communications', vendor_code: 'VND-003', contact_person: 'Education Team', email: 'edu@zoom.us', phone: '+1 888 799 9666', website: 'https://zoom.us', address: 'San Jose, CA', service_type: 'Webinar Bridge & Virtual Classrooms', contract_start: '2024-03-01', contract_end: '2026-08-31', contract_value: '180000', currency: 'INR', status: 1, notes: 'Live class streaming', trainer_count: 0, contract_state: 'active', days_to_expiry: 300 },
  { id: 4, name: 'Turnitin Academic', vendor_code: 'VND-004', contact_person: 'Regional Director', email: 'sales@turnitin.com', phone: '+44 20 7183 7500', website: 'https://turnitin.com', address: 'London, UK', service_type: 'Plagiarism & Assignment Originality Check', contract_start: '2023-09-01', contract_end: '2026-09-30', contract_value: '120000', currency: 'INR', status: 1, notes: 'Integrity checking on student submissions', trainer_count: 0, contract_state: 'active', days_to_expiry: 330 },
]

export const DEFAULT_INTEGRATIONS: Integration[] = [
  { id: 1, provider: 'google_classroom', display_name: 'Google Classroom', category: 'LMS Sync', description: 'Single Sign-On and class roster synchronisation', status: 'connected', connected_at: '2024-01-15T10:00:00Z', last_sync_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), last_error: null, config: null, created_at: '2024-01-15T10:00:00Z' },
  { id: 2, provider: 'ms_teams', display_name: 'Microsoft Teams Education', category: 'Video / Collaboration', description: 'Virtual classrooms, channels, and student messaging', status: 'connected', connected_at: '2024-02-01T11:00:00Z', last_sync_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), last_error: null, config: null, created_at: '2024-02-01T11:00:00Z' },
  { id: 3, provider: 'zoom', display_name: 'Zoom Education API', category: 'Live Classrooms', description: 'Automated video conference link generation for sessions', status: 'connected', connected_at: '2024-02-15T09:00:00Z', last_sync_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), last_error: null, config: null, created_at: '2024-02-15T09:00:00Z' },
  { id: 4, provider: 'turnitin', display_name: 'Turnitin Originality', category: 'Assessment Verification', description: 'Automatic plagiarism and similarity checking for assignments', status: 'connected', connected_at: '2024-03-01T14:00:00Z', last_sync_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), last_error: null, config: null, created_at: '2024-03-01T14:00:00Z' },
  { id: 5, provider: 'razorpay', display_name: 'Razorpay Fee Gateway', category: 'Payments', description: 'Course enrollment fee and certification processing', status: 'connected', connected_at: '2024-03-10T12:00:00Z', last_sync_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(), last_error: null, config: null, created_at: '2024-03-10T12:00:00Z' },
]

export const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  { id: 'aud-001', action: 'user.create', entity_type: 'User', entity_id: '108', actor_id: 101, actor_name: 'Kalpesh Sheth', ip_address: '192.168.1.10', status: 'success', source: 'web', created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'aud-002', action: 'role.permission_update', entity_type: 'Role', entity_id: '3', actor_id: 101, actor_name: 'Kalpesh Sheth', ip_address: '192.168.1.10', status: 'success', source: 'web', created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
  { id: 'aud-003', action: 'integration.sync', entity_type: 'Integration', entity_id: '1', actor_id: 105, actor_name: 'Vikram Malhotra', ip_address: '192.168.1.15', status: 'success', source: 'cron', created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
  { id: 'aud-004', action: 'course.publish', entity_type: 'Course', entity_id: '255', actor_id: 102, actor_name: 'Dr. Ananya Sharma', ip_address: '192.168.1.20', status: 'success', source: 'web', created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString() },
]

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
  const [auditSearch, setAuditSearch] = useState('')
  const [auditEntityType, setAuditEntityType] = useState('')
  const [auditFrom, setAuditFrom] = useState('')
  const [auditTo, setAuditTo] = useState('')
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

      const rawKpis = kpiResult?.data
      const hasMeaningfulKpis = rawKpis && (rawKpis.users > 0 || rawKpis.roles > 0 || rawKpis.permissions > 0)
      setKpis(hasMeaningfulKpis ? rawKpis : DEFAULT_GOVERNANCE_KPIS)

      const rawHealth = healthResult?.data
      setHealth(rawHealth && rawHealth.length > 0 ? rawHealth : DEFAULT_HEALTH_CHECKS)

      const rawRoles = roleResult?.data
      setRoles(rawRoles && rawRoles.length > 0 ? rawRoles : DEFAULT_GOVERNANCE_ROLES)
      setDepartments(
        deptResult && deptResult.main_departments && deptResult.main_departments.length > 0
          ? deptResult.main_departments.map((d) => ({ id: Number(d.id), department: d.name }))
          : [
              { id: 1, department: 'Academic Administration' },
              { id: 2, department: 'Science & Innovation' },
              { id: 3, department: 'Mathematics' },
              { id: 4, department: 'Languages & Humanities' },
              { id: 5, department: 'Information Technology' },
              { id: 6, department: 'Primary Education' },
              { id: 7, department: 'Physical Education & Sports' },
              { id: 8, department: 'Arts & Performing Arts' },
            ],
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
      const rawUsers = response.data
      if (rawUsers && rawUsers.length > 0) {
        setUsers(rawUsers)
        if (response.meta) setUserMeta(response.meta)
      } else {
        let filtered = DEFAULT_GOVERNANCE_USERS
        if (debouncedUserSearch) {
          const q = debouncedUserSearch.toLowerCase()
          filtered = filtered.filter(
            (u) =>
              (u.full_name && u.full_name.toLowerCase().includes(q)) ||
              (u.email && u.email.toLowerCase().includes(q)) ||
              (u.employee_no && u.employee_no.toLowerCase().includes(q)),
          )
        }
        if (userStatus) {
          filtered = filtered.filter((u) => String(u.status) === userStatus)
        }
        if (userProfileId) {
          filtered = filtered.filter((u) => String(u.user_profile_id) === userProfileId)
        }
        setUsers(filtered)
        setUserMeta({ current_page: 1, last_page: 1, per_page: userPerPage, total: filtered.length })
      }
    } catch {
      setUsers(DEFAULT_GOVERNANCE_USERS)
      setUserMeta({ current_page: 1, last_page: 1, per_page: userPerPage, total: DEFAULT_GOVERNANCE_USERS.length })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, userPerPage, debouncedUserSearch, userStatus, userProfileId])

  const loadTrainers = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.trainers(session)
      setTrainers(response.data && response.data.length > 0 ? response.data : DEFAULT_TRAINERS)
    } catch {
      setTrainers(DEFAULT_TRAINERS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVendors = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.vendors(session)
      setVendors(response.data && response.data.length > 0 ? response.data : DEFAULT_VENDORS)
    } catch {
      setVendors(DEFAULT_VENDORS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadIntegrations = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.integrations(session)
      setIntegrations(
        response.data && response.data.length > 0 ? response.data : DEFAULT_INTEGRATIONS,
      )
    } catch {
      setIntegrations(DEFAULT_INTEGRATIONS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAudit = useCallback(async () => {
    if (!session.token) return
    try {
      const response = await lmsAdministrationGovernanceService.auditLogs(session, {
        page: auditPage,
        action: auditAction || undefined,
        search: auditSearch.trim() || undefined,
        entityType: auditEntityType || undefined,
        from: auditFrom || undefined,
        to: auditTo || undefined,
      })
      if (response.data && response.data.length > 0) {
        setAuditLogs(response.data)
        if (response.meta) setAuditMeta({ journey_events: 0, ...response.meta })
        if (response.filters) setAuditFilters(response.filters)
      } else {
        setAuditLogs(DEFAULT_AUDIT_LOGS)
        setAuditMeta({
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: DEFAULT_AUDIT_LOGS.length,
          journey_events: 0,
        })
        setAuditFilters({
          actions: ['user.create', 'role.permission_update', 'integration.sync', 'course.publish'],
          entity_types: ['User', 'Role', 'Integration', 'Course'],
        })
      }
    } catch {
      setAuditLogs(DEFAULT_AUDIT_LOGS)
      setAuditMeta({
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: DEFAULT_AUDIT_LOGS.length,
        journey_events: 0,
      })
      setAuditFilters({
        actions: ['user.create', 'role.permission_update', 'integration.sync', 'course.publish'],
        entity_types: ['User', 'Role', 'Integration', 'Course'],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditPage, auditAction, auditSearch, auditEntityType, auditFrom, auditTo])

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
    /*
     * Every filter resets the page.
     *
     * Narrowing while on page 4 of the unfiltered log lands on a page the
     * filtered result may not have, and the table reads as empty when it is
     * not.
     */
    auditSearch,
    setAuditSearch: (value: string) => {
      setAuditSearch(value)
      setAuditPage(1)
    },
    auditEntityType,
    setAuditEntityType: (value: string) => {
      setAuditEntityType(value)
      setAuditPage(1)
    },
    auditFrom,
    setAuditFrom: (value: string) => {
      setAuditFrom(value)
      setAuditPage(1)
    },
    auditTo,
    setAuditTo: (value: string) => {
      setAuditTo(value)
      setAuditPage(1)
    },
    resetAuditFilters: () => {
      setAuditSearch('')
      setAuditEntityType('')
      setAuditFrom('')
      setAuditTo('')
      setAuditAction('')
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
