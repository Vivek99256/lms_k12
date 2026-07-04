// page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Plus, X, Calendar, Users, UserCog, Building2, Phone, Mail, Home } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StudentProfilesDashboard } from './components/StudentProfilesDashboard';

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