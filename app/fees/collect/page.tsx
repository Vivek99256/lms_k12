'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Filter, Loader2, Phone, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SessionContext = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
};

type SelectOption = {
  id: string;
  label: string;
};

type StudentFeeRow = {
  id: string;
  name: string;
  grNo: string;
  standard: string;
  section: string;
  pendingFees: number;
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dummyStandards: SelectOption[] = [
  { id: '6', label: '6' },
  { id: '7', label: '7' },
  { id: '8', label: '8' },
];

const dummyLevels: SelectOption[] = [
  { id: 'kg', label: 'KG' },
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'higher_secondary', label: 'Higher Secondary' },
];

const dummyDivisions: SelectOption[] = [
  { id: 'A', label: 'A' },
  { id: 'B', label: 'B' },
  { id: 'C', label: 'C' },
];

const dummyStudents: StudentFeeRow[] = [
  { id: '1020', name: 'Rahul Patel', grNo: '1020', standard: '6', section: 'C', pendingFees: 52310 },
  { id: '1021', name: 'Priya Sharma', grNo: '1021', standard: '7', section: 'A', pendingFees: 18450 },
  { id: '1022', name: 'Arjun Singh', grNo: '1022', standard: '8', section: 'B', pendingFees: 32700 },
  { id: '1023', name: 'Isha Mehta', grNo: '1023', standard: '6', section: 'A', pendingFees: 9600 },
];

