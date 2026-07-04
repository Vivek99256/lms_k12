// app/students/student_documents/page.tsx
'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  Download,
  Mail,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  User,
  GraduationCap,
  Users,
  PieChart,
  BarChart3,
  Send,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Types
interface StudentDocument {
  id: string;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
  verifiedDocs: number;
  totalDocs: number;
  pendingDocs: number;
  missingDocs: number;
  status: 'complete' | 'pending' | 'missing';
  lastUpdated: string;
}

// Sample Data
const sampleStudents: StudentDocument[] = [
  { id: 'STU001', name: 'Aarav Sharma', class: '6', section: 'A', admissionNo: 'ADM/2024/001', verifiedDocs: 4, totalDocs: 6, pendingDocs: 2, missingDocs: 0, status: 'pending', lastUpdated: '2024-01-15' },
  { id: 'STU002', name: 'Ishaan Iyer', class: '7', section: 'A', admissionNo: 'ADM/2024/002', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-14' },
  { id: 'STU003', name: 'Ananya Gupta', class: '8', section: 'A', admissionNo: 'ADM/2024/003', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-13' },
  { id: 'STU004', name: 'Klara Kapoor', class: '9', section: 'A', admissionNo: 'ADM/2024/004', verifiedDocs: 5, totalDocs: 6, pendingDocs: 1, missingDocs: 0, status: 'pending', lastUpdated: '2024-01-12' },
  { id: 'STU005', name: 'Pari Menon', class: '10', section: 'A', admissionNo: 'ADM/2024/005', verifiedDocs: 3, totalDocs: 6, pendingDocs: 2, missingDocs: 1, status: 'missing', lastUpdated: '2024-01-11' },
  { id: 'STU006', name: 'Reyansh Kumar', class: '6', section: 'B', admissionNo: 'ADM/2024/006', verifiedDocs: 5, totalDocs: 6, pendingDocs: 1, missingDocs: 0, status: 'pending', lastUpdated: '2024-01-10' },
  { id: 'STU007', name: 'Myra Singh', class: '7', section: 'B', admissionNo: 'ADM/2024/007', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-09' },
  { id: 'STU008', name: 'Vihaan Mehta', class: '8', section: 'B', admissionNo: 'ADM/2024/008', verifiedDocs: 4, totalDocs: 6, pendingDocs: 2, missingDocs: 0, status: 'pending', lastUpdated: '2024-01-08' },
  { id: 'STU009', name: 'Aadhira Reddy', class: '9', section: 'B', admissionNo: 'ADM/2024/009', verifiedDocs: 2, totalDocs: 6, pendingDocs: 3, missingDocs: 1, status: 'missing', lastUpdated: '2024-01-07' },
  { id: 'STU010', name: 'Kabir Verma', class: '10', section: 'B', admissionNo: 'ADM/2024/010', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-06' },
];

// Document Card Component
function DocumentCard({ student }: { student: StudentDocument }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'missing': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'missing': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {student.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
          <p className="text-xs text-slate-500">Grade {student.class} - {student.section} · {student.admissionNo}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">{student.verifiedDocs}/{student.totalDocs}</p>
          <p className="text-xs text-slate-500">Verified</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-amber-600">{student.pendingDocs}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
            {getStatusIcon(student.status)}
            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
          </span>
        </div>
        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Main Page Component
export default function StudentDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Filter students
  const filteredStudents = sampleStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.admissionNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  // Calculate metrics
  const metrics = {
    verified: sampleStudents.filter(s => s.status === 'complete').length,
    pending: sampleStudents.filter(s => s.status === 'pending').length,
    missing: sampleStudents.filter(s => s.status === 'missing').length,
    total: sampleStudents.length,
  };

  const complianceRate = Math.round((metrics.verified / metrics.total) * 100);

  // Doughnut chart data
  const doughnutData = {
    labels: ['Completed', 'Pending Verification', 'Missing Documents'],
    datasets: [
      {
        data: [metrics.verified, metrics.pending, metrics.missing],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderColor: '#ffffff',
        borderWidth: 3,
      },
    ],
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#64748b',
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((context.parsed / total) * 100);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
  };

  // Bar chart data - Documents by grade
  const gradeData = {
    labels: ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
    verified: [0, 0, 0, 0, 0],
    pending: [0, 0, 0, 0, 0],
  };

  sampleStudents.forEach(student => {
    const index = parseInt(student.class) - 6;
    if (index >= 0 && index < 5) {
      gradeData.verified[index] += student.verifiedDocs;
      gradeData.pending[index] += student.pendingDocs;
    }
  });

  const barData = {
    labels: gradeData.labels,
    datasets: [
      {
        label: 'Verified',
        data: gradeData.verified,
        backgroundColor: '#10b981',
        borderRadius: 4,
        barThickness: 28,
      },
      {
        label: 'Pending',
        data: gradeData.pending,
        backgroundColor: '#f59e0b',
        borderRadius: 4,
        barThickness: 28,
      },
    ],
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#64748b',
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#e2e8f0' },
        ticks: { color: '#64748b', font: { size: 11 }, stepSize: 5 },
      },
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Documents</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and verify student document submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#0D6EFD] text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-sm">
            <Send className="w-4 h-4" />
            Send Reminders
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Verified</p>
              <p className="text-2xl font-bold text-slate-900">{metrics.verified}</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pending Verification</p>
              <p className="text-2xl font-bold text-amber-600">{metrics.pending}</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Missing Documents</p>
              <p className="text-2xl font-bold text-red-600">{metrics.missing}</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Compliance</p>
              <p className="text-2xl font-bold text-slate-900">{complianceRate}%</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-emerald-600 mt-1">↑ 4.6% this month</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Doughnut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Verification Status</h3>
              <p className="text-xs text-slate-500">Share of students by document completeness</p>
            </div>
          </div>
          <div className="h-64">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Documents by Grade</h3>
              <p className="text-xs text-slate-500">Verified vs pending document count per grade</p>
            </div>
          </div>
          <div className="h-64">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] bg-white"
                >
                  <option value="all">All Classes</option>
                  <option value="6">Grade 6</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD] bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="complete">Complete</option>
                  <option value="pending">Pending</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{filteredStudents.length} students</span>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="col-span-4">Student</div>
          <div className="col-span-2 text-center">Verified</div>
          <div className="col-span-2 text-center">Pending</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Students List */}
        <div className="divide-y divide-slate-100">
          {filteredStudents.map((student) => (
            <DocumentCard key={student.id} student={student} />
          ))}
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No students found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}