'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Pencil,
  Eye,
  Printer,
  FileDown,
  Table2,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';

type SortDirection = 'asc' | 'desc' | null;
type SortField = string;

interface RegistrationRecord {
  id: string;
  enquiryNumber: string;
  admissionDate: string;
  registrationNumber: string;
  inquiryDate: string;
  followUpDate: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  age: string;
  admissionStandard: string;
  status: 'pending' | 'approved' | 'rejected' | 'under-review';
  address: string;
}

const mockData: RegistrationRecord[] = [
  {
    id: 'REG-001',
    enquiryNumber: 'ENQ-2026-001',
    admissionDate: '2026-06-25',
    registrationNumber: 'REG-2026-1001',
    inquiryDate: '2026-06-20',
    followUpDate: '2026-07-05',
    firstName: 'Priya',
    middleName: 'Rajesh',
    lastName: 'Sharma',
    mobile: '+91 9876543210',
    email: 'priya.sharma@email.com',
    dateOfBirth: '2015-03-14',
    age: '11',
    admissionStandard: '6th Standard',
    status: 'under-review',
    address: '123 MG Road, Bangalore, Karnataka - 560001',
  },
  {
    id: 'REG-002',
    enquiryNumber: 'ENQ-2026-002',
    admissionDate: '2026-06-24',
    registrationNumber: 'REG-2026-1002',
    inquiryDate: '2026-06-18',
    followUpDate: '2026-07-02',
    firstName: 'Arjun',
    middleName: 'Vikram',
    lastName: 'Singh',
    mobile: '+91 9876543211',
    email: 'arjun.singh@email.com',
    dateOfBirth: '2014-08-22',
    age: '11',
    admissionStandard: '5th Standard',
    status: 'approved',
    address: '45 Park Street, Kolkata, West Bengal - 700016',
  },
  {
    id: 'REG-003',
    enquiryNumber: 'ENQ-2026-003',
    admissionDate: '2026-06-23',
    registrationNumber: 'REG-2026-1003',
    inquiryDate: '2026-06-15',
    followUpDate: '2026-07-01',
    firstName: 'Riya',
    middleName: 'Amit',
    lastName: 'Patel',
    mobile: '+91 9876543212',
    email: 'riya.patel@email.com',
    dateOfBirth: '2012-11-05',
    age: '13',
    admissionStandard: '10th Standard',
    status: 'pending',
    address: '78 CG Road, Ahmedabad, Gujarat - 380009',
  },
  {
    id: 'REG-004',
    enquiryNumber: 'ENQ-2026-004',
    admissionDate: '2026-06-22',
    registrationNumber: 'REG-2026-1004',
    inquiryDate: '2026-06-12',
    followUpDate: '2026-06-28',
    firstName: 'Kavi',
    middleName: 'Suresh',
    lastName: 'Kumar',
    mobile: '+91 9876543213',
    email: 'kavi.kumar@email.com',
    dateOfBirth: '2019-01-10',
    age: '7',
    admissionStandard: 'Nursery',
    status: 'approved',
    address: '22 Anna Nagar, Chennai, Tamil Nadu - 600040',
  },
  {
    id: 'REG-005',
    enquiryNumber: 'ENQ-2026-005',
    admissionDate: '2026-06-21',
    registrationNumber: 'REG-2026-1005',
    inquiryDate: '2026-06-10',
    followUpDate: '2026-06-25',
    firstName: 'Anjali',
    middleName: 'Krishna',
    lastName: 'Reddy',
    mobile: '+91 9876543214',
    email: 'anjali.reddy@email.com',
    dateOfBirth: '2013-05-18',
    age: '13',
    admissionStandard: '12th Standard',
    status: 'rejected',
    address: '90 Jubilee Hills, Hyderabad, Telangana - 500033',
  },
  {
    id: 'REG-006',
    enquiryNumber: 'ENQ-2026-006',
    admissionDate: '2026-06-20',
    registrationNumber: 'REG-2026-1006',
    inquiryDate: '2026-06-08',
    followUpDate: '2026-06-23',
    firstName: 'Rohan',
    middleName: 'Sanjay',
    lastName: 'Gupta',
    mobile: '+91 9876543215',
    email: 'rohan.gupta@email.com',
    dateOfBirth: '2016-09-30',
    age: '9',
    admissionStandard: '3rd Standard',
    status: 'pending',
    address: '56 SG Palya, Bangalore, Karnataka - 560029',
  },
  {
    id: 'REG-007',
    enquiryNumber: 'ENQ-2026-007',
    admissionDate: '2026-06-19',
    registrationNumber: 'REG-2026-1007',
    inquiryDate: '2026-06-07',
    followUpDate: '2026-06-22',
    firstName: 'Sneha',
    middleName: 'Ramesh',
    lastName: 'Verma',
    mobile: '+91 9876543216',
    email: 'sneha.verma@email.com',
    dateOfBirth: '2015-07-12',
    age: '10',
    admissionStandard: '4th Standard',
    status: 'approved',
    address: '12ushi Nagar, Indore, Madhya Pradesh - 452001',
  },
  {
    id: 'REG-008',
    enquiryNumber: 'ENQ-2026-008',
    admissionDate: '2026-06-18',
    registrationNumber: 'REG-2026-1008',
    inquiryDate: '2026-06-05',
    followUpDate: '2026-06-21',
    firstName: 'Aditya',
    middleName: 'Mohan',
    lastName: 'Joshi',
    mobile: '+91 9876543217',
    email: 'aditya.joshi@email.com',
    dateOfBirth: '2013-12-03',
    age: '12',
    admissionStandard: '8th Standard',
    status: 'under-review',
    address: '34 Baner Road, Pune, Maharashtra - 411045',
  },
  {
    id: 'REG-009',
    enquiryNumber: 'ENQ-2026-009',
    admissionDate: '2026-06-17',
    registrationNumber: 'REG-2026-1009',
    inquiryDate: '2026-06-04',
    followUpDate: '2026-06-20',
    firstName: 'Isha',
    middleName: 'Prakash',
    lastName: 'Iyer',
    mobile: '+91 9876543218',
    email: 'isha.iyer@email.com',
    dateOfBirth: '2016-04-25',
    age: '10',
    admissionStandard: '2nd Standard',
    status: 'pending',
    address: '67 T Nagar, Chennai, Tamil Nadu - 600017',
  },
  {
    id: 'REG-010',
    enquiryNumber: 'ENQ-2026-010',
    admissionDate: '2026-06-16',
    registrationNumber: 'REG-2026-1010',
    inquiryDate: '2026-06-03',
    followUpDate: '2026-06-19',
    firstName: 'Vihaan',
    middleName: 'Deepak',
    lastName: 'Malhotra',
    mobile: '+91 9876543219',
    email: 'vihaan.malhotra@email.com',
    dateOfBirth: '2017-10-08',
    age: '8',
    admissionStandard: '1st Standard',
    status: 'approved',
    address: '89 DLF Phase 2, Gurugram, Haryana - 122002',
  },
  {
    id: 'REG-011',
    enquiryNumber: 'ENQ-2026-011',
    admissionDate: '2026-06-15',
    registrationNumber: 'REG-2026-1011',
    inquiryDate: '2026-06-02',
    followUpDate: '2026-06-18',
    firstName: 'Diya',
    middleName: 'Anil',
    lastName: 'Kapoor',
    mobile: '+91 9876543220',
    email: 'diya.kapoor@email.com',
    dateOfBirth: '2014-06-17',
    age: '11',
    admissionStandard: '6th Standard',
    status: 'rejected',
    address: '23 Bandra West, Mumbai, Maharashtra - 400050',
  },
  {
    id: 'REG-012',
    enquiryNumber: 'ENQ-2026-012',
    admissionDate: '2026-06-14',
    registrationNumber: 'REG-2026-1012',
    inquiryDate: '2026-06-01',
    followUpDate: '2026-06-17',
    firstName: 'Kabir',
    middleName: 'Sunil',
    lastName: 'Mehta',
    mobile: '+91 9876543221',
    email: 'kabir.mehta@email.com',
    dateOfBirth: '2015-02-28',
    age: '11',
    admissionStandard: '5th Standard',
    status: 'under-review',
    address: '45 Koramangala, Bangalore, Karnataka - 560095',
  },
];

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  approved: {
    label: 'Approved',
    variant: 'default',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  },
  pending: {
    label: 'Pending',
    variant: 'secondary',
    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  },
  'under-review': {
    label: 'Under Review',
    variant: 'outline',
    className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    className: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  },
};

