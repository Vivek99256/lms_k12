'use client'

import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useLeaveDashboard, useLeaveRequestDetail } from '@/app/hrit/_lib/use-leave'
import { getCurrentDate, quickActions } from '@/app/hrit/_lib/hrit-utils'
import {
  mapActivity,
  mapBalanceSnapshot,
  mapDashboardStats,
  mapDepartmentSummary,
  mapHolidays,
  mapLeaveRequest,
  mapTypeDistribution,
  mapUpcomingLeaves,
} from '@/app/hrit/_lib/leave-mappers'
import type { LeaveQuickAction, LeaveRequest } from '@/app/hrit/_lib/hrit-types'
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard'
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences'
import { toWidgetId, type DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences'

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const LEAVE_WIDGETS = [
  // KPI ids are toWidgetId('kpi', stat.id) over the stat ids from mapDashboardStats.
  { id: 'kpi.total-requests', label: 'Total leave requests', group: 'kpi' },
  { id: 'kpi.pending-requests', label: 'Pending requests', group: 'kpi' },
  { id: 'kpi.approved-requests', label: 'Approved requests', group: 'kpi' },
  { id: 'kpi.rejected-requests', label: 'Rejected requests', group: 'kpi' },
  { id: 'kpi.on-leave-today', label: 'Employees on leave today', group: 'kpi' },
  { id: 'kpi.available-balance', label: 'Available leave balance', group: 'kpi' },
  { id: 'chart.department-distribution', label: 'Department distribution', group: 'chart' },
  { id: 'chart.leave-type-distribution', label: 'Leave type distribution', group: 'chart' },
  { id: 'panel.pending-approvals', label: 'Pending approvals', group: 'panel' },
  { id: 'panel.leave-balance', label: 'Leave balance snapshot', group: 'panel' },
  { id: 'panel.holidays', label: 'Upcoming holidays', group: 'panel' },
  { id: 'panel.quick-actions', label: 'Quick actions', group: 'panel' },
  { id: 'panel.recent-requests', label: 'Recent leave requests', group: 'panel' },
  { id: 'panel.recent-activity', label: 'Recent activity', group: 'panel' },
] as const satisfies readonly DashboardWidget[]

const SUMMARY_PANELS = [
  'panel.pending-approvals',
  'panel.leave-balance',
  'panel.holidays',
  'panel.quick-actions',
] as const

// The summary panels share one row; however many are left fill it.
const SUMMARY_PANEL_COLUMNS: Record<number, string> = {
  1: '',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 xl:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
}

const DashboardHeader = lazy(() =>
  import('./components/DashboardHeader').then((m) => ({
    default: m.DashboardHeader,
  })),
)

const DashboardStats = lazy(() =>
  import('./components/DashboardStats').then((m) => ({
    default: m.DashboardStats,
  })),
)

const DepartmentChart = lazy(() =>
  import('./components/DepartmentChart').then((m) => ({
    default: m.DepartmentChart,
  })),
)

const HolidayCard = lazy(() =>
  import('./components/HolidayCard').then((m) => ({
    default: m.HolidayCard,
  })),
)

const LeaveTypeChart = lazy(() =>
  import('./components/LeaveTypeChart').then((m) => ({
    default: m.LeaveTypeChart,
  })),
)

const PendingApprovalsCard = lazy(() =>
  import('./components/PendingApprovalCard').then((m) => ({
    default: m.PendingApprovalsCard,
  })),
)

const RecentActivity = lazy(() =>
  import('./components/RecentActivity').then((m) => ({
    default: m.RecentActivity,
  })),
)

const RecentLeaveRequests = lazy(() =>
  import('./components/RecentLeaveRequests').then((m) => ({
    default: m.RecentLeaveRequests,
  })),
)

const LeaveBalanceSnapshotCard = lazy(() =>
  import('./components/LeaveBalanceSnapshot').then((m) => ({
    default: m.LeaveBalanceSnapshotCard,
  })),
)

const LeaveQuickActionsCard = lazy(() =>
  import('./components/LeaveQuickActionsCard').then((m) => ({
    default: m.LeaveQuickActionsCard,
  })),
)

const LeaveRequestDetailsDrawer = lazy(() =>
  import('@/app/hrit/leave-management/leave-requests/components/LeaveRequestDetailsDrawer').then((m) => ({
    default: m.LeaveRequestDetailsDrawer,
  })),
)

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const currentDate = useMemo(() => getCurrentDate(), [])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    loading,
    processingRequestId,
    error,
    actionError,
    summary,
    departments,
    leaveTypes,
    holidays,
    balances,
    pending,
    recent,
    upcoming,
    retry,
    decide,
  } = useLeaveDashboard()

  const { detail } = useLeaveRequestDetail(drawerOpen ? selectedRequestId : null)

  const prefs = useDashboardPreferences('hr.leave-dashboard', LEAVE_WIDGETS)
  const show = prefs.isVisible
  const bothCharts = show('chart.department-distribution') && show('chart.leave-type-distribution')
  const bothRecent = show('panel.recent-requests') && show('panel.recent-activity')
  const summaryPanelCount = SUMMARY_PANELS.filter((id) => show(id)).length

  const stats = useMemo(() => mapDashboardStats(summary), [summary])
  const visibleStats = useMemo(
    () => stats.filter((stat) => !prefs.hidden.has(toWidgetId('kpi', stat.id))),
    [stats, prefs.hidden],
  )
  const departmentData = useMemo(() => mapDepartmentSummary(departments), [departments])
  const leaveTypeData = useMemo(() => mapTypeDistribution(leaveTypes), [leaveTypes])
  const holidayData = useMemo(() => mapHolidays(holidays), [holidays])
  const balanceData = useMemo(() => mapBalanceSnapshot(balances?.leave_types ?? []), [balances])
  const activityData = useMemo(() => mapActivity(summary?.recent_activity ?? []), [summary])
  const pendingRequests = useMemo(() => pending.map(mapLeaveRequest), [pending])
  const recentRequests = useMemo(() => recent.map(mapLeaveRequest), [recent])
  const upcomingLeaves = useMemo(() => mapUpcomingLeaves(upcoming), [upcoming])

  const selectedRequest = useMemo<LeaveRequest | null>(() => {
    if (detail) return mapLeaveRequest(detail)
    return pendingRequests.find((request) => request.id === String(selectedRequestId)) ?? null
  }, [detail, pendingRequests, selectedRequestId])

  const handleViewDetails = useCallback((request: LeaveRequest) => {
    setSelectedRequestId(Number(request.id))
    setDrawerOpen(true)
  }, [])

  const navigate = useCallback(
    (submenu: string, query = '') => {
      router.push(`/module/hrit-solutions/leave-management/${submenu}${query}`)
    },
    [router],
  )

  const handleQuickAction = useCallback(
    (action: LeaveQuickAction) => {
      const destinations: Record<string, [string, string]> = {
        apply: ['leave-requests', '?apply=1'],
        requests: ['leave-requests', '?mine=1'],
        balance: ['leave-reports', '?report=leave-balance'],
        reports: ['leave-reports', ''],
      }
      const destination = destinations[action.id]
      if (destination) navigate(...destination)
    },
    [navigate],
  )

  // Wait for the user's layout too, so hidden widgets never flash in.
  if (loading || !prefs.ready) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load the leave dashboard"
        description={error}
        retry={retry}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      <Suspense fallback={<Skeleton className="h-16 rounded-2xl" />}>
        <DashboardHeader
          userName={user?.name ?? 'there'}
          currentDate={currentDate}
          upcomingLeaves={upcomingLeaves}
          actions={<CustomizeDashboard widgets={LEAVE_WIDGETS} {...prefs.customizeProps} size="lg" />}
        />
      </Suspense>

      {!prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      {prefs.hasVisible('kpi') && (
        <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
          <DashboardStats stats={visibleStats} />
        </Suspense>
      )}

      {prefs.hasVisible('chart') && (
        // A lone remaining chart takes the full row instead of leaving a gap.
        <section className={`grid gap-6 ${bothCharts ? 'xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]' : ''}`}>
          {show('chart.department-distribution') && (
            <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
              <DepartmentChart data={departmentData} />
            </Suspense>
          )}
          {show('chart.leave-type-distribution') && (
            <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
              <LeaveTypeChart data={leaveTypeData} />
            </Suspense>
          )}
        </section>
      )}

      {summaryPanelCount > 0 && (
        <section className={`grid gap-6 ${SUMMARY_PANEL_COLUMNS[summaryPanelCount]}`}>
          {show('panel.pending-approvals') && (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <PendingApprovalsCard
                requests={pendingRequests}
                onViewDetails={handleViewDetails}
                onViewAll={() => navigate('leave-requests', '?status=pending')}
                onDecision={(request, status) => void decide(request.id, status)}
                processingRequestId={processingRequestId}
              />
            </Suspense>
          )}
          {show('panel.leave-balance') && (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <LeaveBalanceSnapshotCard
                balances={balanceData}
                onViewAll={() => navigate('leave-reports', '?report=leave-balance')}
              />
            </Suspense>
          )}
          {show('panel.holidays') && (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <HolidayCard
                holidays={holidayData}
                onViewAll={() => navigate('leave-configuration', '?tab=holiday-calendar')}
              />
            </Suspense>
          )}
          {show('panel.quick-actions') && (
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <LeaveQuickActionsCard actions={quickActions} onAction={handleQuickAction} />
            </Suspense>
          )}
        </section>
      )}

      {(show('panel.recent-requests') || show('panel.recent-activity')) && (
        <section className={`grid grid-cols-1 gap-6 ${bothRecent ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
          {show('panel.recent-requests') && (
            <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
              <RecentLeaveRequests requests={recentRequests} />
            </Suspense>
          )}
          {show('panel.recent-activity') && (
            <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
              <RecentActivity activities={activityData} />
            </Suspense>
          )}
        </section>
      )}

      <Suspense fallback={null}>
        <LeaveRequestDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          request={selectedRequest}
          detail={detail}
        />
      </Suspense>
    </div>
  )
}
