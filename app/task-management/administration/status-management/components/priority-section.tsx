'use client'

/**
 * Ported from G2G's `components/domain/task/tm-priority-management.tsx`.
 *
 * System priorities (High / Medium / Low) are constants; custom levels are
 * created, renamed, ordered (lower sorts first) and deactivated here against
 * task_management_priorities. Every task write validates against this set, so
 * a new level is usable in the create form immediately. Deactivation, not
 * deletion: tasks already using the name keep it for display.
 *
 * Adaptations: `taskService` + `getLaravelContext()` -> `usePriorities()`
 * (`../../../_lib/use-administration.ts`); `./priority-badge` ->
 * `../../../_components/priority-badge.tsx` (this repo's already-ported,
 * shared copy).
 */

import { useState } from 'react'
import { Lock, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { InlineMessage } from '../../../_components/task-shared'
import { PriorityBadge } from '../../../_components/priority-badge'
import { usePriorities } from '../../../_lib/use-administration'
import type { TaskPriorityOption } from '../../../_lib/task-types'

export function PrioritySection() {
  const { priorities, loading, busy, error, message, save, deactivate } = usePriorities()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slaHours, setSlaHours] = useState('')

  const startEdit = (option: TaskPriorityOption) => {
    setEditingId(option.id)
    setName(option.name)
    setSlaHours(option.sla_hours !== null ? String(option.sla_hours) : '')
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setSlaHours('')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      ...(slaHours.trim() ? { sla_hours: Number(slaHours) } : {}),
    }
    await save(editingId, payload)
    resetForm()
  }

  const handleDeactivate = (option: TaskPriorityOption) => {
    if (!option.id || !window.confirm(`Deactivate "${option.name}"? Tasks already using it keep it for display.`)) return
    void deactivate(option)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        System levels are fixed; custom levels are validated on every task write the moment they exist.
        SLA hours are informational for now.
      </p>

      {error && <InlineMessage type="error" text={error} />}
      {message && <InlineMessage type="success" text={message} />}

      {/* Add / edit */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4">
        <label className="min-w-52 flex-1">
          <span className="mb-1 block text-xs font-semibold">{editingId ? 'Rename priority' : 'New priority name'}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Critical"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="min-w-40">
          <span className="mb-1 block text-xs font-semibold">SLA hours (optional)</span>
          <input
            type="number"
            min={1}
            value={slaHours}
            onChange={(event) => setSlaHours(event.target.value)}
            placeholder="e.g. 24"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <Button onClick={() => void handleSave()} disabled={busy || !name.trim()}>
          {editingId ? <Pencil className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add Priority'}
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
          {priorities.map((option, index) => (
            <div
              key={option.id ?? option.name}
              className={cn(
                'flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-primary/5',
                index > 0 && 'border-t border-primary/5',
                !option.active && 'opacity-50',
              )}
            >
              <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-28">
                <PriorityBadge priority={option.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {option.name}
                  {!option.active && <span className="ml-2 text-xs font-medium text-muted-foreground">(inactive)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {option.sla_hours !== null ? `SLA ${option.sla_hours}h` : 'No SLA'}
                </p>
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
