import {
  Filter,
  History,
  Search,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdmissionReportFilters, AdmissionReportId } from './api';

export type ReportConfig = {
  id: AdmissionReportId;
  slug: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  endpoint: string;
  filterMode: 'user' | 'status' | 'followup';
  statusOptions?: Array<{ value: string; label: string }>;
  supportsFieldSelection: boolean;
  defaultFieldKeys: string[];
};

export const reportConfigs: ReportConfig[] = [
  {
    id: 'inquiry_followup',
    slug: 'inquiry-followup',
    title: 'Inquiry Follow-up Report',
    subtitle: 'Review enquiry follow-up history with date and status filtering.',
    icon: History,
    endpoint: '/admission/admission_enquiry_followup_report',
    filterMode: 'followup',
    supportsFieldSelection: false,
    defaultFieldKeys: [],
  },
  {
    id: 'admission_inquiry',
    slug: 'admission-inquiry',
    title: 'Admission Inquiry Report',
    subtitle: 'Inspect enquiry records generated in the selected date range.',
    icon: Search,
    endpoint: '/admission/admission_enquiry_report',
    filterMode: 'user',
    supportsFieldSelection: false,
    defaultFieldKeys: [],
  },
  {
    id: 'admission_registration',
    slug: 'admission-registration',
    title: 'Admission Registration Report',
    subtitle: 'Track admission form records and select the fields that should appear in the report.',
    icon: Table2,
    endpoint: '/admission/admission_registration_report',
    filterMode: 'status',
    statusOptions: [
      { value: 'OPEN', label: 'Open' },
      { value: 'CLOSE', label: 'Close' },
    ],
    supportsFieldSelection: true,
    defaultFieldKeys: ['first_name', 'middle_name', 'last_name', 'mobile', 'email'],
  },
  {
    id: 'admission_without_confirmation',
    slug: 'admission-without-confirmation',
    title: 'Admission Without Confirmation Report',
    subtitle: 'Find admission forms that have not yet moved into confirmation.',
    icon: Filter,
    endpoint: '/admission/admission_without_con_report',
    filterMode: 'status',
    statusOptions: [
      { value: 'OPEN', label: 'Open' },
      { value: 'CLOSE', label: 'Close' },
    ],
    supportsFieldSelection: false,
    defaultFieldKeys: ['first_name', 'middle_name', 'last_name', 'mobile', 'email'],
  },
  {
    id: 'admission_confirmation',
    slug: 'admission-confirmation',
    title: 'Admission Confirmation Report',
    subtitle: 'Audit confirmed admissions with status-based filtering and export support.',
    icon: Users,
    endpoint: '/admission/admission_confirmation_report',
    filterMode: 'status',
    statusOptions: [
      { value: 'YES', label: 'Yes' },
      { value: 'NO', label: 'No' },
    ],
    supportsFieldSelection: false,
    defaultFieldKeys: ['first_name', 'middle_name', 'last_name', 'mobile', 'email'],
  },
];

export const initialFilters: AdmissionReportFilters = {
  fromDate: '',
  toDate: '',
  user: '',
  status: '',
  followUpStatus: '',
};

export function getReportConfig(reportId: AdmissionReportId) {
  return reportConfigs.find((config) => config.id === reportId) ?? reportConfigs[0];
}
