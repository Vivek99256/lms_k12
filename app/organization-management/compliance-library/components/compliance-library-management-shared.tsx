'use client'

/**
 * Compliance Management, frontend-completion pass: extended from the
 * original G2G port with Category/Priority/Status support and a
 * "Create from Template" flow. Departments and Assigned Employee were
 * already backend-driven before this pass (fetched via
 * `useComplianceLibrary()`'s `departments`/`employees`, see
 * `compliance-library-api.ts`); this pass adds `categories`/`templates`
 * the same way. The dead hardcoded demo `departments` fallback array (with
 * fake employee names) that existed here before has been removed - it was
 * never reachable once real options are always passed, and kept dead code
 * around that looked like the exact hardcoding the product brief calls out.
 */

import type { ReactNode } from 'react'
import { Paperclip, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/g2g/button'
import { DatePicker } from '@/components/ui/date-picker'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/g2g/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/g2g/select'
import { Textarea } from '@/components/ui/g2g/textarea'
import type { ComplianceTemplateOption } from '../../_lib/compliance-library-api'

export type Frequency = 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Custom'
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'
export type Status =
  | 'Upcoming'
  | 'Due Soon'
  | 'In Progress'
  | 'Pending Verification'
  | 'Completed'
  | 'Overdue'
  | 'Expired'
  | 'Not Applicable'

export type ComplianceRecord = {
  id: string
  name: string
  description: string
  categoryId: string
  categoryName: string
  department: string
  departmentId: string
  assignedTo: string
  dueDate: string
  nextDueDate: string
  frequency: Frequency
  customDate?: string
  priority: Priority
  status: Status
  derivedStatus: Status
  evidenceCount: number
  attachmentName?: string
}

export type ComplianceFormState = {
  name: string
  description: string
  categoryId: string
  department: string
  departmentId: string
  assignedTo: string
  dueDate: string
  frequency: Frequency | ''
  customDate: string
  priority: Priority | ''
  status: Status | ''
  attachmentName: string
  attachmentFile?: File
}

/**
 * Closed vocabularies that exactly mirror the backend's validation lists
 * (`ComplianceLibraryRecord::FREQUENCIES/PRIORITIES/STATUSES` in the Laravel
 * app) - unlike Department/Assigned Employee/Category/Template, these are
 * not admin-managed master data, so there is nothing to fetch from an API;
 * the backend enforces the same fixed set via `Rule::in(...)`.
 */
export const frequencyOptions: Frequency[] = ['One-Time', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Custom']
export const priorityOptions: Priority[] = ['Low', 'Medium', 'High', 'Critical']
export const statusOptions: Status[] = ['Upcoming', 'Due Soon', 'In Progress', 'Pending Verification', 'Completed', 'Overdue', 'Expired', 'Not Applicable']

export const initialForm: ComplianceFormState = {
  name: '',
  description: '',
  categoryId: '',
  department: '',
  departmentId: '',
  assignedTo: '',
  dueDate: '',
  frequency: '',
  customDate: '',
  priority: '',
  status: '',
  attachmentName: '',
  attachmentFile: undefined,
}

export const frequencySelectOptions = frequencyOptions.map((frequency) => ({ label: frequency, value: frequency }))
export const prioritySelectOptions = priorityOptions.map((priority) => ({ label: priority, value: priority }))
export const statusSelectOptions = statusOptions.map((status) => ({ label: status, value: status }))
export const pageSizeOptions = [10, 25, 50].map((size) => ({ label: `${size} / page`, value: String(size) }))

export function toIsoDate(value?: Date | string) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return format(date, 'yyyy-MM-dd')
}

export function displayDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd MMM yyyy')
}

