'use client';

import React, { useState } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  FileBarChart,
  GraduationCap,
  Lock,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFeesSession } from '@/app/fees/_lib/fees-api';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { isStudentProfile } from '@/lib/ai/adapters/shared-utils';
import { StudentAttendanceRecordView } from './StudentAttendanceRecordView';
import { HrmsAttendanceReportView } from './HrmsAttendanceReportView';
import DaywiseStudentAttendancePage from '@/app/student/daywise_student_attendance/page';
import MonthwiseStudentAttendancePage from '@/app/student/monthwise_student_attendance/page';
import YearlyStudentAttendancePage from '@/app/student/yearly_student_attendance/page';

export type AttendanceReportTabId =
  | 'hrms'
  | 'daywise'
  | 'monthwise'
  | 'yearly'
  | 'student-record';

export function AttendanceReportWorkspace({
  initialTab = 'hrms',
}: {
  initialTab?: AttendanceReportTabId;
}) {
  const session = getFeesSession();
  const menuContext = getStoredMenuContext();

  const userProfileName = session.userProfileName || menuContext?.user_profile_name || '';
  const isActualStudent = isStudentProfile(userProfileName);

  // Allow admin preview toggle between Admin View and Student Read-Only View
  const [rolePreview, setRolePreview] = useState<'student' | 'admin'>(
    isActualStudent ? 'student' : 'admin',
  );
  const [activeTab, setActiveTab] = useState<AttendanceReportTabId>(initialTab);

  // If actual logged in user is student OR preview is student, render read-only student attendance
  const viewingAsStudent = isActualStudent || rolePreview === 'student';

  if (viewingAsStudent) {
    return (
      <div className="space-y-4">
        {!isActualStudent && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Student View Preview:</strong> Viewing the read-only student attendance record with all CRUD operations disabled.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRolePreview('admin')}
              className="h-7 text-[11px] border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900"
            >
              Switch back to Admin / Staff View
            </Button>
          </div>
        )}

        <StudentAttendanceRecordView isStudentDirect={true} />
      </div>
    );
  }

  // Admin / Staff View
  return (
    <div className="space-y-4">
      {/* Role Switcher Banner for Admin / Staff */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-[#D9E3F1] bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
            <Users className="h-3.5 w-3.5 text-[#5846EA]" />
            Staff & HR Mode:
          </span>
          <span className="text-slate-500">
            Full access to HRMS staff attendance and student class reports.
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRolePreview('student')}
          className="h-8 gap-1.5 text-xs text-slate-700 border-[#D9E3F1] hover:bg-slate-50 hover:text-[#5846EA]"
        >
          <GraduationCap className="h-3.5 w-3.5 text-[#5846EA]" />
          Preview Student View (Read-Only)
        </Button>
      </div>

      {/* Sub-tab content when in Admin Mode */}
      {activeTab === 'hrms' && <HrmsAttendanceReportView />}
      {activeTab === 'daywise' && <DaywiseStudentAttendancePage />}
      {activeTab === 'monthwise' && <MonthwiseStudentAttendancePage />}
      {activeTab === 'yearly' && <YearlyStudentAttendancePage />}
      {activeTab === 'student-record' && <StudentAttendanceRecordView isStudentDirect={false} />}
    </div>
  );
}

