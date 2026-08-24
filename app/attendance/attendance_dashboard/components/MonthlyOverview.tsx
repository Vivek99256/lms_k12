// app/students/attendance/components/MonthlyOverview.tsx
'use client';

<<<<<<< HEAD
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
=======
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import {
  buildSessionContext,
  fetchMonthlyOverview,
  type ClassSection,
  type MonthlyOverviewDay,
} from '../../_lib/attendance-api';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

interface MonthlyOverviewProps {
  selectedDate: Date;
  selectedClass: string;
<<<<<<< HEAD
}

interface DayData {
  date: number;
  day: string;
  attendance: number;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday' | 'weekend';
  label?: string;
  isToday?: boolean;
}

export function MonthlyOverview({ selectedDate, selectedClass }: MonthlyOverviewProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayData = (date: number): DayData => {
    const dayOfWeek = new Date(currentYear, currentMonth, date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = new Date().getDate() === date && 
                    new Date().getMonth() === currentMonth && 
                    new Date().getFullYear() === currentYear;

    const attendanceMap: { [key: number]: { status: DayData['status'], label?: string } } = {
      1: { status: 'present' },
      2: { status: 'present' },
      3: { status: 'absent' },
      4: { status: 'late' },
      5: { status: 'present' },
      6: { status: 'present' },
      7: { status: 'present' },
      8: { status: 'present' },
      9: { status: 'present' },
      10: { status: 'present' },
      11: { status: 'present' },
      12: { status: 'present' },
      13: { status: 'present' },
      14: { status: 'present' },
      15: { status: 'present' },
      16: { status: 'absent' },
      17: { status: 'present' },
      18: { status: 'present' },
      19: { status: 'present' },
      20: { status: 'present' },
      21: { status: 'present' },
      22: { status: 'present' },
      23: { status: 'present' },
      24: { status: 'present' },
      25: { status: 'present' },
      26: { status: 'present' },
      27: { status: 'present' },
      28: { status: 'present' },
      29: { status: 'present' },
      30: { status: 'present' },
      31: { status: 'present' },
    };

    const specialDays: { [key: number]: { status: DayData['status'], label: string } } = {
      6: { status: 'holiday', label: 'School holiday' },
      13: { status: 'holiday', label: 'Health camp' },
      20: { status: 'holiday', label: 'PTM — all grades' },
      27: { status: 'holiday', label: 'Unit test week' },
    };

    const dayData = specialDays[date] || attendanceMap[date] || { status: 'present' };
    
    return {
      date,
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      attendance: isWeekend ? 0 : Math.floor(Math.random() * 20) + 80,
      status: isWeekend ? 'weekend' : dayData.status as DayData['status'],
      label: dayData.label,
      isToday,
    };
=======
  section: ClassSection;
  totalStudents: number;
}

type DayStatus = 'present-majority' | 'absent-majority' | 'unmarked' | 'weekend';

interface DayCell {
  date: number;
  day: string;
  present: number;
  absent: number;
  marked: number;
  status: DayStatus;
  isToday?: boolean;
}

export function MonthlyOverview({ selectedDate, selectedClass, section, totalStudents }: MonthlyOverviewProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [days, setDays] = useState<MonthlyOverviewDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const session = buildSessionContext();
    fetchMonthlyOverview(session, section, currentMonth + 1, currentYear)
      .then((rows) => {
        if (!cancelled) setDays(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the month overview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [section, currentMonth, currentYear]);

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const dayTotals = new Map(days.map((day) => [day.date, day]));

  const getDayCell = (date: number): DayCell => {
    const dayOfWeek = new Date(currentYear, currentMonth, date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday =
      new Date().getDate() === date &&
      new Date().getMonth() === currentMonth &&
      new Date().getFullYear() === currentYear;

    const totals = dayTotals.get(date);
    const present = totals?.present ?? 0;
    const absent = totals?.absent ?? 0;
    const marked = totals?.marked ?? 0;

    let status: DayStatus = 'unmarked';
    if (isWeekend) status = 'weekend';
    else if (marked > 0) status = present >= absent ? 'present-majority' : 'absent-majority';

    return { date, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek], present, absent, marked, status, isToday };
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
<<<<<<< HEAD
  const days: DayData[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push({ date: 0, day: '', attendance: 0, status: 'weekend' });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(getDayData(i));
=======
  const cells: DayCell[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push({ date: 0, day: '', present: 0, absent: 0, marked: 0, status: 'weekend' });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(getDayCell(i));
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  }

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });

<<<<<<< HEAD
  const getStatusColor = (status: DayData['status']) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
      case 'late': return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200';
      case 'leave': return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200';
      case 'holiday': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
=======
  const getStatusColor = (status: DayStatus) => {
    switch (status) {
      case 'present-majority': return 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200';
      case 'absent-majority': return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      case 'weekend': return 'bg-slate-100 text-slate-400 border-slate-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

<<<<<<< HEAD
  const getStatusIcon = (status: DayData['status']) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-4 h-4" />;
      case 'absent': return <XCircle className="w-4 h-4" />;
      case 'late': return <Clock className="w-4 h-4" />;
      case 'leave': return <AlertCircle className="w-4 h-4" />;
      case 'holiday': return <Calendar className="w-4 h-4" />;
=======
  const getStatusIcon = (status: DayStatus) => {
    switch (status) {
      case 'present-majority': return <CheckCircle className="w-4 h-4" />;
      case 'absent-majority': return <XCircle className="w-4 h-4" />;
      case 'unmarked': return <HelpCircle className="w-4 h-4" />;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      default: return null;
    }
  };

<<<<<<< HEAD
  const getStatusLabel = (status: DayData['status']) => {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'late': return 'Late';
      case 'leave': return 'Leave';
      case 'holiday': return 'Holiday';
      case 'weekend': return 'Weekend';
      default: return '';
    }
  };

=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const previousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="overflow-x-auto">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
<<<<<<< HEAD
          <button
            onClick={previousMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
=======
          <button onClick={previousMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h3 className="text-lg font-semibold text-slate-900">
            {monthName} {currentYear}
          </h3>
<<<<<<< HEAD
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
=======
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{selectedClass}</span>
<<<<<<< HEAD
          <span className="text-slate-500 hidden sm:inline">10 students</span>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 px-6 py-3 bg-slate-50 border-b border-slate-200">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 p-4">
        {days.map((day, index) => (
          <div
            key={index}
            className={`min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer ${
              day.isToday ? 'ring-2 ring-[#3f5bf6] ring-offset-2' : ''
            } ${getStatusColor(day.status)}`}
          >
            {day.date > 0 && (
              <>
                <div className="flex items-center justify-between mb-1">
                   <span className={`text-sm font-semibold ${day.isToday ? 'text-[#3f5bf6]' : 'text-slate-700'}`}>
                    {day.date}
                  </span>
                  {day.status !== 'weekend' && day.status !== 'holiday' && (
                    <span className="text-xs font-medium text-slate-600">
                      {day.attendance}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {getStatusIcon(day.status)}
                  <span className="truncate text-slate-700">
                    {day.label || getStatusLabel(day.status)}
                  </span>
                </div>
                {day.label && (
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    {day.label}
                  </div>
                )}
                {day.isToday && (
                     <div className="mt-1 text-[10px] font-semibold text-[#3f5bf6]">
                    Today
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50">
        <span className="text-xs text-slate-500">Click a day to open its saved register</span>
        <div className="flex flex-wrap items-center gap-4 ml-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-600">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-slate-600">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs text-slate-600">Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs text-slate-600">Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#3f5bf6]"></div>
            <span className="text-xs text-slate-600">Holiday</span>
=======
          <span className="text-slate-500 hidden sm:inline">{totalStudents} students</span>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading month overview…</div>
      ) : (
        <>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 px-6 py-3 bg-slate-50 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 p-4">
            {cells.map((cell, index) => (
              <div
                key={index}
                className={`min-h-[100px] p-2 rounded-lg border transition-all ${
                  cell.isToday ? 'ring-2 ring-[#3f5bf6] ring-offset-2' : ''
                } ${getStatusColor(cell.status)}`}
              >
                {cell.date > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold ${cell.isToday ? 'text-[#3f5bf6]' : 'text-slate-700'}`}>
                        {cell.date}
                      </span>
                      {cell.status !== 'weekend' && cell.marked > 0 && totalStudents > 0 && (
                        <span className="text-xs font-medium text-slate-600">
                          {Math.round((cell.present / totalStudents) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {getStatusIcon(cell.status)}
                      <span className="truncate text-slate-700">
                        {cell.status === 'weekend'
                          ? 'Weekend'
                          : cell.marked > 0
                            ? `${cell.present} present, ${cell.absent} absent`
                            : 'Not marked'}
                      </span>
                    </div>
                    {cell.isToday && <div className="mt-1 text-[10px] font-semibold text-[#3f5bf6]">Today</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center gap-4 ml-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-600">Mostly present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-slate-600">Mostly absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
            <span className="text-xs text-slate-600">Not marked</span>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          </div>
        </div>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
