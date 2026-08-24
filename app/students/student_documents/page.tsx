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
  ChevronRight,
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

// Sample Data matching the image
const sampleStudents: StudentDocument[] = [
  { id: 'STU001', name: 'Aarav Sharma', class: '6', section: 'A', admissionNo: 'ADM-2026-0421', verifiedDocs: 4, totalDocs: 6, pendingDocs: 2, missingDocs: 0, status: 'pending', lastUpdated: '2024-01-15' },
  { id: 'STU002', name: 'Ishaan Iyer', class: '7', section: 'A', admissionNo: 'ADM-2026-0422', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-14' },
  { id: 'STU003', name: 'Ananya Gupta', class: '8', section: 'A', admissionNo: 'ADM-2026-0423', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-13' },
  { id: 'STU004', name: 'Kiara Kapoor', class: '9', section: 'A', admissionNo: 'ADM-2026-0424', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-12' },
  { id: 'STU005', name: 'Pari Menon', class: '10', section: 'A', admissionNo: 'ADM-2026-0425', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-11' },
  { id: 'STU006', name: 'Sai Malhotra', class: '6', section: 'A', admissionNo: 'ADM-2026-0426', verifiedDocs: 6, totalDocs: 6, pendingDocs: 0, missingDocs: 0, status: 'complete', lastUpdated: '2024-01-10' },
];

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
      case 'complete': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      case 'missing': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
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
{/* Stats Tabs - Like the image */}
      <div className="flex items-center gap-6 bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#0D6EFD] text-white rounded-lg text-sm font-medium">
            <Users className="w-4 h-4" />
            All students
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{metrics.total}</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
            <Clock className="w-4 h-4 text-amber-500" />
            Pending verification
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{metrics.pending}</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Missing documents
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">{metrics.missing}</span>
          </button>
        </div>
        <div className="ml-auto text-sm text-slate-500">
          {metrics.total} students
        </div>
      </div>
      {/* Students Table - Matching the image design */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="col-span-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</span>
          </div>
          <div className="col-span-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</span>
          </div>
          <div className="col-span-2 text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified</span>
          </div>
          <div className="col-span-2 text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</span>
          </div>
          <div className="col-span-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
          </div>
          <div className="col-span-1 text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</span>
          </div>
        </div>

        {/* Students List */}
        <div className="divide-y divide-slate-100">
          {filteredStudents.map((student) => (
            <div key={student.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
              {/* Student Info */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.admissionNo}</p>
                </div>
              </div>

              {/* Class */}
              <div className="col-span-2">
                <span className="text-sm text-slate-700">Grade {student.class} - {student.section}</span>
              </div>

              {/* Verified */}
              <div className="col-span-2 text-center">
                <span className="text-sm font-semibold text-slate-900">{student.verifiedDocs} / {student.totalDocs}</span>
              </div>

              {/* Pending */}
              <div className="col-span-2 text-center">
                <span className={`text-sm font-semibold ${student.pendingDocs > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {student.pendingDocs}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                  {getStatusIcon(student.status)}
                  {student.status === 'complete' ? 'Complete' : 
                   student.status === 'pending' ? 'Missing documents' : 
                   'Missing documents'}
                </span>
              </div>

              {/* Action */}
              <div className="col-span-1 flex items-center justify-end">
                <button className="flex items-center gap-1 text-sm text-[#0D6EFD] hover:text-blue-700 font-medium transition-colors">
                  Review
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
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