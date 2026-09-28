'use client'

/**
 * Ported as-is from G2G's `compliance-library-management-dialogs.tsx` for
 * Edit/Delete. Compliance Management, frontend-completion pass adds a third
 * dialog - Complete Compliance (§20 of the product brief) - using the same
 * `AlertDialog`/`Dialog` primitives already in use here, not a new pattern.
 */

import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/g2g/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/g2g/textarea'
import {
  ComplianceForm,
  toIsoDate,
  type ComplianceFormState,
  type ComplianceRecord,
} from './compliance-library-management-shared'
import type { ComplianceCategoryOption, ComplianceDepartmentOption, ComplianceEmployeeOption } from '../../_lib/compliance-library-api'

interface ComplianceDialogsProps {
  editingRecord: ComplianceRecord | null
  editForm: ComplianceFormState
  editUploadKey: number
  categoryOptions: ComplianceCategoryOption[]
  departmentOptions: ComplianceDepartmentOption[]
  employeeOptions: ComplianceEmployeeOption[]
  saving?: boolean
  onEditChange: (next: Partial<ComplianceFormState>) => void
  onEditSave: () => void
  onEditClose: () => void
  deleteRecord: ComplianceRecord | null
  onDeleteConfirm: () => void
  onDeleteClose: () => void
  completeRecord: ComplianceRecord | null
  onCompleteConfirm: (note: string, date: string) => void
  onCompleteClose: () => void
}

export function ComplianceDialogs({
  editingRecord,
  editForm,
  editUploadKey,
  categoryOptions,
  departmentOptions,
  employeeOptions,
  saving,
  onEditChange,
  onEditSave,
  onEditClose,
  deleteRecord,
  onDeleteConfirm,
  onDeleteClose,
  completeRecord,
  onCompleteConfirm,
  onCompleteClose,
}: ComplianceDialogsProps) {
  const [completionNote, setCompletionNote] = useState('')
  const [completionDate, setCompletionDate] = useState(toIsoDate(new Date()))

  return (
    <>
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && onEditClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compliance Record</DialogTitle>
            <DialogDescription>
              Update ownership, category, due date, frequency, priority, and status for this compliance item.
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <ComplianceForm
              form={editForm}
              onChange={onEditChange}
              onSubmit={onEditSave}
              submitLabel="Save Changes"
              uploadKey={editUploadKey}
              currentAttachment={editingRecord.attachmentName}
              categoryOptions={categoryOptions}
              departmentOptions={departmentOptions}
              employeeOptions={employeeOptions}
              showStatus
              saving={saving}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onEditClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && onDeleteClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle>Delete compliance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove {deleteRecord?.name ? `"${deleteRecord.name}"` : 'this record'} from the compliance library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteConfirm}>
              <AlertTriangle className="size-4" />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!completeRecord}
        onOpenChange={(open) => {
          if (!open) {
            onCompleteClose()
            setCompletionNote('')
            setCompletionDate(toIsoDate(new Date()))
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as completed</DialogTitle>
            <DialogDescription>
              {completeRecord?.name ? `"${completeRecord.name}"` : 'This compliance'} will be marked Completed
              {completeRecord?.frequency && completeRecord.frequency !== 'One-Time'
                ? ' and the next recurring cycle will be generated automatically.'
                : '.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Completion Date</Label>
              <DatePicker value={completionDate} onChange={(date) => setCompletionDate(toIsoDate(date))} placeholder="Select completion date" />
            </div>
            <div className="space-y-2">
              <Label>Completion Note (optional)</Label>
              <Textarea
                aria-label="Completion note"
                placeholder="Any notes about how this compliance was completed"
                value={completionNote}
                onChange={(event) => setCompletionNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCompleteClose}>
              Cancel
            </Button>
            <Button onClick={() => onCompleteConfirm(completionNote, completionDate)}>
              <CheckCircle2 className="size-4" />
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
