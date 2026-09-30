'use client'

/**
 * Ported as-is from G2G's `components/domain/organization/
 * employee-directory-sheets.tsx`.
 *
 * - `@/components/ui/button`, `input`, `select` -> the shared
 *   `@/components/ui/g2g/*` copies (same reasoning as every other ported
 *   G2G screen).
 * - `@/components/ui/checkbox`, `label`, `sheet`, `date-picker` are the
 *   native primitives, already G2G-compatible.
 * - `@/components/ui/time-picker`, `@/components/ui/radio-group` ->
 *   `@/components/ui/g2g/time-picker`, `@/components/ui/g2g/radio-group`
 *   (not present natively - see those files).
 * - `@/types/employee` -> `../../_lib/organization-types`.
 * - `@/services/organization/employee-profile-service` ->
 *   `../../_lib/employee-directory-api`.
 * - `getLaravelContext()` (G2G's Laravel-context resolver) ->
 *   `buildSessionContext()`, this project's session resolver.
 * - The 7 lazy-loaded `edit-employee/*` tabs now point at the local
 *   `./edit-employee/*` instead of G2G's `@/domain/organization/
 *   edit-employee/*`.
 *
 * Classes/markup/behavior/data-shape handling unchanged.
 */

import { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { AlertCircle, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Shield, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/g2g/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Select } from '@/components/ui/g2g/select'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/g2g/time-picker'
import { RadioGroup, Radio } from '@/components/ui/g2g/radio-group'
import { cn } from '@/lib/utils'
import { toDateOnly } from '@/lib/date-only'
import type { Employee } from '../../_lib/organization-types'
import {
  buildSessionContext,
  EmployeeDirectoryService,
  fetchEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeeDocument,
  fetchCompetencyProfile,
  updateSkillRating,
  type EmployeeProfileFullResponse,
  type ReferenceData,
} from '../../_lib/employee-directory-api'

const PersonalInfoTab = lazy(() =>
  import('./edit-employee/personal-info-tab').then((m) => ({
    default: m.PersonalInfoTab,
  })),
)

const UploadDocTab = lazy(() =>
  import('./edit-employee/upload-doc-tab').then((m) => ({
    default: m.UploadDocTab,
  })),
)

const JobroleSkillTab = lazy(() =>
  import('./edit-employee/jobrole-skill-tab').then((m) => ({
    default: m.JobroleSkillTab,
  })),
)

const JobroleTasksTab = lazy(() =>
  import('./edit-employee/jobrole-tasks-tab').then((m) => ({
    default: m.JobroleTasksTab,
  })),
)

const LorTab = lazy(() =>
  import('./edit-employee/lor-tab').then((m) => ({
    default: m.LorTab,
  })),
)

const CompetencyRatingTab = lazy(() =>
  import('./edit-employee/competency-rating-tab').then((m) => ({
    default: m.CompetencyRatingTab,
  })),
)

const ExpectedCompetencyTab = lazy(() =>
  import('./edit-employee/expected-competency-tab').then((m) => ({
    default: m.ExpectedCompetencyTab,
  })),
)

const TOP_TABS = [
  { id: 'personal-info', label: 'Personal Information' },
  { id: 'upload-docs', label: 'Upload Document' },
  { id: 'jobrole-skill', label: 'Jobrole Skill' },
  { id: 'jobrole-tasks', label: 'Jobrole Tasks' },
  { id: 'responsibility', label: 'Level of Responsibility' },
  { id: 'skill-rating', label: 'Competency Rating' },
  { id: 'expected-competency', label: 'Expected Competency' },
] as const

type EmployeeDirectorySheetsProps = {
  isAddSheetOpen: boolean
  onAddSheetOpenChange: (open: boolean) => void
  activeEmployee: Employee | null
  onCloseEmployeeSheet: () => void
  /** Fired after a successful Add Employee submit, with the backend's success message. */
  onEmployeeCreated: (message: string) => void
}

type CompetencyCategory = 'Skill' | 'Knowledge' | 'Ability' | 'Attitude' | 'Behaviour'
type CompetencyRatings = Record<CompetencyCategory, Array<{
  id: string
  title: string
  description: string
  current_level: number | null
  max_level: number
}>>

function competencyCategory(value: unknown): CompetencyCategory {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized.includes('knowledge')) return 'Knowledge'
  if (normalized.includes('ability')) return 'Ability'
  if (normalized.includes('attitude')) return 'Attitude'
  if (normalized.includes('behavio')) return 'Behaviour'
  return 'Skill'
}

