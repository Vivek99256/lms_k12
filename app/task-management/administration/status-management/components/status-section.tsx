'use client'

/**
 * Ported from G2G's `components/domain/task/tm-status-management.tsx`.
 *
 * The four system statuses are the workflow engine (boards, summaries and
 * transition rules key off them) and stay read-only. A custom status is a
 * tenant-defined label mapped onto one of those categories — created, renamed,
 * re-ordered and deactivated here against task_management_statuses, and
 * accepted by every task write the moment it exists. Deactivation, not
 * deletion: tasks already carrying the label keep it for display.
 *
 * Adaptations: `taskService` + `getLaravelContext()` -> `useStatuses()`
 * (`../../../_lib/use-administration.ts`); source's inline `<select>` ->
 * this repo's `NativeSelect`; source's `Select` (options prop) is dropped
 * since the category dropdown only ever needs the 4 fixed system categories.
 */

import { useState } from 'react'
import { ArrowRight, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { InlineMessage, NativeSelect } from '../../../_components/task-shared'
import { useStatuses } from '../../../_lib/use-administration'
import type { TaskStatus, TaskStatusOption } from '../../../_lib/task-types'

/** Mirror of the server's transition matrix, shown as documentation. */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'PENDING': ['IN-PROGRESS', 'ON HOLD', 'COMPLETED'],
  'IN-PROGRESS': ['ON HOLD', 'COMPLETED', 'PENDING'],
  'ON HOLD': ['PENDING', 'IN-PROGRESS', 'COMPLETED'],
  'COMPLETED': ['IN-PROGRESS'],
}

const CATEGORY_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending (to do)' },
  { value: 'IN-PROGRESS', label: 'In Progress' },
  { value: 'ON HOLD', label: 'On Hold (blocked / review)' },
  { value: 'COMPLETED', label: 'Completed (done)' },
]

export function StatusSection() {
  const { statuses, loading, busy, error, message, save, deactivate } = useStatuses()

  // The add/edit mini-form. `editingId` null = creating.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TaskStatus>('PENDING')

  const startEdit = (option: TaskStatusOption) => {
    setEditingId(option.id)
    setName(option.name)
    setCategory(option.category)
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setCategory('PENDING')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    await save(editingId, { name: name.trim(), category })
    resetForm()
  }

  const handleDeactivate = (option: TaskStatusOption) => {
    if (!option.id || !window.confirm(`Deactivate "${option.name}"? Tasks already using it keep the label.`)) return
    void deactivate(option)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        System statuses drive the workflow; custom statuses are your organisation&apos;s labels on top of them,
        usable in every task the moment they are created.
      </p>

      {error && <InlineMessage type="error" text={error} />}
      {message && <InlineMessage type="success" text={message} />}

      {/* Add / edit */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4">
        <label className="flex-1 min-w-52">
          <span className="mb-1 block text-xs font-semibold">{editingId ? 'Rename status' : 'New status name'}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. In Review"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="min-w-56">
          <span className="mb-1 block text-xs font-semibold">Behaves as</span>
          <NativeSelect value={category} onChange={(value) => setCategory(value as TaskStatus)}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </NativeSelect>
        </label>
        <Button onClick={() => void handleSave()} disabled={busy || !name.trim()}>
          {editingId ? <Pencil className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add Status'}
        </Button>
        {editingId && (
          <Button variant="outline" onClick={resetForm} disabled={busy}>
            <X className="mr-2 size-4" /> Cancel
          </Button>
        )}
      </div>

      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/90 shadow-sm">
          {statuses.map((option, index) => (
            <div
              key={option.id ?? option.name}
              className={cn(
                'flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-primary/5',
                index > 0 && 'border-t border-primary/5',
                !option.active && 'opacity-50',
              )}
            >
              <div className="min-w-44">
                <StatusBadge status={option.is_system ? option.name : option.category} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {option.name}
                  {!option.active && <span className="ml-2 text-xs font-medium text-muted-foreground">(inactive)</span>}
                </p>
                {option.is_system ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold">Can move to:</span>
                    {(TRANSITIONS[option.category] ?? []).map((target) => (
                      <span key={target} className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> {target}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Behaves as {option.category}</p>
                )}
              </div>

              {option.is_system ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" /> System
                </span>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(option)} disabled={busy}>
                    <Pencil className="mr-1.5 size-3.5" /> Edit
                  </Button>
                  {option.active && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeactivate(option)} disabled={busy}>
                      <Trash2 className="mr-1.5 size-3.5" /> Deactivate
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
