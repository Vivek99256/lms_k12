'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Pencil,
  Eye,
  Download,
  Filter,
  Loader2,
  User,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type SortDirection = 'asc' | 'desc' | null;
type SortField = string;

interface StudentRecord {
  id: string;
  studentId: string;
  grNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  age: string;
  standard: string;
  section: string;
  admissionDate: string;
  status: 'active' | 'inactive' | 'passed-out' | 'transferred';
  address: string;
  fatherName: string;
  motherName: string;
}

const mockStudents: StudentRecord[] = [
  {
    id: 'STU-001',
    studentId: '2026-1001',
    grNo: 'GR-2026-001',
    firstName: 'Priya',
    middleName: 'Rajesh',
    lastName: 'Sharma',
    fullName: 'Priya Rajesh Sharma',
    email: 'priya.sharma@email.com',
    mobile: '+91 9876543210',
    dateOfBirth: '2015-03-14',
    age: '11',
    standard: '6th Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '123 MG Road, Bangalore, Karnataka - 560001',
    fatherName: 'Rajesh Sharma',
    motherName: 'Sunita Sharma',
  },
  {
    id: 'STU-002',
    studentId: '2026-1002',
    grNo: 'GR-2026-002',
    firstName: 'Arjun',
    middleName: 'Vikram',
    lastName: 'Singh',
    fullName: 'Arjun Vikram Singh',
    email: 'arjun.singh@email.com',
    mobile: '+91 9876543211',
    dateOfBirth: '2014-08-22',
    age: '11',
    standard: '7th Standard',
    section: 'B',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '45 Park Street, Kolkata, West Bengal - 700016',
    fatherName: 'Vikram Singh',
    motherName: 'Meera Singh',
  },
  {
    id: 'STU-003',
    studentId: '2026-1003',
    grNo: 'GR-2026-003',
    firstName: 'Riya',
    middleName: 'Amit',
    lastName: 'Patel',
    fullName: 'Riya Amit Patel',
    email: 'riya.patel@email.com',
    mobile: '+91 9876543212',
    dateOfBirth: '2012-11-05',
    age: '13',
    standard: '10th Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '78 CG Road, Ahmedabad, Gujarat - 380009',
    fatherName: 'Amit Patel',
    motherName: 'Kavita Patel',
  },
  {
    id: 'STU-004',
    studentId: '2026-1004',
    grNo: 'GR-2026-004',
    firstName: 'Kavi',
    middleName: 'Suresh',
    lastName: 'Kumar',
    fullName: 'Kavi Suresh Kumar',
    email: 'kavi.kumar@email.com',
    mobile: '+91 9876543213',
    dateOfBirth: '2019-01-10',
    age: '7',
    standard: '2nd Standard',
    section: 'C',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '22 Anna Nagar, Chennai, Tamil Nadu - 600040',
    fatherName: 'Suresh Kumar',
    motherName: 'Lakshmi Kumar',
  },
  {
    id: 'STU-005',
    studentId: '2026-1005',
    grNo: 'GR-2026-005',
    firstName: 'Anjali',
    middleName: 'Krishna',
    lastName: 'Reddy',
    fullName: 'Anjali Krishna Reddy',
    email: 'anjali.reddy@email.com',
    mobile: '+91 9876543214',
    dateOfBirth: '2013-05-18',
    age: '13',
    standard: '12th Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'passed-out',
    address: '90 Jubilee Hills, Hyderabad, Telangana - 500033',
    fatherName: 'Krishna Reddy',
    motherName: 'Padma Reddy',
  },
  {
    id: 'STU-006',
    studentId: '2026-1006',
    grNo: 'GR-2026-006',
    firstName: 'Rohan',
    middleName: 'Sanjay',
    lastName: 'Gupta',
    fullName: 'Rohan Sanjay Gupta',
    email: 'rohan.gupta@email.com',
    mobile: '+91 9876543215',
    dateOfBirth: '2016-09-30',
    age: '9',
    standard: '4th Standard',
    section: 'B',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '56 SG Palya, Bangalore, Karnataka - 560029',
    fatherName: 'Sanjay Gupta',
    motherName: 'Neha Gupta',
  },
  {
    id: 'STU-007',
    studentId: '2026-1007',
    grNo: 'GR-2026-007',
    firstName: 'Sneha',
    middleName: 'Ramesh',
    lastName: 'Verma',
    fullName: 'Sneha Ramesh Verma',
    email: 'sneha.verma@email.com',
    mobile: '+91 9876543216',
    dateOfBirth: '2015-07-12',
    age: '10',
    standard: '5th Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '12 Vijay Nagar, Indore, Madhya Pradesh - 452001',
    fatherName: 'Ramesh Verma',
    motherName: 'Geeta Verma',
  },
  {
    id: 'STU-008',
    studentId: '2026-1008',
    grNo: 'GR-2026-008',
    firstName: 'Aditya',
    middleName: 'Mohan',
    lastName: 'Joshi',
    fullName: 'Aditya Mohan Joshi',
    email: 'aditya.joshi@email.com',
    mobile: '+91 9876543217',
    dateOfBirth: '2013-12-03',
    age: '12',
    standard: '8th Standard',
    section: 'C',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '34 Baner Road, Pune, Maharashtra - 411045',
    fatherName: 'Mohan Joshi',
    motherName: 'Sujata Joshi',
  },
  {
    id: 'STU-009',
    studentId: '2026-1009',
    grNo: 'GR-2026-009',
    firstName: 'Isha',
    middleName: 'Prakash',
    lastName: 'Iyer',
    fullName: 'Isha Prakash Iyer',
    email: 'isha.iyer@email.com',
    mobile: '+91 9876543218',
    dateOfBirth: '2016-04-25',
    age: '10',
    standard: '3rd Standard',
    section: 'B',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '67 T Nagar, Chennai, Tamil Nadu - 600017',
    fatherName: 'Prakash Iyer',
    motherName: 'Uma Iyer',
  },
  {
    id: 'STU-010',
    studentId: '2026-1010',
    grNo: 'GR-2026-010',
    firstName: 'Vihaan',
    middleName: 'Deepak',
    lastName: 'Malhotra',
    fullName: 'Vihaan Deepak Malhotra',
    email: 'vihaan.malhotra@email.com',
    mobile: '+91 9876543219',
    dateOfBirth: '2017-10-08',
    age: '8',
    standard: '2nd Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '89 DLF Phase 2, Gurugram, Haryana - 122002',
    fatherName: 'Deepak Malhotra',
    motherName: 'Priyanka Malhotra',
  },
  {
    id: 'STU-011',
    studentId: '2026-1011',
    grNo: 'GR-2026-011',
    firstName: 'Diya',
    middleName: 'Anil',
    lastName: 'Kapoor',
    fullName: 'Diya Anil Kapoor',
    email: 'diya.kapoor@email.com',
    mobile: '+91 9876543220',
    dateOfBirth: '2014-06-17',
    age: '11',
    standard: '7th Standard',
    section: 'C',
    admissionDate: '2026-04-01',
    status: 'transferred',
    address: '23 Bandra West, Mumbai, Maharashtra - 400050',
    fatherName: 'Anil Kapoor',
    motherName: 'Ritu Kapoor',
  },
  {
    id: 'STU-012',
    studentId: '2026-1012',
    grNo: 'GR-2026-012',
    firstName: 'Kabir',
    middleName: 'Sunil',
    lastName: 'Mehta',
    fullName: 'Kabir Sunil Mehta',
    email: 'kabir.mehta@email.com',
    mobile: '+91 9876543221',
    dateOfBirth: '2015-02-28',
    age: '11',
    standard: '6th Standard',
    section: 'A',
    admissionDate: '2026-04-01',
    status: 'active',
    address: '45 Koramangala, Bangalore, Karnataka - 560095',
    fatherName: 'Sunil Mehta',
    motherName: 'Anita Mehta',
  },
];

