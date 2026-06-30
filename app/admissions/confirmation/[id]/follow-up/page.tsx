'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, ClipboardList, User, Phone, Mail, Baby, MapPin, VenusAndMars, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface FollowUpRecord {
  id: string;
  enquiryNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  age: string;
  address: string;
  admissionStandard: string;
  motherName: string;
  status: 'pending' | 'approved' | 'rejected' | 'under-review';
  studentQuota: string;
  division: string;
  enrollmentNo: string;
  admissionConfirmed: boolean;
}

const mockData: FollowUpRecord[] = [
  {
    id: 'CFM-001',
    enquiryNumber: 'ENQ-2026-001',
    firstName: 'Priya',
    middleName: 'Rajesh',
    lastName: 'Sharma',
    gender: 'Female',
    mobile: '+91 9876543210',
    email: 'priya.sharma@email.com',
    dateOfBirth: '2015-03-14',
    age: '11',
    address: '123 MG Road, Bangalore, Karnataka - 560001',
    admissionStandard: '6th Standard',
    motherName: 'Sunita Sharma',
    status: 'approved',
    studentQuota: 'General',
    division: 'A',
    enrollmentNo: 'ENR-2026-001',
    admissionConfirmed: true,
  },
  {
    id: 'CFM-002',
    enquiryNumber: 'ENQ-2026-002',
    firstName: 'Arjun',
    middleName: 'Vikram',
    lastName: 'Singh',
    gender: 'Male',
    mobile: '+91 9876543211',
    email: 'arjun.singh@email.com',
    dateOfBirth: '2014-08-22',
    age: '11',
    address: '45 Park Street, Kolkata, West Bengal - 700016',
    admissionStandard: '5th Standard',
    motherName: 'Meena Singh',
    status: 'pending',
    studentQuota: 'OBC',
    division: 'B',
    enrollmentNo: 'ENR-2026-002',
    admissionConfirmed: false,
  },
  {
    id: 'CFM-003',
    enquiryNumber: 'ENQ-2026-003',
    firstName: 'Riya',
    middleName: 'Amit',
    lastName: 'Patel',
    gender: 'Female',
    mobile: '+91 9876543212',
    email: 'riya.patel@email.com',
    dateOfBirth: '2012-11-05',
    age: '13',
    address: '78 CG Road, Ahmedabad, Gujarat - 380009',
    admissionStandard: '10th Standard',
    motherName: 'Kavita Patel',
    status: 'approved',
    studentQuota: 'General',
    division: 'A',
    enrollmentNo: 'ENR-2026-003',
    admissionConfirmed: true,
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

const statuses = [
  'pending',
  'approved',
  'under-review',
  'rejected',
];

const quotas = [
  'General',
  'OBC',
  'SC',
  'ST',
  'EWS',
];

const divisions = ['A', 'B', 'C', 'D', 'E'];

const FormField = ({ icon: Icon, label, htmlFor, children }: { icon?: LucideIcon; label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {Icon && <Icon className="h-3.5 w-3.5 text-[#0D6EFD]" />}
      {label}
    </Label>
    {children}
  </div>
);

export default function AdmissionFollowUpPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;
  const initialRecord = mockData.find((r) => r.id === recordId);

  const [formData, setFormData] = useState<Partial<FollowUpRecord>>(initialRecord || {});

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/admissions/confirmation');
  };

  const handleCancel = () => {
    router.push('/admissions/confirmation');
  };

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
                  Admission Follow Up
                </h1>
              </div>
              <p className="text-sm text-slate-500 ml-3 mt-1">
                Update follow-up details for <span className="font-mono text-[#0D6EFD]">{formData.enquiryNumber}</span>
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
                Follow Up Form
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

                <FormField icon={User} label="Student Name" htmlFor="firstName">
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={User} label="Father Name" htmlFor="middleName">
                  <Input
                    id="middleName"
                    value={formData.middleName || ''}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={User} label="Surname" htmlFor="lastName">
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={VenusAndMars} label="Gender" htmlFor="gender">
                  <Select
                    value={formData.gender || ''}
                    onValueChange={(value) => value && handleChange('gender', value)}
                  >
                    <SelectTrigger id="gender" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectValue placeholder="Select standard" />
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

                <FormField icon={User} label="Mother Name" htmlFor="motherName">
                  <Input
                    id="motherName"
                    value={formData.motherName || ''}
                    onChange={(e) => handleChange('motherName', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
                </FormField>

                <FormField icon={ClipboardList} label="Status" htmlFor="status">
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange('status', value as FollowUpRecord['status'])}
                  >
                    <SelectTrigger id="status" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField icon={ClipboardList} label="Student Quota" htmlFor="studentQuota">
                  <Select
                    value={formData.studentQuota || ''}
                    onValueChange={(value) => value && handleChange('studentQuota', value)}
                  >
                    <SelectTrigger id="studentQuota" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select quota" />
                    </SelectTrigger>
                    <SelectContent>
                      {quotas.map((q) => (
                        <SelectItem key={q} value={q}>
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField icon={ClipboardList} label="Division" htmlFor="division">
                  <Select
                    value={formData.division || ''}
                    onValueChange={(value) => value && handleChange('division', value)}
                  >
                    <SelectTrigger id="division" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField icon={ClipboardList} label="Enrollment No./GR No." htmlFor="enrollmentNo">
                  <Input
                    id="enrollmentNo"
                    value={formData.enrollmentNo || ''}
                    onChange={(e) => handleChange('enrollmentNo', e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                  />
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

              <FormField icon={CheckCircle} label="Admission Confirmation" htmlFor="admissionConfirmed">
                <Select
                  value={formData.admissionConfirmed ? 'yes' : 'no'}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, admissionConfirmed: value === 'yes' }));
                  }}
                >
                  <SelectTrigger id="admissionConfirmed" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="submit"
                  className="h-10 rounded-lg px-8 bg-gradient-to-r from-[#0D6EFD] to-blue-600 hover:from-[#0D6EFD]/90 hover:to-blue-600/90 text-white shadow-md shadow-blue-500/20 font-semibold"
                >
                  Update
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-10 rounded-lg px-6 border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Add Student
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