function numericRating(value: unknown): number | null {
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 0 ? Math.min(5, rating) : null
}

/** Normalises the KABA response while accepting the API's object- or array-shaped payloads. */
function mapKabaRatings(payload: any): CompetencyRatings {
  const ratings: CompetencyRatings = {
    Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
  }
  const source = Array.isArray(payload)
    ? payload
    : payload?.data ?? payload?.result ?? payload?.kaba ?? payload ?? []

  const groupedSource = !Array.isArray(source) && typeof source === 'object' ? source : null
  if (groupedSource) {
    for (const [categoryName, items] of Object.entries(groupedSource)) {
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const title = item.competency ?? item.competency_name ?? item.title ?? item.name ?? item.skill ?? item.kaba ?? item.sub_category ?? item.category
        if (!title) continue
        const category = competencyCategory(categoryName)
        ratings[category].push({
          id: String(item.id ?? item.kaba_id ?? item.competency_id ?? `${category}-${title}`),
          title: String(title),
          description: String(item.description ?? item.competency_description ?? item.details ?? title),
          current_level: numericRating(item.current_level ?? item.rating ?? item.proficiency_level ?? item.level),
          max_level: numericRating(item.max_level ?? item.maximum_level) ?? 5,
        })
      }
    }
    return ratings
  }

  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const category = competencyCategory(item.category ?? item.competency_category ?? item.kaba_type ?? item.type)
    const title = item.competency ?? item.competency_name ?? item.title ?? item.name ?? item.skill ?? item.kaba ?? item.sub_category ?? item.category
    if (!title) continue
    ratings[category].push({
      id: String(item.id ?? item.kaba_id ?? item.competency_id ?? `${category}-${title}`),
      title: String(title),
      description: String(item.description ?? item.competency_description ?? item.details ?? title),
      current_level: numericRating(item.current_level ?? item.rating ?? item.proficiency_level ?? item.level),
      max_level: numericRating(item.max_level ?? item.maximum_level) ?? 5,
    })
  }

  return ratings
}

type ExpectedCompetencyData = Record<CompetencyCategory, Array<{
  id: string
  title: string
  description: string
  expectedLevel: number
  actualLevel: number
}>>

/**
 * Groups the flat `.../competency-profile` item array into the
 * `Record<CategoryType, CompetencyGap[]>` shape `ExpectedCompetencyTab`
 * expects (`expectedLevel`/`actualLevel`, both required numbers - unrated
 * skills report `actualLevel: 0`, matching "not yet met" rather than being
 * dropped, so the tab's gap-analysis math has a real number to subtract).
 */
function mapExpectedCompetencies(items: any[]): ExpectedCompetencyData {
  const result: ExpectedCompetencyData = {
    Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
  }

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const title = item.title ?? item.name ?? item.skill
    if (!title) continue
    const category = competencyCategory(item.category ?? item.competency_type ?? item.type)
    const expectedLevel = numericRating(item.expected_level ?? item.expectedLevel) ?? 0
    const actualLevel = numericRating(item.current_level ?? item.currentLevel) ?? 0

    result[category].push({
      id: String(item.id ?? item.skill_id ?? `${category}-${title}`),
      title: String(title),
      description: String(item.description ?? title),
      expectedLevel,
      actualLevel,
    })
  }

  return result
}

const tabFallback = (
  <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
    Loading tab content...
  </div>
)

const WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type WorkingDay = (typeof WORKING_DAYS)[number]
const DAY_LABELS: Record<WorkingDay, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
const ADD_STEP_LABELS = ['Personal Details', 'Employment Structure', 'Address Information', 'Reporting & Deposit', 'Attendance Setup']

type DaySchedule = { working: boolean; in: string; out: string }

function defaultSchedule(): Record<WorkingDay, DaySchedule> {
  return WORKING_DAYS.reduce((acc, day) => {
    acc[day] = { working: day !== 'sunday', in: '09:00', out: '18:00' }
    return acc
  }, {} as Record<WorkingDay, DaySchedule>)
}

type AddEmployeeForm = {
  first_name: string
  last_name: string
  email: string
  mobile: string
  gender: 'M' | 'F'
  birthdate?: string
  department_id: string
  job_role_id: string
  user_profile_id: string
  joined_date?: string
  address: string
  city: string
  state: string
  pincode: string
  reporting_manager_id: string
  bank_name: string
  account_no: string
  ifsc_code: string
  schedule: Record<WorkingDay, DaySchedule>
}

function emptyForm(): AddEmployeeForm {
  return {
    first_name: '', last_name: '', email: '', mobile: '', gender: 'M', birthdate: undefined,
    department_id: '', job_role_id: '', user_profile_id: '', joined_date: undefined,
    address: '', city: '', state: '', pincode: '',
    reporting_manager_id: '', bank_name: '', account_no: '', ifsc_code: '',
    schedule: defaultSchedule(),
  }
}

/**
 * Real "Add Employee" flow, wired to `EmployeeDirectoryController::
 * referenceData()/create()` (both already existed server-side and were
 * simply unused by this sheet - see this file's git history for the
 * previous unbound-inputs mockup). Field mapping to `tbluser` columns is
 * confirmed against `tbluserModel::$fillable` and the create() validator:
 * required first_name/last_name/mobile/email/user_profile_id, everything
 * else optional and only sent if filled so `buildAttributeArray()` on the
 * backend (which writes every request key through as a column) never
 * receives an empty string for a field the user skipped.
 */
function AddEmployeeSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (message: string) => void
}) {
  const [addStep, setAddStep] = useState(1)
  const [form, setForm] = useState<AddEmployeeForm>(emptyForm)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [referenceLoading, setReferenceLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReferenceLoading(true)
    ;(async () => {
      try {
        const session = buildSessionContext()
        const response = await EmployeeDirectoryService.referenceData(session)
        if (!cancelled) setReference(response?.data ?? null)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load form options.')
      } finally {
        if (!cancelled) setReferenceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  function update<K extends keyof AddEmployeeForm>(key: K, value: AddEmployeeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateDay(day: WorkingDay, patch: Partial<DaySchedule>) {
    setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], ...patch } } }))
  }

  function handleOpenChange(next: boolean) {
    if (isSaving) return
    if (!next) {
      setForm(emptyForm())
      setAddStep(1)
      setError('')
    }
    onOpenChange(next)
  }

  async function handleFinish() {
    if (isSaving) return

    const firstName = form.first_name.trim()
    const lastName = form.last_name.trim()
    const mobile = form.mobile.trim()
    const email = form.email.trim()

    if (!firstName || !lastName) {
      setError('First name and last name are required.')
      setAddStep(1)
      return
    }
    if (!mobile) {
      setError('Phone number is required.')
      setAddStep(1)
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('A valid corporate email is required.')
      setAddStep(1)
      return
    }
    if (!form.user_profile_id) {
      setError('User Profile / Role is required.')
      setAddStep(2)
      return
    }

    setError('')
    setIsSaving(true)
    try {
      const session = buildSessionContext()
      const payload: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email,
        mobile,
        user_profile_id: form.user_profile_id,
        gender: form.gender,
      }
      if (form.birthdate) payload.birthdate = form.birthdate
      if (form.department_id) payload.department_id = form.department_id
      if (form.job_role_id) payload.allocated_standards = form.job_role_id
      if (form.joined_date) payload.joined_date = form.joined_date
      if (form.address.trim()) payload.address = form.address.trim()
      if (form.city.trim()) payload.city = form.city.trim()
      if (form.state.trim()) payload.state = form.state.trim()
      if (form.pincode.trim()) payload.pincode = form.pincode.trim()
      if (form.reporting_manager_id) payload.reporting_manager_id = form.reporting_manager_id
      if (form.bank_name.trim()) payload.bank_name = form.bank_name.trim()
      if (form.account_no.trim()) payload.account_no = form.account_no.trim()
      if (form.ifsc_code.trim()) payload.ifsc_code = form.ifsc_code.trim()

      for (const day of WORKING_DAYS) {
        const schedule = form.schedule[day]
        payload[day] = schedule.working ? 1 : 0
        if (schedule.working) {
          payload[`${day}_in_date`] = schedule.in
          payload[`${day}_out_date`] = schedule.out
        }
      }

      const response = await EmployeeDirectoryService.create(session, payload)
      onCreated(response?.message || 'Employee created successfully.')
      handleOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create employee.')
    } finally {
      setIsSaving(false)
    }
  }

  const departmentOptions = (reference?.departments ?? []).map((d) => ({ label: d.name, value: String(d.id) }))
  const jobRoleOptions = (reference?.job_roles ?? [])
    .filter((role) => !form.department_id || String(role.department_id ?? '') === form.department_id)
    .map((role) => ({ label: role.name, value: String(role.id) }))
  const userProfileOptions = (reference?.user_profiles ?? []).map((p) => ({ label: p.name, value: String(p.id) }))
  const managerOptions = (reference?.managers ?? []).map((m) => ({
    label: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || `Employee #${m.employee_no ?? ''}`,
    value: String(m.id),
  }))

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden border-l border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-xl">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-primary/5 via-transparent to-transparent" />

        <div className="relative z-10 border-b border-border/40 bg-surface/50 px-6 py-6">
          <SheetTitle className="text-xl">Add New People</SheetTitle>
          <SheetDescription className="mt-1">
            Step {addStep} of 5: {ADD_STEP_LABELS[addStep - 1]}
          </SheetDescription>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {addStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} placeholder="e.g. Sarah" disabled={isSaving} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} placeholder="e.g. Jenkins" disabled={isSaving} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Corporate Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="sarah.j@company.com" disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number <span className="text-destructive">*</span></Label>
                <Input type="tel" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} placeholder="+1 (555) 000-0000" disabled={isSaving} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup value={form.gender} onValueChange={(value) => update('gender', value as 'M' | 'F')}>
                    <Radio value="M" label="Male" disabled={isSaving} />
                    <Radio value="F" label="Female" disabled={isSaving} />
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <DatePicker value={form.birthdate} onChange={(date) => update('birthdate', date ? toDateOnly(date) : undefined)} disabled={isSaving} />
                </div>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  placeholder={referenceLoading ? 'Loading...' : 'Select Department'}
                  options={departmentOptions}
                  value={form.department_id}
                  onChange={(value) => {
                    update('department_id', value)
                    update('job_role_id', '')
                  }}
                  disabled={isSaving || referenceLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Job Role / Designation</Label>
                <Select
                  placeholder={referenceLoading ? 'Loading...' : 'Select Job Role'}
                  options={jobRoleOptions}
                  value={form.job_role_id}
                  onChange={(value) => update('job_role_id', value)}
                  disabled={isSaving || referenceLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>User Profile / Role <span className="text-destructive">*</span></Label>
                <Select
                  placeholder={referenceLoading ? 'Loading...' : 'Select User Profile'}
                  options={userProfileOptions}
                  value={form.user_profile_id}
                  onChange={(value) => update('user_profile_id', value)}
                  disabled={isSaving || referenceLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <DatePicker value={form.joined_date} onChange={(date) => update('joined_date', date ? toDateOnly(date) : undefined)} disabled={isSaving} />
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="123 Corporate Blvd, Suite 400" disabled={isSaving} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="San Francisco" disabled={isSaving} />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="California" disabled={isSaving} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pincode / Postal Code</Label>
                <Input value={form.pincode} onChange={(e) => update('pincode', e.target.value)} placeholder="94105" disabled={isSaving} />
              </div>
            </div>
          )}

          {addStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reporting Manager</Label>
                <Select
                  placeholder={referenceLoading ? 'Loading...' : 'Select Reporting Manager'}
                  options={managerOptions}
                  value={form.reporting_manager_id}
                  onChange={(value) => update('reporting_manager_id', value)}
                  disabled={isSaving || referenceLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} placeholder="Silicon Valley Bank" disabled={isSaving} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={form.account_no} onChange={(e) => update('account_no', e.target.value)} placeholder="9842" disabled={isSaving} />
                </div>
                <div className="space-y-2">
                  <Label>IFSC / Routing Code</Label>
                  <Input value={form.ifsc_code} onChange={(e) => update('ifsc_code', e.target.value)} placeholder="SVBK0001234" disabled={isSaving} />
                </div>
              </div>
            </div>
          )}

          {addStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {WORKING_DAYS.map((day) => (
                    <label key={day} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.schedule[day].working}
                        onCheckedChange={(checked) => updateDay(day, { working: checked })}
                        disabled={isSaving}
                      />
                      {DAY_LABELS[day]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Default In-Time</Label>
                  <TimePicker
                    value={form.schedule.monday.in}
                    onChange={(time) => WORKING_DAYS.forEach((day) => updateDay(day, { in: time }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Out-Time</Label>
                  <TimePicker
                    value={form.schedule.monday.out}
                    onChange={(time) => WORKING_DAYS.forEach((day) => updateDay(day, { out: time }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-border/40 bg-surface/50 px-6 py-4">
          <Button
            variant="ghost"
            disabled={addStep === 1 || isSaving}
            onClick={() => setAddStep(s => Math.max(1, s - 1))}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            {addStep < 5 ? (
              <Button onClick={() => setAddStep(s => Math.min(5, s + 1))} disabled={isSaving}>
                Next Step
              </Button>
            ) : (
              <Button onClick={() => void handleFinish()} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isSaving ? 'Creating...' : 'Add Person'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmployeeOverviewSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTopTab, setActiveTopTab] = useState<(typeof TOP_TABS)[number]['id']>('personal-info')
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<EmployeeProfileFullResponse | null>(null)
  const [competencyProfile, setCompetencyProfile] = useState<any | null>(null)

  const loadData = useCallback(async () => {
    if (!employee?.id) return
    setIsLoading(true)
    // Clear the previous employee's profile immediately, before the new
    // fetch resolves - otherwise the Skills/Tasks/LOR/Competency tabs keep
    // rendering stale data (or, worse, the hardcoded placeholder fallbacks
    // below) for the moment between "switch employee" and "response received".
    setProfileData(null)
    setCompetencyProfile(null)
    try {
      const [resProfile, resCompetency] = await Promise.allSettled([
        fetchEmployeeProfile(employee.id),
        fetchCompetencyProfile(employee.id),
      ])

      if (resProfile.status === 'fulfilled') {
        setProfileData(resProfile.value)
      }
      if (resCompetency.status === 'fulfilled') {
        setCompetencyProfile(resCompetency.value)
      }
    } catch (err) {
      console.error('Failed to fetch profile details:', err)
    } finally {
      setIsLoading(false)
    }
  }, [employee?.id])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, loadData])

  /*
   * G2G's real Competency Rating data source (`fetchJobRoleKaba` ->
   * `/get-kaba`) is dead code in G2G itself: `SkillMatrixController::getKaba`
   * has a live, uncommented `dd()` that halts every request before it
   * returns JSON (confirmed by reading the source). G2G's frontend never
   * notices because it always lands in the catch/error branch. There is
   * nothing working to port from that path.
   *
   * Both tabs are instead derived from the same `competencyProfile` fetch
   * already loaded by `loadData()` (the backend's
   * `.../employee-directory/{id}/competency-profile`, scoped to this
   * employee's job role - see that endpoint's docblock). `mapKabaRatings()`
   * groups the flat item array into `Record<CategoryType, RatingItem[]>` for
   * Competency Rating; `mapExpectedCompetencies()` does the equivalent for
   * Expected Competency's `expectedLevel`/`actualLevel` shape.
   */
  const competencyItems = useMemo<any[]>(() => {
    const raw = competencyProfile?.data
    return Array.isArray(raw) ? raw : []
  }, [competencyProfile])

  const kabaRatings = useMemo(() => mapKabaRatings(competencyItems), [competencyItems])
  const expectedCompetencyData = useMemo(() => mapExpectedCompetencies(competencyItems), [competencyItems])

  /*
   * Tab strip scroll affordances (chevrons + edge fade + auto-scroll active
   * tab into view) - there are 7 tabs and the strip overflows on typical
   * widths, but a bare `overflow-x-auto` gives no visual hint that more tabs
   * exist, so users never discover e.g. Expected Competency. Same pattern
   * as this app's own ModuleTabBar (K-12 ERP Design System/components/
   * navigation/ModuleTabBar.jsx): measure scroll position on scroll/resize,
   * show a chevron + gradient mask on whichever edge has more content, and
   * scroll the active tab into view whenever it changes.
   */
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const [tabEdge, setTabEdge] = useState({ start: false, end: false })

  const measureTabEdges = useCallback(() => {
    const el = tabScrollRef.current
    if (!el) return
    setTabEdge({
      start: el.scrollLeft > 2,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
  }, [])

  useLayoutEffect(() => {
    measureTabEdges()
    const el = tabScrollRef.current
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureTabEdges) : null
    if (ro && el) ro.observe(el)
    window.addEventListener('resize', measureTabEdges)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measureTabEdges)
    }
  }, [measureTabEdges])

  useEffect(() => {
    const el = tabScrollRef.current
    if (!el) return
    const btn = el.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTopTab}"]`)
    if (!btn) return
    const left = btn.offsetLeft
    const right = left + btn.offsetWidth
    if (left < el.scrollLeft) el.scrollTo({ left: left - 16, behavior: 'smooth' })
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth + 16, behavior: 'smooth' })
  }, [activeTopTab])

  const nudgeTabs = (direction: 1 | -1) => {
    tabScrollRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' })
  }

  const tabEdgeMask =
    tabEdge.start && tabEdge.end
      ? 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)'
      : tabEdge.start
        ? 'linear-gradient(to right, transparent, black 24px)'
        : tabEdge.end
          ? 'linear-gradient(to right, black calc(100% - 24px), transparent)'
          : 'none'

  const handleSavePersonalInfo = async (formData: any) => {
    if (!employee?.id) return
    await updateEmployeeProfile(employee.id, formData)
    await loadData()
  }

  const handleUploadDocument = async (formData: FormData) => {
    if (!employee?.id) return
    await uploadEmployeeDocument(employee.id, formData)
    await loadData()
  }

  /**
   * KNOWN ISSUE (2026-08-25 migration audit): `updateSkillRating()` 422s on
   * every real call - see its docblock in `employee-directory-api.ts` for the
   * full root cause. Short version: `matrixId` here is a
   * `.../competency-profile` item id (job-role KASBA catalog), not an
   * `s_skill_matrix` row id, which is what `PUT .../{id}/skills/{matrixId}`
   * actually validates against.
   *
   * A working item-level rating endpoint DOES exist on the backend
   * (`POST /competency/kasba-rating`, wired as `EmployeeDirectoryService.
   * rateKasbaItem()`) - but it validates `kasba_item_id` against its own
   * `competency_kasba_item` table, and this screen's `matrixId`/`category`
   * don't correspond to that table's ids either (confirmed by reading both
   * controllers; there is no shared id space between `.../competency-profile`
   * and `competency_kasba_item`). Swapping the call below for `rateKasbaItem`
   * would trade one failing call for another, not fix the bug. Left as-is
   * pending a backend change that reconciles the two id spaces (or returns
   * `competency-profile` items keyed by `competency_kasba_item.id`).
   */
  const handleSaveRating = async (category: string, matrixId: string, level: number) => {
    if (!employee?.id) return
    await updateSkillRating(employee.id, matrixId, level)
    await loadData()
  }

  const mergedEmployee = {
    ...employee,
    ...(profileData?.data || {}),
    full_name: profileData?.data
      ? `${profileData.data.first_name || ''} ${profileData.data.last_name || ''}`.trim() || employee.full_name
      : employee.full_name,
    jobRole: profileData?.data?.userJobrole || employee.jobRole,
    department_name: profileData?.data?.userDepartment || employee.department_name,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-[95vw] flex-col gap-0 border-l border-border/80 p-0 sm:max-w-4xl">
        {/*
         * `min-w-0` here and on the tab strip below overrides flex items'
         * default `min-width: auto` - without it, this column (and the tab
         * strip inside it) refuses to shrink below the intrinsic width of
         * its widest content (the whitespace-nowrap tab buttons), so it
         * grows past the sheet's actual width instead of clipping. That
         * silently defeats the tab strip's own `overflow-x-auto`: it never
         * becomes narrower than its content, so there's nothing to scroll -
         * later tabs (Expected Competency) just render off-screen with no
         * way to reach them.
         */}
        <div className="flex h-full min-w-0 flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-surface px-6 py-5">
            <div className="flex items-center gap-4">
              {mergedEmployee.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- External URLs may not work with next/image
                <img src={mergedEmployee.image} alt={mergedEmployee.full_name} className="size-14 rounded-full border-2 border-background object-cover shadow-sm" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-primary shadow-sm">
                  <User className="size-6" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-foreground">{mergedEmployee.full_name}</h2>
                <p className="text-sm font-medium text-muted-foreground">{mergedEmployee.jobRole} {mergedEmployee.department_name ? `• ${mergedEmployee.department_name}` : ''}</p>
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading live API data...
              </div>
            )}
          </div>

          <div className="relative w-full min-w-0 border-b bg-surface-muted/30">
            {tabEdge.start && (
              <button
                type="button"
                aria-label="Scroll tabs back"
                onClick={() => nudgeTabs(-1)}
                className="absolute left-0 top-0 z-10 flex h-full w-8 cursor-pointer items-center justify-center bg-gradient-to-r from-surface-muted/95 to-transparent text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div
              ref={tabScrollRef}
              onScroll={measureTabEdges}
              role="tablist"
              aria-label="Employee profile sections"
              className="scrollbar-thin flex w-full min-w-0 gap-1 overflow-x-auto px-6 py-2"
              style={{ WebkitMaskImage: tabEdgeMask, maskImage: tabEdgeMask }}
            >
              {TOP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-tab-id={tab.id}
                  aria-selected={activeTopTab === tab.id}
                  onClick={() => setActiveTopTab(tab.id)}
                  className={cn(
                    'shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95',
                    activeTopTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {tabEdge.end && (
              <button
                type="button"
                aria-label="Scroll tabs forward"
                onClick={() => nudgeTabs(1)}
                className="absolute right-0 top-0 z-10 flex h-full w-8 cursor-pointer items-center justify-center bg-gradient-to-l from-surface-muted/95 to-transparent text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div key={activeTopTab} className="animate-in fade-in slide-in-from-bottom-2 flex-1 overflow-hidden bg-surface p-6 duration-300">
            {activeTopTab === 'personal-info' && (
              <Suspense fallback={tabFallback}>
                <PersonalInfoTab
                  employee={mergedEmployee}
                  departments={profileData?.departments || []}
                  jobRoles={profileData?.jobroleList || []}
                  userProfiles={profileData?.user_profiles || []}
                  employeesList={profileData?.employees || []}
                  onSave={handleSavePersonalInfo}
                />
              </Suspense>
            )}
            {activeTopTab === 'upload-docs' && (
              <Suspense fallback={tabFallback}>
                <UploadDocTab
                  employee={mergedEmployee}
                  documentTypes={profileData?.documentTypeLists || [
                    { id: 1, document_type: 'Resume' },
                    { id: 2, document_type: 'Offer Letter' },
                    { id: 3, document_type: 'ID Proof' },
                    { id: 4, document_type: 'Address Proof' },
                  ]}
                  documentLists={profileData?.documentLists || []}
                  onUpload={handleUploadDocument}
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-skill' && (
              <Suspense fallback={tabFallback}>
                {isLoading ? (
                  tabFallback
                ) : (
                  <JobroleSkillTab
                    employee={mergedEmployee}
                    skills={
                      (profileData?.jobroleSkills && profileData.jobroleSkills.length > 0)
                        ? profileData.jobroleSkills
                        : (profileData?.skills && profileData.skills.length > 0)
                        ? profileData.skills
                        : (profileData?.data?.jobroleSkills && profileData.data.jobroleSkills.length > 0)
                        ? profileData.data.jobroleSkills
                        : (profileData?.data?.skills && profileData.data.skills.length > 0)
                        ? profileData.data.skills
                        : []
                    }
                  />
                )}
              </Suspense>
            )}
            {activeTopTab === 'jobrole-tasks' && (
              <Suspense fallback={tabFallback}>
                {isLoading ? (
                  tabFallback
                ) : (
                  <JobroleTasksTab tasks={profileData?.jobroleTasks || []} />
                )}
              </Suspense>
            )}
            {activeTopTab === 'responsibility' && (
              <Suspense fallback={tabFallback}>
                {isLoading ? (
                  tabFallback
                ) : (
                  <LorTab data={profileData?.userLevelOfResponsibility || {}} />
                )}
              </Suspense>
            )}
            {activeTopTab === 'skill-rating' && (
              <Suspense fallback={tabFallback}>
                {isLoading ? (
                  tabFallback
                ) : (
                  <CompetencyRatingTab
                    onSave={(category, id, level) => handleSaveRating(category, id, level)}
                    data={kabaRatings}
                  />
                )}
              </Suspense>
            )}
            {activeTopTab === 'expected-competency' && (
              <Suspense fallback={tabFallback}>
                {isLoading ? tabFallback : <ExpectedCompetencyTab data={expectedCompetencyData} />}
              </Suspense>
            )}
            {activeTopTab !== 'personal-info' && activeTopTab !== 'upload-docs' && activeTopTab !== 'jobrole-skill' && activeTopTab !== 'jobrole-tasks' && activeTopTab !== 'responsibility' && activeTopTab !== 'skill-rating' && activeTopTab !== 'expected-competency' && (
              <div className="flex h-full flex-col items-center justify-center space-y-4 text-muted-foreground">
                <div className="rounded-full bg-muted/50 p-4">
                  <Briefcase className="size-8 opacity-50" />
                </div>
                <p>The &quot;{TOP_TABS.find((t) => t.id === activeTopTab)?.label}&quot; tab is under construction.</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function EmployeeDirectorySheets({
  isAddSheetOpen,
  onAddSheetOpenChange,
  activeEmployee,
  onCloseEmployeeSheet,
  onEmployeeCreated,
}: EmployeeDirectorySheetsProps) {
  return (
    <>
      <AddEmployeeSheet
        key={isAddSheetOpen ? 'open' : 'closed'}
        open={isAddSheetOpen}
        onOpenChange={onAddSheetOpenChange}
        onCreated={onEmployeeCreated}
      />
      {activeEmployee && (
        <EmployeeOverviewSheet
          key={activeEmployee.id}
          employee={activeEmployee}
          open={!!activeEmployee}
          onOpenChange={(open) => !open && onCloseEmployeeSheet()}
        />
      )}
    </>
  )
}
