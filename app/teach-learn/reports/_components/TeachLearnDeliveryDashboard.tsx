'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Printer,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { jsPDF } from 'jspdf';

interface TeacherProgressRow {
  id: string;
  teacherName: string;
  initials: string;
  subject: string;
  classSection: string;
  completedLessons: number;
  totalLessons: number;
  attainmentPercent: number;
  status: 'Ahead' | 'On Track' | 'Needs Attention';
}

const DEFAULT_FACULTY_PROGRESS: TeacherProgressRow[] = [
  {
    id: 'f-1',
    teacherName: 'Dr. Ananya Sharma',
    initials: 'AS',
    subject: 'Mathematics',
    classSection: 'Class 10-A',
    completedLessons: 36,
    totalLessons: 40,
    attainmentPercent: 88,
    status: 'On Track',
  },
  {
    id: 'f-2',
    teacherName: 'Rajesh Patel',
    initials: 'RP',
    subject: 'Science (Physics & Chem)',
    classSection: 'Class 10-A',
    completedLessons: 34,
    totalLessons: 38,
    attainmentPercent: 82,
    status: 'On Track',
  },
  {
    id: 'f-3',
    teacherName: 'Priya Nair',
    initials: 'PN',
    subject: 'English Literature',
    classSection: 'Class 9-B',
    completedLessons: 42,
    totalLessons: 42,
    attainmentPercent: 94,
    status: 'Ahead',
  },
  {
    id: 'f-4',
    teacherName: 'Vikram Malhotra',
    initials: 'VM',
    subject: 'Computer Science',
    classSection: 'Class 10-B',
    completedLessons: 28,
    totalLessons: 34,
    attainmentPercent: 85,
    status: 'On Track',
  },
  {
    id: 'f-5',
    teacherName: 'Sunita Deshmukh',
    initials: 'SD',
    subject: 'Social Science (History)',
    classSection: 'Class 9-A',
    completedLessons: 27,
    totalLessons: 36,
    attainmentPercent: 74,
    status: 'Needs Attention',
  },
  {
    id: 'f-6',
    teacherName: 'Amitabh Sen',
    initials: 'AS',
    subject: 'Hindi Literature',
    classSection: 'Class 8-C',
    completedLessons: 24,
    totalLessons: 32,
    attainmentPercent: 76,
    status: 'Needs Attention',
  },
  {
    id: 'f-7',
    teacherName: 'Meera Kulkarni',
    initials: 'MK',
    subject: 'Biology & Life Sciences',
    classSection: 'Class 11-A',
    completedLessons: 38,
    totalLessons: 40,
    attainmentPercent: 91,
    status: 'On Track',
  },
];

const SUBJECT_DELIVERY_STATS = [
  { subject: 'Mathematics', delivered: 72, total: 80, percent: 90, color: '#5846EA' },
  { subject: 'Science & Lab', delivered: 68, total: 78, percent: 87, color: '#10b981' },
  { subject: 'English Language', delivered: 84, total: 84, percent: 100, color: '#0ea5e9' },
  { subject: 'Social Studies', delivered: 54, total: 72, percent: 75, color: '#f59e0b' },
  { subject: 'Computer Applications', delivered: 56, total: 68, percent: 82, color: '#8b5cf6' },
  { subject: 'Hindi & Sanskrit', delivered: 48, total: 64, percent: 75, color: '#ec4899' },
];

const INSTRUCTION_METHODOLOGY = [
  { mode: 'Direct Classroom Instruction & Lectures', share: 44, hours: '648 hrs', color: '#5846EA' },
  { mode: 'Practical Science & Computer Labs', share: 26, hours: '382 hrs', color: '#10b981' },
  { mode: 'Formative Quizzes & Group Inquiry', share: 18, hours: '264 hrs', color: '#0ea5e9' },
  { mode: 'Remedial Pacing & Doubt Clearing', share: 12, hours: '176 hrs', color: '#f59e0b' },
];