const standards = [
  'Nursery', 'LKG', 'UKG',
  '1st Standard', '2nd Standard', '3rd Standard', '4th Standard',
  '5th Standard', '6th Standard', '7th Standard', '8th Standard',
  '9th Standard', '10th Standard', '11th Standard', '12th Standard',
];

const sections = ['A', 'B', 'C', 'D'];
const statuses = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'passed-out', label: 'Passed Out' },
  { value: 'transferred', label: 'Transferred' },
];

type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
};

const columns: ColumnDef[] = [
  { key: 'action', label: 'Action', width: '100px' },
  { key: 'id', label: 'ID', width: '100px', sortable: true },
  { key: 'grNo', label: 'GR No', width: '130px', sortable: true },
  { key: 'fullName', label: 'Student Name', width: '180px', sortable: true },
  { key: 'standard', label: 'Standard', width: '130px', sortable: true },
  { key: 'section', label: 'Section', width: '80px', sortable: true },
  { key: 'mobile', label: 'Mobile', width: '130px' },
  { key: 'email', label: 'Email', width: '180px' },
  { key: 'dateOfBirth', label: 'DOB', width: '110px', sortable: true },
  { key: 'status', label: 'Status', width: '110px', sortable: true },
];

const ROWS_PER_PAGE = 10;

