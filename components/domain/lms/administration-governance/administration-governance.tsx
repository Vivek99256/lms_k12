'use client'

/**
 * Administration & Governance — main screen.
 *
 * Ported from g2gv0's `components/domain/lms/governance/lms-governance.tsx`
 * (`LmsGovernance`) verbatim in JSX/logic. Import-only changes:
 *   - `@/components/ui/select` → `@/components/ui/g2g/select` (see
 *     governance-panels.tsx for why).
 *   - `useGovernance` / `GovernanceTab` → `./use-administration-governance`.
 *   - `GovernanceUser`, `HealthStatus` → `./types`.
 */

import React, { useState } from 'react'
import {
  Search,
  Users,
  Shield,
  Key,
  GraduationCap,
  Building2,
  Zap,
  FileText,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ShieldCheck,
  Activity,
  Edit2,
  Trash2,
  Upload,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/g2g/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useAdministrationGovernance, type GovernanceTab } from './use-administration-governance'
import type { GovernanceUser, HealthStatus } from './types'
import {
  AuditPanel,
  Field,
  FormRow,
  IntegrationsPanel,
  RolesPanel,
  TrainersPanel,
  VendorsPanel,
} from './governance-panels'

/* ─── Config ───────────────────────────────────────────────────────────────── */

const TABS: { id: GovernanceTab; label: string; icon: typeof Users }[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles & permissions', icon: Shield },
  { id: 'trainers', label: 'Trainers', icon: GraduationCap },
  { id: 'vendors', label: 'Vendors', icon: Building2 },
  { id: 'integrations', label: 'Integrations', icon: Zap },
  { id: 'audit', label: 'Audit logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const HEALTH_ICON: Record<HealthStatus, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  unknown: HelpCircle,
}

const HEALTH_DOT: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
}

