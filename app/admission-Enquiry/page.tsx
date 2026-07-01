'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, User, Phone, Mail, GraduationCap, Baby, Globe2, MapPin, VenusAndMars, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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

export default function AdmissionEnquiryPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [age, setAge] = useState<string>('');

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
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-gray-200/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="h-1.5 bg-gradient-to-r from-[#0D6EFD] via-blue-500 to-[#7ED957]" />

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="shrink-0 bg-gradient-to-br from-gray-50/80 to-white pb-6 pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admission Enquiry</h1>
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
            <form className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <FormField icon={ClipboardList} label="Enquiry Number" htmlFor="enquiryNumber">
                  <Input id="enquiryNumber" placeholder="e.g. ENQ-2024-001" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Student Name" htmlFor="studentName">
                  <Input id="studentName" placeholder="Enter student name" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Father Name" htmlFor="middleName">
                  <Input id="middleName" placeholder="Enter father name" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={User} label="Surname" htmlFor="surname">
                  <Input id="surname" placeholder="Enter surname" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Phone} label="Mobile (SMS Number)" htmlFor="mobile">
                  <Input id="mobile" type="tel" placeholder="+91 98765 43210" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Mail} label="Email" htmlFor="email">
                  <Input id="email" type="email" placeholder="student@example.com" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={GraduationCap} label="Admission Standard" htmlFor="admissionStandard">
                  <Select>
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
                  <Select>
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
                  <Input id="placeOfBirth" placeholder="Enter place of birth" className="h-10 rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white" />
                </FormField>

                <FormField icon={Globe2} label="Religion" htmlFor="religion">
                  <Select>
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
                  placeholder="Enter full residential address"
                  className="min-h-[110px] resize-none rounded-lg border-gray-200 bg-gray-50/50 transition-colors focus:bg-white"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="h-10 rounded-lg border-gray-200 px-6 text-gray-600 hover:bg-gray-50">
                  Reset Form
                </Button>
                <Button
                  type="submit"
                  onClick={() => router.push('/admissions/registration')}
                  className="h-10 rounded-lg bg-gradient-to-r from-[#0D6EFD] to-blue-600 px-8 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-[#0D6EFD]/90 hover:to-blue-600/90"
                >
                  Submit Enquiry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