export default function StudentProfilesTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const getSessionContext = useCallback(() => {
    if (typeof window === 'undefined') {
      return { token: '', subInstituteId: '', hostName: '' };
    }
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}');
      return {
        token: userData.user_token || userData.token || '',
        subInstituteId: userData.sub_institute_id || menuContext.sub_institute_id || '',
        hostName: userData.host_name || '',
      };
    } catch {
      return { token: '', subInstituteId: '', hostName: '' };
    }
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      const { token, subInstituteId, hostName } = getSessionContext();
      
      if (!hostName || !token || !subInstituteId) {
        return;
      }

      setLoading(true);
      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', subInstituteId);
        form.append('token', token);

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('Student profiles API error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [getSessionContext]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3.5 w-3.5 text-[#0D6EFD]" />;
    if (sortDirection === 'desc') return <ArrowDown className="ml-1 h-3.5 w-3.5 text-[#0D6EFD]" />;
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
  };

  const filteredData = mockStudents.filter((student) => {
    const matchesSearch = searchQuery === '' ||
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.grNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.mobile.includes(searchQuery) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStandard = selectedStandard === '' || student.standard === selectedStandard;
    const matchesSection = selectedSection === '' || student.section === selectedSection;
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;

    return matchesSearch && matchesStandard && matchesSection && matchesStatus;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;
    const aVal = a[sortField as keyof StudentRecord] ?? '';
    const bVal = b[sortField as keyof StudentRecord] ?? '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalEntries = sortedData.length;
  const totalPages = Math.ceil(totalEntries / ROWS_PER_PAGE);
  const startEntry = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endEntry = Math.min(currentPage * ROWS_PER_PAGE, totalEntries);
  const paginatedData = sortedData.slice(startEntry - 1, endEntry);

  const getPaginationItems = () => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (currentPage > 3) items.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        items.push(i);
      }
      if (currentPage < totalPages - 2) items.push('ellipsis');
      items.push(totalPages);
    }
    return items;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      'active': 'bg-green-100 text-green-700 border-green-200',
      'inactive': 'bg-gray-100 text-gray-600 border-gray-200',
      'passed-out': 'bg-blue-100 text-blue-700 border-blue-200',
      'transferred': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    const style = statusStyles[status] || statusStyles['inactive'];
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', style)}>
        {status.replace('-', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Card */}
      <Card className="border-gray-200/60 shadow-lg shadow-gray-200/50">
        <CardHeader className="pb-4 pt-5 bg-gradient-to-br from-gray-50/80 to-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Search className="h-5 w-5 text-[#0D6EFD]" />
              Search Filters
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Search className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Search
              </Label>
              <Input
                placeholder="Name, GR No, Mobile, Email"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <GraduationCap className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Standard
              </Label>
              <Select value={selectedStandard} onValueChange={(value) => { setSelectedStandard(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50">
                  <SelectValue placeholder="All Standards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Standards</SelectItem>
                  {standards.map((std) => (
                    <SelectItem key={std} value={std}>{std}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <FileText className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Section
              </Label>
              <Select value={selectedSection} onValueChange={(value) => { setSelectedSection(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sections</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Filter className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Status
              </Label>
              <Select value={selectedStatus} onValueChange={(value) => { setSelectedStatus(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card className="border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#0D6EFD] via-blue-500 to-[#7ED957]" />
        
        <CardHeader className="bg-gradient-to-br from-gray-50/80 to-white py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#0D6EFD]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Student Records</CardTitle>
                <p className="text-xs text-gray-500">{totalEntries} student{totalEntries !== 1 ? 's' : ''} found</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-slate-200">
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500',
                        col.sortable && 'cursor-pointer select-none hover:text-slate-700 transition-colors',
                        col.width && `w-[${col.width}]`
                      )}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className={cn('flex items-center', col.align === 'center' && 'justify-center', col.align === 'right' && 'justify-end')}>
                        {col.label}
                        {col.sortable && getSortIcon(col.key)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0D6EFD]" />
                      <p className="mt-2 text-sm text-slate-500">Loading students...</p>
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-8 w-8 text-slate-300" />
                        <p>No students found matching your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((student) => (
                    <TableRow
                      key={student.id}
                      className="border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 transition-colors"
                            onClick={() => router.push(`/search_student/student/${student.id}/view`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 transition-colors"
                            onClick={() => router.push(`/search_student/student/${student.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-medium text-slate-700">
                        {student.id}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono text-[#0D6EFD]">
                        {student.grNo}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-medium text-slate-900">
                        {student.fullName}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600">
                        {student.standard}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600 text-center font-medium">
                        {student.section}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {student.mobile}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600">
                        {student.email}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600">
                        {format(parseISO(student.dateOfBirth), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {getStatusBadge(student.status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalEntries > 0 && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing {startEntry} to {endEntry} of {totalEntries} entries
              </p>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent className="gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={cn(
                          'h-8 min-w-8 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50',
                          currentPage === 1 && 'pointer-events-none opacity-50'
                        )}
                      />
                    </PaginationItem>

                    {getPaginationItems().map((item, idx) => (
                      <PaginationItem key={idx}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis className="h-8 min-w-8" />
                        ) : (
                          <PaginationLink
                            isActive={currentPage === item}
                            onClick={() => handlePageChange(item as number)}
                            className={cn(
                              'h-8 min-w-8 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50',
                              currentPage === item && 'bg-[#0D6EFD] text-white border-[#0D6EFD] hover:bg-[#0D6EFD]/90'
                            )}
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={cn(
                          'h-8 min-w-8 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50',
                          currentPage === totalPages && 'pointer-events-none opacity-50'
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
