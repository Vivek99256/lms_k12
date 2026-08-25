'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarIcon, User, Phone, Mail, GraduationCap, Baby, Globe2, MapPin, VenusAndMars, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

const genders = ['Male', 'Female', 'Other'];

const religions = [
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Buddhist',
  'Jain',
  'Other',
];

type FormFieldProps = {
  icon?: LucideIcon;
  label: string;
  htmlFor: string;
  children: ReactNode;
};

function FormField({ icon: Icon, label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-[#0D6EFD]" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

type EnquiryFormValues = {
  enquiryNumber: string;
  studentName: string;
  fatherName: string;
  surname: string;
  mobile: string;
  email: string;
  admissionStandard: string;
  gender: string;
  placeOfBirth: string;
  religion: string;
  address: string;
};

const initialFormValues: EnquiryFormValues = {
  enquiryNumber: '',
  studentName: '',
  fatherName: '',
  surname: '',
  mobile: '',
  email: '',
  admissionStandard: '',
  gender: '',
  placeOfBirth: '',
  religion: '',
  address: '',
};

/**
 * `admission/admissionEnquiryAPIController::store()` (routes/api.php,
 * `POST admission_enquiry`) validates only `sub_institute_id`/`syear` and
 * mass-assigns the rest of the body onto `admissionEnquiryModel`, whose
 * `$fillable` list is the source of truth for these keys (first_name,
 * father_name, last_name, admission_standard, date_of_birth, place_of_birth,
 * religion, etc.). This mirrors the field names the sibling
 * `app/admissions/admission_enquiry/page.tsx` screen already posts to the
 * same endpoint.
 */
function buildEnquiryPayload(values: EnquiryFormValues, dateOfBirth: string, age: string) {
  return {
    enquiry_no: values.enquiryNumber,
    first_name: values.studentName,
    father_name: values.fatherName,
    last_name: values.surname,
    mobile: values.mobile,
    email: values.email,
    admission_standard: values.admissionStandard,
    date_of_birth: dateOfBirth,
    age,
    gender: values.gender,
    place_of_birth: values.placeOfBirth,
    religion: values.religion,
    address: values.address,
  };
}

export default function AdmissionEnquiryPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [age, setAge] = useState<string>('');
  const [formValues, setFormValues] = useState<EnquiryFormValues>(initialFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField =
    (field: keyof EnquiryFormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValues((previous) => ({ ...previous, [field]: event.target.value }));
    };

  const updateSelectField = (field: keyof EnquiryFormValues) => (value: string | null) => {
    setFormValues((previous) => ({ ...previous, [field]: value ?? '' }));
  };

  const handleSubmitEnquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const session = buildSessionContext();
    if (!session.baseUrl) {
      setSubmitError('Session data is missing. Please sign in again.');
      return;
    }
    if (!session.subInstituteId || !session.syear) {
      setSubmitError('Your session is missing institute or academic year details. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = new URL(`${session.baseUrl}/api/admission_enquiry`);
      url.searchParams.set('type', 'API');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/json'),
        body: JSON.stringify({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          ...buildEnquiryPayload(formValues, date ? format(date, 'yyyy-MM-dd') : '', age),
        }),
      });

      const responseBody = await response.json().catch(() => null) as { status_code?: number | string; message?: string } | null;
      if (!response.ok || (responseBody?.status_code != null && String(responseBody.status_code) !== '1')) {
        throw new Error(responseBody?.message || `Unable to submit the enquiry (HTTP ${response.status}).`);
      }

      router.push('/admissions/registration');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const today = new Date();
      let calculatedAge = today.getFullYear() - selectedDate.getFullYear();
      const monthDiff = today.getMonth() - selectedDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDate.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge.toString());
    } else {
      setAge('');
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6 mt-[10px] ml-[15px] mt-[-15px]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px]">

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="shrink-0 bg-gradient-to-br from-gray-50/80 to-white pb-6 pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admission Inquiry</h1>
              </div>
              <p className="ml-3 text-sm text-gray-500">
                Fill in the details below to submit a new admission enquiry.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <GraduationCap className="h-5 w-5 text-[#0D6EFD]" />
                Student Information
              </CardTitle>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#0D6EFD]">
                New Enquiry Form
              </span>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-auto p-5 md:p-6 lg:p-8 scrollbar-hide">
            <form className="space-y-5" onSubmit={handleSubmitEnquiry}>
              {submitError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <FormField icon={ClipboardList} label="Enquiry Number" htmlFor="enquiryNumber">
                  <Input id="enquiryNumber" value={formValues.enquiryNumber} onChange={updateField('enquiryNumber')} placeholder="e.g. ENQ-2024-001" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Student Name" htmlFor="studentName">
                  <Input id="studentName" value={formValues.studentName} onChange={updateField('studentName')} placeholder="Enter student name" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Father Name" htmlFor="middleName">
                  <Input id="middleName" value={formValues.fatherName} onChange={updateField('fatherName')} placeholder="Enter father name" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Surname" htmlFor="surname">
                  <Input id="surname" value={formValues.surname} onChange={updateField('surname')} placeholder="Enter surname" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Phone} label="Mobile (SMS Number)" htmlFor="mobile">
                  <Input id="mobile" type="tel" value={formValues.mobile} onChange={updateField('mobile')} placeholder="+91 98765 43210" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Mail} label="Email" htmlFor="email">
                  <Input id="email" type="email" value={formValues.email} onChange={updateField('email')} placeholder="student@example.com" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={GraduationCap} label="Admission Standard" htmlFor="admissionStandard">
                  <Select value={formValues.admissionStandard} onValueChange={updateSelectField('admissionStandard')}>
                    <SelectTrigger id="admissionStandard" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {standards.map((std) => (
                        <SelectItem key={std} value={std.toLowerCase()}>
                          {std}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

<FormField icon={Baby} label="Date of Birth" htmlFor="dob">
                   <Popover>
                     <PopoverTrigger
                       render={
                         <Button
                           variant="outline"
                           className={cn(
                             'h-10 w-full justify-start rounded-lg border-gray-200 bg-gray-50/50 text-left font-normal transition-colors hover:bg-white',
                             !date && 'text-muted-foreground'
                           )}
                         >
                           <CalendarIcon className="mr-2 h-4 w-4 text-[#0D6EFD]" />
                           {date ? format(date, 'dd MMM yyyy') : 'Pick a date'}
                         </Button>
                       }
                     />
                     <PopoverContent className="w-auto p-0" align="start">
                       <Calendar
                         mode="single"
                         selected={date}
                         onSelect={handleDateChange}
                         disabled={(date) =>
                           date > new Date() || date < new Date('1900-01-01')
                         }
                         captionLayout="dropdown"
                       />
                     </PopoverContent>
                   </Popover>
                 </FormField>

                <FormField icon={Baby} label="Age" htmlFor="age">
                  <Input id="age" value={age} readOnly placeholder="Auto-calculated" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={VenusAndMars} label="Gender" htmlFor="gender">
                  <Select value={formValues.gender} onValueChange={updateSelectField('gender')}>
                    <SelectTrigger id="gender" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map((g) => (
                        <SelectItem key={g} value={g.toLowerCase()}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField icon={Globe2} label="Place of Birth" htmlFor="placeOfBirth">
                  <Input id="placeOfBirth" value={formValues.placeOfBirth} onChange={updateField('placeOfBirth')} placeholder="Enter place of birth" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Globe2} label="Religion" htmlFor="religion">
                  <Select value={formValues.religion} onValueChange={updateSelectField('religion')}>
                    <SelectTrigger id="religion" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
                    <SelectContent>
                      {religions.map((r) => (
                        <SelectItem key={r} value={r.toLowerCase()}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <MapPin className="h-3.5 w-3.5 text-[#0D6EFD]" />
                  Address
                </Label>
                <Textarea
                  id="address"
                  value={formValues.address}
                  onChange={updateField('address')}
                  placeholder="Enter full residential address"
                  className="min-h-[110px] resize-none rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-lg border-gray-200 px-6 text-gray-600 hover:bg-gray-50"
                  onClick={() => {
                    setFormValues(initialFormValues);
                    setDate(undefined);
                    setAge('');
                    setSubmitError(null);
                  }}
                >
                  Reset Form
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-lg bg-gradient-to-r from-[#0D6EFD] to-blue-600 px-8 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-[#0D6EFD]/90 hover:to-blue-600/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit Enquiry'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
