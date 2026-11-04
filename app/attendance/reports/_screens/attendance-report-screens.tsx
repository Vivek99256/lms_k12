'use client';

import React from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  FileBarChart,
  UserCheck,
  Users,
} from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { HrmsAttendanceReportView } from '@/app/attendance/reports/_components/HrmsAttendanceReportView';
import { StudentAttendanceRecordView } from '@/app/attendance/reports/_components/StudentAttendanceRecordView';
import DaywiseStudentAttendancePage from '@/app/student/daywise_student_attendance/page';
import MonthwiseStudentAttendancePage from '@/app/student/monthwise_student_attendance/page';
import YearlyStudentAttendancePage from '@/app/student/yearly_student_attendance/page';

/**
 * Attendance -> Reports tabs for Admin, Staff, and HR users.
 * Provides complete HRMS staff attendance analytics alongside student attendance registers.
 */
export const ATTENDANCE_REPORT_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'hrms-attendance',
    label: 'HRMS Staff Attendance Report',
    icon: Users,
    render: () => <HrmsAttendanceReportView />,
  },
  {
    id: 'student-daywise',
    label: 'Student Daywise Report',
    icon: CalendarCheck2,
    render: () => <DaywiseStudentAttendancePage />,
  },
  {
    id: 'student-monthwise',
    label: 'Student Monthwise Report',
    icon: CalendarDays,
    render: () => <MonthwiseStudentAttendancePage />,
  },
  {
    id: 'student-yearly',
    label: 'Student Yearly Report',
    icon: FileBarChart,
    render: () => <YearlyStudentAttendancePage />,
  },
  {
    id: 'student-record',
    label: 'Student Attendance Record',
    icon: UserCheck,
    render: () => <StudentAttendanceRecordView isStudentDirect={false} />,
  },
];

/**
 * Attendance -> Reports screen for Student users.
 * Strictly Read-Only with zero CRUD operations.
 */
export const STUDENT_ATTENDANCE_REPORT_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'my-attendance-record',
    label: 'My Attendance Record',
    icon: UserCheck,
    render: () => <StudentAttendanceRecordView isStudentDirect={true} />,
  },
];

