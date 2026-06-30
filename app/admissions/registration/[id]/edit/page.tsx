'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, ClipboardList, User, Phone, Mail, Baby, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

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
    address: '12 Vijay Nagar, Indore, Madhya Pradesh - 452001',
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

export default function EditRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;

  const [formData, setFormData] = useState<Partial<RegistrationRecord>>({});

  useEffect(() => {
    const record = mockData.find((r) => r.id === recordId);
    if (record) {
      setFormData(record);
    }
  }, [recordId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const index = mockData.findIndex((r) => r.id === recordId);
    if (index !== -1 && formData) {
      mockData[index] = { ...mockData[index], ...formData } as RegistrationRecord;
    }
    router.push('/admissions/registration');
  };

  const handleCancel = () => {
    router.push('/admissions/registration');
  };

  const FormField = ({ icon: Icon, label, htmlFor, children }: any) => (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-[#0D6EFD]" />}
        {label}
      </Label>
      {children}
    </div>
  );

  if (!formData || Object.keys(formData).length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Edit Registration
                </h1>
              </div>
              <p className="text-sm text-slate-500 ml-3 mt-1">
                Update registration details for <span className="font-mono text-[#0D6EFD]">{formData.registrationNumber}</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-[#0D6EFD] border border-blue-100">
            {formData.id}
          </span>
        </div>

        <Card className="border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0D6EFD] via-blue-500 to-[#7ED957]"></div>

          <CardHeader className="pb-6 pt-6 bg-gradient-to-br from-gray-50/80 to-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-[#0D6EFD]" />
                Student Information
              </CardTitle>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-[#0D6EFD] border border-blue-100">
                Edit Form
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-5 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <FormField icon={ClipboardList} label="Enquiry Number" htmlFor="enquiryNumber">
                  <Input
                    id="enquiryNumber"
                    value={formData.enquiryNumber || ''}
                    onChange={(e) => handleChange('enquiryNumber', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={User} label="First Name" htmlFor="firstName">
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={User} label="Middle Name" htmlFor="middleName">
                  <Input
                    id="middleName"
                    value={formData.middleName || ''}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={User} label="Last Name" htmlFor="lastName">
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={Phone} label="Mobile" htmlFor="mobile">
                  <Input
                    id="mobile"
                    value={formData.mobile || ''}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={Mail} label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={Baby} label="Date of Birth" htmlFor="dateOfBirth">
                  <Input
                    id="dateOfBirth"
                    value={formData.dateOfBirth ? format(parseISO(formData.dateOfBirth), 'dd MMM yyyy') : ''}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={Baby} label="Age" htmlFor="age">
                  <Input
                    id="age"
                    value={formData.age || ''}
                    onChange={(e) => handleChange('age', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={GraduationCap} label="Admission Standard" htmlFor="admissionStandard">
                  <Select
                    value={formData.admissionStandard || ''}
                    onValueChange={(value) => value && handleChange('admissionStandard', value)}
                  >
                    <SelectTrigger id="admissionStandard" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {standards.map((std) => (
                        <SelectItem key={std} value={std}>
                          {std}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField icon={ClipboardList} label="Status" htmlFor="status">
                  <Select
                    value={formData.status}
                    onValueChange={(value) => value && handleChange('status', value)}
                  >
                    <SelectTrigger id="status" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="under-review">Under Review</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField icon={MapPin} label="Address" htmlFor="address">
                <Textarea
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="min-h-[110px] rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors resize-none"
                />
              </FormField>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-10 rounded-lg px-6 border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 rounded-lg px-8 bg-gradient-to-r from-[#0D6EFD] to-blue-600 hover:from-[#0D6EFD]/90 hover:to-blue-600/90 text-white shadow-md shadow-blue-500/20 font-semibold"
                >
                  Update
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
