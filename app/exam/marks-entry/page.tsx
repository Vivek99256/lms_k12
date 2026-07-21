'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search, FileText, BookOpen, Users, GraduationCap, Layers, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

type SelectOption = {
  id: string;
  label: string;
};

type StudentMarkRow = {
  id: string;
  grNo: string;
  studentName: string;
  standard: string;
  section: string;
  marks: string;
  maxMarks: number;
  percentage: number;
  grade: string;
  comment: string;
};

type MarksSession = {
  token: string;
  subInstituteId: string;
  userId: string;
  syear: string;
};

export default function MarksEntryPage() {
  const { academicTerms } = useAuth();
  const [term, setTerm] = useState('');
  const [section, setSection] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [subject, setSubject] = useState('');
  const [examMaster, setExamMaster] = useState('');
  const [exam, setExam] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [students, setStudents] = useState<StudentMarkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gradeRanges, setGradeRanges] = useState<Record<string, number[]>>({});

  const terms = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return toOptions(academicTerms.filter((item) => {
      const year = readString(item.syear);
      return !selectedAcademicYear || !year || year === selectedAcademicYear;
    }));
  }, [academicTerms]);
  const [sections, setSections] = useState<SelectOption[]>([]);
  const [standards, setStandards] = useState<SelectOption[]>([]);
  const [divisions, setDivisions] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [examMasters, setExamMasters] = useState<SelectOption[]>([]);
  const [exams, setExams] = useState<SelectOption[]>([]);

  const [subjectsDict, setSubjectsDict] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!term) return;
    return loadOptions('api/get-grade-list', {}, setSections, 'sections');
  }, [term]);

  useEffect(() => {
    if (!section) return;
    return loadOptions('api/get-standard-list', { grade_id: section, type: 'webForm' }, setStandards, 'standards');
  }, [section]);

  useEffect(() => {
    if (!standard) return;
    return loadOptions('api/get-division-list', { standard_id: standard, type: 'webForm' }, setDivisions, 'divisions');
  }, [standard]);

  useEffect(() => {
    if (!division) return;
    return loadOptions(
      'api/get-subject-list',
      { standard_id: standard, division_id: division },
      (options) => {
        setSubjects(options);
        setSubjectsDict(Object.fromEntries(options.map((option) => [option.id, option.label])));
      },
      'subjects',
    );
  }, [division, standard]);

  useEffect(() => {
    if (!subject) return;
    return loadOptions(
      'api/get-exam-master-list',
      { standard_id: standard, term_id: term },
      setExamMasters,
      'exam masters',
    );
  }, [subject, standard, term]);

  useEffect(() => {
    if (!examMaster) return;
    return loadOptions(
      'api/get-exam-list',
      { standard_id: standard, subject_id: subject, term_id: term, exam_id: examMaster },
      setExams,
      'exams',
    );
  }, [examMaster, standard, subject, term]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const session = getMarksSession();

    if (!session.subInstituteId) {
      setStudents([]);
      setError('Session data is missing.');
      setLoading(false);
      setSearched(true);
      return;
    }

    try {
      const payload = await proxyRequest('result/marks_entry/create', {
        type: 'API',
        term,
        grade: section,
        standard,
        division,
        subject,
        exam_master: examMaster,
        exam,
      });
      const source = asRecord(payload.data ?? payload);
      const ranges = toGradeRanges(source.grd_data);
      setGradeRanges(ranges);
      setStudents(toStudentRows(source.stu_data, {
        standard: findLabel(standards, standard),
        division: findLabel(divisions, division),
      }));
    } catch (err) {
      console.error('MarksEntry search error:', err);
      setError('Failed to load students. Please try again.');
      setStudents([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? (() => {
              const percentage = calculatePercentage(value, student.maxMarks);
              return { ...student, marks: value, percentage, grade: findGrade(percentage, value, gradeRanges) };
            })()
          : student
      )
    );
  };

  const handleSaveMarks = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const session = getMarksSession();

    if (!session.subInstituteId) {
      setLoading(false);
      setError('Session data is missing. No marks were saved.');
      return;
    }

    try {
      const invalidRow = students.find((student) => !isValidMark(student.marks, student.maxMarks));
      if (invalidRow) throw new Error(`Invalid marks for ${invalidRow.studentName}. Use a number up to ${invalidRow.maxMarks}, AB, N.A., or EX.`);
      const marksData = Object.fromEntries(students.map((student) => [student.id, {
        exam_id: exam,
        points: student.marks,
        per: student.percentage,
        grade: student.grade || '-',
        comment: student.comment,
      }]));

      const form = new URLSearchParams();
      form.append('sub_institute_id', session.subInstituteId);
      form.append('type', 'API');
      form.append('data', JSON.stringify(marksData));
      if (session.token) form.append('token', session.token);

      const res = await fetch('/api/proxy?path=result%2Fmarks_entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to save marks`);

      const payload = await res.json().catch(() => ({})) as { status?: string | number; message?: string };
      if (String(payload.status ?? '') !== '1') throw new Error(payload.message || 'Laravel did not confirm that marks were saved.');
      setError(null);
      setSuccess(payload.message || 'Marks saved successfully.');
    } catch (err) {
      console.error('Save marks error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save marks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen  p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Marks Entry</h1>
              <p className="text-sm text-slate-500">Enter and manage student examination marks</p>
            </div>
          </div>
        </div>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Search className="h-4 w-4" />
              </div>
              Search Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Field label="Select Term" icon={<Calendar />}>
                  <Select value={term} onValueChange={(value) => {
                    setTerm(value ?? '');
                    setSection(''); setSections([]); setStandard(''); setStandards([]); setDivision(''); setDivisions([]);
                    setSubject(''); setSubjects([]); setSubjectsDict({}); setExamMaster(''); setExamMasters([]); setExam(''); setExams([]);
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      {terms.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Search Section" icon={<Users />}>
                  <Select value={section} onValueChange={(value) => {
                    setSection(value ?? '');
                    setStandard(''); setStandards([]); setDivision(''); setDivisions([]); setSubject(''); setSubjects([]); setSubjectsDict({});
                    setExamMaster(''); setExamMasters([]); setExam(''); setExams([]);
                  }} disabled={!term}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Search Standard" icon={<GraduationCap />}>
                  <Select value={standard} onValueChange={(value) => {
                    setStandard(value ?? '');
                    setDivision(''); setDivisions([]); setSubject(''); setSubjects([]); setSubjectsDict({}); setExamMaster(''); setExamMasters([]); setExam(''); setExams([]);
                  }} disabled={!section}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {standards.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Search Division" icon={<Layers />}>
                  <Select value={division} onValueChange={(value) => {
                    setDivision(value ?? '');
                    setSubject(''); setSubjects([]); setSubjectsDict({}); setExamMaster(''); setExamMasters([]); setExam(''); setExams([]);
                  }} disabled={!standard}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Select Subject" icon={<BookOpen />}>
                  <Select value={subject} onValueChange={(value) => {
                    setSubject(value ?? ''); setExamMaster(''); setExamMasters([]); setExam(''); setExams([]);
                  }} disabled={!division}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Select Exam Master" icon={<FileText />}>
                  <Select value={examMaster} onValueChange={(value) => { setExamMaster(value ?? ''); setExam(''); setExams([]); }} disabled={!subject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select exam master" />
                    </SelectTrigger>
                    <SelectContent>
                      {examMasters.map((em) => (
                        <SelectItem key={em.id} value={em.id}>
                          {em.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Select Exam" icon={<ClipboardList />}>
                  <Select value={exam} onValueChange={(value) => setExam(value ?? '')} disabled={!examMaster}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={!term || !section || !standard || !division || !subject || !examMaster || !exam || loading}
                  className="h-10 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Searching...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Search
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  Student List - {subjectsDict[subject] || 'Subject'}
                </CardTitle>
                {searched && students.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleSaveMarks}
                    disabled={loading}
                    className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </span>
                    ) : (
                      'Save Marks'
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && (
                <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>
              )}
              {success && (
                <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">{success}</div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-semibold">Sr. No</th>
                      <th className="px-5 py-3 font-semibold">GR No</th>
                      <th className="px-5 py-3 font-semibold">Student Name</th>
                      <th className="px-5 py-3 font-semibold">Standard</th>
                      <th className="px-5 py-3 font-semibold">Division</th>
                      <th className="px-5 py-3 text-center font-semibold">Marks</th>
                      <th className="px-5 py-3 text-center font-semibold">Max Marks</th>
                      <th className="px-5 py-3 text-center font-semibold">Percentage</th>
                      <th className="px-5 py-3 text-center font-semibold">Grade</th>
                      <th className="px-5 py-3 font-semibold">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length > 0 ? (
                      students.map((student, index) => (
                        <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-4 text-slate-600">{index + 1}</td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-600">{student.grNo}</td>
                          <td className="px-5 py-4 font-medium text-slate-900">{student.studentName}</td>
                          <td className="px-5 py-4 text-slate-600">{student.standard}</td>
                          <td className="px-5 py-4 text-slate-600">{student.section}</td>
                          <td className="px-5 py-4">
                            <input
                              type="text"
                              value={student.marks}
                              onChange={(e) => handleMarksChange(student.id, e.target.value)}
                              className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-center text-sm transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              placeholder="Enter"
                            />
                          </td>
                          <td className="px-5 py-4 text-center text-slate-600">{student.maxMarks}</td>
                          <td className="px-5 py-4 text-center text-slate-600">{student.percentage.toFixed(2)}%</td>
                          <td className="px-5 py-4 text-center text-slate-600">{student.grade || '-'}</td>
                          <td className="px-5 py-4">
                            <textarea
                              value={student.comment}
                              onChange={(event) => setStudents((current) => current.map((row) => row.id === student.id ? { ...row, comment: event.target.value } : row))}
                              rows={2}
                              className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-5 py-12 text-center text-sm text-slate-500">
                          No students found for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {icon && <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500 [&_svg]:size-3">{icon}</span>}
        {label}
      </Label>
      {children}
    </div>
  );
}

function toOptions(items: unknown): SelectOption[] {
  const record = asRecord(items);
  if (!Array.isArray(items) && Object.keys(record).length > 0 && Object.values(record).every((value) => typeof value !== 'object')) {
    return Object.entries(record).map(([id, label]) => ({ id, label: readString(label) })).filter((item) => item.id && item.label);
  }

  return toCollection(items).map((item) => {
    const record = asRecord(item);
    const id = readString(record.id ?? record.term_id ?? record.section_id ?? record.standard_id ?? record.division_id ?? record.subject_id ?? record.exam_master_id ?? record.exam_id ?? record.value);
    const label = readString(record.name ?? record.term_name ?? record.section_name ?? record.standard_name ?? record.division_name ?? record.subject_name ?? record.exam_master_name ?? record.exam_name ?? record.label ?? record.title);
    return { id, label: label || id };
  }).filter((item) => item.id && item.label);
}

function toStudentRows(items: unknown, fallback: { standard: string; division: string }): StudentMarkRow[] {
  return toCollection(items).map((item) => {
    const record = asRecord(item);
    const firstName = readString(record.first_name);
    const middleName = readString(record.middle_name);
    const lastName = readString(record.last_name);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    return {
      id: readString(record.id ?? record.student_id ?? record.studentId ?? record.unique_id),
      grNo: readString(record.roll_no ?? record.gr_no ?? record.grNo ?? record.gr_number ?? record.enrollment_no ?? record.enrollment),
      studentName: readString(record.student_name ?? record.name ?? record.full_name ?? fullName),
      standard: readString(record.standard ?? record.standard_name ?? record.class_name) || fallback.standard,
      section: readString(record.section ?? record.section_name ?? record.division ?? record.division_name) || fallback.division,
      marks: readString(record.points ?? record.marks ?? record.obtained_marks),
      maxMarks: readNumber(record.outof ?? record.max_marks ?? record.maxMarks),
      percentage: readNumber(record.per ?? record.percentage),
      grade: readString(record.grade),
      comment: readString(record.comment ?? record.remark),
    };
  }).filter((student) => student.id);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toCollection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

function readString(value: unknown): string {
  return value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function isValidMark(value: string, maxMarks: number): boolean {
  const normalized = value.trim().toUpperCase();
  if (['AB', 'N.A.', 'EX'].includes(normalized)) return true;
  if (normalized === '') return true;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= maxMarks;
}

function calculatePercentage(value: string, maxMarks: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && maxMarks > 0 ? Number(((numericValue / maxMarks) * 100).toFixed(2)) : 0;
}

function getMarksSession(): MarksSession {
  if (typeof window === 'undefined') return { token: '', subInstituteId: '', userId: '', syear: '' };
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    return {
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      syear: readString(localStorage.getItem('selectedAcademicYear') ?? userData.syear ?? menuContext.syear),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', syear: '' };
  }
}

async function proxyRequest(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const session = getMarksSession();
  const query = new URLSearchParams({
    path,
    ...params,
    ...(session.subInstituteId ? { sub_institute_id: session.subInstituteId } : {}),
    ...(session.userId ? { user_id: session.userId } : {}),
    ...(session.syear ? { syear: session.syear } : {}),
    ...(session.token ? { token: session.token } : {}),
  });
  const response = await fetch(`/api/proxy?${query.toString()}`, {
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || `HTTP ${response.status}: Request failed`);
  }
  return payload;
}

function loadOptions(
  path: string,
  params: Record<string, string>,
  setter: (options: SelectOption[]) => void,
  label: string,
): () => void {
  let cancelled = false;
  void proxyRequest(path, params)
    .then((payload) => {
      if (!cancelled) setter(toOptions(payload.data ?? payload));
    })
    .catch((error: unknown) => {
      console.error(`Failed to load ${label}:`, error);
      if (!cancelled) setter([]);
    });
  return () => { cancelled = true; };
}

function findLabel(options: SelectOption[], id: string): string {
  return options.find((option) => option.id === id)?.label || id;
}

function toGradeRanges(value: unknown): Record<string, number[]> {
  const ranges: Record<string, number[]> = {};
  for (const [grade, range] of Object.entries(asRecord(value))) {
    const values = Array.isArray(range) ? range : Object.values(asRecord(range));
    ranges[grade] = values.map(Number).filter(Number.isFinite);
  }
  return ranges;
}

function findGrade(percentage: number, mark: string, ranges: Record<string, number[]>): string {
  if (!Number.isFinite(Number(mark))) return '-';
  const rounded = Math.round(percentage);
  return Object.entries(ranges).find(([, range]) => range.includes(rounded))?.[0] || '-';
}
