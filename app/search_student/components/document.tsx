'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Download,
  Upload,
  Eye,
  Trash2,
  Loader2,
  User,
  File,
  FileCheck,
  AlertCircle,
  Filter,
  Grid,
  List,
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
import { Badge } from '@/components/ui/badge';

interface DocumentRecord {
  id: string;
  studentId: string;
  studentName: string;
  grNo: string;
  documentType: string;
  documentName: string;
  documentNumber: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  status: 'verified' | 'pending' | 'rejected';
  remarks: string;
}

const mockDocuments: DocumentRecord[] = [
  {
    id: 'DOC-001',
    studentId: 'STU-001',
    studentName: 'Priya Rajesh Sharma',
    grNo: 'GR-2026-001',
    documentType: 'Identity',
    documentName: 'Aadhar Card',
    documentNumber: '1234-5678-9012',
    fileName: 'aadhar_priya.pdf',
    fileSize: '245 KB',
    uploadDate: '2026-06-15',
    status: 'verified',
    remarks: 'Document verified successfully',
  },
  {
    id: 'DOC-002',
    studentId: 'STU-001',
    studentName: 'Priya Rajesh Sharma',
    grNo: 'GR-2026-001',
    documentType: 'Address',
    documentName: 'Electricity Bill',
    documentNumber: 'EB-2026-12345',
    fileName: 'electricity_bill.pdf',
    fileSize: '320 KB',
    uploadDate: '2026-06-15',
    status: 'verified',
    remarks: 'Address confirmed',
  },
  {
    id: 'DOC-003',
    studentId: 'STU-002',
    studentName: 'Arjun Vikram Singh',
    grNo: 'GR-2026-002',
    documentType: 'Academic',
    documentName: 'Transfer Certificate',
    documentNumber: 'TC-2026-789',
    fileName: 'tc_arjun.pdf',
    fileSize: '1.2 MB',
    uploadDate: '2026-06-18',
    status: 'pending',
    remarks: 'Awaiting verification',
  },
  {
    id: 'DOC-004',
    studentId: 'STU-002',
    studentName: 'Arjun Vikram Singh',
    grNo: 'GR-2026-002',
    documentType: 'Identity',
    documentName: 'Birth Certificate',
    documentNumber: 'BC-2026-456',
    fileName: 'birth_cert_arjun.pdf',
    fileSize: '180 KB',
    uploadDate: '2026-06-18',
    status: 'verified',
    remarks: 'Verified',
  },
  {
    id: 'DOC-005',
    studentId: 'STU-003',
    studentName: 'Riya Amit Patel',
    grNo: 'GR-2026-003',
    documentType: 'Academic',
    documentName: 'Previous Marksheet',
    documentNumber: 'M-2025-321',
    fileName: 'marksheet_riya.pdf',
    fileSize: '890 KB',
    uploadDate: '2026-06-20',
    status: 'pending',
    remarks: 'Under review',
  },
  {
    id: 'DOC-006',
    studentId: 'STU-003',
    studentName: 'Riya Amit Patel',
    grNo: 'GR-2026-003',
    documentType: 'Identity',
    documentName: 'Aadhar Card',
    documentNumber: '9876-5432-1098',
    fileName: 'aadhar_riya.pdf',
    fileSize: '260 KB',
    uploadDate: '2026-06-20',
    status: 'rejected',
    remarks: 'Document blurry, please re-upload',
  },
  {
    id: 'DOC-007',
    studentId: 'STU-004',
    studentName: 'Kavi Suresh Kumar',
    grNo: 'GR-2026-004',
    documentType: 'Medical',
    documentName: 'Health Certificate',
    documentNumber: 'HC-2026-654',
    fileName: 'health_cert_kavi.pdf',
    fileSize: '150 KB',
    uploadDate: '2026-06-22',
    status: 'verified',
    remarks: 'Fit for admission',
  },
  {
    id: 'DOC-008',
    studentId: 'STU-005',
    studentName: 'Anjali Krishna Reddy',
    grNo: 'GR-2026-005',
    documentType: 'Academic',
    documentName: 'Transfer Certificate',
    documentNumber: 'TC-2025-999',
    fileName: 'tc_anjali.pdf',
    fileSize: '1.1 MB',
    uploadDate: '2026-06-10',
    status: 'verified',
    remarks: 'TC received',
  },
  {
    id: 'DOC-009',
    studentId: 'STU-006',
    studentName: 'Rohan Sanjay Gupta',
    grNo: 'GR-2026-006',
    documentType: 'Identity',
    documentName: 'Aadhar Card',
    documentNumber: '5678-1234-9876',
    fileName: 'aadhar_rohan.pdf',
    fileSize: '230 KB',
    uploadDate: '2026-06-25',
    status: 'pending',
    remarks: 'Awaiting upload',
  },
  {
    id: 'DOC-010',
    studentId: 'STU-007',
    studentName: 'Sneha Ramesh Verma',
    grNo: 'GR-2026-007',
    documentType: 'Address',
    documentName: 'Ration Card',
    documentNumber: 'RC-2026-789',
    fileName: 'ration_card_sneha.pdf',
    fileSize: '280 KB',
    uploadDate: '2026-06-26',
    status: 'verified',
    remarks: 'Verified',
  },
  {
    id: 'DOC-011',
    studentId: 'STU-008',
    studentName: 'Aditya Mohan Joshi',
    grNo: 'GR-2026-008',
    documentType: 'Academic',
    documentName: 'Leaving Certificate',
    documentNumber: 'LC-2026-456',
    fileName: 'lc_aditya.pdf',
    fileSize: '950 KB',
    uploadDate: '2026-06-27',
    status: 'pending',
    remarks: 'Pending review',
  },
  {
    id: 'DOC-012',
    studentId: 'STU-009',
    studentName: 'Isha Prakash Iyer',
    grNo: 'GR-2026-009',
    documentType: 'Identity',
    documentName: 'Birth Certificate',
    documentNumber: 'BC-2026-111',
    fileName: 'birth_cert_isha.pdf',
    fileSize: '175 KB',
    uploadDate: '2026-06-28',
    status: 'verified',
    remarks: 'Document verified',
  },
];

