// page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Plus, X, Calendar, Users, UserCog, Building2, Phone, Mail, Home, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StudentProfilesDashboard } from './components/StudentProfilesDashboard';
import {
  fetchAcademicSections,
  fetchDivisions,
  fetchStandards,
  fetchStudents,
  type StudentDivisionOption,
  type StudentSearchOption,
  type StudentSearchFilters,
} from './api';
import type { Student } from './components/StudentProfilesTab';

const classOptions = [
  { value: '', label: 'All Classes' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'alumni', label: 'Alumni' },
];

const houseOptions = [
  { value: '', label: 'All Houses' },
  { value: 'Red', label: 'Red House' },
  { value: 'Blue', label: 'Blue House' },
  { value: 'Green', label: 'Green House' },
  { value: 'Yellow', label: 'Yellow House' },
];

const attendanceTrend = [
  { month: 'Apr', attendance: 88 }, { month: 'May', attendance: 92 },
  { month: 'Jun', attendance: 85 }, { month: 'Jul', attendance: 90 },
  { month: 'Aug', attendance: 94 }, { month: 'Sep', attendance: 91 },
  { month: 'Oct', attendance: 96 }, { month: 'Nov', attendance: 89 },
  { month: 'Dec', attendance: 93 }, { month: 'Jan', attendance: 95 },
];

const subjectPerformance = [
  { subject: 'Maths', score: 92 }, { subject: 'Science', score: 88 },
  { subject: 'English', score: 85 }, { subject: 'Hindi', score: 90 },
  { subject: 'Social', score: 78 }, { subject: 'Computer', score: 95 },
];

// Main Page Component
export default function SearchStudentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState<StudentSearchFilters>({});
  const [sectionOptions, setSectionOptions] = useState<StudentSearchOption[]>([]);
  const [standardOptions, setStandardOptions] = useState<StudentSearchOption[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<StudentDivisionOption[]>([]);
  const [isLoadingStandards, setIsLoadingStandards] = useState(false);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [houseFilter, setHouseFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchStudents({}, controller.signal)
      .then((data) => {
        setStudents(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Unable to load students:', error);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAcademicSections(controller.signal)
      .then(setSectionOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Unable to load academic sections:', error);
        setSectionOptions([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!studentSearch.gradeId) return;
    const controller = new AbortController();
    fetchStandards(studentSearch.gradeId, controller.signal)
      .then(setStandardOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Unable to load standards:', error);
        setStandardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingStandards(false);
      });
    return () => controller.abort();
  }, [studentSearch.gradeId]);

  useEffect(() => {
    if (!studentSearch.standardId) return;

    const controller = new AbortController();
    fetchDivisions(studentSearch.standardId, controller.signal)
      .then(setDivisionOptions)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Unable to load divisions:', error);
        setDivisionOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDivisions(false);
      });

    return () => controller.abort();
  }, [studentSearch.standardId]);

  const handleStudentSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSearching(true);
    try {
      const data = await fetchStudents(studentSearch);
      setStudents(data);
      setCurrentPage(1);
      setSelectedStudents([]);
    } catch (error) {
      console.error('Unable to search students:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.fatherName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesClass = classFilter === '' || student.class === classFilter;
      const matchesStatus = statusFilter === '' || student.status === statusFilter;
      const matchesHouse = houseFilter === '' || student.house === houseFilter;

      return matchesSearch && matchesClass && matchesStatus && matchesHouse;
    });
  }, [students, searchQuery, classFilter, statusFilter, houseFilter]);

  // Sort students
  const sortedStudents = useMemo(() => {
    const sorted = [...filteredStudents];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Student];
      const bVal = b[sortConfig.key as keyof Student];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.dir === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [filteredStudents, sortConfig]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage student records, profiles and information</p>
        </div>
        {/* <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0D6EFD] text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div> */}
      </div>

      <form
        onSubmit={handleStudentSearch}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Section</span>
            <select
              value={studentSearch.gradeId ?? ''}
              onChange={(event) => {
                const gradeId = event.target.value;
                setStandardOptions([]);
                setDivisionOptions([]);
                setIsLoadingStandards(Boolean(gradeId));
                setIsLoadingDivisions(false);
                setStudentSearch((current) => ({
                  ...current,
                  gradeId,
                  standardId: '',
                  divisionId: '',
                }));
              }}
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
            >
              <option value="">All Sections</option>
              {sectionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Standard</span>
            <select
              value={studentSearch.standardId ?? ''}
              disabled={!studentSearch.gradeId || isLoadingStandards}
              onChange={(event) => {
                const standardId = event.target.value;
                setDivisionOptions([]);
                setIsLoadingDivisions(Boolean(standardId));
                setStudentSearch((current) => ({
                  ...current,
                  standardId,
                  divisionId: '',
                }));
              }}
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {isLoadingStandards
                  ? 'Loading standards...'
                  : studentSearch.gradeId
                    ? 'All Standards'
                    : 'Select Section first'}
              </option>
              {standardOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Division</span>
            <select
              value={studentSearch.divisionId ?? ''}
              disabled={!studentSearch.standardId || isLoadingDivisions}
              onChange={(event) => setStudentSearch((current) => ({ ...current, divisionId: event.target.value }))}
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {isLoadingDivisions
                  ? 'Loading divisions...'
                  : studentSearch.standardId
                    ? 'All Divisions'
                    : 'Select Standard first'}
              </option>
              {divisionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">First Name</span>
            <input
              type="text"
              value={studentSearch.firstName ?? ''}
              onChange={(event) => setStudentSearch((current) => ({ ...current, firstName: event.target.value }))}
              placeholder="Enter first name"
              autoComplete="off"
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Last Name</span>
            <input
              type="text"
              value={studentSearch.lastName ?? ''}
              onChange={(event) => setStudentSearch((current) => ({ ...current, lastName: event.target.value }))}
              placeholder="Enter last name"
              autoComplete="off"
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">GR No.</span>
            <input
              type="text"
              value={studentSearch.grNo ?? ''}
              onChange={(event) => setStudentSearch((current) => ({ ...current, grNo: event.target.value }))}
              placeholder="Enter GR number"
              className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSearching}
            className="flex h-9 items-center gap-2 rounded bg-[#3f5bf6] px-5 text-sm font-medium text-white transition hover:bg-[#3249d8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Student Profiles Dashboard */}
      <StudentProfilesDashboard
        students={sortedStudents}
        selectedStudents={selectedStudents}
        setSelectedStudents={setSelectedStudents}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        sortConfig={sortConfig}
        setSortConfig={setSortConfig}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        classFilter={classFilter}
        setClassFilter={setClassFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        houseFilter={houseFilter}
        setHouseFilter={setHouseFilter}
        setShowAddModal={setShowAddModal}
        setSelectedStudent={setSelectedStudent}
        onStudentUpdated={(updatedStudent) => {
          setStudents((current) => current.map((student) => (
            student.id === updatedStudent.id ? updatedStudent : student
          )));
        }}
        classOptions={classOptions}
        statusOptions={statusOptions}
        houseOptions={houseOptions}
      />

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add New Student</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                <input
                  type="text"
                  placeholder="Enter student name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]">
                    <option value="">Select Class</option>
                    <option value="9">Class 9</option>
                    <option value="10">Class 10</option>
                    <option value="11">Class 11</option>
                    <option value="12">Class 12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]">
                    <option value="">Select Section</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Father&apos;s Name</label>
                <input
                  type="text"
                  placeholder="Enter father's name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 bg-[#0D6EFD] text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
              >
                Add Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
