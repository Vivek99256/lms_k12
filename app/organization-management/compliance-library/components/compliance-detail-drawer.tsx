'use client'

/**
 * Compliance detail drawer - Compliance Management, frontend-completion
 * pass. New component; no detail view existed before (the register only had
 * inline edit/delete). Uses the project's existing `Sheet` primitive
 * (`@/components/ui/sheet`, a Radix dialog-based slide-over already used
 * elsewhere, e.g. `app/talent-management/administration`) rather than a new
 * modal pattern.
 *
 * Backed by `GET .../compliance-library/{id}` (record + evidence + activity
 * + cycle history in one call - `ComplianceLibraryController::show()`).
 */

import { useState } from 'react'
import { CheckCircle2, Download, FileText, History, Paperclip, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/g2g/badge'
import { Button } from '@/components/ui/g2g/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/g2g/textarea'
import { cn } from '@/lib/utils'
import { useComplianceDetail } from '../../_lib/use-compliance-extras'
import { displayDate } from './compliance-library-management-shared'

const PRIORITY_VARIANT: Record<string, 'default' | 'navy' | 'warning' | 'destructive'> = {
  Low: 'default',
  Medium: 'navy',
  High: 'warning',
  Critical: 'destructive',
}

export function ComplianceDetailDrawer({
  complianceId,
  isAdmin,
  onClose,
  onChanged,
}: {
  complianceId: string | null
  isAdmin: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const { record, evidence, activity, cycles, loading, uploadEvidence, verifyEvidence, rejectEvidence, deleteEvidence } =
    useComplianceDetail(complianceId)
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [notice, setNotice] = useState('')

  const handleUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const result = await uploadEvidence(file)
    setUploading(false)
    setUploadKey((key) => key + 1)
    setNotice(result.message)
    if (result.ok) onChanged?.()
  }

  const handleVerify = async (evidenceId: number) => {
    const result = await verifyEvidence(evidenceId)
    setNotice(result.message)
    if (result.ok) onChanged?.()
  }

  const handleRejectConfirm = async () => {
    if (!rejectingId || !rejectionReason.trim()) return
    const result = await rejectEvidence(rejectingId, rejectionReason.trim())
    setNotice(result.message)
    setRejectingId(null)
    setRejectionReason('')
    if (result.ok) onChanged?.()
  }

  const handleDelete = async (evidenceId: number) => {
    const result = await deleteEvidence(evidenceId)
    setNotice(result.message)
    if (result.ok) onChanged?.()
  }

  return (
    <Sheet open={complianceId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{record?.name ?? (loading ? 'Loading...' : 'Compliance Detail')}</SheetTitle>
          <SheetDescription>{record?.description}</SheetDescription>
        </SheetHeader>

        {notice && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</div>
        )}

        {loading || !record ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <section className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium text-foreground">{record.category_name ?? '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium text-foreground">{record.department ?? '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Assigned To</p>
                <p className="font-medium text-foreground">{record.assigned_user ?? '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Priority</p>
                <Badge variant={PRIORITY_VARIANT[record.priority ?? ''] ?? 'default'}>{record.priority ?? '-'}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={record.derived_status ?? record.status ?? undefined} />
              </div>
              <div>
                <p className="text-muted-foreground">Frequency</p>
                <p className="font-medium text-foreground">{record.frequency ?? '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium text-foreground">{displayDate(record.due_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next Due Date</p>
                <p className="font-medium text-foreground">{record.next_due_date ? displayDate(record.next_due_date) : '-'}</p>
              </div>
              {record.completed_at && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Completed On</p>
                  <p className="font-medium text-foreground">{displayDate(record.completed_at)}</p>
                </div>
              )}
            </section>

            {/* Recurring cycle history */}
            {cycles.length > 1 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="size-4" /> Cycle History
                </h3>
                <div className="flex flex-wrap gap-2">
                  {cycles.map((cycle) => (
                    <div
                      key={cycle.id}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs',
                        cycle.is_current ? 'border-primary bg-primary/10' : 'border-border/70 bg-background',
                      )}
                    >
                      <p className="font-medium text-foreground">{displayDate(cycle.due_date)}</p>
                      <StatusBadge status={cycle.status} size="sm" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Evidence */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="size-4" /> Evidence ({evidence.length})
              </h3>
              <div className="space-y-2">
                {evidence.length === 0 && <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>}
                {evidence.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                          <FileText className="size-3.5 shrink-0" /> {item.file_name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Uploaded {displayDate(item.created_at)} {item.uploaded_by_name ? `by ${item.uploaded_by_name}` : ''}
                        </p>
                        {item.expiry_date && (
                          <p className="text-xs text-muted-foreground">Expires {displayDate(item.expiry_date)}</p>
                        )}
                        {item.verification_status === 'Rejected' && item.rejection_reason && (
                          <p className="mt-1 text-xs text-destructive">Rejected: {item.rejection_reason}</p>
                        )}
                      </div>
                      <StatusBadge status={item.verification_status} size="sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.file_url && (
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(item.file_url ?? '', '_blank')}>
                          <Download className="size-3.5" /> View
                        </Button>
                      )}
                      {isAdmin && item.verification_status !== 'Verified' && (
                        <Button variant="outline" size="sm" className="gap-1 text-success" onClick={() => handleVerify(item.id)}>
                          <CheckCircle2 className="size-3.5" /> Verify
                        </Button>
                      )}
                      {isAdmin && item.verification_status !== 'Rejected' && (
                        <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => setRejectingId(item.id)}>
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <FileUpload
                  key={uploadKey}
                  label="Upload Evidence"
                  hint={uploading ? 'Uploading...' : 'PDF, DOCX, XLSX, PNG up to 20MB'}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onFileSelect={handleUpload}
                  disabled={uploading}
                />
              </div>
            </section>

            {/* Activity timeline */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4" /> Activity
              </h3>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3 border-l border-border/70 pl-4">
                  {activity.map((entry, index) => (
                    <li key={index} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
                      <p className="font-medium text-foreground">{entry.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor_name ?? 'System'} - {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>

      <Dialog open={rejectingId !== null} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject evidence</DialogTitle>
            <DialogDescription>Explain why this evidence document is being rejected. The uploader will see this reason.</DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Rejection reason"
            placeholder="e.g. Certificate is expired. Please upload the latest certificate."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectionReason.trim()} onClick={handleRejectConfirm}>
              <XCircle className="size-4" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