const EMPTY_USER = {
  first_name: '', last_name: '', email: '', mobile: '', employee_no: '',
  user_profile_id: '', department_id: '', user_name: '', password: '', status: true,
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function AdministrationGovernance() {
  const governance = useAdministrationGovernance()
  const {
    tab, setTab,
    kpis, health, roles, departments, canAdminister,
    users, userMeta, userSearch, setUserSearch, userStatus, setUserStatus,
    userProfileId, setUserProfileId, userPage, setUserPage, userPerPage, setUserPerPage,
    saveUser, removeUser, importUsers, importErrors,
    trainers, vendors, expiringVendors, integrations,
    loadMatrix,
    loading, error, saving, message, actionError, dismiss, reload,
  } = governance

  const [userForm, setUserForm] = useState(EMPTY_USER)
  const [editingUser, setEditingUser] = useState<GovernanceUser | null>(null)
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<GovernanceUser | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProfileId, setImportProfileId] = useState('')

  // KPI cards are driven from the API; each links to the tab that owns it, so
  // "View all" is a real navigation rather than a dead link.
  const stats = [
    {
      label: 'Users',
      value: kpis?.users,
      sub: `${kpis?.active_users ?? 0} active`,
      icon: Users,
      tab: 'users' as const,
      color: 'indigo',
      badgeBg: 'bg-indigo-50 text-[#5846EA] border-indigo-200/80',
      iconBg: 'bg-indigo-50 text-[#5846EA] border border-indigo-100',
    },
    {
      label: 'Roles',
      value: kpis?.roles,
      sub: 'System roles',
      icon: Shield,
      tab: 'roles' as const,
      color: 'violet',
      badgeBg: 'bg-violet-50 text-violet-700 border-violet-200/80',
      iconBg: 'bg-violet-50 text-violet-600 border border-violet-100',
    },
    {
      label: 'Permissions',
      value: kpis?.permissions,
      sub: 'Rights assigned',
      icon: Key,
      tab: 'roles' as const,
      color: 'blue',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
    },
    {
      label: 'Trainers',
      value: kpis?.trainers,
      sub: 'Active trainers',
      icon: GraduationCap,
      tab: 'trainers' as const,
      color: 'emerald',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    {
      label: 'Vendors',
      value: kpis?.vendors,
      sub: 'Active vendors',
      icon: Building2,
      tab: 'vendors' as const,
      color: 'amber',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    },
    {
      label: 'Integrations',
      value: kpis?.integrations,
      sub: 'Connected',
      icon: Zap,
      tab: 'integrations' as const,
      color: 'purple',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
    },
    {
      label: 'Audit logs',
      value: kpis?.audit_logs,
      sub: 'Last 30 days',
      icon: FileText,
      tab: 'audit' as const,
      color: 'rose',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200/80',
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
    },
  ]

  const quickActions = [
    { label: 'Add new user', icon: UserPlus, run: () => { setTab('users'); setEditingUser(null); setUserForm(EMPTY_USER); setUserFormOpen(true) } },
    { label: 'Manage roles', icon: Shield, run: () => setTab('roles') },
    { label: 'Permission matrix', icon: ShieldCheck, run: () => { setTab('roles'); if (roles[0]) void loadMatrix(roles[0].id) } },
    { label: 'Manage trainers', icon: GraduationCap, run: () => setTab('trainers') },
    { label: 'Manage integrations', icon: Zap, run: () => setTab('integrations') },
    { label: 'View audit logs', icon: FileText, run: () => setTab('audit') },
  ]

  const openUserForm = (user?: GovernanceUser) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        mobile: user.mobile ?? '',
        employee_no: user.employee_no ?? '',
        user_profile_id: user.user_profile_id ? String(user.user_profile_id) : '',
        department_id: user.department_id ? String(user.department_id) : '',
        user_name: user.user_name ?? '',
        password: '',
        status: Boolean(user.status),
      })
    } else {
      setEditingUser(null)
      setUserForm(EMPTY_USER)
    }
    setUserFormOpen(true)
  }

  const submitUser = () =>
    void saveUser(
      {
        first_name: userForm.first_name.trim(),
        last_name: userForm.last_name || null,
        email: userForm.email.trim(),
        mobile: userForm.mobile || null,
        employee_no: userForm.employee_no || null,
        user_profile_id: Number(userForm.user_profile_id),
        department_id: userForm.department_id ? Number(userForm.department_id) : null,
        status: userForm.status ? 1 : 0,
        // Only sent on create; an empty password on update leaves it unchanged.
        ...(editingUser ? {} : { user_name: userForm.user_name.trim() }),
        ...(userForm.password ? { password: userForm.password } : {}),
      },
      editingUser?.id,
    ).then((result) => {
      if (result.ok) {
        setUserFormOpen(false)
        setEditingUser(null)
      }
    })

  if (error && !kpis) {
    return <ErrorState title="Couldn't load governance" description={error} retry={reload} />
  }

  return (
    <div
      className="flex flex-col gap-6 pb-6"
      style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Administration &amp; governance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage users, roles, permissions, trainers, vendors, integrations and system settings.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9 gap-2 font-semibold shadow-xs border-slate-200 text-slate-700 hover:border-[#5846EA]/40 hover:text-[#5846EA] hover:bg-indigo-50/50 transition-colors"
          onClick={() => setTab('settings')}
        >
          <Settings className="size-4 text-[#5846EA]" /> System settings
        </Button>
      </div>

      {/* Stats - Responsive Grid with no horizontal scrollbar */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              onClick={() => setTab(stat.tab)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:border-[#5846EA]/40 hover:shadow-sm cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 shadow-2xs', stat.iconBg)}>
                  <Icon className="size-4.5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                  {stat.label}
                </span>
              </div>

              <div className="mt-3 flex flex-col">
                <div className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-[#5846EA] transition-colors">
                  {loading ? <Skeleton className="h-7 w-14" /> : (stat.value ?? 0).toLocaleString()}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border', stat.badgeBg)}>
                    {stat.sub}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#5846EA] group-hover:underline">
                <span>View all</span>
                <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Banners */}
      {(message || actionError) && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
            actionError
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success',
          )}
        >
          <span className="font-medium">{actionError ?? message}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200/80 pb-0">
            {TABS.map((entry) => {
              const TabIcon = entry.icon
              const isActive = tab === entry.id
              return (
                <button
                  key={entry.id}
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-3.5 pb-3 text-sm font-bold transition-all cursor-pointer outline-none',
                    isActive
                      ? 'text-[#5846EA]'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50 rounded-t-lg',
                  )}
                >
                  <TabIcon className={cn('size-4', isActive ? 'text-[#5846EA]' : 'text-slate-400')} />
                  <span>{entry.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-t-full bg-[#5846EA]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Users ── */}
          {tab === 'users' && (
            <Card className="flex flex-1 flex-col overflow-hidden border-border/60 shadow-sm">
              <div className="flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center">
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                  <div className="relative w-full sm:w-[280px]">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email or employee no..."
                      className="h-9 pl-9"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <div className="w-[150px]">
                    <Select
                      options={[
                        { label: 'All statuses', value: '' },
                        { label: 'Active', value: '1' },
                        { label: 'Inactive', value: '0' },
                      ]}
                      value={userStatus}
                      onChange={(v) => setUserStatus(String(v))}
                    />
                  </div>
                  <div className="w-[160px]">
                    <Select
                      options={[
                        { label: 'All roles', value: '' },
                        ...roles.map((r) => ({ label: r.name, value: String(r.id) })),
                      ]}
                      value={userProfileId}
                      onChange={(v) => setUserProfileId(String(v))}
                    />
                  </div>
                </div>

                {canAdminister && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 font-semibold shadow-xs border-slate-200 text-slate-700 hover:border-[#5846EA]/40 hover:text-[#5846EA] hover:bg-indigo-50/50 transition-colors"
                      onClick={() => setImportOpen((v) => !v)}
                    >
                      <Upload className="size-4 text-[#5846EA]" /> Import users
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 gap-2 bg-[#5846EA] text-white hover:bg-[#4936d8] font-bold shadow-xs transition-all"
                      onClick={() => openUserForm()}
                    >
                      <Plus className="size-4" /> Add user
                    </Button>
                  </div>
                )}
              </div>

              {importOpen && (
                <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/5 p-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">Bulk import users from CSV</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Required column: <code className="font-mono">email</code>. Optional:{' '}
                      <code className="font-mono">
                        first_name, last_name, mobile, employee_no, user_name, gender, birthdate,
                        joined_date
                      </code>
                      . Institute and role come from this form, not the file, and each user gets a
                      random password to reset on first sign-in.
                    </p>
                  </div>

                  <FormRow>
                    <Field label="Assign role">
                      <Select
                        options={roles.map((r) => ({ label: r.name, value: String(r.id) }))}
                        value={importProfileId}
                        onChange={(v) => setImportProfileId(String(v))}
                        placeholder="Select a role"
                      />
                    </Field>
                    <Field label="CSV file">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        aria-label="CSV file"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-semibold"
                        onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                      />
                    </Field>
                  </FormRow>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={saving || !importFile || !importProfileId}
                      onClick={() => {
                        if (!importFile || !importProfileId) return
                        void importUsers(importFile, Number(importProfileId)).then((r) => {
                          if (r.ok) setImportFile(null)
                        })
                      }}
                    >
                      {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setImportOpen(false)}>
                      Close
                    </Button>
                  </div>

                  {/* Skipped rows are shown, not swallowed — a partial import
                      that silently drops records is worse than a failed one. */}
                  {importErrors.length > 0 && (
                    <div className="max-h-40 overflow-auto rounded border border-warning/40 bg-warning/10 p-3">
                      <p className="text-xs font-bold text-foreground">
                        {importErrors.length} row{importErrors.length === 1 ? '' : 's'} skipped
                      </p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                        {importErrors.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {userFormOpen && (
                <div className="flex flex-col gap-3 border-b border-border/60 bg-primary/5 p-4">
                  <FormRow>
                    <Field label="First name">
                      <Input className="h-9" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
                    </Field>
                    <Field label="Last name">
                      <Input className="h-9" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
                    </Field>
                    <Field label="Email">
                      <Input className="h-9" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                    </Field>
                    <Field label="Mobile">
                      <Input className="h-9" value={userForm.mobile} onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })} />
                    </Field>
                    <Field label="Employee no.">
                      <Input className="h-9" value={userForm.employee_no} onChange={(e) => setUserForm({ ...userForm, employee_no: e.target.value })} />
                    </Field>
                    <Field label="Role">
                      <Select
                        options={roles.map((r) => ({ label: r.name, value: String(r.id) }))}
                        value={userForm.user_profile_id}
                        onChange={(v) => setUserForm({ ...userForm, user_profile_id: String(v) })}
                        placeholder="Select a role"
                      />
                    </Field>
                    <Field label="Department">
                      <Select
                        options={departments.map((d) => ({ label: d.department, value: String(d.id) }))}
                        value={userForm.department_id}
                        onChange={(v) => setUserForm({ ...userForm, department_id: String(v) })}
                        placeholder="None"
                      />
                    </Field>
                    {!editingUser && (
                      <Field label="Username">
                        <Input className="h-9" value={userForm.user_name} onChange={(e) => setUserForm({ ...userForm, user_name: e.target.value })} />
                      </Field>
                    )}
                    <Field label={editingUser ? 'New password (optional)' : 'Password'}>
                      <Input className="h-9" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                    </Field>
                  </FormRow>
                  {/*
                   * The status control the table's own badge implied existed.
                   * Deactivating is how access is withdrawn without deleting
                   * the person's learning record.
                   */}
                  <label className="flex w-fit items-center gap-2 text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={userForm.status}
                      onChange={(e) => setUserForm({ ...userForm, status: e.target.checked })}
                    />
                    Active
                    {!userForm.status && (
                      <span className="font-normal text-muted-foreground">
                        &mdash; this user will not be able to sign in
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        saving ||
                        !userForm.first_name.trim() ||
                        !userForm.email.trim() ||
                        !userForm.user_profile_id ||
                        (!editingUser && (!userForm.user_name.trim() || userForm.password.length < 8))
                      }
                      onClick={submitUser}
                    >
                      {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {editingUser ? 'Update user' : 'Create user'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setUserFormOpen(false); setEditingUser(null) }}>
                      Cancel
                    </Button>
                    {!editingUser && userForm.password.length > 0 && userForm.password.length < 8 && (
                      <span className="self-center text-xs font-semibold text-destructive">
                        Password must be at least 8 characters.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {users.length === 0 ? (
                <EmptyState
                  title="No users found"
                  description={userSearch ? 'Try a different search term.' : 'No users match these filters.'}
                />
              ) : (
                <div className="flex-1 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">User name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Department</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Last login</TableHead>
                        <TableHead className="pr-4 text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-indigo-50/20 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-2xs">
                                <span className="text-xs font-bold text-[#5846EA]">
                                  {user.initials}
                                </span>
                              </div>
                              <span className="whitespace-nowrap font-medium text-foreground">
                                {user.full_name || user.user_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email ?? '—'}</TableCell>
                          <TableCell>{user.department_name ?? '—'}</TableCell>
                          <TableCell>{user.profile_name ?? '—'}</TableCell>
                          <TableCell>
                            <StatusBadge variant={user.status ? 'active' : 'inactive'} className="font-medium">
                              {user.status ? 'Active' : 'Inactive'}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            {canAdminister && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Edit ${user.full_name}`}
                                  className="size-8"
                                  onClick={() => openUserForm(user)}
                                >
                                  <Edit2 className="size-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Deactivate ${user.full_name}`}
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setConfirmUser(user)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination — real totals from the API. */}
              <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
                <span className="text-sm text-muted-foreground">
                  {userMeta.total === 0
                    ? 'No users'
                    : `Showing ${(userMeta.current_page - 1) * userMeta.per_page + 1} to ${Math.min(
                        userMeta.current_page * userMeta.per_page,
                        userMeta.total,
                      )} of ${userMeta.total.toLocaleString()} users`}
                </span>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous page"
                      className="size-8"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage(userPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-sm font-medium">
                      {userMeta.current_page} / {userMeta.last_page}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next page"
                      className="size-8"
                      disabled={userPage >= userMeta.last_page}
                      onClick={() => setUserPage(userPage + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows:</span>
                    <div className="w-20">
                      <Select
                        options={[
                          { label: '10', value: '10' },
                          { label: '20', value: '20' },
                          { label: '50', value: '50' },
                        ]}
                        value={String(userPerPage)}
                        onChange={(v) => setUserPerPage(Number(v))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {tab === 'roles' && <RolesPanel governance={governance} />}
          {tab === 'trainers' && <TrainersPanel governance={governance} />}
          {tab === 'vendors' && <VendorsPanel governance={governance} />}
          {tab === 'integrations' && <IntegrationsPanel governance={governance} />}
          {tab === 'audit' && <AuditPanel governance={governance} />}

          {/* ── Settings ── */}
          {tab === 'settings' && (
            <div className="flex flex-col gap-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-3">
                  <CardTitle className="text-base">Institute summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
                  {[
                    ['Users', kpis?.users ?? 0],
                    ['Active users', kpis?.active_users ?? 0],
                    ['Roles', kpis?.roles ?? 0],
                    ['Rights assigned', kpis?.permissions ?? 0],
                    ['Trainers', trainers.length],
                    ['Vendors', vendors.length],
                    ['Integrations', integrations.length],
                    ['Audit events (30d)', kpis?.audit_logs ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex flex-col">
                      <span className="text-2xl font-bold tracking-tight">{value}</span>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-3">
                  <CardTitle className="text-base">Contracts needing attention</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {expiringVendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vendor contracts are expiring or overdue.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border/50">
                      {expiringVendors.map((vendor) => (
                        <div key={vendor.id} className="flex items-center justify-between py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{vendor.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Ends {vendor.contract_end}
                            </span>
                          </div>
                          <StatusBadge
                            variant={vendor.contract_state === 'expired' ? 'error' : 'pending'}
                          >
                            {vendor.contract_state}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-6">
          <Card className="shrink-0 border-border/80 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-slate-50/50 px-5 py-3.5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Zap className="size-4 text-[#5846EA]" /> Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.label}
                      onClick={action.run}
                      className="group flex w-full items-center gap-3 border-b border-border/40 px-5 py-3 text-sm font-medium text-slate-600 transition-colors last:border-0 hover:bg-indigo-50/50 hover:text-[#5846EA] cursor-pointer"
                    >
                      <Icon className="size-4 shrink-0 text-[#5846EA] transition-transform group-hover:scale-110" />
                      <span className="font-semibold">{action.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-1 flex-col border-border/80 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="shrink-0 border-b border-border/50 bg-slate-50/50 px-5 py-3.5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Activity className="size-4 text-[#5846EA]" /> System health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : health.length === 0 ? (
                <p className="text-sm text-muted-foreground">Health checks are unavailable.</p>
              ) : (
                health.map((check) => {
                  const Icon = HEALTH_ICON[check.status as HealthStatus] ?? Activity
                  return (
                    <div key={check.key} className="flex items-start justify-between gap-3 p-2 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-[#5846EA]">
                          <Icon className="size-3.5" />
                        </div>
                        <span className="truncate text-sm font-semibold text-slate-800">
                          {check.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5" title={check.detail}>
                        <div
                          className={cn(
                            'size-2 rounded-full',
                            check.status === 'healthy' ? 'bg-emerald-500 shadow-xs' : HEALTH_DOT[check.status as HealthStatus] ?? 'bg-muted-foreground/40',
                          )}
                        />
                        <span className="max-w-[120px] truncate text-xs font-bold text-slate-500">
                          {check.detail}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deactivate confirmation */}
      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Deactivate this user?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirmUser.full_name} will lose access immediately. Their enrolments, progress and
              certificates are kept, so this can be reversed by an administrator.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmUser(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={() => void removeUser(confirmUser.id).then(() => setConfirmUser(null))}
              >
                {saving ? 'Deactivating…' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
