// StudentDetailDrawer.tsx
'use client';

import React, { useState } from 'react';
import {
  X,
  Edit,
  FileText,
  Printer,
  AlertCircle,
  CheckCircle,
  Save,
  Award,
} from 'lucide-react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { Student } from './StudentProfilesTab';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Edit Profile Form Component
interface EditProfileFormProps {
  student: Student;
  onSave: (updatedStudent: Student) => Promise<void> | void;
  onCancel: () => void;
}

function EditProfileForm({ student, onSave, onCancel }: EditProfileFormProps) {
  const [formData, setFormData] = useState(student);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      await onSave(formData);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update student.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Student Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Admission No</label>
          <input
            type="text"
            name="admissionNo"
            value={formData.admissionNo}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Class</label>
          <select
            name="class"
            value={formData.class}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          >
            <option value="6">Grade 6</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Section</label>
          <select
            name="section"
            value={formData.section}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Roll Number</label>
          <input
            type="number"
            name="rollNo"
            value={formData.rollNo}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
          <select
            name="bloodGroup"
            value={formData.bloodGroup}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          >
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">House</label>
          <select
            name="house"
            value={formData.house}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          >
            <option value="Red">Red</option>
            <option value="Blue">Blue</option>
            <option value="Green">Green</option>
            <option value="Yellow">Yellow</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Father&apos;s Name</label>
          <input
            type="text"
            name="fatherName"
            value={formData.fatherName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Mother&apos;s Name</label>
          <input
            type="text"
            name="motherName"
            value={formData.motherName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/20 focus:border-[#0D6EFD]"
        />
      </div>

      {saveError && (
        <p className="text-sm text-red-600">{saveError}</p>
      )}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0D6EFD] text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Dummy Certificate Component
function DummyCertificate({ student }: { student: Student }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-200/20 rounded-full -ml-16 -mb-16"></div>
        
        <div className="text-center relative">
          <div className="flex justify-center mb-4">
            <Award className="w-16 h-16 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Certificate of Achievement</h2>
          <div className="w-20 h-1 bg-blue-500 mx-auto my-3"></div>
          <p className="text-slate-600">This is to certify that</p>
          <h3 className="text-3xl font-bold text-slate-900 my-2">{student.name}</h3>
          <p className="text-slate-600">has successfully completed Grade {student.class}-{student.section}</p>
          <p className="text-slate-600 mt-1">with an outstanding attendance of <span className="font-semibold text-blue-600">{student.attendance}%</span></p>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-blue-200">
            <div>
              <p className="text-xs text-slate-500">Date of Issue</p>
              <p className="text-sm font-medium text-slate-800">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Certificate No</p>
              <p className="text-sm font-medium text-slate-800">CERT-{student.admissionNo}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <p className="text-sm text-emerald-700">This certificate is digitally verified and can be validated through our portal.</p>
      </div>
    </div>
  );
}

// Dummy ID Card Component
function DummyIDCard({ student }: { student: Student }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-300 p-6 max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 text-center">
            <p className="text-white font-bold text-sm tracking-wider">STUDENT ID CARD</p>
          </div>
          
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 border-2 border-white shadow-md">
                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">{student.name}</p>
                <p className="text-sm text-slate-600">Class {student.class}-{student.section}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    student.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    student.status === 'transferred' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200 text-sm">
              <div>
                <p className="text-xs text-slate-500">Admission No</p>
                <p className="font-medium text-slate-800">{student.admissionNo}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Roll No</p>
                <p className="font-medium text-slate-800">{student.rollNo}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">House</p>
                <p className="font-medium text-slate-800">{student.house}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Blood Group</p>
                <p className="font-medium text-slate-800">{student.bloodGroup}</p>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400">Valid for Academic Year {new Date().getFullYear()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700">This ID card is valid for school identification and library access.</p>
        </div>
      </div>
    </div>
  );
}

// Main Student Detail Drawer
interface StudentDetailDrawerProps {
  student: Student | null;
  onClose: () => void;
  onEdit: (student: Student) => Promise<void> | void;
  onGenerateCertificate: (student: Student) => void;
  onPrintIDCard: (student: Student) => void;
}

export function StudentDetailDrawer({
  student,
  onClose,
  onEdit,
  onGenerateCertificate,
  onPrintIDCard,
}: StudentDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'academics' | 'attendance' | 'documents'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showIDCard, setShowIDCard] = useState(false);

  if (!student) return null;

  const handleEditClick = () => {
    setEditStudent({ ...student });
    setIsEditing(true);
    setShowCertificate(false);
    setShowIDCard(false);
    setActiveTab('form');
  };

  const handleGenerateCertificateClick = () => {
    setShowCertificate(true);
    setShowIDCard(false);
    setIsEditing(false);
    setActiveTab('overview');
  };

  const handlePrintIDCardClick = () => {
    setShowIDCard(true);
    setShowCertificate(false);
    setIsEditing(false);
    setActiveTab('overview');
  };

  const handleSaveEdit = async (updatedStudent: Student) => {
    await onEdit(updatedStudent);
    setEditStudent(null);
    setIsEditing(false);
    setActiveTab('overview');
  };

  const handleCancelEdit = () => {
    setEditStudent(null);
    setIsEditing(false);
    setActiveTab('overview');
  };

  const handleClose = () => {
    setIsEditing(false);
    setShowCertificate(false);
    setShowIDCard(false);
    setActiveTab('overview');
    onClose();
  };

  // Spider web chart data
  const spiderData = {
    labels: ['Attendance', 'Homework', 'Discipline', 'Health', 'Participation'],
    datasets: [
      {
        label: student.name,
        data: [
          student.attendance,
          Math.min(100, student.attendance + 5),
          Math.min(100, student.attendance - 10),
          Math.min(100, student.attendance + 3),
          Math.min(100, student.attendance + 8),
        ],
        backgroundColor: 'rgba(13, 110, 253, 0.2)',
        borderColor: '#0D6EFD',
        borderWidth: 2,
        pointBackgroundColor: '#0D6EFD',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#0D6EFD',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const spiderOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20,
          color: '#64748b',
          font: { size: 10 },
        },
        grid: {
          color: 'rgba(0,0,0,0.1)',
        },
        angleLines: {
          color: 'rgba(0,0,0,0.1)',
        },
        pointLabels: {
          color: '#1e293b',
          font: { size: 11, weight: 500 },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
      },
    },
  };

  const renderContent = () => {
    // Show Certificate
    if (showCertificate) {
      return <DummyCertificate student={student} />;
    }

    // Show ID Card
    if (showIDCard) {
      return <DummyIDCard student={student} />;
    }

    switch (activeTab) {
      case 'form':
        return (
          <EditProfileForm
            student={editStudent || student}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        );
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Attendance</p>
                <p className="text-2xl font-bold text-slate-900">{student.attendance}%</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Status</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  student.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  student.status === 'transferred' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">House</p>
                <p className="text-lg font-semibold text-slate-900">{student.house}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500">Blood Group</p>
                <p className="text-lg font-semibold text-slate-900">{student.bloodGroup}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Personal Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Admission No</p>
                  <p className="font-medium">{student.admissionNo}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Roll Number</p>
                  <p className="font-medium">{student.rollNo}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Class</p>
                  <p className="font-medium">Grade {student.class} - {student.section}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Gender</p>
                  <p className="font-medium">{student.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date of Birth</p>
                  <p className="font-medium">{new Date(student.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Active</p>
                  <p className="font-medium">{student.lastActive}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Guardian Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Primary Guardian</p>
                  <p className="font-medium">{student.fatherName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Relationship</p>
                  <p className="font-medium">Father</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="font-medium">{student.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium">{student.email}</p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xs text-slate-500">Address</p>
                <p className="text-sm font-medium">{student.address}</p>
              </div>
            </div>
          </div>
        );
      case 'academics':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Academic Performance</h4>
              <div className="space-y-3">
                {['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science'].map((subject, idx) => (
                  <div key={subject}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{subject}</span>
                      <span className="font-semibold text-slate-900">{85 - idx * 2}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0D6EFD] rounded-full"
                        style={{ width: `${85 - idx * 2}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Attendance Records</h4>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Overall Attendance</span>
                <span className="text-2xl font-bold text-[#0D6EFD]">{student.attendance}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#0D6EFD] rounded-full"
                  style={{ width: `${student.attendance}%` }}
                />
              </div>
            </div>
          </div>
        );
      case 'attendance':
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Monthly Attendance</h4>
              <div className="space-y-3">
                {['January', 'February', 'March', 'April', 'May', 'June'].map((month, idx) => {
                  const value = Math.min(100, student.attendance + (idx * 2) - 5);
                  return (
                    <div key={month}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{month}</span>
                        <span className="font-semibold text-slate-900">{value}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">182</p>
                <p className="text-xs text-slate-500">Days Present</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-red-500">18</p>
                <p className="text-xs text-slate-500">Days Absent</p>
              </div>
            </div>
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Document Status</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Birth Certificate</span>
                  {student.docsMissing > 0 ? (
                    <span className="text-xs text-amber-600 font-medium">Pending</span>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium">Verified ✓</span>
                  )}
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Medical Records</span>
                  <span className="text-xs text-emerald-600 font-medium">Verified ✓</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Previous School Records</span>
                  {student.docsMissing > 1 ? (
                    <span className="text-xs text-amber-600 font-medium">Pending</span>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium">Verified ✓</span>
                  )}
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Immunization Records</span>
                  <span className="text-xs text-emerald-600 font-medium">Verified ✓</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">ID Card Photo</span>
                  <span className="text-xs text-emerald-600 font-medium">Uploaded ✓</span>
                </div>
              </div>
              {student.docsMissing > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700">{student.docsMissing} document(s) pending</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-[#0D6EFD] text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                Upload Documents
              </button>
              <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                View All
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose}></div>
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-screen overflow-hidden">
        {/* Drawer Header - Fixed */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 z-10">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-lg font-bold">
                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
                <p className="text-sm text-slate-500">{student.admissionNo} · Grade {student.class}-{student.section}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area with hidden scrollbar */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Spider Web Chart */}
          <div className="p-6 border-b border-slate-200">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Performance Profile</h3>
                <span className="text-xs text-slate-500">Attendance, Homework, Discipline, Health and Participation</span>
              </div>
              <div className="w-full h-64">
                <Radar data={spiderData} options={spiderOptions} />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 bg-slate-50/50 px-6">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {(['overview', 'form', 'academics', 'attendance', 'documents'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setShowCertificate(false);
                    setShowIDCard(false);
                  }}
                  className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative whitespace-nowrap ${
                    activeTab === tab && !showCertificate && !showIDCard
                      ? 'text-[#0D6EFD] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D6EFD]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'form' ? (
                    <span className="flex items-center gap-1">
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </span>
                  ) : (
                    tab
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {renderContent()}
          </div>
        </div>

        {/* Action Buttons Footer - Fixed */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleEditClick}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                isEditing ? 'bg-[#0D6EFD] text-white hover:bg-blue-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              onClick={handleGenerateCertificateClick}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                showCertificate ? 'bg-[#0D6EFD] text-white hover:bg-blue-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Generate Certificate
            </button>
            <button
              onClick={handlePrintIDCardClick}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                showIDCard ? 'bg-[#0D6EFD] text-white hover:bg-blue-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Printer className="w-4 h-4" />
              Print ID Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
