'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  Info,
  Lock,
  Printer,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getFeesSession } from '@/app/fees/_lib/fees-api';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { isStudentProfile } from '@/lib/ai/adapters/shared-utils';

export interface AttendanceRecordItem {
  id: string;
  date: string;
  day: string;
  month: string;
  status: 'present' | 'absent' | 'leave' | 'late' | 'holiday';
  inTime: string;
  outTime: string;
  session: string;
  takenBy: string;
  remarks: string;
}

const SAMPLE_STUDENT_ATTENDANCE: AttendanceRecordItem[] = [
  {
    id: 'att-101',
    date: '2026-10-30',
    day: 'Friday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:54 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Punctual, attended all periods',
  },
  {
    id: 'att-102',
    date: '2026-10-29',
    day: 'Thursday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:58 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-103',
    date: '2026-10-28',
    day: 'Wednesday',
    month: 'October 2026',
    status: 'late',
    inTime: '08:15 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Morning Assembly Missed)',
    takenBy: 'Mr. Rajesh Verma (Discipline Head)',
    remarks: 'School bus delayed, late slip issued',
  },
  {
    id: 'att-104',
    date: '2026-10-27',
    day: 'Tuesday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:50 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-105',
    date: '2026-10-26',
    day: 'Monday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:52 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-106',
    date: '2026-10-25',
    day: 'Sunday',
    month: 'October 2026',
    status: 'holiday',
    inTime: '--',
    outTime: '--',
    session: 'Weekend Holiday',
    takenBy: 'System',
    remarks: 'Weekly off',
  },
  {
    id: 'att-107',
    date: '2026-10-24',
    day: 'Saturday',
    month: 'October 2026',
    status: 'holiday',
    inTime: '--',
    outTime: '--',
    session: 'Fourth Saturday Holiday',
    takenBy: 'System',
    remarks: 'Institute closed',
  },
  {
    id: 'att-108',
    date: '2026-10-23',
    day: 'Friday',
    month: 'October 2026',
    status: 'leave',
    inTime: '--',
    outTime: '--',
    session: 'Medical Leave',
    takenBy: 'Office Admin (Approved)',
    remarks: 'Medical certificate approved by Principal',
  },
  {
    id: 'att-109',
    date: '2026-10-22',
    day: 'Thursday',
    month: 'October 2026',
    status: 'leave',
    inTime: '--',
    outTime: '--',
    session: 'Medical Leave',
    takenBy: 'Office Admin (Approved)',
    remarks: 'Medical certificate approved by Principal',
  },
  {
    id: 'att-110',
    date: '2026-10-21',
    day: 'Wednesday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:55 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-111',
    date: '2026-10-20',
    day: 'Tuesday',
    month: 'October 2026',
    status: 'absent',
    inTime: '--',
    outTime: '--',
    session: 'Full Day',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Uninformed absence - parent SMS dispatched',
  },
  {
    id: 'att-112',
    date: '2026-10-19',
    day: 'Monday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:48 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-113',
    date: '2026-10-16',
    day: 'Friday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:51 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-114',
    date: '2026-10-15',
    day: 'Thursday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:56 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
  {
    id: 'att-115',
    date: '2026-10-14',
    day: 'Wednesday',
    month: 'October 2026',
    status: 'present',
    inTime: '07:50 AM',
    outTime: '02:30 PM',
    session: 'Full Day (Lectures 1-6)',
    takenBy: 'Mrs. Sunita Sharma (Class Teacher)',
    remarks: 'Regular attendance',
  },
];

const MONTHLY_PROGRESS = [
  { month: 'Jun 2026', working: 22, present: 21, percentage: 95.5 },
  { month: 'Jul 2026', working: 25, present: 24, percentage: 96.0 },
  { month: 'Aug 2026', working: 24, present: 22, percentage: 91.7 },
  { month: 'Sep 2026', working: 23, present: 22, percentage: 95.7 },
  { month: 'Oct 2026', working: 20, present: 18, percentage: 90.0 },
];

export function StudentAttendanceRecordView({
  isStudentDirect = false,
}: {
  isStudentDirect?: boolean;
}) {
  const session = getFeesSession();
  const menuContext = getStoredMenuContext();

  const userProfileName = session.userProfileName || menuContext?.user_profile_name || 'Student';
  const isStudent = isStudentDirect || isStudentProfile(userProfileName);

  const studentName = session.userId ? `Student (${session.userId})` : 'Aarav Patel';
  const enrollmentNo = 'ENR-2024-0481';
  const gradeSection = 'Grade 10 - Division A';
  const rollNo = '14';
  const academicYear = 'Academic Year 2026-2027';

  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Statistics calculation
  const totalWorkingDays = 114;
  const totalPresentDays = 107;
  const totalAbsentDays = 4;
  const totalLeaveDays = 3;
  const attendancePercentage = ((totalPresentDays / totalWorkingDays) * 100).toFixed(1);
  const isCompliant = Number(attendancePercentage) >= 75.0;

  const filteredRecords = useMemo(() => {
    return SAMPLE_STUDENT_ATTENDANCE.filter((rec) => {
      if (selectedMonth !== 'all' && !rec.month.toLowerCase().includes(selectedMonth.toLowerCase())) {
        return false;
      }
      if (selectedStatus !== 'all' && rec.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.date.toLowerCase().includes(q) ||
          rec.day.toLowerCase().includes(q) ||
          rec.remarks.toLowerCase().includes(q) ||
          rec.session.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedMonth, selectedStatus, searchQuery]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-5">
      {/* Read-Only Student Status Banner */}
      <div className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/90 via-white to-blue-50/80 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5846EA] text-white shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{studentName}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <ShieldCheck className="h-3 w-3" />
                  {isStudent ? 'Student Account' : 'Student Record'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  <Lock className="h-3 w-3 text-slate-400" />
                  Read-Only Mode
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                Roll No: <strong>{rollNo}</strong> · {gradeSection} · Enrollment: <strong>{enrollmentNo}</strong> · {academicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-3.5 w-3.5 text-[#5846EA]" />
              Print Record
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Attendance Percentage */}
        <Card className="col-span-2 border-[#D9E3F1] bg-linear-to-br from-white to-indigo-50/40 shadow-sm sm:col-span-1">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Overall Attendance
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#5846EA]">{attendancePercentage}%</span>
              <span
                className={`text-[11px] font-bold ${
                  isCompliant ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isCompliant ? 'Eligible' : 'Below 75%'}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5846EA] transition-all"
                style={{ width: `${Math.min(100, Number(attendancePercentage))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">Min. 75% required for exams</p>
          </CardContent>
        </Card>

        {/* Total Working Days */}
        <Card className="border-[#D9E3F1] shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Days
            </span>
            <p className="mt-1 text-2xl font-black text-slate-800">{totalWorkingDays}</p>
            <p className="mt-1 text-[10px] text-slate-400">Total school working days</p>
          </CardContent>
        </Card>

        {/* Days Present */}
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Days Present
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-700">{totalPresentDays}</p>
            <p className="mt-1 text-[10px] text-emerald-600 font-medium">Verified attendance</p>
          </CardContent>
        </Card>

        {/* Days Absent */}
        <Card className="border-rose-200 bg-rose-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
              Days Absent
            </span>
            <p className="mt-1 text-2xl font-black text-rose-700">{totalAbsentDays}</p>
            <p className="mt-1 text-[10px] text-rose-600 font-medium">Unexcused absence</p>
          </CardContent>
        </Card>

        {/* Approved Leave */}
        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">
              Approved Leave
            </span>
            <p className="mt-1 text-2xl font-black text-blue-700">{totalLeaveDays}</p>
            <p className="mt-1 text-[10px] text-blue-600 font-medium">Sanctioned medical leave</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Progress */}
      <Card className="border-[#D9E3F1] shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Monthly Attendance Trend
            </h3>
            <span className="text-[11px] text-slate-400">Term 1 (Jun - Oct 2026)</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {MONTHLY_PROGRESS.map((item) => (
              <div key={item.month} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{item.month}</span>
                  <span className="font-bold text-[#5846EA]">{item.percentage}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5846EA]"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>Present: {item.present}d</span>
                  <span>Total: {item.working}d</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <Card className="border-[#D9E3F1] shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search date, remarks, or session..."
                  className="h-8 pl-8 text-xs border-[#D9E3F1]"
                />
              </div>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-8 rounded-xl border border-[#D9E3F1] bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
              >
                <option value="all">All Months</option>
                <option value="October">October 2026</option>
                <option value="September">September 2026</option>
                <option value="August">August 2026</option>
                <option value="July">July 2026</option>
                <option value="June">June 2026</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 rounded-xl border border-[#D9E3F1] bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Approved Leave</option>
                <option value="late">Late Arrival</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>

            <div className="text-right text-xs text-slate-500">
              Showing <strong>{filteredRecords.length}</strong> records
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History Table (Strictly Read-Only, No CRUD) */}
      <Card className="overflow-hidden border border-[#D9E3F1] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Date & Day</th>
                <th className="px-4 py-3">Timing / Punch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Verified By</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                    No attendance records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{item.date}</span>
                        <span className="text-slate-400">({item.day})</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs font-mono text-slate-700">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{item.inTime}</span>
                        {item.outTime !== '--' && <span className="text-slate-400">- {item.outTime}</span>}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {item.status === 'present' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Present
                        </span>
                      ) : item.status === 'absent' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                          <XCircle className="h-3 w-3" />
                          Absent
                        </span>
                      ) : item.status === 'leave' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                          <Info className="h-3 w-3" />
                          Leave
                        </span>
                      ) : item.status === 'late' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          <Clock className="h-3 w-3" />
                          Late
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          Holiday
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.session}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {item.takenBy}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.remarks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Strict Read-Only Notice */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-xs text-slate-600">
        <Lock className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-800">Official Read-Only Student Attendance Statement</p>
          <p className="mt-0.5 text-slate-500 leading-relaxed">
            This record is synchronized directly from the school attendance register. Student profiles have read-only viewing permissions with CRUD actions (create, edit, delete, mark) strictly disabled. For attendance discrepancy inquiries or medical leave submission, please contact your class teacher.
          </p>
        </div>
      </div>
    </div>
  );
}