const standards = [
  'Nursery',
  'LKG',
  'UKG',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
};

const columns: ColumnDef[] = [
  { key: 'action', label: 'Action', sortable: false, width: '60px' },
  { key: 'id', label: 'Id', sortable: true, width: '90px' },
  { key: 'enquiryNumber', label: 'Enquiry Number', sortable: true },
  { key: 'admissionDate', label: 'Admission Date', sortable: true },
  { key: 'registrationNumber', label: 'Registration Number', sortable: true },
  { key: 'inquiryDate', label: 'Inquiry Date', sortable: true },
  { key: 'followUpDate', label: 'Follow Up Date', sortable: true },
  { key: 'firstName', label: 'First Name', sortable: true },
  { key: 'middleName', label: 'Middle Name', sortable: true },
  { key: 'lastName', label: 'Last Name', sortable: true },
  { key: 'mobile', label: 'Mobile', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'dateOfBirth', label: 'Date of Birth', sortable: true },
  { key: 'age', label: 'Age', sortable: true, width: '60px' },
  { key: 'admissionStandard', label: 'Admission Standard', sortable: true },
];

export default function AdmissionRegistrationPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<string>('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-2 h-3.5 w-3.5 text-[#0D6EFD]" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="ml-2 h-3.5 w-3.5 text-[#0D6EFD]" />;
    }
    return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
  };

  const filteredAndSortedData = useMemo(() => {
    let data = [...mockData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (record) =>
          record.firstName.toLowerCase().includes(query) ||
          record.lastName.toLowerCase().includes(query) ||
          record.email.toLowerCase().includes(query) ||
          record.mobile.includes(query) ||
          record.registrationNumber.toLowerCase().includes(query) ||
          record.enquiryNumber.toLowerCase().includes(query) ||
          record.admissionStandard.toLowerCase().includes(query)
      );
    }

    if (sortField && sortDirection) {
      data.sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [searchQuery, sortField, sortDirection]);

  const totalEntries = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalEntries / parseInt(entriesPerPage));
  const startEntry = (currentPage - 1) * parseInt(entriesPerPage) + 1;
  const endEntry = Math.min(currentPage * parseInt(entriesPerPage), totalEntries);
  const paginatedData = filteredAndSortedData.slice(startEntry - 1, endEntry);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getPaginationItems = () => {
    const items: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (currentPage > 3) items.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (currentPage < totalPages - 2) items.push('ellipsis');
      items.push(totalPages);
    }
    return items;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Admission Registration
              </h1>
            </div>
            <p className="text-sm text-slate-500 ml-3 mt-1">
              Manage and track all admission registrations in one place
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/admission-enquiry')}
            className="h-9 rounded-lg bg-gradient-to-r from-[#0D6EFD] to-blue-600 shadow-md shadow-blue-500/20 hover:from-[#0D6EFD]/90 hover:to-blue-600/90 text-white"
          >
            <Eye className="mr-2 h-4 w-4" />
            New Enquiry
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Table2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Total Records</p>
                <p className="text-lg font-bold text-slate-900">12,458</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <FileDown className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Registrations</p>
                <p className="text-lg font-bold text-slate-900">892</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                <Printer className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">This Month</p>
                <p className="text-lg font-bold text-slate-900">124</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Active Forms</p>
                <p className="text-lg font-bold text-slate-900">38</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Table Card */}
        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-4 pt-5 px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base font-bold text-slate-800">
                Registrations List
              </CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search registrations..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 text-sm w-full sm:w-[280px] focus:bg-white transition-colors"
                  />
                </div>

                {/* Show Entries */}
                <Select
                  value={entriesPerPage}
                  onValueChange={(val) => {
                    if (val) {
                      setEntriesPerPage(val);
                      setCurrentPage(1);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-full sm:w-[130px] rounded-lg border-slate-200 bg-slate-50/50 text-xs font-medium">
                    <SelectValue placeholder="Show entries" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="5">5 / page</SelectItem>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"
                  >
                    <FileText className="mr-2 h-3.5 w-3.5 text-rose-500" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"
                  >
                    <Table2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"
                  >
                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-blue-500" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"
                  >
                    <Printer className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    Print
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Table */}
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
                        <div className="flex items-center">
                          {col.label}
                          {col.sortable && getSortIcon(col.key)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-32 text-center text-sm text-slate-500"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Search className="h-8 w-8 text-slate-300" />
                          <p>No records found matching "{searchQuery}"</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((record) => {
                      const status = statusConfig[record.status];
                      return (
                        <TableRow
                          key={record.id}
                          className="border-slate-100 hover:bg-slate-50/60 transition-colors"
                        >
                          <TableCell className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 transition-colors"
                              onClick={() => router.push(`/admissions/registration/${record.id}/edit`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs font-medium text-slate-700">
                            {record.id}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs font-medium text-[#0D6EFD]">
                            {record.enquiryNumber}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {format(parseISO(record.admissionDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs font-mono text-slate-600">
                            {record.registrationNumber}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {format(parseISO(record.inquiryDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {format(parseISO(record.followUpDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs font-medium text-slate-900">
                            {record.firstName}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {record.middleName}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {record.lastName}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600 font-mono">
                            {record.mobile}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {record.email}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {format(parseISO(record.dateOfBirth), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600 text-center">
                            {record.age}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {record.admissionStandard}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
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
                            onClick={() => handlePageChange(item)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
