'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Info,
  ListTodo,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  fetchTeacherUnifiedActivities,
  type ActivityModule,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityType,
  type TeacherActivityItem,
  type TeacherWorkSummary,
} from '@/app/lms/data/activityStream';
import { friendlyError } from '@/lib/user-messages';

function errorMessage(error: unknown): string {
  return friendlyError(error, 'We couldn’t load teacher activities. Please try again.');
}

type TabFilter = 'all' | 'overdue' | 'today' | 'assigned' | 'daily' | 'recurring' | 'completed';

function getModuleConfig(module: ActivityModule) {
  switch (module) {
    case 'Attendance':
      return {
        icon: UserCheck,
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        badge: 'bg-blue-100 text-blue-800',
      };
    case 'Homework':
      return {
        icon: BookOpen,
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        badge: 'bg-amber-100 text-amber-800',
      };
    case 'Task Management':
      return {
        icon: CheckSquare,
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        badge: 'bg-indigo-100 text-indigo-800',
      };
    case 'Lesson Plan':
      return {
        icon: FileText,
        color: 'bg-violet-50 text-violet-700 border-violet-200',
        badge: 'bg-violet-100 text-violet-800',
      };
    case 'Exam Evaluation':
      return {
        icon: Award,
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800',
      };
    case 'PTM':
      return {
        icon: Users,
        color: 'bg-teal-50 text-teal-700 border-teal-200',
        badge: 'bg-teal-100 text-teal-800',
      };
    case 'Library':
      return {
        icon: Bookmark,
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        badge: 'bg-purple-100 text-purple-800',
      };
    default:
      return {
        icon: Sparkles,
        color: 'bg-slate-50 text-slate-700 border-slate-200',
        badge: 'bg-slate-100 text-slate-800',
      };
  }
}

function getPriorityBadge(priority: ActivityPriority) {
  switch (priority) {
    case 'High':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          <AlertOctagon className="size-3 text-rose-600" /> High Priority
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
          <AlertCircle className="size-3 text-amber-600" /> Medium
        </span>
      );
    case 'Low':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
          Low Priority
        </span>
      );
  }
}

function getStatusBadge(status: ActivityStatus, isOverdue?: boolean) {
  if (isOverdue || status === 'Overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-extrabold text-rose-800 border border-rose-300 animate-pulse">
        <AlertTriangle className="size-3 text-rose-600" /> OVERDUE
      </span>
    );
  }
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="size-3.5 text-emerald-600" /> Completed
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
        <Clock className="size-3.5 text-blue-600" /> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
      <AlertCircle className="size-3.5 text-amber-600" /> Pending
    </span>
  );
}

