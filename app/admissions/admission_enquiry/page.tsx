'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingUp,
  Users,
  Percent,
  Clock,
  Maximize2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Plus,
  Pencil,
  X,
  History
} from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import {
  ADMISSION_FOLLOW_UP_STATUS_OPTIONS,
  fetchAdmissionFollowUps,
  saveAdmissionFollowUp,
  type AdmissionFollowUpEntry,
} from './followUpApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
);

const chartColors = ['#0D6EFD', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'];
const chartBackgrounds = [
  'rgba(13, 110, 253, 0.18)',
  'rgba(16, 185, 129, 0.18)',
  'rgba(245, 158, 11, 0.18)',
  'rgba(236, 72, 153, 0.18)',
  'rgba(139, 92, 246, 0.18)',
  'rgba(20, 184, 166, 0.18)',
  'rgba(249, 115, 22, 0.18)',
];

const standardOptions = [
  { label: 'Nursery', value: 'Nursery' },
  { label: 'LKG', value: 'LKG' },
  { label: 'UKG', value: 'UKG' },
  { label: '1st', value: '1' },
  { label: '2nd', value: '2' },
  { label: '3rd', value: '3' },
  { label: '4th', value: '4' },
  { label: '5th', value: '5' },
  { label: '6th', value: '6' },
  { label: '7th', value: '7' },
  { label: '8th', value: '8' },
  { label: '9th', value: '9' },
  { label: '10th', value: '10' },
  { label: '11th', value: '11' },
  { label: '12th', value: '12' },
];
const categoryOptions = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];
const sendSmsOptions = ['Yes', 'No'];
const branchOptions = ['Main Branch', 'Primary Branch', 'Secondary Branch', 'Other'];

const enquiryInputClassName =
  'h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary-blue)] focus:bg-white focus:ring-1 focus:ring-[var(--primary-blue)]';
const enquiryInputErrorClassName =
  'h-10 w-full rounded-lg border border-rose-300 bg-rose-50/40 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-400';
const enquiryTextareaClassName =
  'min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary-blue)] focus:bg-white focus:ring-1 focus:ring-[var(--primary-blue)]';

const MOBILE_NUMBER_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EnquiryFieldErrors = {
  mobile?: string;
  email?: string;
  mobile_number_father?: string;
  mobile_number_mother?: string;
};

function validateEnquiryContactFields(formData: FormData): EnquiryFieldErrors {
  const errors: EnquiryFieldErrors = {};

  const mobile = readFormValue(formData, 'mobile');
  if (!mobile) {
    errors.mobile = 'Mobile number is required.';
  } else if (!MOBILE_NUMBER_PATTERN.test(mobile)) {
    errors.mobile = 'Enter a valid 10-digit mobile number.';
  }

  const email = readFormValue(formData, 'email');
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  const mobileFather = readFormValue(formData, 'mobile_number_father');
  if (mobileFather && !MOBILE_NUMBER_PATTERN.test(mobileFather)) {
    errors.mobile_number_father = 'Enter a valid 10-digit mobile number.';
  }

  const mobileMother = readFormValue(formData, 'mobile_number_mother');
  if (mobileMother && !MOBILE_NUMBER_PATTERN.test(mobileMother)) {
    errors.mobile_number_mother = 'Enter a valid 10-digit mobile number.';
  }

  return errors;
}