export function TeachLearnDeliveryDashboard() {
  const [facultyData, setFacultyData] = useState<TeacherProgressRow[]>(DEFAULT_FACULTY_PROGRESS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filtered = useMemo(() => {
    return facultyData.filter((row) => {
      const matchSearch =
        row.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.classSection.toLowerCase().includes(searchQuery.toLowerCase());
      const matchClass = selectedClass === 'all' || row.classSection.toLowerCase().includes(selectedClass.toLowerCase());
      const matchStatus = selectedStatus === 'all' || row.status.toLowerCase() === selectedStatus.toLowerCase();
      return matchSearch && matchClass && matchStatus;
    });
  }, [facultyData, searchQuery, selectedClass, selectedStatus]);

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFillColor(88, 70, 234);
      doc.rect(0, 0, 210, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Teach/Learn Instructional Delivery & Syllabus Report', 14, 15);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Academic Term 2026 — Executive Summary', 14, 34);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Overall Syllabus Coverage: 84.6% | Lessons Delivered: 342 of 404 | Class Attainment: 79.2%', 14, 42);

      let y = 54;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Faculty Teaching Progress', 14, y);
      y += 8;

      filtered.forEach((r) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${r.teacherName} (${r.subject}) — ${r.classSection}: ${r.completedLessons}/${r.totalLessons} lessons (${Math.round((r.completedLessons / r.totalLessons) * 100)}%) | Attainment: ${r.attainmentPercent}% | ${r.status}`,
          14,
          y
        );
        y += 7;
      });

      doc.save('Teach_Learn_Syllabus_Delivery_Report_2026.pdf');
    } catch {
      window.print();
    }
  };

  return (
    <div
      className="space-y-6 mx-auto"
      style={{
        ['--primary' as string]: '#5846EA',
        ['--primary-foreground' as string]: '#ffffff',
      }}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <GraduationCap className="size-6 text-[#5846EA]" />
            Teach/Learn Instructional Progress &amp; Syllabus Analytics
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Real-time tracking of syllabus coverage, teacher diary compliance, and student attainment across subjects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleExportPdf}
            className="rounded-xl bg-[#5846EA] text-white hover:bg-[#4936d8] font-bold shadow-md shadow-[#5846EA]/25 h-10 px-4 cursor-pointer"
          >
            <Download className="size-4 mr-1.5" />
            Export PDF Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-[#5846EA]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Syllabus Coverage</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-bold">
              <TrendingUp className="size-3" /> +4.2%
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 tabular-nums">84.6%</div>
          <p className="mt-1 text-xs text-slate-500">Across 6 academic standards</p>
          <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#5846EA]" style={{ width: '84.6%' }} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-[#5846EA]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lessons Delivered</span>
            <span className="text-xs font-bold text-slate-400">Target: 404</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600 tabular-nums">342</div>
          <p className="mt-1 text-xs text-slate-500">Completed instructional plans</p>
          <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: '84.6%' }} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-[#5846EA]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student Attainment</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-700 px-2 py-0.5 text-xs font-bold">
              Benchmark 75%
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 tabular-nums">79.2%</div>
          <p className="mt-1 text-xs text-slate-500">Average competency mastery</p>
          <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500" style={{ width: '79.2%' }} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-[#5846EA]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diary Compliance</span>
            <span className="text-xs font-bold text-[#5846EA]">48 / 52 Staff</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-[#5846EA] tabular-nums">92.3%</div>
          <p className="mt-1 text-xs text-slate-500">Teacher diary submission rate</p>
          <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-[#5846EA]" style={{ width: '92.3%' }} />
          </div>
        </article>
      </div>

      {/* Two Analytics Panels */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Subject-Wise Syllabus Completion */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="size-4 text-[#5846EA]" />
              Subject Syllabus Completion vs Targets
            </h2>
            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-[#5846EA]">
              Term 1 Progress
            </span>
          </div>

          <div className="space-y-4">
            {SUBJECT_DELIVERY_STATS.map((s) => (
              <div key={s.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800">{s.subject}</span>
                  <span className="tabular-nums text-slate-500">
                    <strong className="text-slate-800">{s.delivered}</strong> / {s.total} lessons ({s.percent}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.percent}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Instructional Methodology Breakdown */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="size-4 text-emerald-600" />
              Instructional Delivery Modes &amp; Teaching Hours
            </h2>
            <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              1,470 Total Hrs
            </span>
          </div>

          <div className="space-y-4">
            {INSTRUCTION_METHODOLOGY.map((m) => (
              <div key={m.mode} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-xs font-bold text-slate-800">{m.mode}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 pl-4.5">{m.hours} recorded in teacher diaries</span>
                </div>

                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 tabular-nums">{m.share}%</span>
                  <span className="text-[11px] block text-slate-400 font-medium">of total time</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Faculty Teaching & Progress Table */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Faculty Teaching Delivery &amp; Pacing Roster</h2>
            <p className="text-xs text-slate-500 mt-0.5">Detailed lesson completion, class sections, and student attainment by instructor.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher or subject…"
                className="h-9 w-52 pl-8.5 rounded-xl text-xs"
              />
            </div>

            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label="Filter by Class"
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Classes</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 8">Class 8</option>
              <option value="Class 11">Class 11</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by Status"
              className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="on track">On Track</option>
              <option value="ahead">Ahead</option>
              <option value="needs attention">Needs Attention</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Faculty Name</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Class &amp; Section</th>
                <th className="py-3 px-4 text-center">Lessons Delivered</th>
                <th className="py-3 px-4 text-center">Coverage %</th>
                <th className="py-3 px-4 text-center">Attainment</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const percent = Math.round((row.completedLessons / row.totalLessons) * 100);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-indigo-50 text-[#5846EA] font-bold flex items-center justify-center text-xs">
                          {row.initials}
                        </div>
                        <span>{row.teacherName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-xs font-medium">{row.subject}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs font-semibold">{row.classSection}</td>
                    <td className="py-3 px-4 text-center tabular-nums text-xs font-bold text-slate-800">
                      {row.completedLessons} / {row.totalLessons}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-[#5846EA] tabular-nums">
                        {percent}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-xs font-extrabold text-slate-900">
                      {row.attainmentPercent}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          row.status === 'Ahead'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : row.status === 'On Track'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
