'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Download, Upload, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Users, UserCheck, UserX, FileText, Plus, MoreVertical, Check, X, Clock, AlertCircle,
  TrendingUp, TrendingDown, Minus, Eye, Edit, Trash2, Mail, Phone, Home, Calendar,
  Shield, Heart, Activity, Award, BookOpen, GraduationCap, Building2, UserCog, Settings,
  Bell, Info, XCircle, CheckCircle, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutGrid, List, Grid3x3, Maximize2, Minimize2, RefreshCw, Copy, Printer, ExternalLink
} from 'lucide-react';

// Types
interface Student {
  id: string;
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

interface MetricCardProps {
  title: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; label: string };
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

// Sample Data
const sampleStudents: Student[] = [
  { id: 'STU001', admissionNo: 'ADM/2024/001', name: 'Aarav Sharma', class: '9', section: 'A', rollNo: '01', gender: 'Male', dob: '2011-03-15', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma', guardian: 'Rajesh Sharma', phone: '+91 98765 43210', email: 'rajesh.sharma@email.com', address: '42, Green Park Colony, Sector 15', house: 'Red', bloodGroup: 'B+', status: 'active', attendance: 94, lastActive: 'Today', docsMissing: 0, vaccination: 'Up to date', allergy: null, infirmary: 2 },
  { id: 'STU002', admissionNo: 'ADM/2024/002', name: 'Ananya Patel', class: '9', section: 'A', rollNo: '02', gender: 'Female', dob: '2011-07-22', fatherName: 'Mitesh Patel', motherName: 'Meera Patel', guardian: 'Mitesh Patel', phone: '+91 98765 43211', email: 'mitesh.patel@email.com', address: '15, Lake View Apartments, MG Road', house: 'Blue', bloodGroup: 'O+', status: 'active', attendance: 97, lastActive: 'Today', docsMissing: 0, vaccination: 'Up to date', allergy: null, infirmary: 0 },
  { id: 'STU003', admissionNo: 'ADM/2024/003', name: 'Vihaan Gupta', class: '9', section: 'A', rollNo: '03', gender: 'Male', dob: '2011-01-08', fatherName: 'Vikram Gupta', motherName: 'Anjali Gupta', guardian: 'Vikram Gupta', phone: '+91 98765 43212', email: 'vikram.gupta@email.com', address: '28, Sunrise Enclave, Phase 2', house: 'Green', bloodGroup: 'A+', status: 'active', attendance: 91, lastActive: 'Yesterday', docsMissing: 1, vaccination: 'Up to date', allergy: 'Peanuts', infirmary: 1 },
  { id: 'STU004', admissionNo: 'ADM/2024/004', name: 'Myra Singh', class: '9', section: 'B', rollNo: '01', gender: 'Female', dob: '2011-05-30', fatherName: 'Arjun Singh', motherName: 'Kavita Singh', guardian: 'Arjun Singh', phone: '+91 98765 43213', email: 'arjun.singh@email.com', address: '7, Harmony Lane, Civil Lines', house: 'Yellow', bloodGroup: 'AB+', status: 'active', attendance: 98, lastActive: 'Today', docsMissing: 0, vaccination: 'Up to date', allergy: null, infirmary: 0 },
  { id: 'STU005', admissionNo: 'ADM/2024/005', name: 'Kabir Verma', class: '9', section: 'B', rollNo: '02', gender: 'Male', dob: '2011-09-12', fatherName: 'Sanjay Verma', motherName: 'Sunita Verma', guardian: 'Sanjay Verma', phone: '+91 98765 43214', email: 'sanjay.verma@email.com', address: '33, Block C, Rainbow Residency', house: 'Red', bloodGroup: 'B-', status: 'inactive', attendance: 72, lastActive: '3 days ago', docsMissing: 2, vaccination: 'Partial', allergy: null, infirmary: 3 },
  { id: 'STU006', admissionNo: 'ADM/2024/006', name: 'Saanvi Joshi', class: '9', section: 'B', rollNo: '03', gender: 'Female', dob: '2011-11-25', fatherName: 'Rohan Joshi', motherName: 'Geetika Joshi', guardian: 'Rohan Joshi', phone: '+91 98765 43215', email: 'rohan.joshi@email.com', address: '19, Pearl Heights, Station Road', house: 'Blue', bloodGroup: 'O-', status: 'active', attendance: 95, lastActive: 'Today', docsMissing: 0, vaccination: 'Up to date', allergy: 'Dust', infirmary: 1 },
  { id: 'STU007', admissionNo: 'ADM/2024/007', name: 'Reyansh Mehta', class: '10', section: 'A', rollNo: '01', gender: 'Male', dob: '2010-04-18', fatherName: 'Kiran Mehta', motherName: 'Dimple Mehta', guardian: 'Kiran Mehta', phone: '+91 98765 43216', email: 'kiran.mehta@email.com', address: '5, Classic Colony, Near Park', house: 'Green', bloodGroup: 'A-', status: 'active', attendance: 89, lastActive: 'Today', docsMissing: 1, vaccination: 'Up to date', allergy: null, infirmary: 0 },
  { id: 'STU008', admissionNo: 'ADM/2024/008', name: 'Aadhira Reddy', class: '10', section: 'A', rollNo: '02', gender: 'Female', dob: '2010-08-05', fatherName: 'Pradeep Reddy', motherName: 'Lakshmi Reddy', guardian: 'Pradeep Reddy', phone: '+91 98765 43217', email: 'pradeep.reddy@email.com', address: '44, Royal Residency, Lane 3', house: 'Yellow', bloodGroup: 'B+', status: 'active', attendance: 96, lastActive: 'Yesterday', docsMissing: 0, vaccination: 'Up to date', allergy: null, infirmary: 0 },
  { id: 'STU009', admissionNo: 'ADM/2024/009', name: 'Vivaan Shah', class: '10', section: 'B', rollNo: '01', gender: 'Male', dob: '2010-12-20', fatherName: 'Mahesh Shah', motherName: 'Nisha Shah', guardian: 'Mahesh Shah', phone: '+91 98765 43218', email: 'mahesh.shah@email.com', address: '12, Mountain View, Hill Road', house: 'Red', bloodGroup: 'AB-', status: 'transferred', attendance: 88, lastActive: 'Last week', docsMissing: 0, vaccination: 'Up to date', allergy: null, infirmary: 0 },
  { id: 'STU010', admissionNo: 'ADM/2024/010', name: 'Inaaya Khan', class: '10', section: 'B', rollNo: '02', gender: 'Female', dob: '2010-02-14', fatherName: 'Imran Khan', motherName: 'Ayesha Khan', guardian: 'Imran Khan', phone: '+91 98765 43219', email: 'imran.khan@email.com', address: '26, Garden City, Block D', house: 'Blue', bloodGroup: 'O+', status: 'active', attendance: 92, lastActive: 'Today', docsMissing: 1, vaccination: 'Up to date', allergy: 'Pollen', infirmary: 2 },
];

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

// Metric Card Component
function MetricCard({ title, value, trend, icon, variant = 'default' }: MetricCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  };

  const iconStyles = {
    default: 'text-[#0D6EFD] bg-blue-100',
    success: 'text-emerald-600 bg-emerald-100',
    warning: 'text-amber-600 bg-amber-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <div className={`rounded-2xl border p-5 ${variantStyles[variant]} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.direction === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
              {trend.direction === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {trend.direction === 'flat' && <Minus className="w-4 h-4 text-gray-400" />}
              <span className={`text-xs font-medium ${
                trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {trend.value}
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: Student['status'] }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-100 text-gray-600',
    transferred: 'bg-amber-100 text-amber-700',
    alumni: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

// Table Header Component
function TableHeader({ label, sortable, sortKey, currentSort, onSort }: {
  label: string;
  sortable?: boolean;
  sortKey?: string;
  currentSort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
}) {
  if (!sortable || !sortKey) return <span className="font-semibold text-gray-700">{label}</span>;

  const isActive = currentSort?.key === sortKey;

  return (
    <button
      onClick={() => onSort?.(sortKey, isActive && currentSort?.dir === 'asc' ? 'desc' : 'asc')}
      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-[#0D6EFD] transition-colors group"
    >
      {label}
      <span className="opacity-40 group-hover:opacity-100 transition-opacity">
        {isActive ? (
          currentSort?.dir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4" />
        )}
      </span>
    </button>
  );
}

// Main Page Component
export default function SearchStudentPage() {
  const [activeTab, setActiveTab] = useState('profiles');
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
  const [selectedRecordTab, setSelectedRecordTab] = useState('overview');

  // Filter students
  const filteredStudents = useMemo(() => {
    return sampleStudents.filter(student => {
      const matchesSearch = searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.fatherName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesClass = classFilter === '' || student.class === classFilter;
      const matchesStatus = statusFilter === '' || student.status === statusFilter;
      const matchesHouse = houseFilter === '' || student.house === houseFilter;

      return matchesSearch && matchesClass && matchesStatus && matchesHouse;
    });
  }, [searchQuery, classFilter, statusFilter, houseFilter]);

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

  // Pagination
  const totalPages = Math.ceil(sortedStudents.length / pageSize);
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Calculate metrics
  const metrics = useMemo(() => ({
    total: sampleStudents.length,
    active: sampleStudents.filter(s => s.status === 'active').length,
    inactive: sampleStudents.filter(s => s.status === 'inactive').length,
    docsIssue: sampleStudents.filter(s => s.docsMissing > 0).length,
  }), []);

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortConfig({ key, dir });
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === paginatedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(paginatedStudents.map(s => s.id));
    }
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const tabs = [
    { id: 'profiles', label: 'Student profiles', icon: <Users className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, badge: metrics.docsIssue },
    { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-4 h-4" /> },
    { id: 'health', label: 'Health & medical', icon: <Heart className="w-4 h-4" /> },
    { id: 'discipline', label: 'Discipline', icon: <Shield className="w-4 h-4" /> },
    { id: 'houses', label: 'Houses', icon: <Building2 className="w-4 h-4" /> },
    { id: 'idcards', label: 'ID cards', icon: <GraduationCap className="w-4 h-4" /> },
  ];

  const activeFiltersCount = [classFilter, statusFilter, houseFilter].filter(Boolean).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage student records, profiles and information</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0D6EFD] text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Students"
          value={String(metrics.total)}
          icon={<Users className="w-5 h-5" />}
          trend={{ direction: 'up', value: '+8', label: 'vs AY 2025-26' }}
        />
        <MetricCard
          title="Active Students"
          value={String(metrics.active)}
          icon={<UserCheck className="w-5 h-5" />}
          variant="success"
          trend={{ direction: 'flat', value: '0', label: 'this month' }}
        />
        <MetricCard
          title="Transferred"
          value={String(sampleStudents.filter(s => s.status === 'transferred').length)}
          icon={<ExternalLink className="w-5 h-5" />}
          trend={{ direction: 'up', value: '+2', label: 'this month' }}
        />
        <MetricCard
          title="Docs Issues"
          value={String(metrics.docsIssue)}
          icon={<AlertCircle className="w-5 h-5" />}
          variant="warning"
          trend={{ direction: 'down', value: '-4', label: 'this month' }}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#0D6EFD] text-[#0D6EFD]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Student Profiles Tab */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
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

              {/* Filter Dropdowns */}
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

            {/* Active Filter Chips */}
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
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedStudents.length)} of {sortedStudents.length} students
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Tabs Placeholder */}
      {activeTab !== 'profiles' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
            {tabs.find(t => t.id === activeTab)?.icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{tabs.find(t => t.id === activeTab)?.label}</h3>
          <p className="text-gray-500 mb-4">This section is under development</p>
          <button
            onClick={() => setActiveTab('profiles')}
            className="px-4 py-2 bg-[#0D6EFD] text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Back to Profiles
          </button>
        </div>
      )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
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

      {/* Student Record Drawer */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStudent(null)}></div>
          <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl overflow-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-lg font-bold">
                    {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h2>
                    <p className="text-sm text-gray-500">{selectedStudent.admissionNo} · Class {selectedStudent.class}-{selectedStudent.section}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Record Tabs */}
              <div className="flex items-center gap-1 px-6 border-t border-gray-100">
                {['overview', 'documents', 'attendance', 'health', 'discipline', 'history'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSelectedRecordTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                      selectedRecordTab === tab
                        ? 'border-[#0D6EFD] text-[#0D6EFD]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6">
              {selectedRecordTab === 'overview' && (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-[#0D6EFD]">{selectedStudent.attendance}%</p>
                      <p className="text-xs text-gray-500 mt-1">Attendance</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{selectedStudent.status === 'active' ? 'Active' : selectedStudent.status}</p>
                      <p className="text-xs text-gray-500 mt-1">Status</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{selectedStudent.house}</p>
                      <p className="text-xs text-gray-500 mt-1">House</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-600">{selectedStudent.bloodGroup}</p>
                      <p className="text-xs text-gray-500 mt-1">Blood Group</p>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Date of Birth</p>
                          <p className="text-sm font-medium text-gray-900">{new Date(selectedStudent.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Gender</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.gender}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <UserCog className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Roll Number</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.rollNo}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Class · Section</p>
                          <p className="text-sm font-medium text-gray-900">Class {selectedStudent.class} · Section {selectedStudent.section}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parent/Guardian Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Parent / Guardian Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <UserCog className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Father's Name</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.fatherName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <UserCog className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Mother's Name</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.motherName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium text-gray-900">{selectedStudent.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Address</h3>
                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                      <Home className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedStudent.address}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedRecordTab !== 'overview' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">{selectedRecordTab} Records</h3>
                  <p className="text-gray-500">This section is under development</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}