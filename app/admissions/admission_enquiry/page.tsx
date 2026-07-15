'use client';

import { useEffect, useMemo, useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Users, 
  Percent, 
  Clock, 
  Maximize2,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Plus,
  MoreVertical
} from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
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

type AdmissionEnquiryApiRow = {
  id: number | string;
  enquiry_no?: number | string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  admission_standard?: number | string | null;
  source_of_enquiry?: string | null;
  followup_date?: string | null;
  status?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_name?: string | null;
  counciler_name?: string | null;
};

type AdmissionEnquiryApiResponse = {
  status_code?: number | string;
  message?: string;
  data?: AdmissionEnquiryApiRow[];
};

type EnquiryRosterRow = {
  apiId: string;
  enquiryNo: string;
  student: string;
  initials: string;
  guardian: string;
  grade: string;
  source: string;
  status: string;
  assigned: string;
  initialsAssigned: string;
  followUp: string;
  searchText: string;
};

type AdmissionEnquirySession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function getAdmissionEnquirySession(): AdmissionEnquirySession {
  if (typeof window === 'undefined') {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '' };
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
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '' };
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
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
  const student = getFullName(row.first_name, row.middle_name, row.last_name) || `Enquiry ${readString(row.enquiry_no || row.id)}`;
  const guardian = row.guardian_name?.trim() || row.father_name?.trim() || row.mother_name?.trim() || 'Not available';
  const gradeValue = readString(row.admission_standard);
  const source = row.source_of_enquiry?.trim() || 'Not specified';
  const status = formatStatus(row.status);
  const assigned = row.counciler_name?.trim() || 'Unassigned';

  const rosterRow = {
    apiId: readString(row.id),
    enquiryNo: readString(row.enquiry_no) || readString(row.id),
    student,
    initials: getInitials(student),
    guardian,
    grade: gradeValue ? `Grade ${gradeValue}` : '-',
    source,
    status,
    assigned,
    initialsAssigned: assigned === 'Unassigned' ? '--' : getInitials(assigned),
    followUp: formatShortDate(row.followup_date),
  };

  return {
    ...rosterRow,
    searchText: Object.values(rosterRow).join(' ').toLowerCase(),
  };
}

export default function AdmissionManagementContent() {
  // --- Chart Data Configurations ---
  
  const funnelData = {
    labels: ['Enquiry', 'Contacted', 'Visit', 'Application', 'Confirmed'],
    datasets: [
      {
        label: 'Students',
        data: [320, 240, 180, 120, 96],
        backgroundColor: '#0D6EFD',
        borderRadius: 4,
      },
    ],
  };

  const sourcesData = {
    labels: ['Website', 'Referral', 'Walk-in', 'Social', 'Event'],
    datasets: [
      {
        data: [118, 76, 54, 42, 30],
        backgroundColor: [
          '#4F46E5', // Indigo
          '#10B981', // Emerald
          '#F59E0B', // Amber
          '#3B82F6', // Blue
          '#EC4899', // Pink
        ],
        borderWidth: 0,
      },
    ],
  };

  const qualityData = {
    labels: ['Volume', 'Conversion', 'Response', 'Cost eff.', 'Retention'],
    datasets: [
      {
        label: 'Website',
        data: 90, // Example normalization for radar mapping
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        borderColor: '#4F46E5',
        pointBackgroundColor: '#4F46E5',
      },
      {
        label: 'Referral',
        data: 75,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10B981',
        pointBackgroundColor: '#10B981',
      },
      {
        label: 'Walk-in',
        data: 60,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
        pointBackgroundColor: '#F59E0B',
      },
    ],
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [rosterData, setRosterData] = useState<EnquiryRosterRow[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAdmissionEnquiries = async () => {
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
          signal: controller.signal,
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
        if (!controller.signal.aborted) {
          setIsRosterLoading(false);
        }
      }
    };

    fetchAdmissionEnquiries();

    return () => {
      controller.abort();
    };
  }, []);

  const filteredRosterData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rosterData;
    return rosterData.filter((row) => row.searchText.includes(query));
  }, [rosterData, searchQuery]);

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
          <div className="text-3xl font-bold tracking-tight mb-1">320</div>
          <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +12% <span className="text-slate-400 font-normal">vs last cycle</span>
          </div>
        </div>

        {/* New This Week */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">New this week</span>
            <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">48</div>
          <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +8 <span className="text-slate-400 font-normal">vs last week</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">Conversion rate</span>
            <Percent className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">30%</div>
          <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +3.4pp <span className="text-slate-400 font-normal">vs last cycle</span>
          </div>
        </div>

        {/* Avg First Response */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all group" role="button" tabIndex={0}>
          <div className="flex justify-between items-start text-slate-400 mb-2">
            <span className="text-sm font-medium">Avg first response</span>
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">3.2h</div>
          <div className="text-xs font-medium text-rose-600 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" /> -0.6h <span className="text-slate-400 font-normal">faster</span>
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
              <p className="text-xs text-slate-400">Enquiry to confirmed · cycle 2026–27</p>
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
              <p className="text-xs text-slate-400">This cycle</p>
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
                <p className="text-xl font-bold text-slate-900">320</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total</p>
              </div>
            </div>
            <div className="text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Website <span className="font-semibold text-slate-900 ml-auto">118</span></div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Referral <span className="font-semibold text-slate-900 ml-auto">76</span></div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Walk-in <span className="font-semibold text-slate-900 ml-auto">54</span></div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Social <span className="font-semibold text-slate-900 ml-auto">42</span></div>
            </div>
          </div>
        </div>

        {/* Source Quality */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Source quality</h3>
              <p className="text-xs text-slate-400">Multi-attribute comparison (0–100)</p>
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
                plugins: { legend: { display: false } },
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
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-blue)] text-white rounded-lg text-sm hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] font-medium shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" /> Enquiry
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-medium border-b border-slate-100">
                <th className="p-4 w-4"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" /></th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Enquiry No.</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Student</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Grade</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Source</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Assigned</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Next Follow-Up</th>
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
                filteredRosterData.map((row) => (
                  <tr key={`${row.apiId}-${row.enquiryNo}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" /></td>
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
                    <td className="p-4">
                      <button className="text-slate-400 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
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
    </div>
  );
}
