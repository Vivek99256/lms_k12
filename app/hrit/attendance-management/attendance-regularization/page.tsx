'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/g2g/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { formatDateShort } from '@/app/hrit/_lib/hrit-utils'
import { toDateInput } from '@/app/hrit/_lib/leave-mappers'
import { useAttendanceRegularization } from '@/app/hrit/_lib/use-attendance-regularization'
import {
  reasonLabels,
  reasonOptions,
  type RegularizationApplyPayload,
  type RegularizationReasonCode,
} from '@/app/hrit/_lib/attendance-regularization-api'

const statusFilterOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function isReasonCode(value: string | null): value is RegularizationReasonCode {
  return !!value && value in reasonLabels
}

export default function AttendanceRegularizationPage() {
  const searchParams = useSearchParams()
  const alertReason = searchParams.get('alert')
  const highlightId = searchParams.get('highlight')

  const { requests, processing, message, clearMessage, apply, cancel } = useAttendanceRegularization()

  const [statusFilter, setStatusFilter] = React.useState(() => searchParams.get('status') ?? '')
  const [reasonFilter, setReasonFilter] = React.useState(() => (isReasonCode(alertReason) ? alertReason : ''))
  const [applyOpen, setApplyOpen] = React.useState(() => searchParams.get('apply') === '1')

  const highlightRef = React.useRef<HTMLTableRowElement | null>(null)
  React.useEffect(() => {
    if (highlightId) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightId, requests])

  const filteredRequests = React.useMemo(
    () =>
      requests.filter((request) => {
        if (statusFilter && request.status !== statusFilter) return false
        if (reasonFilter && request.reasonCode !== reasonFilter) return false
        return true
      }),
    [requests, statusFilter, reasonFilter],
  )

  const handleApplySubmit = async (payload: RegularizationApplyPayload) => {
    const result = await apply(payload)
    if (result.ok) setApplyOpen(false)
    return result
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance Regularization</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requests.length} request{requests.length === 1 ? '' : 's'} • Missing punches, early exits and time corrections
          </p>
        </div>
        <Button onClick={() => setApplyOpen(true)} className="h-9 px-4 gap-2 rounded-lg font-semibold">
          <Plus className="size-4" />
          New Request
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          Regularization requests are stored for this session only — the backend endpoint to submit and approve
          them has not been built yet, so nothing here is saved once you leave or reload the page.
        </AlertDescription>
      </Alert>

      {message && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{message}</span>
            <Button variant="ghost" size="sm" onClick={clearMessage}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-xl border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Select
              className="min-w-[170px]"
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              options={statusFilterOptions}
            />
            <Select
              className="min-w-[190px]"
              value={reasonFilter}
              onChange={setReasonFilter}
              placeholder="Reason"
              options={reasonOptions}
            />
            {(statusFilter || reasonFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('')
                  setReasonFilter('')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/45 text-left text-sm font-semibold text-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Requested Punch In</th>
              <th className="px-4 py-3">Requested Punch Out</th>
              <th className="px-4 py-3">Comment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No regularization requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  ref={request.id === highlightId ? highlightRef : undefined}
                  className={cn(
                    'border-b border-border last:border-b-0',
                    request.id === highlightId && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{formatDateShort(request.date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{reasonLabels[request.reasonCode]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{request.requestedPunchIn || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{request.requestedPunchOut || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[240px] truncate" title={request.comment}>
                    {request.comment}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateShort(request.submittedDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {request.status === 'pending' ? (
                      <Button variant="ghost" size="sm" disabled={processing} onClick={() => cancel(request.id)}>
                        Cancel
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RegularizationApplyDrawer
        // Remounts (fresh initial state) if the URL's alert reason changes -
        // avoids syncing a prop into state via an effect for a value that's
        // stable for the lifetime of a single drawer open/close cycle.
        key={alertReason ?? 'none'}
        open={applyOpen}
        onOpenChange={setApplyOpen}
        processing={processing}
        onSubmit={handleApplySubmit}
        defaultReasonCode={isReasonCode(alertReason) ? alertReason : undefined}
      />
    </div>
  )
}

interface RegularizationApplyDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processing?: boolean
  defaultReasonCode?: RegularizationReasonCode
  onSubmit: (payload: RegularizationApplyPayload) => Promise<{ ok: boolean; message: string }>
}

function RegularizationApplyDrawer({
  open,
  onOpenChange,
  processing = false,
  defaultReasonCode,
  onSubmit,
}: RegularizationApplyDrawerProps) {
  const [date, setDate] = React.useState<Date | undefined>(undefined)
  const [reasonCode, setReasonCode] = React.useState<RegularizationReasonCode | ''>(defaultReasonCode ?? '')
  const [requestedPunchIn, setRequestedPunchIn] = React.useState('')
  const [requestedPunchOut, setRequestedPunchOut] = React.useState('')
  const [comment, setComment] = React.useState('')
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const reset = () => {
    setDate(undefined)
    setReasonCode('')
    setRequestedPunchIn('')
    setRequestedPunchOut('')
    setComment('')
    setSubmitError(null)
  }

  const handleCancel = () => {
    reset()
    onOpenChange(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!date || !reasonCode) {
      setSubmitError('Please pick a date and reason.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await onSubmit({
        date: toDateInput(date),
        reasonCode,
        requestedPunchIn: requestedPunchIn || undefined,
        requestedPunchOut: requestedPunchOut || undefined,
        comment,
      })
      if (!result.ok) {
        setSubmitError(result.message)
        return
      }
      reset()
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || processing

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="shrink-0 p-6 pb-0 space-y-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-5" />
            New Regularization Request
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label required>Date</Label>
              <DatePicker
                value={date}
                onChange={(value) => setDate(value ? (value instanceof Date ? value : new Date(value)) : undefined)}
                placeholder="Pick the attendance date"
              />
            </div>

            <div className="space-y-2">
              <Label required>Reason</Label>
              <Select
                value={reasonCode}
                onChange={(value) => setReasonCode(value as RegularizationReasonCode)}
                options={reasonOptions}
                placeholder="Select reason"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestedPunchIn">Requested Punch In</Label>
                <Input
                  id="requestedPunchIn"
                  type="time"
                  value={requestedPunchIn}
                  onChange={(event) => setRequestedPunchIn(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestedPunchOut">Requested Punch Out</Label>
                <Input
                  id="requestedPunchOut"
                  type="time"
                  value={requestedPunchOut}
                  onChange={(event) => setRequestedPunchOut(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label required htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Explain why this correction is needed..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={255}
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 mt-6 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Request'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