function EnquiryModalField({
  label,
  htmlFor,
  children,
  className = '',
  required = false,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function EnquiryModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}

type AdmissionEnquiryApiRow = {
  id: number | string;
  enquiry_no?: number | string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  age?: number | string | null;
  gender?: string | null;
  admission_standard?: number | string | null;
  previous_school_name?: string | null;
  previous_standard?: number | string | null;
  remarks?: string | null;
  source_of_enquiry?: string | null;
  followup_date?: string | null;
  created_on?: string | null;
  category?: string | null;
  send_sms?: number | string | null;
  institute_branch?: string | null;
  activity_date?: string | null;
  activity_time?: string | null;
  activity_remarks?: string | null;
  siblings?: number | string | null;
  form_number?: number | string | null;
  fees_circular_form_no?: number | string | null;
  status?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  father_occupation?: string | null;
  annual_income?: number | string | null;
  mobile_number_father?: string | null;
  mobile_number_mother?: string | null;
  guardian_name?: string | null;
  counciler_name?: string | null;
};

type AdmissionEnquiryApiResponse = {
  status_code?: number | string;
  message?: string;
  data?: AdmissionEnquiryApiRow[];
};

type AdmissionEnquiryPostPayload = {
  enquiry_no: number | string;
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gender: string;
  date_of_birth: string;
  age: number | string;
  admission_standard: number | string;
  address: string;
  father_name: string;
  mother_name: string;
  father_occupation: string;
  annual_income: string;
  source_of_enquiry: string;
  previous_school_name: string;
  previous_standard: number | string;
  remarks: string;
  followup_date: string;
  mobile_number_father: string;
  mobile_number_mother: string;
  category: string;
  send_sms: string;
  institute_branch: string;
  activity_date: string;
  activity_time: string;
  activity_remarks: string;
  siblings: string;
  fees_circular_form_no: string;
};

type AdmissionEnquiryUpdatePayload = {
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gender: string;
  date_of_birth: string;
  admission_standard: number | string;
  address: string;
  father_name: string;
  mother_name: string;
  father_occupation: string;
  annual_income: string;
  source_of_enquiry: string;
  previous_school_name: string;
  previous_standard: number | string;
  remarks: string;
  followup_date: string;
  mobile_number_father: string;
  mobile_number_mother: string;
  category: string;
  send_sms: string;
  institute_branch: string;
  activity_date: string;
  activity_time: string;
  activity_remarks: string;
  siblings: string;
  fees_circular_form_no: string;
};

type EnquiryRosterRow = {
  apiId: string;
  enquiryNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  student: string;
  initials: string;
  guardian: string;
  grade: string;
  admissionStandard: string;
  source: string;
  mobile: string;
  email: string;
  address: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  previousSchoolName: string;
  previousStandard: string;
  remarks: string;
  category: string;
  sendSms: string;
  instituteBranch: string;
  activityDate: string;
  activityTime: string;
  activityRemarks: string;
  siblings: string;
  formNumber: string;
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  annualIncome: string;
  mobileNumberFather: string;
  mobileNumberMother: string;
  status: string;
  assigned: string;
  initialsAssigned: string;
  followUp: string;
  followUpDate: string;
  createdOn: string;
  searchText: string;
};

type AdmissionEnquirySession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
  userId: string;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function readFormValue(formData: FormData, key: string): string {
  return readString(formData.get(key)).trim();
}

function toNumberWhenPossible(value: string): number | string {
  const parsed = Number(value);
  return value !== '' && Number.isFinite(parsed) ? parsed : value;
}

function getAdmissionEnquirySession(): AdmissionEnquirySession {
  if (typeof window === 'undefined') {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '', userId: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const academicYears = userData.academicYears;

    let syear = readString(localStorage.getItem('selectedAcademicYear'));
    if (!syear && Array.isArray(academicYears) && academicYears.length > 0) {
      const firstYear = academicYears[0] as Record<string, unknown>;
      syear = readString(firstYear.syear);
    }
    if (!syear) {
      syear = readString(userData.academic_year_id ?? userData.academicYearId ?? menuContext.academic_year_id);
    }

    return {
      baseUrl: readString(userData.host_name) || API_BASE_URL,
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      syear,
      userId: readString(userData.user_id ?? userData.userId ?? menuContext.user_id ?? menuContext.userId),
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '', userId: '' };
  }
}

function sanitizeMobileNumberInput(event: FormEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  const digitsOnly = input.value.replace(/\D/g, '').slice(0, 10);
  if (digitsOnly !== input.value) {
    input.value = digitsOnly;
  }
}

function getFullName(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  return initials.toUpperCase() || '--';
}

function formatShortDate(value?: string | null): string {
  if (!value) return '-';

  const date = parseApiDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatFollowUpDate(value?: string | null): string {
  const date = parseApiDate(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatFollowUpTimestamp(value?: string | null): string {
  const date = parseApiDate(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function isConvertedStatus(status: string): boolean {
  const normalizedStatus = status.toLowerCase();
  return normalizedStatus === 'approved' || normalizedStatus === 'converted';
}

function isClosedStatus(status: string): boolean {
  return isConvertedStatus(status) || status.toLowerCase() === 'closed';
}

function formatStatus(value?: string | null): string {
  const status = value?.replace(/[_-]/g, ' ').trim();
  if (!status) return 'New';
  if (status.toLowerCase() === 'approve') return 'Approved';
  return status.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'converted':
      return 'bg-emerald-50 text-emerald-700';
    case 'new':
      return 'bg-blue-50 text-blue-700';
    case 'visit scheduled':
      return 'bg-amber-50 text-amber-700';
    case 'contacted':
      return 'bg-purple-50 text-purple-700';
    case 'application sent':
      return 'bg-indigo-50 text-indigo-700';
    case 'closed':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function mapAdmissionEnquiryToRosterRow(row: AdmissionEnquiryApiRow): EnquiryRosterRow {
  const rawId = readString(row.id);
  const firstName = readString(row.first_name);
  const middleName = readString(row.middle_name);
  const lastName = readString(row.last_name);
  const fatherName = readString(row.father_name);
  const motherName = readString(row.mother_name);
  const enquiryNo = readString(row.enquiry_no) || rawId;
  const student = getFullName(firstName, middleName, lastName) || `Enquiry ${enquiryNo}`;
  const guardian = row.guardian_name?.trim() || fatherName || motherName || 'Not available';
  const gradeValue = readString(row.admission_standard);
  const source = row.source_of_enquiry?.trim() || 'Not specified';
  const status = formatStatus(row.status);
  const assigned = row.counciler_name?.trim() || 'Unassigned';

  const rosterRow = {
    apiId: rawId || enquiryNo,
    enquiryNo,
    firstName,
    middleName,
    lastName,
    student,
    initials: getInitials(student),
    guardian,
    grade: gradeValue ? `Grade ${gradeValue}` : '-',
    admissionStandard: gradeValue,
    source,
    mobile: readString(row.mobile),
    email: readString(row.email),
    address: readString(row.address),
    dateOfBirth: readString(row.date_of_birth),
    age: readString(row.age),
    gender: readString(row.gender),
    previousSchoolName: readString(row.previous_school_name),
    previousStandard: readString(row.previous_standard),
    remarks: readString(row.remarks),
    category: readString(row.category),
    sendSms: readString(row.send_sms),
    instituteBranch: readString(row.institute_branch),
    activityDate: readString(row.activity_date),
    activityTime: readString(row.activity_time),
    activityRemarks: readString(row.activity_remarks),
    siblings: readString(row.siblings),
    formNumber: readString(row.form_number ?? row.fees_circular_form_no),
    fatherName,
    motherName,
    fatherOccupation: readString(row.father_occupation),
    annualIncome: readString(row.annual_income),
    mobileNumberFather: readString(row.mobile_number_father),
    mobileNumberMother: readString(row.mobile_number_mother),
    status,
    assigned,
    initialsAssigned: assigned === 'Unassigned' ? '--' : getInitials(assigned),
    followUp: formatShortDate(row.followup_date),
    followUpDate: readString(row.followup_date),
    createdOn: readString(row.created_on),
  };

  return {
    ...rosterRow,
    searchText: Object.values(rosterRow).join(' ').toLowerCase(),
  };
}

export default function AdmissionManagementContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterData, setRosterData] = useState<EnquiryRosterRow[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryRosterRow | null>(null);
  const [enquiryDob, setEnquiryDob] = useState('');
  const [enquiryAge, setEnquiryAge] = useState('');
  const [isSavingEnquiry, setIsSavingEnquiry] = useState(false);
  const [enquiryFormError, setEnquiryFormError] = useState<string | null>(null);
  const [enquiryFieldErrors, setEnquiryFieldErrors] = useState<EnquiryFieldErrors>({});
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpEntries, setFollowUpEntries] = useState<AdmissionFollowUpEntry[]>([]);
  const [followUpContactName, setFollowUpContactName] = useState('');
  const [followUpContactMobile, setFollowUpContactMobile] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [followUpListError, setFollowUpListError] = useState<string | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [followUpFormError, setFollowUpFormError] = useState<string | null>(null);
  const [nextFollowUpByEnquiry, setNextFollowUpByEnquiry] = useState<Record<string, string>>({});

  const loadAdmissionEnquiries = useCallback(async (signal?: AbortSignal) => {
    const session = getAdmissionEnquirySession();

    if (!session.subInstituteId || !session.syear) {
      setRosterData([]);
      setRosterError('Session is missing sub institute or academic year.');
      setIsRosterLoading(false);
      return;
    }

    setIsRosterLoading(true);
    setRosterError(null);

    try {
      const baseUrl = session.baseUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/api/admission_enquiry`);
      url.searchParams.set('sub_institute_id', session.subInstituteId);
      url.searchParams.set('syear', session.syear);
      url.searchParams.set('type', 'API');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load enquiries (${response.status})`);
      }

      const payload = (await response.json()) as AdmissionEnquiryApiResponse;
      if (String(payload.status_code) !== '1') {
        throw new Error(payload.message || 'Failed to load enquiries.');
      }

      setRosterData(Array.isArray(payload.data) ? payload.data.map(mapAdmissionEnquiryToRosterRow) : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setRosterData([]);
      setRosterError(error instanceof Error ? error.message : 'Failed to load enquiries.');
    } finally {
      if (!signal?.aborted) {
        setIsRosterLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadAdmissionEnquiries(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadAdmissionEnquiries]);

  useEffect(() => {
    if (rosterData.length === 0) return;
    const controller = new AbortController();

    (async () => {
      const results = await Promise.allSettled(
        rosterData.map(async (row) => {
          const details = await fetchAdmissionFollowUps(row.apiId, controller.signal);
          const latestEntry = details.entries.reduce<AdmissionFollowUpEntry | null>((latest, entry) => {
            const entryDate = parseApiDate(entry.followUpDate);
            if (!entryDate) return latest;
            const latestDate = latest ? parseApiDate(latest.followUpDate) : null;
            return !latest || (latestDate && entryDate > latestDate) ? entry : latest;
          }, null);
          return { apiId: row.apiId, latest: latestEntry?.followUpDate || '' };
        })
      );

      if (controller.signal.aborted) return;

      setNextFollowUpByEnquiry((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.latest) {
            next[result.value.apiId] = result.value.latest;
          }
        });
        return next;
      });
    })();

    return () => controller.abort();
  }, [rosterData]);

  const filteredRosterData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rosterData;
    return rosterData.filter((row) => row.searchText.includes(query));
  }, [rosterData, searchQuery]);

  const kpiStats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const total = rosterData.length;
    const newThisWeek = rosterData.filter((row) => {
      const createdDate = parseApiDate(row.createdOn);
      return Boolean(createdDate && createdDate >= sevenDaysAgo && createdDate <= now);
    }).length;
    const convertedCount = rosterData.filter((row) => isConvertedStatus(row.status)).length;
    const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;
    const followUpsDue = rosterData.filter((row) => {
      const followUpDate = parseApiDate(row.followUpDate);
      return Boolean(followUpDate && followUpDate <= endOfToday && !isClosedStatus(row.status));
    }).length;

    return {
      total,
      newThisWeek,
      convertedCount,
      conversionRate,
      followUpsDue,
    };
  }, [rosterData]);

  const sourceBreakdown = useMemo(() => {
    const counts = rosterData.reduce<Record<string, number>>((acc, row) => {
      const source = row.source.trim() || 'Not specified';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([source, count], index) => ({
        source,
        count,
        color: chartColors[index % chartColors.length],
        background: chartBackgrounds[index % chartBackgrounds.length],
      }))
      .sort((first, second) => second.count - first.count);
  }, [rosterData]);

  const funnelData = useMemo(() => {
    const newCount = rosterData.filter((row) => row.status.toLowerCase() === 'new').length;
    const approvedCount = kpiStats.convertedCount;
    const activeCount = rosterData.filter((row) => {
      const normalizedStatus = row.status.toLowerCase();
      return normalizedStatus !== 'new' && !isClosedStatus(row.status);
    }).length;

    return {
      labels: ['Total', 'New', 'Active', 'Follow-up due', 'Approved'],
      datasets: [
        {
          label: 'Enquiries',
          data: [kpiStats.total, newCount, activeCount, kpiStats.followUpsDue, approvedCount],
          backgroundColor: '#0D6EFD',
          borderRadius: 4,
        },
      ],
    };
  }, [kpiStats.convertedCount, kpiStats.followUpsDue, kpiStats.total, rosterData]);

  const sourcesData = useMemo(() => {
    const hasSources = sourceBreakdown.length > 0;

    return {
      labels: hasSources ? sourceBreakdown.map((item) => item.source) : ['No data'],
      datasets: [
        {
          data: hasSources ? sourceBreakdown.map((item) => item.count) : [1],
          backgroundColor: hasSources ? sourceBreakdown.map((item) => item.color) : ['#E2E8F0'],
          borderWidth: 0,
        },
      ],
    };
  }, [sourceBreakdown]);

  const qualityData = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const maxSourceCount = Math.max(...sourceBreakdown.map((item) => item.count), 1);
    const topSources = sourceBreakdown.slice(0, 3);

    return {
      labels: ['Volume', 'Conversion', 'Follow-ups', 'Recent', 'Contact'],
      datasets:
        topSources.length > 0
          ? topSources.map((item, index) => {
              const sourceRows = rosterData.filter((row) => row.source === item.source);
              const sourceTotal = sourceRows.length || 1;
              const converted = sourceRows.filter((row) => isConvertedStatus(row.status)).length;
              const followUps = sourceRows.filter((row) => Boolean(parseApiDate(row.followUpDate))).length;
              const recent = sourceRows.filter((row) => {
                const createdDate = parseApiDate(row.createdOn);
                return Boolean(createdDate && createdDate >= sevenDaysAgo && createdDate <= now);
              }).length;
              const contactReady = sourceRows.filter((row) => row.mobile || row.email).length;

              return {
                label: item.source,
                data: [
                  Math.round((item.count / maxSourceCount) * 100),
                  Math.round((converted / sourceTotal) * 100),
                  Math.round((followUps / sourceTotal) * 100),
                  Math.round((recent / sourceTotal) * 100),
                  Math.round((contactReady / sourceTotal) * 100),
                ],
                backgroundColor: chartBackgrounds[index % chartBackgrounds.length],
                borderColor: item.color,
                pointBackgroundColor: item.color,
              };
            })
          : [
              {
                label: 'No data',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(148, 163, 184, 0.16)',
                borderColor: '#94A3B8',
                pointBackgroundColor: '#94A3B8',
              },
            ],
    };
  }, [rosterData, sourceBreakdown]);

  const nextEnquiryNumber = useMemo(() => {
    const session = getAdmissionEnquirySession();
    const academicYear = session.syear || String(new Date().getFullYear());
    const maxExistingEnquiryNo = rosterData.reduce((max, row) => {
      const parsed = Number(row.enquiryNo);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);

    if (maxExistingEnquiryNo > 0) {
      return String(maxExistingEnquiryNo + 1);
    }

    return `${academicYear}${String(1).padStart(3, '0')}`;
  }, [rosterData]);

  const getKpiValue = (value: number, suffix = '') => (isRosterLoading ? '...' : `${value}${suffix}`);
  const handleEnquiryDobChange = (value: string) => {
    setEnquiryDob(value);

    const birthDate = parseApiDate(value);
    if (!birthDate) {
      setEnquiryAge('');
      return;
    }

    const today = new Date();
    let nextAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      nextAge -= 1;
    }
    setEnquiryAge(String(Math.max(nextAge, 0)));
  };

  const resetEnquiryModalForm = () => {
    setEnquiryDob(editingEnquiry?.dateOfBirth || '');
    setEnquiryAge(editingEnquiry?.age || '');
    setEnquiryFormError(null);
    setEnquiryFieldErrors({});
  };

  const openAddEnquiryModal = () => {
    setEditingEnquiry(null);
    setEnquiryDob('');
    setEnquiryAge('');
    setEnquiryFormError(null);
    setEnquiryFieldErrors({});
    setIsEnquiryModalOpen(true);
  };

  const openEditEnquiryModal = (row: EnquiryRosterRow) => {
    setEditingEnquiry({ ...row });
    setEnquiryDob(row.dateOfBirth);
    setEnquiryAge(row.age);
    setEnquiryFormError(null);
    setEnquiryFieldErrors({});
    setIsEnquiryModalOpen(true);
  };

  const handleEditEnquiryClick = (event: MouseEvent<HTMLButtonElement>, row: EnquiryRosterRow) => {
    event.preventDefault();
    event.stopPropagation();
    openEditEnquiryModal(row);
  };

  const handleRosterEditAction = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const trigger = target.closest<HTMLElement>('[data-edit-enquiry-index]');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();

    const rowIndex = Number(trigger.dataset.editEnquiryIndex);
    const rowId = trigger.dataset.editEnquiryId || '';
    const rowFromIndex = Number.isInteger(rowIndex) ? filteredRosterData[rowIndex] : undefined;
    const row =
      (rowFromIndex?.apiId === rowId ? rowFromIndex : undefined) ||
      filteredRosterData.find((item) => item.apiId === rowId) ||
      rosterData.find((item) => item.apiId === rowId);

    if (row) {
      openEditEnquiryModal(row);
    }
  };

  const closeEnquiryModal = () => {
    setIsEnquiryModalOpen(false);
    setEditingEnquiry(null);
    setEnquiryFormError(null);
    setEnquiryFieldErrors({});
  };

  const loadFollowUps = useCallback(async (enquiryId: string, signal?: AbortSignal) => {
    setIsFollowUpLoading(true);
    setFollowUpListError(null);

    try {
      const details = await fetchAdmissionFollowUps(enquiryId, signal);
      setFollowUpEntries(details.entries);
      if (details.name) setFollowUpContactName(details.name);
      if (details.mobile) setFollowUpContactMobile(details.mobile);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFollowUpEntries([]);
      setFollowUpListError(error instanceof Error ? error.message : 'Failed to load admission follow-ups.');
    } finally {
      if (!signal?.aborted) {
        setIsFollowUpLoading(false);
      }
    }
  }, []);

  const openFollowUpModal = () => {
    if (!editingEnquiry) return;

    setIsEnquiryModalOpen(false);
    setFollowUpContactName(editingEnquiry.student);
    setFollowUpContactMobile(editingEnquiry.mobile);
    setFollowUpEntries([]);
    setFollowUpFormError(null);
    setFollowUpListError(null);
    setIsFollowUpModalOpen(true);
    void loadFollowUps(editingEnquiry.apiId);
  };

  const closeFollowUpModal = () => {
    setIsFollowUpModalOpen(false);
    setFollowUpFormError(null);
    if (editingEnquiry) {
      setIsEnquiryModalOpen(true);
    }
  };

  const handleSaveFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEnquiry) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const followUpDate = readFormValue(formData, 'follow_up_date');
    const status = readFormValue(formData, 'status');
    const remarks = readFormValue(formData, 'remarks');

    if (!followUpDate || !status || !remarks) {
      setFollowUpFormError('Next followup date, remarks, and enquiry status are required.');
      return;
    }

    setIsSavingFollowUp(true);
    setFollowUpFormError(null);

    try {
      await saveAdmissionFollowUp({ enquiryId: editingEnquiry.apiId, followUpDate, status, remarks });
      form.reset();
      setNextFollowUpByEnquiry((prev) => ({ ...prev, [editingEnquiry.apiId]: followUpDate }));
      await loadFollowUps(editingEnquiry.apiId);
    } catch (error) {
      setFollowUpFormError(error instanceof Error ? error.message : 'Failed to save the follow-up.');
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleSaveEnquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const session = getAdmissionEnquirySession();
    if (!session.subInstituteId || !session.syear) {
      setEnquiryFormError('Session is missing sub institute or academic year.');
      return;
    }

    const formData = new FormData(form);

    const fieldErrors = validateEnquiryContactFields(formData);
    setEnquiryFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setEnquiryFormError('Please fix the highlighted fields before saving.');
      return;
    }
    setEnquiryFormError(null);

    const middleName = readFormValue(formData, 'middle_name');

    if (editingEnquiry) {
      const payload: AdmissionEnquiryUpdatePayload = {
        first_name: readFormValue(formData, 'first_name'),
        middle_name: readFormValue(formData, 'middle_name'),
        last_name: readFormValue(formData, 'last_name'),
        mobile: readFormValue(formData, 'mobile'),
        email: readFormValue(formData, 'email'),
        gender: readFormValue(formData, 'gender'),
        date_of_birth: readFormValue(formData, 'date_of_birth'),
        admission_standard: toNumberWhenPossible(readFormValue(formData, 'admission_standard')),
        address: readFormValue(formData, 'address'),
        father_name: readFormValue(formData, 'father_name'),
        mother_name: readFormValue(formData, 'mother_name'),
        father_occupation: readFormValue(formData, 'father_occupation'),
        annual_income: readFormValue(formData, 'annual_income'),
        source_of_enquiry: readFormValue(formData, 'source_of_enquiry'),
        previous_school_name: readFormValue(formData, 'previous_school_name'),
        previous_standard: toNumberWhenPossible(readFormValue(formData, 'previous_standard')),
        remarks: readFormValue(formData, 'remarks'),
        followup_date: readFormValue(formData, 'followup_date'),
        mobile_number_father: readFormValue(formData, 'mobile_number_father'),
        mobile_number_mother: readFormValue(formData, 'mobile_number_mother'),
        category: readFormValue(formData, 'category'),
        send_sms: readFormValue(formData, 'send_sms'),
        institute_branch: readFormValue(formData, 'institute_branch'),
        activity_date: readFormValue(formData, 'activity_date'),
        activity_time: readFormValue(formData, 'activity_time'),
        activity_remarks: readFormValue(formData, 'activity_remarks'),
        siblings: readFormValue(formData, 'siblings'),
        fees_circular_form_no: readFormValue(formData, 'fees_circular_form_no'),
      };

      setIsSavingEnquiry(true);
      setEnquiryFormError(null);

      try {
        const baseUrl = session.baseUrl.replace(/\/$/, '');
        const url = new URL(`${baseUrl}/api/admission_enquiry/${editingEnquiry.apiId}`);
        url.searchParams.set('sub_institute_id', session.subInstituteId);
        url.searchParams.set('syear', session.syear);
        url.searchParams.set('type', 'API');

        const response = await fetch(url.toString(), {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to update enquiry (${response.status})`);
        }

        const responsePayload = (await response.json().catch(() => null)) as AdmissionEnquiryApiResponse | null;
        if (responsePayload?.status_code != null && String(responsePayload.status_code) !== '1') {
          throw new Error(responsePayload.message || 'Failed to update enquiry.');
        }

        form.reset();
        resetEnquiryModalForm();
        closeEnquiryModal();
        await loadAdmissionEnquiries();
      } catch (error) {
        setEnquiryFormError(error instanceof Error ? error.message : 'Failed to update enquiry.');
      } finally {
        setIsSavingEnquiry(false);
      }
      return;
    }

    const payload: AdmissionEnquiryPostPayload = {
      enquiry_no: toNumberWhenPossible(readFormValue(formData, 'enquiry_no') || nextEnquiryNumber),
      first_name: readFormValue(formData, 'first_name'),
      middle_name: middleName,
      last_name: readFormValue(formData, 'last_name'),
      mobile: readFormValue(formData, 'mobile'),
      email: readFormValue(formData, 'email'),
      gender: readFormValue(formData, 'gender'),
      date_of_birth: readFormValue(formData, 'date_of_birth'),
      age: toNumberWhenPossible(readFormValue(formData, 'age')),
      admission_standard: toNumberWhenPossible(readFormValue(formData, 'admission_standard')),
      address: readFormValue(formData, 'address'),
      father_name: readFormValue(formData, 'father_name') || middleName,
      mother_name: readFormValue(formData, 'mother_name'),
      father_occupation: readFormValue(formData, 'father_occupation'),
      annual_income: readFormValue(formData, 'annual_income'),
      source_of_enquiry: readFormValue(formData, 'source_of_enquiry'),
      previous_school_name: readFormValue(formData, 'previous_school_name'),
      previous_standard: toNumberWhenPossible(readFormValue(formData, 'previous_standard')),
      remarks: readFormValue(formData, 'remarks'),
      followup_date: readFormValue(formData, 'followup_date'),
      mobile_number_father: readFormValue(formData, 'mobile_number_father'),
      mobile_number_mother: readFormValue(formData, 'mobile_number_mother'),
      category: readFormValue(formData, 'category'),
      send_sms: readFormValue(formData, 'send_sms'),
      institute_branch: readFormValue(formData, 'institute_branch'),
      activity_date: readFormValue(formData, 'activity_date'),
      activity_time: readFormValue(formData, 'activity_time'),
      activity_remarks: readFormValue(formData, 'activity_remarks'),
      siblings: readFormValue(formData, 'siblings'),
      fees_circular_form_no: readFormValue(formData, 'form_number'),
    };

    setIsSavingEnquiry(true);
    setEnquiryFormError(null);

    try {
      const baseUrl = session.baseUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/api/admission_enquiry`);
      url.searchParams.set('sub_institute_id', session.subInstituteId);
      url.searchParams.set('syear', session.syear);
      url.searchParams.set('type', 'API');
      if (session.userId) url.searchParams.set('user_id', session.userId);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save enquiry (${response.status})`);
      }

      const responsePayload = (await response.json().catch(() => null)) as AdmissionEnquiryApiResponse | null;
      if (responsePayload?.status_code != null && String(responsePayload.status_code) !== '1') {
        throw new Error(responsePayload.message || 'Failed to save enquiry.');
      }

      form.reset();
      resetEnquiryModalForm();
      setIsEnquiryModalOpen(false);
      await loadAdmissionEnquiries();
    } catch (error) {
      setEnquiryFormError(error instanceof Error ? error.message : 'Failed to save enquiry.');
    } finally {
      setIsSavingEnquiry(false);
    }
  };

  return (
    <div className="space-y-6  p-6 min-h-screen text-slate-800">
      
      {/* --- KPI Metric Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Enquiries */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">Total enquiries</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">{getKpiValue(kpiStats.total)}</div>
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
            Live from admission enquiry API
          </div>
        </div>

        {/* New This Week */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">New this week</span>
            <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">{getKpiValue(kpiStats.newThisWeek)}</div>
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
            Created in the last 7 days
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">Conversion rate</span>
            <Percent className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">{getKpiValue(kpiStats.conversionRate, '%')}</div>
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
            {isRosterLoading ? 'Loading converted enquiries' : `${kpiStats.convertedCount} approved or converted`}
          </div>
        </div>

        {/* Follow-ups Due */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">Follow-ups due</span>
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">{getKpiValue(kpiStats.followUpsDue)}</div>
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
            Pending follow-ups up to today
          </div>
        </div>
      </div>

      {/* --- Charts Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Admissions funnel</h3>
              <p className="text-xs text-slate-400">Status movement from loaded enquiries</p>
            </div>
            <button className="text-xs font-medium text-[var(--primary-blue)] hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
              Details <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          <div className="h-48 flex items-center justify-center">
            <Bar 
              data={funnelData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { grid: { display: false } }, x: { grid: { display: false } } }
              }} 
            />
          </div>
        </div>

        {/* Enquiry Sources */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Enquiry sources</h3>
              <p className="text-xs text-slate-400">Grouped by source of enquiry</p>
            </div>
            <button className="text-xs font-medium text-[var(--primary-blue)] hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
              Details <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-around h-48">
            <div className="w-32 h-32 relative flex items-center justify-center">
              <Doughnut 
                data={sourcesData} 
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} 
              />
              <div className="absolute text-center">
                <p className="text-xl font-bold text-slate-900">{getKpiValue(kpiStats.total)}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total</p>
              </div>
            </div>
            <div className="text-xs space-y-1.5 text-slate-600">
              {sourceBreakdown.length > 0 ? (
                sourceBreakdown.slice(0, 4).map((item) => (
                  <div key={item.source} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    {item.source}
                    <span className="font-semibold text-slate-900 ml-auto">{item.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400">No source data</div>
              )}
            </div>
          </div>
        </div>

        {/* Source Quality */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Source quality</h3>
              <p className="text-xs text-slate-400">Top source metrics from API data</p>
            </div>
            <button className="text-xs font-medium text-[var(--primary-blue)] hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
              Details <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          <div className="h-48 flex items-center justify-center">
            <Radar 
              data={qualityData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                      boxWidth: 8,
                      font: { size: 10 },
                    },
                  },
                },
                scales: { r: { ticks: { display: false } } }
              }} 
            />
          </div>
        </div>
      </div>

      {/* --- Enquiry Roster Section --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header Filters Area */}
        <div className="p-4 border-b border-slate-100 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <h3 className="font-semibold text-slate-900 text-base">Enquiry roster <span className="text-xs text-slate-400 font-normal ml-1">{rosterData.length} enquiries</span></h3>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search roster..."
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-blue)] w-48"
              />
            </div>
            
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Status <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 font-medium">
              Source <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 font-medium">
              Grade <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={openAddEnquiryModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-blue)] text-white rounded-lg text-sm hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] font-medium shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Enquiry
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto" onMouseDownCapture={handleRosterEditAction} onClickCapture={handleRosterEditAction}>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-medium border-b border-slate-100">
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Enquiry No.</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Student</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Grade</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Source</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Assigned</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Follow-up Date</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Next Follow-up Date</th>
                <th className="p-4 w-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isRosterLoading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-slate-500">
                    Loading enquiries...
                  </td>
                </tr>
              ) : rosterError ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-rose-600">
                    {rosterError}
                  </td>
                </tr>
              ) : filteredRosterData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-slate-500">
                    No enquiries found.
                  </td>
                </tr>
              ) : (
                filteredRosterData.map((row, rowIndex) => (
                  <tr key={`${row.apiId || row.enquiryNo || 'enquiry'}-${rowIndex}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{row.enquiryNo}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-semibold text-xs flex items-center justify-center">
                          {row.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{row.student}</div>
                          <div className="text-xs text-slate-400">Guardian: {row.guardian}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">{row.grade}</td>
                    <td className="p-4 text-slate-600">{row.source}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                          {row.initialsAssigned}
                        </div>
                        <span>{row.assigned}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">{row.followUp}</td>
                    <td className="p-4 text-slate-500 font-medium">
                      {nextFollowUpByEnquiry[row.apiId] ? formatShortDate(nextFollowUpByEnquiry[row.apiId]) : '-'}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        data-edit-enquiry-id={row.apiId}
                        data-edit-enquiry-index={rowIndex}
                        onMouseDown={(event) => handleEditEnquiryClick(event, row)}
                        onClick={(event) => handleEditEnquiryClick(event, row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--primary-blue)] transition-colors hover:bg-blue-50"
                        aria-label={`Edit enquiry ${row.enquiryNo}`}
                        aria-haspopup="dialog"
                        title="Edit enquiry"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div>
            {isRosterLoading
              ? 'Loading rows'
              : `${filteredRosterData.length === 0 ? 0 : 1} - ${filteredRosterData.length} of ${rosterData.length} Rows`}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 bg-slate-100 text-slate-800 font-semibold rounded shadow-sm">1</button>
          </div>
        </div>

      </div>
      {isEnquiryModalOpen && (
        <EnquiryModalPortal>
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-enquiry-title"
        >
          <form
            key={editingEnquiry ? `edit-${editingEnquiry.apiId}` : 'add-enquiry'}
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onSubmit={handleSaveEnquiry}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="new-enquiry-title" className="text-lg font-semibold text-slate-900">
                  {editingEnquiry ? 'Edit Admission Enquiry' : 'Add Admission Enquiry'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingEnquiry ? `Viewing enquiry ${editingEnquiry.enquiryNo}.` : 'Enter the student enquiry details below.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEnquiryModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close add enquiry popup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {enquiryFormError && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {enquiryFormError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <EnquiryModalField label="Enquiry Number" htmlFor="enquiryNumber">
                  <input id="enquiryNumber" name="enquiry_no" value={editingEnquiry?.enquiryNo || nextEnquiryNumber} readOnly className={`${enquiryInputClassName} cursor-not-allowed text-slate-500`} />
                </EnquiryModalField>

                <EnquiryModalField label="Student Name" htmlFor="studentName" required>
                  <input id="studentName" name="first_name" type="text" defaultValue={editingEnquiry?.firstName || ''} placeholder="Enter student name" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Middle Name (Father Name)" htmlFor="middleName" required>
                  <input id="middleName" name="middle_name" type="text" defaultValue={editingEnquiry?.middleName || ''} placeholder="Enter father name" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Surname" htmlFor="surname" required>
                  <input id="surname" name="last_name" type="text" defaultValue={editingEnquiry?.lastName || ''} placeholder="Enter surname" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Mobile (SMS Number)" htmlFor="mobile" required>
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    defaultValue={editingEnquiry?.mobile || ''}
                    placeholder="Enter 10-digit mobile number"
                    onInput={sanitizeMobileNumberInput}
                    aria-invalid={Boolean(enquiryFieldErrors.mobile)}
                    className={enquiryFieldErrors.mobile ? enquiryInputErrorClassName : enquiryInputClassName}
                  />
                  {enquiryFieldErrors.mobile && (
                    <p className="text-xs font-medium text-rose-600">{enquiryFieldErrors.mobile}</p>
                  )}
                </EnquiryModalField>

                <EnquiryModalField label="Email" htmlFor="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingEnquiry?.email || ''}
                    placeholder="Enter email address"
                    aria-invalid={Boolean(enquiryFieldErrors.email)}
                    className={enquiryFieldErrors.email ? enquiryInputErrorClassName : enquiryInputClassName}
                  />
                  {enquiryFieldErrors.email && (
                    <p className="text-xs font-medium text-rose-600">{enquiryFieldErrors.email}</p>
                  )}
                </EnquiryModalField>

                <EnquiryModalField label="Admission Standard" htmlFor="admissionStandard" required>
                  <select id="admissionStandard" name="admission_standard" defaultValue={editingEnquiry?.admissionStandard || ''} className={enquiryInputClassName}>
                    <option value="" disabled>Select standard</option>
                    {standardOptions.map((standard) => (
                      <option key={standard.value} value={standard.value}>{standard.label}</option>
                    ))}
                  </select>
                </EnquiryModalField>

                <EnquiryModalField label="Date of Birth" htmlFor="dateOfBirth" required>
                  <input
                    id="dateOfBirth"
                    name="date_of_birth"
                    type="date"
                    value={enquiryDob}
                    onChange={(event) => handleEnquiryDobChange(event.target.value)}
                    className={enquiryInputClassName}
                  />
                </EnquiryModalField>

                <EnquiryModalField label="Age" htmlFor="age">
                  <input id="age" name="age" type="text" value={enquiryAge} readOnly placeholder="Auto calculated" className={`${enquiryInputClassName} cursor-not-allowed text-slate-500`} />
                </EnquiryModalField>

                <EnquiryModalField label="Address" htmlFor="address" className="md:col-span-2 xl:col-span-3" required>
                  <textarea id="address" name="address" defaultValue={editingEnquiry?.address || ''} placeholder="Enter full address" className={enquiryTextareaClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Father Name" htmlFor="fatherName" required>
                  <input id="fatherName" name="father_name" type="text" defaultValue={editingEnquiry?.fatherName || ''} placeholder="Enter father name" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Mother Name" htmlFor="motherName" required>
                  <input id="motherName" name="mother_name" type="text" defaultValue={editingEnquiry?.motherName || ''} placeholder="Enter mother name" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Father Occupation" htmlFor="fatherOccupation">
                  <input id="fatherOccupation" name="father_occupation" type="text" defaultValue={editingEnquiry?.fatherOccupation || ''} placeholder="Enter father occupation" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Annual Income" htmlFor="annualIncome">
                  <input id="annualIncome" name="annual_income" type="text" defaultValue={editingEnquiry?.annualIncome || ''} placeholder="Enter annual income" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Gender" htmlFor="genderMale" required>
                  <div className="flex h-10 items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <input id="genderMale" type="radio" name="gender" value="male" defaultChecked={editingEnquiry?.gender?.toLowerCase() === 'male' || editingEnquiry?.gender?.toLowerCase() === 'm'} className="text-[var(--primary-blue)] focus:ring-[var(--primary-blue)]" />
                      Male
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name="gender" value="female" defaultChecked={editingEnquiry?.gender?.toLowerCase() === 'female' || editingEnquiry?.gender?.toLowerCase() === 'f'} className="text-[var(--primary-blue)] focus:ring-[var(--primary-blue)]" />
                      Female
                    </label>
                  </div>
                </EnquiryModalField>

                <EnquiryModalField label="Previous School Name" htmlFor="previousSchoolName">
                  <input id="previousSchoolName" name="previous_school_name" type="text" defaultValue={editingEnquiry?.previousSchoolName || ''} placeholder="Enter previous school" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Previous Standard" htmlFor="previousStandard">
                  <select id="previousStandard" name="previous_standard" defaultValue={editingEnquiry?.previousStandard || ''} className={enquiryInputClassName}>
                    <option value="" disabled>Select previous standard</option>
                    {standardOptions.map((standard) => (
                      <option key={standard.value} value={standard.value}>{standard.label}</option>
                    ))}
                  </select>
                </EnquiryModalField>

                <EnquiryModalField label="Followup Date" htmlFor="followupDate">
                  <input id="followupDate" name="followup_date" type="date" defaultValue={editingEnquiry?.followUpDate || ''} className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Remarks" htmlFor="remarks" className="md:col-span-2 xl:col-span-3">
                  <textarea id="remarks" name="remarks" defaultValue={editingEnquiry?.remarks || ''} placeholder="Enter remarks" className={enquiryTextareaClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Source of Enquiry" htmlFor="sourceOfEnquiry" required>
                  <input id="sourceOfEnquiry" name="source_of_enquiry" type="text" defaultValue={editingEnquiry?.source || ''} placeholder="e.g. Website, Referral" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Category" htmlFor="category">
                  <select id="category" name="category" defaultValue={editingEnquiry?.category || ''} className={enquiryInputClassName}>
                    <option value="" disabled>Select category</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </EnquiryModalField>

                <EnquiryModalField label="Send SMS" htmlFor="sendSms">
                  <select id="sendSms" name="send_sms" defaultValue={editingEnquiry?.sendSms || ''} className={enquiryInputClassName}>
                    <option value="" disabled>Select option</option>
                    {sendSmsOptions.map((option) => (
                      <option key={option} value={option.toLowerCase()}>{option}</option>
                    ))}
                  </select>
                </EnquiryModalField>

                <EnquiryModalField label="Institute Branch" htmlFor="instituteBranch">
                  <select id="instituteBranch" name="institute_branch" defaultValue={editingEnquiry?.instituteBranch || ''} className={enquiryInputClassName}>
                    <option value="" disabled>Select branch</option>
                    {branchOptions.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </EnquiryModalField>

                <EnquiryModalField label="Activity Date" htmlFor="activityDate">
                  <input id="activityDate" name="activity_date" type="date" defaultValue={editingEnquiry?.activityDate || ''} className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Activity Time" htmlFor="activityTime">
                  <input id="activityTime" name="activity_time" type="time" defaultValue={editingEnquiry?.activityTime || ''} className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Activity Remarks" htmlFor="activityRemarks" className="md:col-span-2 xl:col-span-3">
                  <textarea id="activityRemarks" name="activity_remarks" defaultValue={editingEnquiry?.activityRemarks || ''} placeholder="Enter activity remarks" className={enquiryTextareaClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Siblings" htmlFor="siblings">
                  <input id="siblings" name="siblings" type="text" defaultValue={editingEnquiry?.siblings || ''} placeholder="Enter sibling count or details" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Form Number" htmlFor="formNumber">
                  <input id="formNumber" name="form_number" type="text" defaultValue={editingEnquiry?.formNumber || ''} placeholder="Enter form number" className={enquiryInputClassName} />
                </EnquiryModalField>

                <EnquiryModalField label="Mobile Number Father" htmlFor="mobileNumberFather">
                  <input
                    id="mobileNumberFather"
                    name="mobile_number_father"
                    type="tel"
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    defaultValue={editingEnquiry?.mobileNumberFather || ''}
                    placeholder="Enter father's 10-digit mobile"
                    onInput={sanitizeMobileNumberInput}
                    aria-invalid={Boolean(enquiryFieldErrors.mobile_number_father)}
                    className={enquiryFieldErrors.mobile_number_father ? enquiryInputErrorClassName : enquiryInputClassName}
                  />
                  {enquiryFieldErrors.mobile_number_father && (
                    <p className="text-xs font-medium text-rose-600">{enquiryFieldErrors.mobile_number_father}</p>
                  )}
                </EnquiryModalField>

                <EnquiryModalField label="Mobile Number Mother" htmlFor="mobileNumberMother">
                  <input
                    id="mobileNumberMother"
                    name="mobile_number_mother"
                    type="tel"
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    defaultValue={editingEnquiry?.mobileNumberMother || ''}
                    placeholder="Enter mother's 10-digit mobile"
                    onInput={sanitizeMobileNumberInput}
                    aria-invalid={Boolean(enquiryFieldErrors.mobile_number_mother)}
                    className={enquiryFieldErrors.mobile_number_mother ? enquiryInputErrorClassName : enquiryInputClassName}
                  />
                  {enquiryFieldErrors.mobile_number_mother && (
                    <p className="text-xs font-medium text-rose-600">{enquiryFieldErrors.mobile_number_mother}</p>
                  )}
                </EnquiryModalField>

              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              {editingEnquiry && (
                <button
                  type="button"
                  onClick={openFollowUpModal}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 sm:mr-auto"
                >
                  <History className="h-4 w-4" /> Admission follow-up
                </button>
              )}
              <button
                type="button"
                onClick={closeEnquiryModal}
                disabled={isSavingEnquiry}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="reset"
                onClick={resetEnquiryModalForm}
                disabled={isSavingEnquiry}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Reset Form
              </button>
              {editingEnquiry ? (
                <button
                  type="submit"
                  disabled={isSavingEnquiry}
                  className="h-10 rounded-lg bg-[var(--primary-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingEnquiry ? 'Updating...' : 'Update Enquiry'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSavingEnquiry}
                  className="h-10 rounded-lg bg-[var(--primary-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingEnquiry ? 'Saving...' : 'Save Enquiry'}
                </button>
              )}
            </div>
          </form>
        </div>
        </EnquiryModalPortal>
      )}
      {isFollowUpModalOpen && editingEnquiry && (
        <EnquiryModalPortal>
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-900/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admission-follow-up-title"
          >
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 id="admission-follow-up-title" className="text-lg font-semibold text-slate-900">
                    Admission follow-up
                  </h2>
                  <p className="text-sm text-slate-500">Enquiry {editingEnquiry.enquiryNo} — record calls, visits and status updates.</p>
                </div>
                <button
                  type="button"
                  onClick={closeFollowUpModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close admission follow up popup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-6">
                {followUpFormError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    {followUpFormError}
                  </div>
                )}

                <form onSubmit={handleSaveFollowUp} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <EnquiryModalField label="Next Followup Date" htmlFor="followUpDate" required>
                      <input id="followUpDate" name="follow_up_date" type="date" required className={enquiryInputClassName} />
                    </EnquiryModalField>

                    <EnquiryModalField label="Name" htmlFor="followUpName">
                      <input
                        id="followUpName"
                        type="text"
                        value={followUpContactName}
                        readOnly
                        className={`${enquiryInputClassName} cursor-not-allowed text-slate-500`}
                      />
                    </EnquiryModalField>

                    <EnquiryModalField label="Mobile Number" htmlFor="followUpMobile">
                      <input
                        id="followUpMobile"
                        type="text"
                        value={followUpContactMobile}
                        readOnly
                        className={`${enquiryInputClassName} cursor-not-allowed text-slate-500`}
                      />
                    </EnquiryModalField>

                    <EnquiryModalField label="Enquiry Status" htmlFor="followUpStatus" required>
                      <select id="followUpStatus" name="status" required defaultValue="" className={enquiryInputClassName}>
                        <option value="" disabled>Select status</option>
                        {ADMISSION_FOLLOW_UP_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </EnquiryModalField>

                    <EnquiryModalField label="Remarks" htmlFor="followUpRemarks" className="md:col-span-2 xl:col-span-4">
                      <textarea id="followUpRemarks" name="remarks" required placeholder="Enter remarks" className={enquiryTextareaClassName} />
                    </EnquiryModalField>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingFollowUp}
                      className="h-10 rounded-lg bg-[var(--primary-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Follow-up history</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-medium border-b border-slate-100">
                          <th className="p-3 font-semibold text-xs tracking-wider uppercase">Sr. No</th>
                          <th className="p-3 font-semibold text-xs tracking-wider uppercase">Next Followup Date</th>
                          <th className="p-3 font-semibold text-xs tracking-wider uppercase">Created On</th>
                          <th className="p-3 font-semibold text-xs tracking-wider uppercase">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isFollowUpLoading ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-sm text-slate-500">Loading follow-ups...</td>
                          </tr>
                        ) : followUpListError ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-sm text-rose-600">{followUpListError}</td>
                          </tr>
                        ) : followUpEntries.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-sm text-slate-500">No follow-ups recorded yet.</td>
                          </tr>
                        ) : (
                          followUpEntries.map((entry, index) => (
                            <tr key={entry.id || index}>
                              <td className="p-3 text-slate-600">{index + 1}</td>
                              <td className="p-3 text-slate-600">{formatFollowUpDate(entry.followUpDate)}</td>
                              <td className="p-3 text-slate-600">{formatFollowUpTimestamp(entry.createdOn)}</td>
                              <td className="p-3 text-slate-600">{entry.remarks || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EnquiryModalPortal>
      )}
    </div>
  );
}
