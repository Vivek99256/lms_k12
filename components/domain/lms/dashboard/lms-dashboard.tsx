'use client'

/**
 * Ported from G2G's `components/domain/lms/dashboard/lms-dashboard.tsx`.
 *
 * Adaptations from the source:
 *  - `useAuth` (G2G's `hooks/use-auth.ts`, backed by its own Laravel-context
 *    user) is replaced by lms_k12's `contexts/AuthContext.tsx`, whose `user`
 *    only carries `{ name, email, avatar }` — used for the greeting name.
 *  - `useSidebarNavigation` now comes from lms_k12's own
 *    `hooks/use-sidebar-navigation.ts` (a much thinner hook than G2G's;
 *    `resolveAccessLink` is an identity function there).
 *  - The `LMS_*_ACCESS_LINK` constants from G2G's `lib/gtg-navigation` are
 *    replaced by the literal `/people-competency/lms/*` routes already wired
 *    into `app/data/routeMapper.ts` (`g2g_lms.*` keys). Assignments and
 *    Sessions & Calendar are other packages' screens — the links below point
 *    at their contracted routes even though those pages do not exist yet.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trophy,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard'
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences'
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences'
import { useLmsDashboard } from './use-lms-dashboard'
import { getGreeting } from '../lib/greeting'
import { KpiCard, WIDGET_HEIGHT } from './widgets/shared'
import {
  LearningProgressWidget,
  MyLearningWidget,
  UpcomingDeadlinesWidget,
} from './widgets/course-widgets'
import { LmsCalendarWidget, UpcomingSessionsWidget } from './widgets/calendar-widgets'
import {
  AchievementsWidget,
  LearningStatsWidget,
  RecentActivityWidget,
  SkillProgressWidget,
} from './widgets/insight-widgets'
import { QuickActionsWidget } from './widgets/quick-actions-widget'
import { EnrollCourseSheet } from './widgets/enroll-course-sheet'

const LMS_LEARNING_CATALOG_ACCESS_LINK = '/people-competency/lms/learning-catalog'
const LMS_MY_LEARNING_ACCESS_LINK = '/people-competency/lms/my-learning'
const LMS_ASSIGNMENTS_ACCESS_LINK = '/people-competency/lms/assignments'
const LMS_SESSIONS_CALENDAR_ACCESS_LINK = '/people-competency/lms/sessions-calendar'

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const LEARNING_WIDGETS = [
  { id: 'kpi.courses_assigned', label: 'Courses assigned', group: 'kpi' },
  { id: 'kpi.in_progress', label: 'In progress', group: 'kpi' },
  { id: 'kpi.upcoming_sessions', label: 'Upcoming sessions', group: 'kpi' },
  { id: 'kpi.achievements_earned', label: 'Achievements earned', group: 'kpi' },
  { id: 'kpi.learning_hours', label: 'Learning hours', group: 'kpi' },
  { id: 'kpi.completed_courses', label: 'Completed courses', group: 'kpi' },
  { id: 'chart.learning_progress', label: 'Learning progress', group: 'chart' },
  { id: 'panel.my_learning', label: 'My learning', group: 'panel' },
  { id: 'panel.upcoming_deadlines', label: 'Upcoming deadlines', group: 'panel' },
  { id: 'panel.upcoming_sessions', label: 'Upcoming sessions', group: 'panel' },
  { id: 'panel.quick_actions', label: 'Quick actions', group: 'panel' },
  { id: 'panel.achievements', label: 'Achievements', group: 'panel' },
  { id: 'panel.recent_activity', label: 'Recent activity', group: 'panel' },
  { id: 'panel.calendar', label: 'Calendar', group: 'panel' },
  { id: 'panel.skill_progress', label: 'Skill progress', group: 'panel' },
  { id: 'panel.learning_stats', label: 'Learning stats', group: 'panel' },
] as const satisfies readonly DashboardWidget[]

/** Stands in for the KPI and widget grids until the user's saved layout has loaded. */
function WidgetAreaSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading your learning dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className={cn(WIDGET_HEIGHT, 'rounded-xl')} />
        ))}
      </div>
    </div>
  )
}