export default function TeacherActivityStreamPage() {
  const [activities, setActivities] = useState<TeacherActivityItem[]>([]);
  const [summary, setSummary] = useState<TeacherWorkSummary>({
    overdueCount: 0,
    dueTodayCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    assignedTasksCount: 0,
    dailyResponsibilitiesCount: 0,
    recurringActivitiesCount: 0,
  });
  const [teacherName, setTeacherName] = useState('Prof. Sarah Jenkins');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ActivityPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<TeacherActivityItem | null>(null);

  const loadData = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorText('');
    fetchTeacherUnifiedActivities(signal)
      .then((res) => {
        setActivities(res.activities);
        setSummary(res.summary);
        if (res.teacherName) setTeacherName(res.teacherName);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setErrorText(errorMessage(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => loadData(controller.signal));
    return () => controller.abort();
  }, [loadData]);

  // Toggle completion status locally
  const toggleActivityCompletion = (id: string) => {
    setActivities((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isComp = item.status === 'Completed';
          const newStatus: ActivityStatus = isComp ? 'Pending' : 'Completed';
          return {
            ...item,
            status: newStatus,
            isOverdue: isComp ? item.isOverdue : false,
            completedAt: !isComp ? 'Just now' : undefined,
          };
        }
        return item;
      })
    );
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      // Tab filter
      if (activeTab === 'overdue' && item.status !== 'Overdue' && !item.isOverdue) return false;
      if (activeTab === 'today' && !item.dueDate.toLowerCase().includes('today')) return false;
      if (activeTab === 'assigned' && item.type !== 'Assigned Task') return false;
      if (activeTab === 'daily' && item.type !== 'Daily Activity') return false;
      if (activeTab === 'recurring' && item.type !== 'Recurring Activity') return false;
      if (activeTab === 'completed' && item.status !== 'Completed') return false;

      // Priority Filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.module.toLowerCase().includes(q) ||
          item.assignedBy.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [activities, activeTab, priorityFilter, searchQuery]);

  return (
    <div className="min-h-full ">
      <div className="mx-auto w-full  space-y-6">
        {/* Top Header */}
        {/* <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white shadow-lg shadow-indigo-200">
                <ListTodo className="size-7" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    Teacher Work & Activity Stream
                  </h1>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 border border-indigo-200">
                    Unified Dashboard
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Single centralized workspace for <span className="font-bold text-slate-900">{teacherName}</span> — combining Task Management assignments, daily class duties, homework grading, and recurring ERP responsibilities.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span>Logged in: <strong className="text-slate-800">{teacherName}</strong></span>
                  <span>•</span>
                  <span>Department: <strong className="text-slate-800">Mathematics & Science</strong></span>
                  <span>•</span>
                  <span>Synced with: <strong className="text-indigo-600">Task Management & LMS</strong></span>
                </div>
              </div>
            </div>

            
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/task-management/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
              >
                <CheckSquare className="size-4 text-indigo-400" />
                Task Management Dashboard
                <ArrowUpRight className="size-3.5 text-slate-400" />
              </Link>

              <button
                type="button"
                onClick={() => loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
              >
                <RefreshCw className={cn('size-4 text-slate-500', loading && 'animate-spin')} />
                Refresh Activities
              </button>
            </div>
          </div>
        </header> */}

        {/* Hero KPI Metric Widgets */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Overdue Card */}
          <div
            onClick={() => setActiveTab('overdue')}
            className={cn(
              'group cursor-pointer rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md',
              activeTab === 'overdue'
                ? 'border-rose-400 bg-rose-50/90 ring-2 ring-rose-300'
                : 'border-rose-200/80 bg-gradient-to-br from-rose-50/50 to-white hover:border-rose-300'
            )}
          >
            <div className="flex items-center justify-between text-xs font-bold text-rose-700">
              <span className="uppercase tracking-wider">Overdue Activities</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 group-hover:scale-110 transition-transform">
                <AlertOctagon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-rose-900">{summary.overdueCount}</p>
            <p className="mt-1 text-xs font-medium text-rose-600">Action required immediately</p>
          </div>

          {/* Due Today Card */}
          <div
            onClick={() => setActiveTab('today')}
            className={cn(
              'group cursor-pointer rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md',
              activeTab === 'today'
                ? 'border-amber-400 bg-amber-50/90 ring-2 ring-amber-300'
                : 'border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-300'
            )}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span className="uppercase tracking-wider">Due Today</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 group-hover:scale-110 transition-transform">
                <Clock className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-900">{summary.dueTodayCount}</p>
            <p className="mt-1 text-xs font-medium text-amber-700">Daily responsibilities & deadlines</p>
          </div>

          {/* Task Management Sync Card */}
          <div
            onClick={() => setActiveTab('assigned')}
            className={cn(
              'group cursor-pointer rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md',
              activeTab === 'assigned'
                ? 'border-indigo-400 bg-indigo-50/90 ring-2 ring-indigo-300'
                : 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 to-white hover:border-indigo-300'
            )}
          >
            <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
              <span className="uppercase tracking-wider">Assigned Tasks</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-110 transition-transform">
                <CheckSquare className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-indigo-950">{summary.assignedTasksCount}</p>
            <p className="mt-1 text-xs font-medium text-indigo-700">From Task Management Module</p>
          </div>

          {/* Completed Card */}
          <div
            onClick={() => setActiveTab('completed')}
            className={cn(
              'group cursor-pointer rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md',
              activeTab === 'completed'
                ? 'border-emerald-400 bg-emerald-50/90 ring-2 ring-emerald-300'
                : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white hover:border-emerald-300'
            )}
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span className="uppercase tracking-wider">Completed Duties</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-950">{summary.completedCount}</p>
            <p className="mt-1 text-xs font-medium text-emerald-700">Finished & verified activities</p>
          </div>
        </div>

        {errorText ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-xs">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {/* Filter & Control Bar */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2 lg:border-none lg:pb-0">
              {[
                { id: 'all', label: 'All Activities', count: activities.length },
                { id: 'overdue', label: 'Overdue', count: summary.overdueCount, alert: true },
                { id: 'today', label: 'Due Today', count: summary.dueTodayCount },
                { id: 'assigned', label: 'Assigned Tasks', count: summary.assignedTasksCount },
                { id: 'daily', label: 'Daily Duties', count: summary.dailyResponsibilitiesCount },
                { id: 'recurring', label: 'Recurring Activities', count: summary.recurringActivitiesCount },
                { id: 'completed', label: 'Completed', count: summary.completedCount },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabFilter)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                      active
                        ? tab.alert
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100/70 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                        active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Priority & Search Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Priority Select */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | ActivityPriority)}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-400 focus:outline-hidden"
              >
                <option value="all">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>

              {/* Search Box */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search work, task, or supervisor…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Activity Cards List */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-sm font-semibold text-slate-500">
            <Loader2 className="size-6 animate-spin text-indigo-600" /> Syncing teacher work stream…
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
            <Info className="mx-auto size-10 text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-800">No matching activities found.</p>
            <p className="mt-1 text-xs text-slate-500">
              There are no tasks or responsibilities matching the selected tab or search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-2">
            {filteredActivities.map((item) => {
              const moduleCfg = getModuleConfig(item.module);
              const ModuleIcon = moduleCfg.icon;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md',
                    item.isOverdue || item.status === 'Overdue'
                      ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                      : item.status === 'Completed'
                      ? 'border-emerald-200/80 bg-emerald-50/10'
                      : 'border-slate-200/90 hover:border-indigo-300'
                  )}
                >
                  <div>
                    {/* Top Bar: Module, Type, Recurrence, Priority */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold', moduleCfg.color)}>
                          <ModuleIcon className="size-3.5" />
                          {item.module}
                        </span>

                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {item.type}
                        </span>

                        {item.recurrence ? (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100">
                            {item.recurrence}
                          </span>
                        ) : null}
                      </div>

                      <div>{getPriorityBadge(item.priority)}</div>
                    </div>

                    {/* Title & Status */}
                    <div className="mt-3.5 flex items-start justify-between gap-3">
                      <h3
                        onClick={() => setSelectedActivity(item)}
                        className="cursor-pointer text-base font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors"
                      >
                        {item.title}
                      </h3>
                      <div className="shrink-0">{getStatusBadge(item.status, item.isOverdue)}</div>
                    </div>

                    {/* Actionable Instruction Box ("What Needs To Be Done") */}
                    <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <ListTodo className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                        <div>
                          <span className="font-bold text-slate-900">What needs to be done: </span>
                          <span className="text-slate-600 leading-relaxed">{item.description}</span>
                        </div>
                      </div>
                    </div>

                    {/* Assignment & Due Date Grid */}
                    <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned By</span>
                        <span className="font-semibold text-slate-800">{item.assignedBy}</span>
                      </div>

                      <div className="text-right">
                        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Due Date & Time</span>
                        <span className={cn('font-bold', item.isOverdue || item.status === 'Overdue' ? 'text-rose-700' : 'text-slate-900')}>
                          {item.dueDate} {item.dueTime ? `@ ${item.dueTime}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Action Bar */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3.5">
                    {/* Completion Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleActivityCompletion(item.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95',
                        item.status === 'Completed'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <Check className={cn('size-3.5', item.status === 'Completed' && 'text-emerald-600 font-extrabold')} />
                      {item.status === 'Completed' ? 'Mark Completed ✓' : 'Mark Complete'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedActivity(item)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Inspect Details
                      </button>

                      {item.source === 'task_management' ? (
                        <Link
                          href="/task-management/dashboard"
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                        >
                          {item.actionLabel}
                          <ExternalLink className="size-3" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(item)}
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                        >
                          {item.actionLabel}
                          <ArrowUpRight className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Activity Modal */}
        {selectedActivity ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                    {selectedActivity.module} • {selectedActivity.type}
                  </span>
                  <h3 className="mt-2 text-xl font-extrabold text-slate-900">{selectedActivity.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs sm:text-sm">
                {/* Description */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5 mb-1.5 text-xs uppercase tracking-wider">
                    <ListTodo className="size-4 text-indigo-600" />
                    What Needs To Be Done
                  </p>
                  <p className="text-slate-700 leading-relaxed">{selectedActivity.description}</p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3.5 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned By</p>
                    <p className="mt-0.5 font-bold text-slate-900">{selectedActivity.assignedBy}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Responsible Teacher</p>
                    <p className="mt-0.5 font-bold text-slate-900">{selectedActivity.assignedTo}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Due Date & Time</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {selectedActivity.dueDate} {selectedActivity.dueTime ? `@ ${selectedActivity.dueTime}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Priority & Recurrence</p>
                    <div className="mt-1 flex items-center gap-2">
                      {getPriorityBadge(selectedActivity.priority)}
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {selectedActivity.recurrence}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Update Activity Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(['Pending', 'In Progress', 'Completed'] as ActivityStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          toggleActivityCompletion(selectedActivity.id);
                          setSelectedActivity((prev) => (prev ? { ...prev, status: st } : null));
                        }}
                        className={cn(
                          'rounded-xl border px-3.5 py-1.5 text-xs font-bold transition',
                          selectedActivity.status === st
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

                {selectedActivity.source === 'task_management' ? (
                  <Link
                    href="/task-management/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Open in Task Management Portal
                    <ExternalLink className="size-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      toggleActivityCompletion(selectedActivity.id);
                      setSelectedActivity(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Mark Activity Complete
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