export function createCsv(records: ComplianceRecord[]) {
  const headers = ['Sr No.', 'Name', 'Category', 'Department', 'Assigned To', 'Due Date', 'Frequency', 'Priority', 'Status', 'Evidence']
  const rows = records.map((record, index) => [
    String(index + 1),
    record.name,
    record.categoryName || '-',
    record.department,
    record.assignedTo,
    displayDate(record.dueDate),
    record.frequency,
    record.priority,
    record.derivedStatus,
    String(record.evidenceCount ?? 0),
  ])
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Applies a template's defaults onto a (usually blank) form - the "Create from Template" flow. */
export function applyTemplate(form: ComplianceFormState, template: ComplianceTemplateOption): ComplianceFormState {
  return {
    ...form,
    name: template.name,
    description: template.description ?? form.description,
    categoryId: template.category_id ? String(template.category_id) : form.categoryId,
    frequency: (template.default_frequency as Frequency) || form.frequency,
    customDate: template.default_custom_frequency_details ?? form.customDate,
    priority: (template.default_priority as Priority) || form.priority,
  }
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

export function ComplianceForm({
  form,
  categoryOptions,
  departmentOptions,
  employeeOptions,
  templates,
  showStatus,
  onChange,
  onSubmit,
  onApplyTemplate,
  submitLabel,
  uploadKey,
  currentAttachment,
  saving,
}: {
  form: ComplianceFormState
  categoryOptions: { label: string; value: string }[]
  departmentOptions: { label: string; value: string }[]
  /** Real employees fetched from the API, scoped to the selected department when the backend supplied `department_id` for each employee. */
  employeeOptions: { label: string; value: string; department_id?: number | null }[]
  templates?: ComplianceTemplateOption[]
  /** Status is only editable once a record exists - a new record always starts at the backend's default (Upcoming). */
  showStatus?: boolean
  onChange: (next: Partial<ComplianceFormState>) => void
  onSubmit: () => void
  onApplyTemplate?: (template: ComplianceTemplateOption) => void
  submitLabel: string
  uploadKey: string | number
  currentAttachment?: string
  saving?: boolean
}) {
  const filteredEmployeeOptions = form.departmentId
    ? employeeOptions.filter((employee) => !employee.department_id || String(employee.department_id) === form.departmentId)
    : employeeOptions

  const handleDepartmentChange = (departmentId: string) => {
    const department = departmentOptions.find((option) => option.value === departmentId)
    onChange({ departmentId, department: department?.label ?? '', assignedTo: '' })
  }

  return (
    <div className="grid gap-5">
      {templates && templates.length > 0 && onApplyTemplate && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="text-sm text-muted-foreground">Create from template:</span>
          <Select
            value=""
            onChange={(value) => {
              const template = templates.find((item) => String(item.id) === value)
              if (template) onApplyTemplate(template)
            }}
            options={templates.map((template) => ({ label: template.name, value: String(template.id) }))}
            placeholder="Choose a template"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Compliance Name" required>
          <Input
            aria-label="Compliance Name"
            placeholder="Enter compliance name"
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        <Field label="Category" required>
          <Select
            value={form.categoryId}
            onChange={(categoryId) => onChange({ categoryId })}
            options={categoryOptions}
            placeholder="Select category"
          />
        </Field>

        <div className="lg:col-span-2">
          <Field label="Description" required>
            <Textarea
              aria-label="Description"
              placeholder="Summarize compliance requirement, controls, and evidence needed"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Department">
          <Select
            value={form.departmentId}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Select department"
          />
        </Field>

        <Field label="Assigned Employee">
          <Select
            value={form.assignedTo}
            onChange={(assignedTo) => onChange({ assignedTo })}
            options={filteredEmployeeOptions}
            placeholder={form.departmentId ? 'Select employee' : 'Select employee'}
          />
        </Field>

        <Field label="Due Date" required>
          <DatePicker
            value={form.dueDate}
            onChange={(date) => onChange({ dueDate: toIsoDate(date) })}
            placeholder="Select due date"
          />
        </Field>

        <Field label="Frequency">
          <Select
            value={form.frequency}
            onChange={(frequency) => onChange({ frequency: frequency as Frequency, customDate: frequency === 'Custom' ? form.customDate : '' })}
            options={frequencySelectOptions}
            placeholder="Select frequency"
          />
        </Field>

        {form.frequency === 'Custom' && (
          <Field label="Custom Next-Due Date">
            <DatePicker
              value={form.customDate}
              onChange={(date) => onChange({ customDate: toIsoDate(date) })}
              placeholder="Select the next due date for this custom cycle"
            />
          </Field>
        )}

        <Field label="Priority">
          <Select
            value={form.priority}
            onChange={(priority) => onChange({ priority: priority as Priority })}
            options={prioritySelectOptions}
            placeholder="Select priority"
          />
        </Field>

        {showStatus && (
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(status) => onChange({ status: status as Status })}
              options={statusSelectOptions}
              placeholder="Select status"
            />
          </Field>
        )}
      </div>

      <div className="grid gap-3">
        <FileUpload
          key={uploadKey}
          label="Attachment Upload"
          hint="PDF, DOCX, XLSX, PNG up to 10MB"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onFileSelect={(file) => onChange({ attachmentName: file?.name ?? '', attachmentFile: file ?? undefined })}
        />
        {currentAttachment && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Paperclip className="size-4" />
            <span className="truncate">Current attachment: {currentAttachment}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" className="w-full gap-2 sm:w-auto" onClick={onSubmit} disabled={saving}>
          <Plus className="size-4" />
          {saving ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-12 w-full animate-pulse rounded bg-muted/40" />
      ))}
    </div>
  )
}