export default function FeesCollectPage() {
  const router = useRouter();
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [level, setLevel] = useState('');
  const [studentName, setStudentName] = useState('');
  const [grNo, setGrNo] = useState('');
  const [mobile, setMobile] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [standards, setStandards] = useState<SelectOption[]>([]);
  const [divisions, setDivisions] = useState<SelectOption[]>([]);
  const [levels, setLevels] = useState<SelectOption[]>([]);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [session] = useState(getSessionContext);

  useEffect(() => {
    let cancelled = false;

    const fetchLevels = async () => {
      let token = '';
      let subInstituteId = '';
      let hostName = '';

      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
          const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

          token = readString(userData.user_token ?? userData.token);
          subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
          hostName = readString(userData.host_name);
        } catch {}
      }

      if (!hostName || !token || !subInstituteId) {
        setLevels(dummyLevels);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_adminAcademicSection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load academic sections`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : (source.levels ?? source.sections ?? source.standards ?? []);
        const fetchedLevels = toOptions(items);

        if (!cancelled) {
          setLevels(fetchedLevels.length > 0 ? fetchedLevels : dummyLevels);
        }
      } catch (err) {
        console.error('FeesCollect levels API error:', err);
        if (!cancelled) {
          setLevels(dummyLevels);
        }
      }
    };

    fetchLevels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchStandards = async () => {
      if (!level) {
        setStandards([]);
        setStandard('');
        return;
      }

      let token = '';
      let subInstituteId = '';
      let hostName = '';

      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
          const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

          token = readString(userData.user_token ?? userData.token);
          subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
          hostName = readString(userData.host_name);
        } catch {}
      }

      if (!hostName || !token || !subInstituteId) {
        setStandards([]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('grade_id', String(level));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_adminStandard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load standards`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedStandards = toOptions(items);

        if (!cancelled) {
          setStandards(fetchedStandards.length > 0 ? fetchedStandards : []);
        }
      } catch {
        if (!cancelled) {
          setStandards([]);
        }
      }
    };

    fetchStandards();

    return () => {
      cancelled = true;
    };
  }, [level]);

  useEffect(() => {
    let cancelled = false;

    const fetchDivisions = async () => {
      if (!standard) {
        setDivisions([]);
        setDivision('');
        return;
      }

      let token = '';
      let subInstituteId = '';
      let hostName = '';

      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
          const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

          token = readString(userData.user_token ?? userData.token);
          subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
          hostName = readString(userData.host_name);
        } catch {}
      }

      if (!hostName || !token || !subInstituteId) {
        setDivisions([]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('standard_id', String(standard));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_adminDivision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load divisions`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedDivisions = toOptions(items);

        if (!cancelled) {
          setDivisions(fetchedDivisions.length > 0 ? fetchedDivisions : []);
        }
      } catch {
        if (!cancelled) {
          setDivisions([]);
        }
      }
    };

    fetchDivisions();

    return () => {
      cancelled = true;
    };
  }, [standard]);

  const loadDummyStudents = useCallback((isSearch = false) => {
    const queryName = studentName.trim().toLowerCase();
    const queryGrNo = grNo.trim().toLowerCase();

    const filteredStudents = dummyStudents.filter((student) => {
      const matchesStandard = !standard || student.standard === standard;
      const matchesDivision = !division || student.section === division;
      const matchesName = !queryName || student.name.toLowerCase().includes(queryName);
      const matchesGrNo = !queryGrNo || student.grNo.toLowerCase().includes(queryGrNo);
      const matchesMobile = !mobile.trim();

      return matchesStandard && matchesDivision && matchesName && matchesGrNo && matchesMobile;
    });

    setStandards(dummyStandards);
    setDivisions(dummyDivisions);
    setStudents(filteredStudents);
    setSearched(isSearch);
  }, [division, grNo, mobile, standard, studentName]);

  const fetchStudents = useCallback(async (isSearch = false) => {
    if (!session.subInstituteId) {
      setError('Showing dummy data because session data is missing.');
      loadDummyStudents(isSearch);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let token = '';
      let subInstituteId = '';
      let hostName = '';

      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
          const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

          token = readString(userData.user_token ?? userData.token);
          subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
          hostName = readString(userData.host_name);
        } catch {}
      }

      const academicYearId = readString(localStorage.getItem('selectedAcademicYear') || session.academicYearId);

      if (!hostName || !token || !subInstituteId) {
        setError('Showing dummy data because session data is missing.');
        loadDummyStudents(isSearch);
        return;
      }

      const form = new URLSearchParams();
      form.append('sub_institute_id', String(subInstituteId));
      form.append('syear', String(academicYearId));
      form.append('grade', String(level));
      form.append('standard', String(standard));
      form.append('division', String(division));
      form.append('type', 'API');

      const res = await fetch(`${hostName.replace(/\/$/, '')}/fees/fees_collect/show_student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error((errorPayload as Record<string, unknown>).message ? String(errorPayload.message) : `HTTP ${res.status}: Unable to load students`);
      }

      const payload = await res.json();
      const source = payload.data ?? payload;
      const items = Array.isArray(source) ? source : (source.stu_data ?? source.students ?? []);

      setStudents(toStudentRows(items));
      setSearched(isSearch);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load student fees list.';
      setError(`${message} Showing dummy data.`);
      loadDummyStudents(isSearch);
    } finally {
      setLoading(false);
    }
  }, [division, level, loadDummyStudents, session, standard]);

  const totalPending = students.reduce((total, student) => total + student.pendingFees, 0);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[#0D6EFD]">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Fees</h1>
              <p className="mt-1 text-sm text-slate-500">Search students and start fee collection from the action column.</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Pending Fees In Current View</p>
            <p className="text-lg font-bold text-rose-600">{currencyFormatter.format(totalPending)}</p>
          </div>
        </div>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Filter className="h-4 w-4 text-[#0D6EFD]" />
              Search Section
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                fetchStudents(true);
              }}
            >
              <Field label="Search Section">
                <Select value={level} onValueChange={(value) => { setLevel(value ?? ''); setStandard(''); setDivision(''); }}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm">
                    <SelectValue placeholder="Select section">
                      {(selectedValue) => {
                        if (!selectedValue) return 'Select section';
                        const option = levels.find((l) => l.id === selectedValue);
                        return option?.label ?? selectedValue;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Search Standard">
                <Select value={standard} onValueChange={(value) => { setStandard(value ?? ''); setDivision(''); }}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm">
                    <SelectValue placeholder="Select standard">
                      {(selectedValue) => {
                        if (!selectedValue) return 'Select standard';
                        const option = standards.find((s) => s.id === selectedValue);
                        return option?.label ?? selectedValue;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {standards.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Search Division">
                <Select value={division} onValueChange={(value) => setDivision(value ?? '')}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm">
                    <SelectValue placeholder="Select division">
                      {(selectedValue) => {
                        if (!selectedValue) return 'Select division';
                        const option = divisions.find((d) => d.id === selectedValue);
                        return option?.label ?? selectedValue;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              

              <Field label="Student Name">
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Enter student name" className="h-10 rounded-lg border-slate-200 bg-slate-50/70 pl-9 text-sm" />
                </div>
              </Field>

              <Field label="GR No.">
                <Input value={grNo} onChange={(event) => setGrNo(event.target.value)} placeholder="Enter GR number" className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
              </Field>

              <Field label="Mobile">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Enter mobile number" className="h-10 rounded-lg border-slate-200 bg-slate-50/70 pl-9 text-sm" />
                </div>
              </Field>

              <div className="flex items-end">
                <label className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0D6EFD]" />
                  In-active Students
                </label>
              </div>

              <div className="flex items-end md:col-span-2">
                <Button type="submit" disabled={loading} className="h-10 w-full rounded-lg bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90 md:w-auto md:px-6">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Search Student
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-base font-bold text-slate-800">Student List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Student Name</th>
                    <th className="px-5 py-3 font-semibold">GR No</th>
                    <th className="px-5 py-3 font-semibold">Standard</th>
                    <th className="px-5 py-3 font-semibold">Section</th>
                    <th className="px-5 py-3 font-semibold">Pending Fees</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searched ? (
                    students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-medium text-slate-900">{student.name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">{student.grNo}</td>
                        <td className="px-5 py-4 text-slate-600">{student.standard}</td>
                        <td className="px-5 py-4 text-slate-600">{student.section}</td>
                        <td className="px-5 py-4 font-semibold text-rose-600">{currencyFormatter.format(student.pendingFees)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg bg-[#0D6EFD] px-3 text-xs text-white hover:bg-[#0D6EFD]/90"
                            onClick={() => router.push(`/fees/collect/${encodeURIComponent(student.id)}`)}
                          >
                            Collect Fees
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        Use the search section above to find students.
                      </td>
                    </tr>
                  )}
                  {searched && loading && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        Loading student fee records...
                      </td>
                    </tr>
                  )}
                  {searched && !loading && students.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        No students found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function getSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    return {
      token: readString(userData.user_token ?? userData.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      academicYearId: readString(localStorage.getItem('selectedAcademicYear') || (userData.academic_year_id ?? userData.academicYearId)),
      hostName: readString(userData.host_name),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }
}

function toOptions(items: unknown): SelectOption[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record = asRecord(item);
    const id = readString(record.id ?? record.standard_id ?? record.division_id ?? record.section_id ?? record.level_id ?? record.class_id ?? record.value);
    const label = readString(record.name ?? record.standard_name ?? record.division_name ?? record.section_name ?? record.level_name ?? record.class_name ?? record.label ?? record.title);
    return { id, label: label || id };
  }).filter((item) => item.id && item.label);
}

function toStudentRows(items: unknown): StudentFeeRow[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record = asRecord(item);
    const firstName = readString(record.first_name);
    const middleName = readString(record.middle_name);
    const lastName = readString(record.last_name);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    return {
      id: readString(record.id ?? record.student_id ?? record.studentId ?? record.unique_id),
      name: readString(record.student_name ?? record.name ?? record.full_name ?? fullName),
      grNo: readString(record.gr_no ?? record.grNo ?? record.gr_number ?? record.enrollment_no),
      standard: readString(record.standard ?? record.standard_name ?? record.class_name),
      section: readString(record.section ?? record.section_name ?? record.division ?? record.division_name),
      pendingFees: readNumber(record.pending_fees ?? record.pendingFees ?? record.remaining ?? record.balance ?? record.bkoff),
    };
  }).filter((student) => student.id);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
