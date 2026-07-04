// StudentProfilesDashboard.tsx (updated)
'use client';

import React, { useMemo } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileWarning,
  Search,
  UserCheck,
  Users,
  UserX,
  X,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { MetricCard } from './MetricCard';
import { StatusBadge } from './StatusBadge';
import { TableHeader } from './TableHeader';
import { StudentDetailDrawer } from './StudentDetailDrawer';
import type { Student, StudentProfilesTabProps } from './StudentProfilesTab';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const statusTone: Record<Student['status'], string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-slate-400',
  transferred: 'bg-amber-500',
  alumni: 'bg-indigo-500',
};

const houseTone: Record<string, string> = {
  Red: 'bg-red-500 text-red-700 bg-red-50',
  Blue: 'bg-blue-500 text-blue-700 bg-blue-50',
  Green: 'bg-emerald-500 text-emerald-700 bg-emerald-50',
  Yellow: 'bg-amber-500 text-amber-700 bg-amber-50',
};

function Sparkline({ value }: { value: number }) {
  const color = value >= 90 ? '#10b981' : value >= 75 ? '#f59e0b' : '#ef4444';
  const end = Math.max(18, Math.min(54, Math.round(value / 2)));

  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16" aria-hidden="true">
      <path d={`M2 17 L14 ${end - 17} L26 14 L38 ${24 - end / 2} L50 13 L62 ${24 - end / 3}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function StudentProfilesDashboard({
  students,
  selectedStudents,
  setSelectedStudents,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  sortConfig,
  setSortConfig,
  searchQuery,
  setSearchQuery,
  classFilter,
  setClassFilter,
  statusFilter,
  setStatusFilter,
  houseFilter,
  setHouseFilter,
  setShowAddModal,
  setSelectedStudent,
  classOptions,
  statusOptions,
  houseOptions,
}: StudentProfilesTabProps) {
  const [drawerStudent, setDrawerStudent] = React.useState<Student | null>(null);

  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  const activeFiltersCount = [classFilter, statusFilter, houseFilter].filter(Boolean).length;
  const paginatedStudents = students.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const metrics = useMemo(() => {
    const active = students.filter((student) => student.status === 'active').length;
    const transferred = students.filter((student) => student.status === 'transferred').length;
    const docsIssue = students.filter((student) => student.docsMissing > 0).length;

    return {
      total: students.length,
      active,
      transferred,
      docsIssue,
    };
  }, [students]);

  const classSections = useMemo(() => {
    const labels = Array.from(new Set(students.map((student) => `Grade ${student.class}${student.section}`))).sort();
    const boys = labels.map((label) => students.filter((student) => `Grade ${student.class}${student.section}` === label && student.gender === 'Male').length);
    const girls = labels.map((label) => students.filter((student) => `Grade ${student.class}${student.section}` === label && student.gender === 'Female').length);

    return { labels, boys, girls };
  }, [students]);

  const statusCounts = useMemo(() => {
    return {
      active: students.filter((student) => student.status === 'active').length,
      inactive: students.filter((student) => student.status === 'inactive').length,
      transferred: students.filter((student) => student.status === 'transferred').length,
      alumni: students.filter((student) => student.status === 'alumni').length,
    };
  }, [students]);

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, color: '#64748b', font: { size: 10 } },
      },
      tooltip: { backgroundColor: '#0f172a', padding: 10 },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
      y: { stacked: true, beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { precision: 0, color: '#64748b', font: { size: 10 } } },
    },
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, color: '#64748b', font: { size: 10 } },
      },
      tooltip: { backgroundColor: '#0f172a', padding: 10 },
    },
  };

  const recentActivity = students.slice(0, 4).map((student, index) => ({
    id: `${student.id}-${index}`,
    title:
      index === 0
        ? `${student.name} submitted attendance for Grade ${student.class}.`
        : index === 1
          ? `Parent office verified ${student.name}'s contact details.`
          : index === 2
            ? `Admin approved transfer note for ${student.name}.`
            : `${student.name}'s documents moved to review.`,
    time: index === 0 ? '10 min ago' : index === 1 ? '42 min ago' : index === 2 ? '1 hr ago' : '3 hrs ago',
  }));

  const handleSort = (key: string, dir: 'asc' | 'desc') => setSortConfig({ key, dir });

  const handleSelectAll = () => {
    if (selectedStudents.length === paginatedStudents.length) {
      setSelectedStudents([]);
      return;
    }
    setSelectedStudents(paginatedStudents.map((student) => student.id));
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudents(selectedStudents.includes(id) ? selectedStudents.filter((studentId) => studentId !== id) : [...selectedStudents, id]);
  };

  const handleOpenDrawer = (student: Student) => {
    setDrawerStudent(student);
    setSelectedStudent(student);
  };

  const handleEdit = (updatedStudent: Student) => {
    console.log('Student updated:', updatedStudent);
    // Here you would update the student in your data source
  };

  const handleGenerateCertificate = (student: Student) => {
    console.log('Generate certificate for:', student.name);
    // Generate certificate logic
  };

  const handlePrintIDCard = (student: Student) => {
    console.log('Print ID card for:', student.name);
    // Print ID card logic
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total students"
            value={String(metrics.total)}
            icon={<Users className="h-4 w-4" />}
            trend={{ direction: 'up', value: '+8', label: 'vs AY 2025-26' }}
          />
          <MetricCard
            title="Active"
            value={String(metrics.active)}
            icon={<UserCheck className="h-4 w-4" />}
            variant="success"
            trend={{ direction: 'flat', value: '0', label: 'this month' }}
          />
          <MetricCard
            title="Transfer pending"
            value={String(metrics.transferred)}
            icon={<UserX className="h-4 w-4" />}
            variant="warning"
            trend={{ direction: 'up', value: '+2', label: 'this month' }}
          />
          <MetricCard
            title="Docs incomplete"
            value={String(metrics.docsIssue)}
            icon={<FileWarning className="h-4 w-4" />}
            variant="danger"
            trend={{ direction: 'down', value: '-4', label: 'this month' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.1fr]">
          <ChartPanel title="Enrollment by grade" subtitle="Section A / B split across grades">
            <div className="h-52">
              <Bar
                data={{
                  labels: classSections.labels,
                  datasets: [
                    { label: 'Girls', data: classSections.girls, backgroundColor: '#4f46e5', borderRadius: 3, barThickness: 18 },
                    { label: 'Boys', data: classSections.boys, backgroundColor: '#c7d2fe', borderRadius: 3, barThickness: 18 },
                  ],
                }}
                options={barOptions}
              />
            </div>
          </ChartPanel>

          <ChartPanel title="Status distribution" subtitle="Active, inactive, transferred and alumni">
            <div className="h-52">
              <Doughnut
                data={{
                  labels: ['Active', 'Inactive', 'Transfer pending', 'Alumni'],
                  datasets: [
                    {
                      data: [statusCounts.active, statusCounts.inactive, statusCounts.transferred, statusCounts.alumni],
                      backgroundColor: ['#10b981', '#94a3b8', '#f59e0b', '#6366f1'],
                      borderColor: '#ffffff',
                      borderWidth: 3,
                    },
                  ],
                }}
                options={doughnutOptions}
              />
            </div>
          </ChartPanel>

          <ChartPanel title="Recent activity" subtitle="Latest changes across student records">
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#eef2ff] text-[#3f5bf6]">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium leading-5 text-slate-800">{activity.title}</span>
                    <span className="text-xs text-slate-400">{activity.time}</span>
                  </span>
                </button>
              ))}
            </div>
          </ChartPanel>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-200 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or admission no"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-full rounded border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={classFilter}
                  onChange={(event) => {
                    setClassFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                >
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  value={houseFilter}
                  onChange={(event) => {
                    setHouseFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                >
                  {houseOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassFilter('');
                      setStatusFilter('');
                      setHouseFilter('');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="inline-flex h-9 items-center gap-1 rounded px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {selectedStudents.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-[#3f5bf6]/15 bg-[#eef2ff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-[#3f5bf6]">{selectedStudents.length} selected</span>
              <div className="flex items-center gap-2">
                <button type="button" className="inline-flex h-8 items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button type="button" className="inline-flex h-8 items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                  <ExternalLink className="h-4 w-4" />
                  Transfer
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === paginatedStudents.length && paginatedStudents.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-[#3f5bf6] focus:ring-[#3f5bf6]/20"
                    />
                  </th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Student" sortable sortKey="name" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Class" sortable sortKey="class" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Roll" sortable sortKey="rollNo" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="House" sortable sortKey="house" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Attendance" sortable sortKey="attendance" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Documents" sortable sortKey="docsMissing" currentSort={sortConfig} onSort={handleSort} /></th>
                  <th className="px-4 py-3 text-left"><TableHeader label="Status" sortable sortKey="status" currentSort={sortConfig} onSort={handleSort} /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((student) => {
                  const houseClasses = houseTone[student.house] ?? 'bg-slate-500 text-slate-700 bg-slate-50';
                  const dotClass = houseClasses.split(' ')[0];
                  const pillClasses = houseClasses.replace(dotClass, '');

                  return (
                    <tr key={student.id} className={selectedStudents.includes(student.id) ? 'bg-[#eef2ff]' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#3f5bf6] focus:ring-[#3f5bf6]/20"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleOpenDrawer(student)} className="flex items-center gap-3 text-left">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-bold text-[#3f5bf6]">
                            {student.name.split(' ').map((name) => name[0]).join('').slice(0, 2)}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-950">{student.name}</span>
                            <span className="block text-xs text-slate-500">{student.admissionNo}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">Grade {student.class} - {student.section}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.rollNo}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold ${pillClasses}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                          {student.house}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Sparkline value={student.attendance} />
                          <span className={`text-sm font-semibold ${student.attendance >= 90 ? 'text-emerald-600' : student.attendance >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                            {student.attendance}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {student.docsMissing > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {student.docsMissing} pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-emerald-700">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            Complete
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleOpenDrawer(student)}
                          className="inline-flex items-center gap-2 group"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusTone[student.status]}`} />
                          <StatusBadge status={student.status} />
                          <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>
                {students.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, students.length)} of {students.length} students
              </span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm font-medium text-slate-700">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student Detail Drawer */}
      <StudentDetailDrawer
        student={drawerStudent}
        onClose={() => {
          setDrawerStudent(null);
          setSelectedStudent(null);
        }}
        onEdit={handleEdit}
        onGenerateCertificate={handleGenerateCertificate}
        onPrintIDCard={handlePrintIDCard}
      />
    </>
  );
}