/** Transient banner for the enrolment-status mutation and partial load failures. */
function ActionBanner({
  message,
  tone,
  onDismiss,
  onRetry,
}: {
  message: string
  tone: 'success' | 'error'
  onDismiss?: () => void
  onRetry?: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium',
        tone === 'success'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span className="flex items-center gap-2">
        {tone === 'success' && <CheckCircle2 className="size-4 shrink-0" />}
        {message}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 gap-1.5 text-xs font-semibold">
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="rounded-md p-1 transition-opacity hover:opacity-70"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function LmsDashboard() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const { user } = useAuth()
  const {
    loading,
    error,
    retry,
    courses,
    skillProgress,
    achievements,
    streak,
    weeklyGoal,
    peerComparison,
    activities,
    calendarMonth,
    setCalendarMonth,
    calendarEvents,
    calendarLoading,
    calendarError,
    upcomingSessions,
    updatingCourseId,
    actionMessage,
    actionError,
    dismissAction,
    setCourseStatus,
    unenroll,
    enroll,
  } = useLmsDashboard()

  const prefs = useDashboardPreferences('learning.dashboard', LEARNING_WIDGETS)
  const show = prefs.isVisible
  // Skill progress and learning stats share the last row; a lone one takes the full width.
  const bothStatsPanels = show('panel.skill_progress') && show('panel.learning_stats')

  const [enrollOpen, setEnrollOpen] = useState(false)

  // Success and failure banners are transient - clear them after a few seconds.
  useEffect(() => {
    if (!actionMessage && !actionError) return
    const timer = setTimeout(dismissAction, 5000)
    return () => clearTimeout(timer)
  }, [actionMessage, actionError, dismissAction])

  const kpis = useMemo(() => {
    const total = courses.length
    const inProgress = courses.filter((course) => course.bucket === 'in-progress').length
    const notStarted = courses.filter((course) => course.bucket === 'not-started').length
    const overdue = courses.filter((course) => course.bucket === 'overdue').length
    const completed = courses.filter((course) => course.bucket === 'completed').length

    const allAchievements = achievements?.achievements ?? []
    const earnedAchievements = allAchievements.filter((achievement) => achievement.earned).length

    return { total, inProgress, notStarted, overdue, completed, allAchievements, earnedAchievements }
  }, [courses, achievements])

  const greetingName = user?.name || 'there'

  // A hard load failure means none of the widgets has data worth rendering.
  if (error && !loading && courses.length === 0) {
    return (
      <div className="p-6">
        <ErrorState
          title="Couldn't load your learning dashboard"
          description={error}
          retry={retry}
        />
      </div>
    )
  }

  return (
    <div className="relative space-y-5 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {getGreeting(greetingName)}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Here&apos;s what&apos;s happening with your learning today.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {prefs.ready && (
            <CustomizeDashboard widgets={LEARNING_WIDGETS} {...prefs.customizeProps} size="lg" className="h-10 rounded-lg" />
          )}
          <Button
            variant="outline"
            onClick={() => router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))}
            className="h-10 justify-center gap-2 rounded-lg border-border/80 bg-card px-4 text-sm font-semibold shadow-sm"
          >
            <BookOpen className="size-4 text-muted-foreground" />
            Browse Catalog
          </Button>
        </div>
      </header>

      {actionMessage && (
        <ActionBanner message={actionMessage} tone="success" onDismiss={dismissAction} />
      )}
      {actionError && <ActionBanner message={actionError} tone="error" onDismiss={dismissAction} />}
      {error && courses.length > 0 && (
        <ActionBanner message={error} tone="error" onRetry={retry} />
      )}

      {!prefs.ready ? (
        // Wait for the user's layout, so hidden widgets never flash in.
        <WidgetAreaSkeleton />
      ) : !prefs.hasVisible() ? (
        <AllWidgetsHiddenNotice />
      ) : (
        <>
          {prefs.hasVisible('kpi') && (
            <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {show('kpi.courses_assigned') && (
                <KpiCard
                  title="Courses Assigned"
                  value={kpis.total}
                  subtext={`${kpis.notStarted} not started`}
                  icon={BookOpen}
                  trend="primary"
                  loading={loading}
                />
              )}
              {show('kpi.in_progress') && (
                <KpiCard
                  title="In Progress"
                  value={kpis.inProgress}
                  subtext={kpis.overdue > 0 ? `${kpis.overdue} overdue` : 'Nothing overdue'}
                  icon={Clock}
                  trend={kpis.overdue > 0 ? 'warning' : 'success'}
                  loading={loading}
                />
              )}
              {show('kpi.upcoming_sessions') && (
                <KpiCard
                  title="Upcoming Sessions"
                  value={upcomingSessions.length}
                  subtext={`${format(new Date(), 'MMMM')} onwards`}
                  icon={BarChart2}
                  trend="primary"
                  loading={loading}
                />
              )}
              {show('kpi.achievements_earned') && (
                <KpiCard
                  title="Achievements Earned"
                  value={kpis.earnedAchievements}
                  subtext={`${kpis.allAchievements.length} available`}
                  icon={Award}
                  trend="success"
                  loading={loading}
                />
              )}
              {show('kpi.learning_hours') && (
                <KpiCard
                  title="Learning Hours"
                  value={weeklyGoal ? `${weeklyGoal.current_hours}h` : '0h'}
                  subtext={
                    weeklyGoal
                      ? `This week · goal ${weeklyGoal.goal_hours}h`
                      : 'This week'
                  }
                  icon={Trophy}
                  trend="primary"
                  loading={loading}
                />
              )}
              {show('kpi.completed_courses') && (
                <KpiCard
                  title="Completed Courses"
                  value={kpis.completed}
                  subtext="All time"
                  icon={CheckCircle2}
                  trend="success"
                  loading={loading}
                />
              )}
            </section>
          )}

          {(prefs.hasVisible('chart') || prefs.hasVisible('panel')) && (
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {show('panel.my_learning') && (
                <MyLearningWidget
                  courses={courses}
                  loading={loading}
                  error={error}
                  retry={retry}
                  updatingCourseId={updatingCourseId}
                  onSetStatus={(course, status) => void setCourseStatus(course, status)}
                  onUnenroll={(course) => void unenroll(course)}
                  onViewAll={() => router.push(resolveAccessLink(LMS_MY_LEARNING_ACCESS_LINK))}
                />
              )}
              {show('panel.upcoming_deadlines') && (
                <UpcomingDeadlinesWidget
                  courses={courses}
                  loading={loading}
                  error={error}
                  onViewAll={() => router.push(resolveAccessLink(LMS_ASSIGNMENTS_ACCESS_LINK))}
                />
              )}
              {show('panel.upcoming_sessions') && (
                <UpcomingSessionsWidget
                  sessions={upcomingSessions}
                  loading={loading}
                  error={error}
                  onViewCalendar={() => router.push(resolveAccessLink(LMS_SESSIONS_CALENDAR_ACCESS_LINK))}
                />
              )}
              {show('panel.quick_actions') && (
                <QuickActionsWidget
                  courses={courses}
                  onBrowseCatalog={() => router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))}
                  onEnrollClick={() => setEnrollOpen(true)}
                />
              )}

              {show('chart.learning_progress') && (
                <LearningProgressWidget courses={courses} loading={loading} error={error} />
              )}
              {show('panel.achievements') && (
                <AchievementsWidget achievements={achievements} loading={loading} error={error} />
              )}
              {show('panel.recent_activity') && (
                <RecentActivityWidget activities={activities} loading={loading} error={error} />
              )}
              {show('panel.calendar') && (
                <LmsCalendarWidget
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  events={calendarEvents}
                  loading={calendarLoading}
                  error={calendarError}
                />
              )}

              {/* The pair always starts its own row, so hidden widgets above never leave a gap beside it. */}
              {show('panel.skill_progress') && (
                <div className={bothStatsPanels ? 'md:col-span-2 xl:col-start-1' : 'md:col-span-2 xl:col-span-4'}>
                  <SkillProgressWidget skillProgress={skillProgress} loading={loading} error={error} />
                </div>
              )}
              {show('panel.learning_stats') && (
                <div className={bothStatsPanels ? 'md:col-span-2' : 'md:col-span-2 xl:col-span-4'}>
                  <LearningStatsWidget
                    streak={streak}
                    weeklyGoal={weeklyGoal}
                    peerComparison={peerComparison}
                    loading={loading}
                    error={error}
                  />
                </div>
              )}
            </section>
          )}
        </>
      )}

      <EnrollCourseSheet
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnroll={enroll}
        enrollingCourseId={updatingCourseId}
      />
    </div>
  )
}
