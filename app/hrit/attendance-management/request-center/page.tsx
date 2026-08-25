'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, ClipboardList, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDateShort } from '@/app/hrit/_lib/hrit-utils'
import { useLeaveRequests } from '@/app/hrit/_lib/use-leave'
import { mapLeaveRequest } from '@/app/hrit/_lib/leave-mappers'
import { useAuth } from '@/contexts/AuthContext'
import { useAttendanceRegularization } from '@/app/hrit/_lib/use-attendance-regularization'
import { reasonLabels } from '@/app/hrit/_lib/attendance-regularization-api'

type RequestKind = 'all' | 'leave' | 'regularization'

interface UnifiedRow {
  id: string
  kind: 'Leave' | 'Regularization'
  summary: string
  date: string
  status: string
  submittedDate: string
}

const tabs: { id: RequestKind; label: string }[] = [
  { id: 'all', label: 'All Requests' },
  { id: 'leave', label: 'Leave' },
  { id: 'regularization', label: 'Regularization & Corrections' },
]

export default function RequestCenterPage() {
  const router = useRouter()
  const { menuContext } = useAuth()
  const [tab, setTab] = React.useState<RequestKind>('all')

  const leaveFilters = React.useMemo(
    () => ({
      employeeId: menuContext?.user_id ? String(menuContext.user_id) : undefined,
      page: 1,
      perPage: 50,
      sortBy: 'submittedDate' as const,
      sortDir: 'desc' as const,
    }),
    [menuContext?.user_id],
  )

  const { loading: leaveLoading, error: leaveError, requests: leaveRequests } = useLeaveRequests(leaveFilters)
  const { requests: regularizationRequests } = useAttendanceRegularization()

  const rows = React.useMemo<UnifiedRow[]>(() => {
    const leaveRows: UnifiedRow[] = leaveRequests.map((request) => {
      const mapped = mapLeaveRequest(request)
      return {
        id: `leave-${mapped.id}`,
        kind: 'Leave',
        summary: `${mapped.leaveType} • ${mapped.duration}`,
        date: mapped.fromDate,
        status: mapped.status,
        submittedDate: mapped.submittedDate ?? mapped.appliedDate,
      }
    })

    const regularizationRows: UnifiedRow[] = regularizationRequests.map((request) => ({
      id: `reg-${request.id}`,
      kind: 'Regularization',
      summary: reasonLabels[request.reasonCode],
      date: request.date,
      status: request.status,
      submittedDate: request.submittedDate,
    }))

    const combined = [...leaveRows, ...regularizationRows].sort(
      (a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime(),
    )

    if (tab === 'leave') return combined.filter((row) => row.kind === 'Leave')
    if (tab === 'regularization') return combined.filter((row) => row.kind === 'Regularization')
    return combined
  }, [leaveRequests, regularizationRequests, tab])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Request Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All of your leave, WFH and attendance regularization requests in one place.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          Work From Home is applied as a leave type, and attendance corrections use the same regularization
          workflow — so they appear here under Leave and Regularization respectively rather than as separate
          duplicate lists. Regularization data is session-only until its backend endpoint exists.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push('/hrit/leave-management/leave-requests?apply=1')}
          >
            <CalendarPlus className="size-4" />
            Apply Leave
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push('/hrit/attendance-management/attendance-regularization?apply=1')}
          >
            <Clock className="size-4" />
            New Regularization
          </Button>
        </div>
      </div>

      {leaveError && (
        <Alert variant="destructive">
          <AlertDescription>{leaveError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/45 text-left text-sm font-semibold text-foreground">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {leaveLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading requests...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="size-8 text-muted-foreground/50" />
                    No requests found
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium text-foreground">{row.kind}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.summary}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.date ? formatDateShort(row.date) : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.submittedDate ? formatDateShort(row.submittedDate) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
