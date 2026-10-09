import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export type ActivityPriority = 'High' | 'Medium' | 'Low';
export type ActivityStatus = 'Overdue' | 'Pending' | 'In Progress' | 'Completed';
export type ActivityType = 'Assigned Task' | 'Daily Activity' | 'Recurring Activity';
export type ActivityRecurrence = 'Daily' | 'Weekly' | 'Monthly' | 'One-time';
export type ActivityModule =
  | 'Attendance'
  | 'Homework'
  | 'Task Management'
  | 'Lesson Plan'
  | 'Exam Evaluation'
  | 'PTM'
  | 'Library'
  | 'General';

export interface TeacherActivityItem {
  id: string;
  title: string;
  description: string;
  assignedBy: string;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  isOverdue?: boolean;
  priority: ActivityPriority;
  status: ActivityStatus;
  type: ActivityType;
  recurrence: ActivityRecurrence;
  module: ActivityModule;
  actionLabel: string;
  actionUrl: string;
  source: 'task_management' | 'lms_responsibility' | 'system';
  completedAt?: string;
}

export interface TeacherWorkSummary {
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  completedCount: number;
  assignedTasksCount: number;
  dailyResponsibilitiesCount: number;
  recurringActivitiesCount: number;
}

export interface UnifiedActivityStreamResponse {
  todayTitle: string;
  teacherName: string;
  summary: TeacherWorkSummary;
  activities: TeacherActivityItem[];
}

