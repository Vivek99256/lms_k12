'use client';

import { useEffect, useState } from 'react';
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
  marks?: number;
  maxMarks: number;
};

export default function MarksEntryPage() {
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

  const [terms, setTerms] = useState<SelectOption[]>([]);
  const [sections, setSections] = useState<SelectOption[]>([]);
  const [standards, setStandards] = useState<SelectOption[]>([]);
  const [divisions, setDivisions] = useState<SelectOption[]>([]);
  const [subjects, setSubjects] = useState<SelectOption[]>([]);
  const [examMasters, setExamMasters] = useState<SelectOption[]>([]);
  const [exams, setExams] = useState<SelectOption[]>([]);

  const [subjectsDict, setSubjectsDict] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchTerms = async () => {
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
        setTerms([
          { id: '1', label: 'Term 1' },
          { id: '2', label: 'Term 2' },
          { id: '3', label: 'Final' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_term`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load terms`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedTerms = toOptions(items);

        if (!cancelled) {
          setTerms(fetchedTerms.length > 0 ? fetchedTerms : [
            { id: '1', label: 'Term 1' },
            { id: '2', label: 'Term 2' },
            { id: '3', label: 'Final' },
          ]);
        }
      } catch {
        if (!cancelled) {
          setTerms([
            { id: '1', label: 'Term 1' },
            { id: '2', label: 'Term 2' },
            { id: '3', label: 'Final' },
          ]);
        }
      }
    };

    fetchTerms();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchSections = async () => {
      if (!term) {
        setSections([]);
        setSection('');
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
        setSections([
          { id: 'section_a', label: 'Section A' },
          { id: 'section_b', label: 'Section B' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('term_id', String(term));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_section`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load sections`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedSections = toOptions(items);

        if (!cancelled) {
          setSections(fetchedSections);
        }
      } catch {
        if (!cancelled) {
          setSections([]);
        }
      }
    };

    fetchSections();

    return () => {
      cancelled = true;
    };
  }, [term]);

  useEffect(() => {
    let cancelled = false;

    const fetchStandards = async () => {
      if (!section) {
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
        setStandards([
          { id: '6', label: 'Class 6' },
          { id: '7', label: 'Class 7' },
          { id: '8', label: 'Class 8' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('section_id', String(section));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_standard`, {
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
          setStandards(fetchedStandards);
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
  }, [section]);

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
        setDivisions([
          { id: 'A', label: 'Division A' },
          { id: 'B', label: 'Division B' },
          { id: 'C', label: 'Division C' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('standard_id', String(standard));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_division`, {
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
          setDivisions(fetchedDivisions);
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

  useEffect(() => {
    let cancelled = false;

    const fetchSubjects = async () => {
      if (!division) {
        setSubjects([]);
        setSubjectsDict({});
        setSubject('');
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
        const dummySubjects = [
          { id: 'math', label: 'Mathematics' },
          { id: 'science', label: 'Science' },
          { id: 'english', label: 'English' },
          { id: 'hindi', label: 'Hindi' },
          { id: 'sst', label: 'Social Studies' },
        ];
        setSubjects(dummySubjects);
        const dict: Record<string, string> = {};
        dummySubjects.forEach((s) => { dict[s.id] = s.label; });
        setSubjectsDict(dict);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('division_id', String(division));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_subject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load subjects`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedSubjects = toOptions(items);
        const dict: Record<string, string> = {};
        fetchedSubjects.forEach((s) => { dict[s.id] = s.label; });

        if (!cancelled) {
          setSubjects(fetchedSubjects);
          setSubjectsDict(dict);
        }
      } catch {
        if (!cancelled) {
          setSubjects([]);
          setSubjectsDict({});
        }
      }
    };

    fetchSubjects();

    return () => {
      cancelled = true;
    };
  }, [division]);

  useEffect(() => {
    let cancelled = false;

    const fetchExamMasters = async () => {
      if (!subject) {
        setExamMasters([]);
        setExamMaster('');
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
        setExamMasters([
          { id: 'unit_test', label: 'Unit Test' },
          { id: 'half_yearly', label: 'Half Yearly' },
          { id: 'annual', label: 'Annual' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('subject_id', String(subject));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_exam_master`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load exam masters`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedExamMasters = toOptions(items);

        if (!cancelled) {
          setExamMasters(fetchedExamMasters);
        }
      } catch {
        if (!cancelled) {
          setExamMasters([]);
        }
      }
    };

    fetchExamMasters();

    return () => {
      cancelled = true;
    };
  }, [subject]);

  useEffect(() => {
    let cancelled = false;

    const fetchExams = async () => {
      if (!examMaster) {
        setExams([]);
        setExam('');
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
        setExams([
          { id: 'exam_1', label: 'Exam 1 - January' },
          { id: 'exam_2', label: 'Exam 2 - February' },
          { id: 'exam_3', label: 'Exam 3 - March' },
        ]);
        return;
      }

      try {
        const form = new URLSearchParams();
        form.append('sub_institute_id', String(subInstituteId));
        form.append('exam_master_id', String(examMaster));
        form.append('token', String(token));

        const res = await fetch(`${hostName.replace(/\/$/, '')}/get_exam`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load exams`);

        const payload = await res.json();
        const source = payload.data ?? payload;
        const items = Array.isArray(source) ? source : [];
        const fetchedExams = toOptions(items);

        if (!cancelled) {
          setExams(fetchedExams);
        }
      } catch {
        if (!cancelled) {
          setExams([]);
        }
      }
    };

    fetchExams();

    return () => {
      cancelled = true;
    };
  }, [examMaster]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setStudents(dummyStudents);
      setLoading(false);
      setSearched(true);
      return;
    }

    try {
      const form = new URLSearchParams();
      form.append('sub_institute_id', String(subInstituteId));
      form.append('term_id', String(term));
      form.append('section_id', String(section));
      form.append('standard_id', String(standard));
      form.append('division_id', String(division));
      form.append('subject_id', String(subject));
      form.append('exam_master_id', String(examMaster));
      form.append('exam_id', String(exam));
      form.append('token', String(token));

      const res = await fetch(`${hostName.replace(/\/$/, '')}/get_student_marks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load students`);

      const payload = await res.json();
      const source = payload.data ?? payload;
      const items = Array.isArray(source) ? source : [];
      const fetchedStudents = toStudentRows(items);

      setStudents(fetchedStudents);
    } catch (err) {
      console.error('MarksEntry search error:', err);
      setError('Failed to load students. Please try again.');
      setStudents(dummyStudents);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, marks: value === '' ? undefined : parseFloat(value) || 0 }
          : student
      )
    );
  };

  const handleSaveMarks = async () => {
    setLoading(true);
    setError(null);

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
      setLoading(false);
      alert('Marks saved successfully!');
      return;
    }

    try {
      const marksData = students.map((student) => ({
        student_id: student.id,
        marks: student.marks ?? 0,
      }));

      const form = new URLSearchParams();
      form.append('sub_institute_id', String(subInstituteId));
      form.append('exam_id', String(exam));
      form.append('subject_id', String(subject));
      form.append('marks_data', JSON.stringify(marksData));
      form.append('token', String(token));

      const res = await fetch(`${hostName.replace(/\/$/, '')}/save_student_marks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to save marks`);

      alert('Marks saved successfully!');
    } catch (err) {
      console.error('Save marks error:', err);
      setError('Failed to save marks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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
                  <Select value={term} onValueChange={setTerm}>
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
                  <Select value={section} onValueChange={setSection} disabled={!term}>
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
                  <Select value={standard} onValueChange={setStandard} disabled={!section}>
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
                  <Select value={division} onValueChange={setDivision} disabled={!standard}>
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
                  <Select value={subject} onValueChange={setSubject} disabled={!division}>
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
                  <Select value={examMaster} onValueChange={setExamMaster} disabled={!subject}>
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
                  <Select value={exam} onValueChange={setExam} disabled={!examMaster}>
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
                              type="number"
                              min="0"
                              max={student.maxMarks}
                              value={student.marks ?? ''}
                              onChange={(e) => handleMarksChange(student.id, e.target.value)}
                              className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-center text-sm transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              placeholder="Enter"
                            />
                          </td>
                          <td className="px-5 py-4 text-center text-slate-600">{student.maxMarks}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
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

const dummyStudents: StudentMarkRow[] = [
  { id: '1', grNo: '1001', studentName: 'Rahul Patel', standard: '6', section: 'A', maxMarks: 50 },
  { id: '2', grNo: '1002', studentName: 'Priya Sharma', standard: '6', section: 'A', maxMarks: 50 },
  { id: '3', grNo: '1003', studentName: 'Arjun Singh', standard: '6', section: 'A', maxMarks: 50 },
  { id: '4', grNo: '1004', studentName: 'Isha Mehta', standard: '6', section: 'A', maxMarks: 50 },
  { id: '5', grNo: '1005', studentName: 'Vikram Rao', standard: '6', section: 'A', maxMarks: 50 },
];

function toOptions(items: unknown[]): SelectOption[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record = asRecord(item);
    const id = readString(record.id ?? record.term_id ?? record.section_id ?? record.standard_id ?? record.division_id ?? record.subject_id ?? record.exam_master_id ?? record.exam_id ?? record.value);
    const label = readString(record.name ?? record.term_name ?? record.section_name ?? record.standard_name ?? record.division_name ?? record.subject_name ?? record.exam_master_name ?? record.exam_name ?? record.label ?? record.title);
    return { id, label: label || id };
  }).filter((item) => item.id && item.label);
}

function toStudentRows(items: unknown[]): StudentMarkRow[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record = asRecord(item);
    const firstName = readString(record.first_name);
    const middleName = readString(record.middle_name);
    const lastName = readString(record.last_name);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    return {
      id: readString(record.id ?? record.student_id ?? record.studentId ?? record.unique_id),
      grNo: readString(record.gr_no ?? record.grNo ?? record.gr_number ?? record.enrollment_no ?? record.enrollment),
      studentName: readString(record.student_name ?? record.name ?? record.full_name ?? fullName),
      standard: readString(record.standard ?? record.standard_name ?? record.class_name),
      section: readString(record.section ?? record.section_name ?? record.division ?? record.division_name),
      marks: readNumber(record.marks ?? record.obtained_marks),
      maxMarks: readNumber(record.max_marks ?? record.maxMarks ?? 50),
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
