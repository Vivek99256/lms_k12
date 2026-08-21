'use client'

/**
 * Ported from G2G's `components/domain/task/my-task-details-drawer.tsx`
 * (`MyTaskDetailsDrawer`). Markup, the edit/reassign form, the deadline
 * extension thread and the status-update form are unchanged. Adaptations:
 *
 * - `taskService.*` (`LaravelContext` first argument) -> `myTasksApi.*`
 *   (`_lib/my-tasks-api.ts`), which takes a `TaskSession`
 *   (`resolveTaskSession()` / `getTaskSession()`) instead.
 * - G2G's local `<Select value onChange options>` -> `NativeSelect`
 *   (`_components/task-shared.tsx`).
 */

import { useEffect, useState } from 'react'
import { CalendarClock, CalendarDays, CheckCircle2, Clock, Edit2, FileText, Trash2, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { Spinner } from '@/components/ui/spinner'
import { NativeSelect } from '../../_components/task-shared'
import { PriorityBadge } from '../../_components/priority-badge'
import { myTasksApi } from '../../_lib/my-tasks-api'
import { getTaskSession, isTaskSessionReady, toMessage } from '../../_lib/task-session'
import type { DeadlineExtension, MyTask, TaskStatusOption } from '../../_lib/task-types'

/** Shown until the tenant's own vocabulary arrives from `/statuses`. */
const SYSTEM_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN-PROGRESS' },
  { label: 'On Hold', value: 'ON HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
]

interface Props {
  taskId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

export function MyTaskDetailsDrawer({ taskId, open, onClose, onUpdated }: Props) {
  const [task, setTask] = useState<MyTask | null>(null)
  const [status, setStatus] = useState<string>('PENDING')
  const [statusOptions, setStatusOptions] = useState(SYSTEM_STATUS_OPTIONS)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([])
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [editPriority, setEditPriority] = useState('Medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [extensions, setExtensions] = useState<DeadlineExtension[]>([])
  const [extDate, setExtDate] = useState('')
  const [extReason, setExtReason] = useState('')
  const [extBusy, setExtBusy] = useState(false)

  const session = getTaskSession()

  useEffect(() => {
    if (!open || !taskId) return
    const id = taskId
    let active = true

    queueMicrotask(() => {
      if (!active) return
      const activeSession = getTaskSession()
      if (!isTaskSessionReady(activeSession)) {
        setError('Your ERP session is unavailable. Please sign in again.')
        return
      }
      run(activeSession)
    })

    function run(activeSession: ReturnType<typeof getTaskSession>) {
      setLoading(true)
      setError('')
      setMessage('')
      myTasksApi
        .getDeadlineExtensions(activeSession, id)
        .then((response) => { if (active) setExtensions(response.data.extensions) })
        .catch(() => { /* the drawer still works without the extension history */ })

      myTasksApi
        .getStatusOptions(activeSession)
        .then((response) => {
          if (!active || !response.data.statuses.length) return
          setStatusOptions(response.data.statuses.map((option: TaskStatusOption) => ({ label: option.name, value: option.is_system ? option.category : option.name })))
        })
        .catch(() => { /* the four system statuses remain selectable */ })

      myTasksApi
        .getMyTask(activeSession, id)
        .then((response) => {
          if (!active) return
          setTask(response.data)
          setStatus(response.data.status_label || response.data.status)
          setRemarks(response.data.remarks ?? '')
          setEditTitle(response.data.title)
          setEditDescription(response.data.description)
          setEditAssignee(response.data.assignee_id ?? '')
          setEditPriority(response.data.priority ?? response.data.task_type ?? 'Medium')
          setEditDueDate(response.data.due_date ?? '')
        })
        .catch((reason: unknown) => { if (active) setError(toMessage(reason, 'Unable to load this task.')) })
        .finally(() => { if (active) setLoading(false) })
    }

    return () => { active = false }
  }, [open, taskId])

  async function saveStatus() {
    if (!task || !remarks.trim()) {
      setError('Remarks are required when updating a task status.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await myTasksApi.updateMyTaskStatus(session, task.id, status, remarks.trim())
      setTask({ ...task, status: response.data.status, status_label: response.data.status_label, remarks: remarks.trim() })
      setMessage(response.message)
      onUpdated()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to update the task.'))
    } finally {
      setSaving(false)
    }
  }

  async function startEditing() {
    setError('')
    try {
      const users = await myTasksApi.getAssignmentUsers(session)
      setEmployees(users.map((user) => ({ id: String(user.id), name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') })))
      setEditing(true)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load employees.'))
    }
  }

  async function saveTask() {
    if (!task || !editTitle.trim() || !editAssignee || !editDueDate) {
      setError('Title, assignee, and due date are required.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await myTasksApi.updateLegacyTask(session, task.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        assigneeId: editAssignee,
        observerId: task.owner_id ?? '',
        priority: editPriority,
        dueDate: editDueDate,
        status: task.status,
      })
      if (Number(response.status_code) !== 1) throw new Error(response.message)
      setMessage(response.message)
      setEditing(false)
      onUpdated()
      const refreshed = await myTasksApi.getMyTask(session, task.id)
      setTask(refreshed.data)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to update the task.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return
    setSaving(true)
    setError('')
    try {
      const response = await myTasksApi.deleteLegacyTask(session, task.id)
      if (Number(response.status_code) !== 1) throw new Error(response.message)
      onUpdated()
      onClose()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to delete the task.'))
    } finally {
      setSaving(false)
    }
  }

  async function refreshExtensions() {
    if (!taskId) return
    try {
      const response = await myTasksApi.getDeadlineExtensions(session, taskId)
      setExtensions(response.data.extensions)
    } catch { /* non-fatal */ }
  }

  async function requestExtension() {
    if (!task || !extDate || !extReason.trim()) {
      setError('A new date and a reason are required to request an extension.')
      return
    }
    setExtBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await myTasksApi.requestDeadlineExtension(session, { taskId: task.id, requestedDate: extDate, reason: extReason.trim() })
      setMessage(response.message)
      setExtDate('')
      setExtReason('')
      await refreshExtensions()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to request the extension.'))
    } finally {
      setExtBusy(false)
    }
  }

  async function decideExtension(id: string, decision: 'approve' | 'reject') {
    if (!task) return
    setExtBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await myTasksApi.decideDeadlineExtension(session, id, decision)
      setMessage(response.message)
      await refreshExtensions()
      const refreshed = await myTasksApi.getMyTask(session, task.id)
      setTask(refreshed.data)
      onUpdated()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to record the decision.'))
    } finally {
      setExtBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[640px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{task?.title ?? 'Task details'}</SheetTitle>
          <SheetDescription>Verified task information from Laravel</SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-98px)] overflow-y-auto p-6">
          {loading && <div className="flex h-48 items-center justify-center"><Spinner /></div>}
          {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

          {task && !loading && (
            <div className="space-y-6">
              {task.owner_id === session.userId && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => (editing ? setEditing(false) : void startEditing())}>
                    <Edit2 className="mr-2 size-4" />
                    {editing ? 'Cancel Edit' : 'Edit / Reassign'}
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={() => void deleteTask()} disabled={saving}>
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </div>
              )}
              {editing && (
                <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold">Task Title</span>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 w-full rounded-lg border px-3 text-sm" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold">Description</span>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-24 w-full rounded-lg border p-3 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold">Assignee</span>
                    <NativeSelect value={editAssignee} onChange={setEditAssignee}>
                      <option value="">Select</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold">Priority</span>
                    <NativeSelect value={editPriority} onChange={setEditPriority}>
                      {['High', 'Medium', 'Low'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </NativeSelect>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold">Due Date</span>
                    <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-10 w-full rounded-lg border px-3 text-sm" />
                  </label>
                  <div className="flex items-end">
                    <Button onClick={() => void saveTask()} disabled={saving}>{saving ? 'Saving…' : 'Save Task'}</Button>
                  </div>
                </section>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Info icon={UserCircle2} label="Assigned to" value={task.assignee} />
                <Info icon={UserCircle2} label="Assigned by" value={task.owner} />
                <Info icon={CalendarDays} label="Due date" value={formatDate(task.due_date)} />
                <Info icon={FileText} label="Department" value={task.department || 'Not assigned'} />
                <Info icon={Clock} label="Priority / cadence" value={<PriorityBadge priority={task.priority ?? task.task_type} />} />
                <Info icon={CheckCircle2} label="Current status" value={<StatusBadge status={task.status} label={task.status_label || undefined} />} />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Description</h3>
                <p className="rounded-xl bg-muted/30 p-4 text-sm leading-6 text-foreground/80">{task.description || 'No description provided.'}</p>
              </section>

              {task.observation_point && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Observation point</h3>
                  <p className="rounded-xl bg-muted/30 p-4 text-sm">{task.observation_point}</p>
                </section>
              )}

              {task.attachment && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Attachment</h3>
                  <div className="rounded-xl border p-4 text-sm">{task.attachment.name}</div>
                </section>
              )}

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="size-4" /> Deadline extension
                </h3>

                {extensions.length > 0 && (
                  <ul className="space-y-2">
                    {extensions.map((extension) => (
                      <li key={extension.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-semibold">{formatDate(extension.requested_date)}</span>
                            <span className="text-muted-foreground"> requested by {extension.requested_by ?? 'Unknown'}</span>
                          </span>
                          <StatusBadge status={extension.status.toUpperCase()} />
                        </div>
                        {extension.reason && <p className="mt-1 text-muted-foreground">{extension.reason}</p>}
                        {extension.decision_remarks && <p className="mt-1 text-xs text-muted-foreground">Decision: {extension.decision_remarks}</p>}

                        {extension.status === 'pending' && task.owner_id === session.userId && (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => void decideExtension(extension.id, 'approve')} disabled={extBusy}>Approve</Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => void decideExtension(extension.id, 'reject')} disabled={extBusy}>Reject</Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {!extensions.some((extension) => extension.status === 'pending') && (
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                    <input type="date" value={extDate} onChange={(event) => setExtDate(event.target.value)} className="h-10 rounded-lg border px-3 text-sm" aria-label="New due date" />
                    <input value={extReason} onChange={(event) => setExtReason(event.target.value)} placeholder="Why is more time needed?" className="h-10 rounded-lg border px-3 text-sm" />
                    <Button variant="outline" onClick={() => void requestExtension()} disabled={extBusy || !extDate || !extReason.trim()}>{extBusy ? 'Sending…' : 'Request'}</Button>
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">Update status</h3>
                <NativeSelect value={status} onChange={setStatus}>
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Completion or progress remarks (required)"
                  className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <StatusBadge status={status} />
                <Button onClick={saveStatus} disabled={saving || !remarks.trim()} className="w-full">{saving ? 'Saving…' : 'Save status and remarks'}</Button>
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'No due date'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
