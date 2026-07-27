'use client';

import React from 'react';
import { Search, X, Download, ExternalLink, Eye, Edit, Trash2, ChevronLeft, ChevronRight, Plus, XCircle } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { StatusBadge } from './StatusBadge';
import { TableHeader } from './TableHeader';

export interface Student {
  id: string;
  standardId?: string;
  divisionId?: string;
  admissionNo: string;
  name: string;
  class: string;
  section: string;
  rollNo: string;
  gender: string;
  dob: string;
  fatherName: string;
  motherName: string;
  guardian: string;
  phone: string;
  email: string;
  address: string;
  house: string;
  bloodGroup: string;
  status: 'active' | 'inactive' | 'transferred' | 'alumni';
  attendance: number;
  lastActive: string;
  docsMissing: number;
  vaccination: string;
  allergy: string | null;
  infirmary: number;
}

export interface StudentProfilesTabProps {
  students: Student[];
  selectedStudents: string[];
  setSelectedStudents: (ids: string[]) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  sortConfig: { key: string; dir: 'asc' | 'desc' };
  setSortConfig: (config: { key: string; dir: 'asc' | 'desc' }) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  classFilter: string;
  setClassFilter: (filter: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  houseFilter: string;
  setHouseFilter: (filter: string) => void;
  setShowAddModal: (show: boolean) => void;
  setSelectedStudent: (student: Student | null) => void;
  onStudentUpdated: (student: Student) => void;
  classOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  houseOptions: { value: string; label: string }[];
}

export function StudentProfilesTab({
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
  const totalPages = Math.ceil(students.length / pageSize);
  const activeFiltersCount = [classFilter, statusFilter, houseFilter].filter(Boolean).length;

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortConfig({ key, dir });
  };

  const handleSelectAll = () => {
    const paginatedStudents = students.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
    if (selectedStudents.length === paginatedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(paginatedStudents.map(s => s.id));
    }
  };

  const handleSelectStudent = (id: string) => {
    const current = selectedStudents;
    setSelectedStudents(current.includes(id) ? current.filter((i) => i !== id) : [...current, id]);
  };

  const paginatedStudents = students.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const metrics = {
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    transferred: students.filter(s => s.status === 'transferred').length,
    docsIssue: students.filter(s => s.docsMissing > 0).length,
  };

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Students"
          value={String(metrics.total)}
          icon={<span>👥</span>}
          trend={{ direction: 'up', value: '+8', label: 'vs AY 2025-26' }}
        />
        <MetricCard
          title="Active Students"
          value={String(metrics.active)}
          icon={<span>✓</span>}
          variant="success"
          trend={{ direction: 'flat', value: '0', label: 'this month' }}
        />
        <MetricCard
          title="Transferred"
          value={String(metrics.transferred)}
          icon={<span>↗</span>}
          trend={{ direction: 'up', value: '+2', label: 'this month' }}
        />
        <MetricCard
          title="Docs Issues"
          value={String(metrics.docsIssue)}
          icon={<span>!</span>}
          variant="warning"
          trend={{ direction: 'down', value: '-4', label: 'this month' }}
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, admission no, or parent name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] transition-all"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] bg-white min-w-[140px]"
            >
              {classOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] bg-white min-w-[130px]"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={houseFilter}
              onChange={(e) => {
                setHouseFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] bg-white min-w-[140px]"
            >
              {houseOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setClassFilter('');
                  setStatusFilter('');
                  setHouseFilter('');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-[#0D6EFD] transition-colors"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Active filters:</span>
            {classFilter && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                Class {classFilter}
                <button onClick={() => setClassFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {statusFilter && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                {statusFilter}
                <button onClick={() => setStatusFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {houseFilter && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                {houseFilter} House
                <button onClick={() => setHouseFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selection Bar */}
      {selectedStudents.length > 0 && (
        <div className="bg-[#0D6EFD]/5 border border-[#0D6EFD]/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#0D6EFD]">
              {selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ExternalLink className="w-4 h-4" />
              Transfer
            </button>
            <button
              onClick={() => setSelectedStudents([])}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === paginatedStudents.length && paginatedStudents.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#0D6EFD] focus:ring-[#0D6EFD]/20"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="Admission No" sortable sortKey="admissionNo" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="Student Name" sortable sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="Class" sortable sortKey="class" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="House" sortable sortKey="house" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="Status" sortable sortKey="status" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeader label="Attendance" sortable sortKey="attendance" currentSort={sortConfig} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="font-semibold text-gray-700">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedStudents.map((student) => (
                <tr
                  key={student.id}
                  className={`hover:bg-gray-50 transition-colors ${selectedStudents.includes(student.id) ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => handleSelectStudent(student.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#0D6EFD] focus:ring-[#0D6EFD]/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-gray-600">{student.admissionNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-sm font-semibold">
                        {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.fatherName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">Class {student.class} · {student.section}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                      student.house === 'Red' ? 'bg-red-100 text-red-700' :
                      student.house === 'Blue' ? 'bg-blue-100 text-blue-700' :
                      student.house === 'Green' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        student.house === 'Red' ? 'bg-red-500' :
                        student.house === 'Blue' ? 'bg-blue-500' :
                        student.house === 'Green' ? 'bg-emerald-500' :
                        'bg-yellow-500'
                      }`}></span>
                      {student.house}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={student.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            student.attendance >= 90 ? 'bg-emerald-500' :
                            student.attendance >= 75 ? 'bg-amber-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${student.attendance}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="p-2 text-gray-500 hover:text-[#0D6EFD] hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-500 hover:text-[#0D6EFD] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, students.length)} of {students.length} students
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page = i + 1;
              if (totalPages > 5) {
                if (currentPage > 3) page = currentPage - 2 + i;
                if (currentPage > totalPages - 2) page = totalPages - 4 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-[#0D6EFD] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
