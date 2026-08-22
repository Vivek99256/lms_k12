'use client'

import { CalendarClock, Clock, Info, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * BACKEND GAP: no attendance-lock / payroll-cutoff endpoint or settings page
 * exists yet (see the "Attendance Locked in X Days" dashboard alert, which is
 * hardcoded mock text, not backend-driven). The figures below are static
 * placeholder policy text until an institute-level attendance-lock setting
 * is exposed via API - do not treat the "2 days" figure as live data.
 */
const LOCK_WINDOW_DAYS = 2

const policyPoints = [
  'Attendance for a calendar month locks for editing a fixed number of days after the month ends, once payroll processing begins.',
  'Regularization requests (missed punches, wrong times, early exits) must be submitted and approved before the lock date to be reflected in that month\'s attendance.',
  'Once locked, attendance records can only be corrected by HR through a manual override — raise a regularization request as early as possible.',
  'Leave applied after a month locks is still recorded, but does not retroactively change that month\'s already-locked attendance totals.',
]

export default function AttendancePolicyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance Policy & Lock Information</h1>
        <p className="text-sm text-muted-foreground mt-1">
          When attendance records lock for editing, and what to do before that happens.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          This page shows static policy text. The live &quot;days until lock&quot; figure is not yet available from the
          backend — the dashboard alert of the same name is currently a placeholder too.
        </AlertDescription>
      </Alert>

      <Card className="rounded-xl border-border">
        <CardContent className="flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
            <CalendarClock className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current attendance period locks in</p>
            <p className="text-2xl font-bold text-foreground">{LOCK_WINDOW_DAYS} days</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {policyPoints.map((point) => (
            <div key={point} className="flex items-start gap-3">
              <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{point}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-5 text-primary" />
            Before the lock date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Missing a punch, an early exit, or a wrong recorded time? Submit a regularization request from the
            Attendance Tracking dashboard so it can be approved before this month&apos;s attendance locks.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