const documentTypes = [
  'All Types',
  'Identity',
  'Address',
  'Academic',
  'Medical',
  'Other',
];

const documentNames = [
  'All Documents',
  'Aadhar Card',
  'Birth Certificate',
  'Transfer Certificate',
  'Leaving Certificate',
  'Previous Marksheet',
  'Electricity Bill',
  'Ration Card',
  'Health Certificate',
  'Passport Photo',
  'Caste Certificate',
  'Income Certificate',
];

const ROWS_PER_PAGE = 10;

export default function DocumentTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedDocumentName, setSelectedDocumentName] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
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
    const fetchDocuments = async () => {
      const { token, subInstituteId, hostName } = getSessionContext();
      
      if (!hostName || !token || !subInstituteId) {
        return;
      }

      setLoading(true);
      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', subInstituteId);
        form.append('token', token);

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error('Documents API error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [getSessionContext]);

  const filteredData = mockDocuments.filter((doc) => {
    const matchesSearch = searchQuery === '' ||
      doc.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.grNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedDocumentType === '' || selectedDocumentType === 'All Types' || doc.documentType === selectedDocumentType;
    const matchesName = selectedDocumentName === '' || selectedDocumentName === 'All Documents' || doc.documentName === selectedDocumentName;
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;

    return matchesSearch && matchesType && matchesName && matchesStatus;
  });

  const totalEntries = filteredData.length;
  const totalPages = Math.ceil(totalEntries / ROWS_PER_PAGE);
  const startEntry = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endEntry = Math.min(currentPage * ROWS_PER_PAGE, totalEntries);
  const paginatedData = filteredData.slice(startEntry - 1, endEntry);

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

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, { bg: string; text: string; border: string; icon: typeof FileCheck }> = {
      'verified': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: FileCheck },
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: AlertCircle },
      'rejected': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: AlertCircle },
    };
    const style = statusStyles[status] || statusStyles['pending'];
    const StatusIcon = style.icon;
    
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', style.bg, style.text, style.border)}>
        <StatusIcon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
              <FileText className="h-5 w-5 text-[#0D6EFD]" />
              Document Search
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                className={cn('h-9 rounded-lg', viewMode === 'table' && 'bg-[#0D6EFD]')}
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                className={cn('h-9 rounded-lg', viewMode === 'grid' && 'bg-[#0D6EFD]')}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
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
                placeholder="Student, GR No, Doc No"
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
                <Filter className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Document Type
              </Label>
              <Select value={selectedDocumentType} onValueChange={(value) => { setSelectedDocumentType(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type === 'All Types' ? '' : type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <File className="h-3.5 w-3.5 text-[#0D6EFD]" />
                Document Name
              </Label>
              <Select value={selectedDocumentName} onValueChange={(value) => { setSelectedDocumentName(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50">
                  <SelectValue placeholder="All Documents" />
                </SelectTrigger>
                <SelectContent>
                  {documentNames.map((name) => (
                    <SelectItem key={name} value={name === 'All Documents' ? '' : name}>{name}</SelectItem>
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
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
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
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-800">Document Records</CardTitle>
                <p className="text-xs text-gray-500">{totalEntries} document{totalEntries !== 1 ? 's' : ''} found</p>
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
          {viewMode === 'table' ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-slate-200">
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[250px]">
                        Student Name
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[130px]">
                        GR No
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[130px]">
                        Document Type
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[160px]">
                        Document Name
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[140px]">
                        Doc Number
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[120px]">
                        Upload Date
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[100px]">
                        Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right w-[120px]">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0D6EFD]" />
                          <p className="mt-2 text-sm text-slate-500">Loading documents...</p>
                        </TableCell>
                      </TableRow>
                    ) : paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileText className="h-8 w-8 text-slate-300" />
                            <p>No documents found matching your search criteria</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="border-slate-100 hover:bg-slate-50/60 transition-colors"
                        >
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#0D6EFD]">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-900">{doc.studentName}</p>
                                <p className="text-[10px] text-slate-500">ID: {doc.studentId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs font-mono text-[#0D6EFD]">
                            {doc.grNo}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {doc.documentType}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {doc.documentName}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600 font-mono">
                            {doc.documentNumber}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-600">
                            {format(parseISO(doc.uploadDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {getStatusBadge(doc.status)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 transition-colors"
                                title="View Document"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                                onClick={() => setCurrentPage(item as number)}
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
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0D6EFD]" />
                  <p className="mt-2 text-sm text-slate-500">Loading documents...</p>
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <p>No documents found matching your search criteria</p>
                </div>
              ) : (
                paginatedData.map((doc) => (
                  <Card key={doc.id} className="border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-2 bg-gradient-to-r from-[#0D6EFD] to-[#7ED957]" />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#0D6EFD]">
                          <FileText className="h-5 w-5" />
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{doc.documentName}</h3>
                      <p className="text-xs text-gray-500 mb-2">{doc.documentType}</p>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-2">
                          <User className="h-3 w-3 text-slate-400" />
                          {doc.studentName}
                        </p>
                        <p className="font-mono text-[#0D6EFD]">{doc.grNo}</p>
                        <p className="text-slate-500">{format(parseISO(doc.uploadDate), 'dd MMM yyyy')}</p>
                      </div>
                      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-gray-100">
                        <Button variant="outline" size="sm" className="flex-1 h-8 rounded-lg text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-8 rounded-lg text-xs">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {viewMode === 'grid' && totalPages > 1 && (
            <div className="flex justify-center border-t border-slate-100 px-4 py-4">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                          onClick={() => setCurrentPage(item as number)}
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
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={cn(
                        'h-8 min-w-8 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50',
                        currentPage === totalPages && 'pointer-events-none opacity-50'
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