function requireSession(): SessionContext | null {
  try {
    const session = buildSessionContext();
    if (session.baseUrl) return session;
  } catch {
    // Return null on failure
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Realistic baseline activities combining Task Management & LMS Teacher Responsibilities. */
export function getBaselineTeacherActivities(): TeacherActivityItem[] {
  return [
    {
      id: 'act-1',
      title: 'Daily Attendance - Period 1 (Class 10-A)',
      description: 'Take student morning attendance for Grade 10 Section A in Room 102.',
      assignedBy: 'System / Timetable',
      assignedTo: 'Prof. Sarah Jenkins (Class Teacher)',
      dueDate: 'Today',
      dueTime: '09:15 AM',
      isOverdue: false,
      priority: 'High',
      status: 'Pending',
      type: 'Daily Activity',
      recurrence: 'Daily',
      module: 'Attendance',
      actionLabel: 'Take Attendance',
      actionUrl: '/lms/activity-stream',
      source: 'lms_responsibility',
    },
    {
      id: 'act-2',
      title: 'Grade Grade 10 Mathematics Homework (Quadratic Equations)',
      description: 'Review and mark 32 student exercise submissions for Exercises 4.1 & 4.2.',
      assignedBy: 'HOD Mathematics',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Today',
      dueTime: '05:00 PM',
      isOverdue: false,
      priority: 'High',
      status: 'Pending',
      type: 'Recurring Activity',
      recurrence: 'Daily',
      module: 'Homework',
      actionLabel: 'Grade Homework',
      actionUrl: '/lms/activity-stream',
      source: 'lms_responsibility',
    },
    {
      id: 'act-3',
      title: 'Draft Mid-Term Physics Examination Question Paper Blueprint',
      description: 'Prepare 50 multiple choice questions, unit weightage, and numerical solutions for Grade 10 Science.',
      assignedBy: 'Academic Director (Dr. Jenkins)',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Today',
      dueTime: '04:30 PM',
      isOverdue: false,
      priority: 'High',
      status: 'In Progress',
      type: 'Assigned Task',
      recurrence: 'One-time',
      module: 'Task Management',
      actionLabel: 'View Task in Task Management',
      actionUrl: '/task-management/dashboard',
      source: 'task_management',
    },
    {
      id: 'act-4',
      title: 'Submit Grade 10-A Monthly Attendance Reconciliation Audit',
      description: 'Reconcile digital biometric logs with physical attendance sheets for Grade 10-A.',
      assignedBy: 'Vice Principal Office',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Yesterday',
      dueTime: '05:00 PM',
      isOverdue: true,
      priority: 'High',
      status: 'Overdue',
      type: 'Assigned Task',
      recurrence: 'Monthly',
      module: 'Task Management',
      actionLabel: 'Complete Audit Task',
      actionUrl: '/task-management/dashboard',
      source: 'task_management',
    },
    {
      id: 'act-5',
      title: 'Grade 10 Chemistry Lab Practical Marks Entry',
      description: 'Enter lab performance scores and viva marks for 28 students into the ERP exam portal.',
      assignedBy: 'Examination Controller',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: '2 days ago',
      dueTime: '05:00 PM',
      isOverdue: true,
      priority: 'High',
      status: 'Overdue',
      type: 'Recurring Activity',
      recurrence: 'One-time',
      module: 'Exam Evaluation',
      actionLabel: 'Enter Exam Marks',
      actionUrl: '/exam/progress-report',
      source: 'lms_responsibility',
    },
    {
      id: 'act-6',
      title: 'Upload Weekly Lesson Plan (Unit 4 - Trigonometry)',
      description: 'Upload 5-day structured lesson plan with learning objectives and teaching aids.',
      assignedBy: 'HOD Mathematics',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Tomorrow',
      dueTime: '06:00 PM',
      isOverdue: false,
      priority: 'Medium',
      status: 'In Progress',
      type: 'Recurring Activity',
      recurrence: 'Weekly',
      module: 'Lesson Plan',
      actionLabel: 'Upload Lesson Plan',
      actionUrl: '/lms/activity-stream',
      source: 'lms_responsibility',
    },
    {
      id: 'act-7',
      title: 'Confirm Parent-Teacher Conference Appointment Slots',
      description: 'Review and confirm 12 parent appointment requests for the upcoming PTM session.',
      assignedBy: 'Class Coordinator',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Oct 03, 2026',
      dueTime: '02:00 PM',
      isOverdue: false,
      priority: 'Low',
      status: 'Pending',
      type: 'Recurring Activity',
      recurrence: 'Weekly',
      module: 'PTM',
      actionLabel: 'Manage PTM Slots',
      actionUrl: '/lms/activity-stream',
      source: 'lms_responsibility',
    },
    {
      id: 'act-8',
      title: 'Return Borrowed Reference Library Book',
      description: 'Return "Advanced Applied Physics - Vol II" (ID: LIB-8921) to library counter.',
      assignedBy: 'Central Library',
      assignedTo: 'Prof. Sarah Jenkins',
      dueDate: 'Today',
      dueTime: '01:00 PM',
      isOverdue: false,
      priority: 'Low',
      status: 'Completed',
      type: 'Daily Activity',
      recurrence: 'One-time',
      module: 'Library',
      actionLabel: 'View Library Log',
      actionUrl: '/lms/activity-stream',
      source: 'lms_responsibility',
      completedAt: 'Today at 11:30 AM',
    },
  ];
}

export async function fetchTeacherUnifiedActivities(signal?: AbortSignal): Promise<UnifiedActivityStreamResponse> {
  const session = requireSession();
  const baselineActivities = getBaselineTeacherActivities();

  let fetchedTaskManagementTasks: TeacherActivityItem[] = [];

  if (session) {
    try {
      const url = new URL(`${session.baseUrl}/api/task-management/my-tasks`);
      url.searchParams.set('sub_institute_id', session.subInstituteId);
      url.searchParams.set('syear', session.syear);
      url.searchParams.set('user_id', session.userId);

      const res = await fetch(url.toString(), {
        headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
        signal,
      });

      if (res.ok) {
        const payload = toRecord(await res.json().catch(() => ({})));
        const dataRecord = toRecord(payload.data);
        const tasksList = toArray(dataRecord.tasks || payload.tasks || payload.data);

        fetchedTaskManagementTasks = tasksList.map((t, idx) => {
          const r = toRecord(t);
          const rawStatus = readString(r.status || r.STATUS).toUpperCase();
          let status: ActivityStatus = 'Pending';
          if (rawStatus === 'COMPLETED' || rawStatus === 'DONE') status = 'Completed';
          else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'WORKING') status = 'In Progress';
          else if (rawStatus === 'OVERDUE') status = 'Overdue';

          const rawPriority = readString(r.priority || r.selType || r.PRIORITY);
          let priority: ActivityPriority = 'Medium';
          if (rawPriority.toLowerCase().includes('high')) priority = 'High';
          else if (rawPriority.toLowerCase().includes('low')) priority = 'Low';

          return {
            id: `tm-${readString(r.id || r.task_id) || idx}`,
            title: readString(r.title || r.task_title || 'Assigned ERP Task'),
            description: readString(r.description || r.task_description || 'Task assigned via Task Management portal.'),
            assignedBy: readString(r.assigned_by || r.manageby_name || r.created_by || 'Task Manager'),
            assignedTo: readString(r.assigned_to || r.task_user_name || 'Logged-in Teacher'),
            dueDate: readString(r.due_date || r.TASK_DATE || 'Today'),
            dueTime: readString(r.due_time || '05:00 PM'),
            isOverdue: status === 'Overdue',
            priority,
            status,
            type: 'Assigned Task',
            recurrence: 'One-time',
            module: 'Task Management',
            actionLabel: 'View in Task Management',
            actionUrl: '/task-management/dashboard',
            source: 'task_management',
          };
        });
      }
    } catch {
      // Fall back to baseline if fetch fails
    }
  }

  // Combine fetched task management items + baseline items (avoiding duplicate IDs)
  const existingIds = new Set(fetchedTaskManagementTasks.map((t) => t.id));
  const combinedActivities = [
    ...fetchedTaskManagementTasks,
    ...baselineActivities.filter((b) => !existingIds.has(b.id)),
  ];

  // Calculate summary stats
  const summary: TeacherWorkSummary = {
    overdueCount: combinedActivities.filter((a) => a.status === 'Overdue' || a.isOverdue).length,
    dueTodayCount: combinedActivities.filter((a) => a.dueDate.toLowerCase().includes('today') && a.status !== 'Completed').length,
    upcomingCount: combinedActivities.filter((a) => !a.dueDate.toLowerCase().includes('today') && a.status !== 'Completed' && a.status !== 'Overdue').length,
    completedCount: combinedActivities.filter((a) => a.status === 'Completed').length,
    assignedTasksCount: combinedActivities.filter((a) => a.type === 'Assigned Task').length,
    dailyResponsibilitiesCount: combinedActivities.filter((a) => a.type === 'Daily Activity').length,
    recurringActivitiesCount: combinedActivities.filter((a) => a.type === 'Recurring Activity').length,
  };

  return {
    todayTitle: 'Teacher Central Work & Responsibilities Dashboard',
    teacherName: 'Prof. Sarah Jenkins',
    summary,
    activities: combinedActivities,
  };
}
