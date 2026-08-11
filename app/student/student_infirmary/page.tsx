'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, Edit3, Loader2, Plus, Search, Stethoscope, Trash2, X } from 'lucide-react';
import {
  deleteInfirmaryRecord,
  getInfirmaryRecords,
  saveInfirmaryRecord,
  searchInfirmaryStudents,
  type InfirmaryForm,
  type InfirmaryRecord,
  type StudentOption,
} from './api';

const emptyForm = (caseNumber = ''): InfirmaryForm => ({
  student_id: '',
  student_name: '',
  medical_case_no: caseNumber,
  doctor_name: '',
  doctor_contact: '',
  date: new Date().toISOString().slice(0, 10),
  complaint: '',
  symptoms: '',
  disease: '',
  treatments: '',
  medical_close_date: '',
  health_center: '',
});

export default function StudentInfirmaryPage() {
  const [records, setRecords] = useState<InfirmaryRecord[]>([]);
  const [nextCaseNumber, setNextCaseNumber] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<InfirmaryForm>(emptyForm());
  const [editingId, setEditingId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadRecords = async () => {
    const data = await getInfirmaryRecords();
    setRecords(data.records);
    setNextCaseNumber(data.nextCaseNumber);
  };

  useEffect(() => {
    const controller = new AbortController();
    getInfirmaryRecords(controller.signal).then((data) => {
      setRecords(data.records);
      setNextCaseNumber(data.nextCaseNumber);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load infirmary records.');
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (studentQuery.trim().length < 2 || form.student_id) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchInfirmaryStudents(studentQuery.trim(), controller.signal)
        .then(setStudentOptions)
        .catch(() => setStudentOptions([]));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [studentQuery, form.student_id]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [studentOptions]);

  useEffect(() => {
    if (highlightedIndex < 0 || studentOptions.length === 0) return;
    const option = document.querySelector(`#infirmary-student-options [data-index="${highlightedIndex}"]`);
    (option as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, studentOptions]);

  const selectStudent = (student: StudentOption) => {
    setStudentQuery(`${student.enrollmentNo} / ${student.name}`);
    setForm((current) => ({ ...current, student_id: student.id, student_name: student.name }));
    setStudentOptions([]);
    setHighlightedIndex(-1);
  };

  const filteredRecords = useMemo(() => {
    const query = filter.toLowerCase().trim();
    if (!query) return records;
    return records.filter((record) => [
      record.student_name, record.medical_case_no, record.doctor_name,
      record.complaint, record.disease, record.health_center,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [filter, records]);

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm(nextCaseNumber));
    setStudentQuery('');
    setStudentOptions([]);
    setShowForm(true);
    setError('');
  };

  const openEdit = (record: InfirmaryRecord) => {
    setEditingId(record.id);
    setForm({ ...record });
    setStudentQuery(record.student_name);
    setStudentOptions([]);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.student_id) {
      setError('Please select a student from the search results.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      setMessage(await saveInfirmaryRecord(form, editingId || undefined));
      setShowForm(false);
      await loadRecords();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save infirmary record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (record: InfirmaryRecord) => {
    if (!window.confirm(`Delete infirmary case ${record.medical_case_no}?`)) return;
    setError('');
    try {
      setMessage(await deleteInfirmaryRecord(record.id));
      await loadRecords();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete infirmary record.');
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading infirmary…</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Student Infirmary</h1>
          <p className="mt-1 text-sm text-slate-500">Manage medical visits, complaints, treatments and case closure.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" />Add Infirmary Record
        </button>
      </div>

      {(error || message) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary title="Total cases" value={records.length} icon={<Activity className="h-5 w-5" />} />
        <Summary title="Open cases" value={records.filter((record) => !record.medical_close_date).length} icon={<Stethoscope className="h-5 w-5" />} />
        <Summary title="Closed cases" value={records.filter((record) => record.medical_close_date).length} icon={<Stethoscope className="h-5 w-5" />} />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search student, case, doctor or complaint" className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr>{['Student', 'Case No.', 'Doctor', 'Contact', 'Open Date', 'Complaint', 'Symptoms', 'Disease', 'Treatments', 'Close Date', 'Health Center', 'Actions'].map((header) => <th key={header} className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => <tr key={record.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-slate-900">{record.student_name}</td>
                <td className="px-3 py-3 text-sm text-slate-700">{record.medical_case_no}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">{record.doctor_name || '-'}</td>
                <td className="px-3 py-3 text-sm text-slate-600">{record.doctor_contact || '-'}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">{record.date}</td>
                <td className="max-w-48 truncate px-3 py-3 text-sm text-slate-600">{record.complaint || '-'}</td>
                <td className="max-w-48 truncate px-3 py-3 text-sm text-slate-600">{record.symptoms || '-'}</td>
                <td className="max-w-48 truncate px-3 py-3 text-sm text-slate-600">{record.disease || '-'}</td>
                <td className="max-w-48 truncate px-3 py-3 text-sm text-slate-600">{record.treatments || '-'}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">{record.medical_close_date || 'Open'}</td>
                <td className="px-3 py-3 text-sm text-slate-600">{record.health_center || '-'}</td>
                <td className="px-3 py-3"><div className="flex gap-1">
                  <button type="button" onClick={() => openEdit(record)} className="rounded p-2 text-indigo-600 hover:bg-indigo-50" title="Edit"><Edit3 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => handleDelete(record)} className="rounded p-2 text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>)}
              {filteredRecords.length === 0 && <tr><td colSpan={12} className="px-4 py-14 text-center text-sm text-slate-500">No infirmary records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" onClick={() => setShowForm(false)} className="absolute inset-0 bg-slate-950/50" />
        <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit' : 'Add'} Student Infirmary</h2>
            <button type="button" onClick={() => setShowForm(false)} className="rounded p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="relative space-y-1 md:col-span-2">
                <span className="text-xs font-medium text-slate-700">Student</span>
                <input required readOnly={Boolean(editingId)} value={studentQuery} onChange={(event) => {
                  setStudentQuery(event.target.value);
                  setStudentOptions([]);
                  setForm((current) => ({ ...current, student_id: '', student_name: event.target.value }));
                }} onKeyDown={(event) => {
                  if (studentOptions.length === 0) return;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setHighlightedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, studentOptions.length - 1)));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setHighlightedIndex((prev) => (prev <= 0 ? -1 : prev - 1));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    selectStudent(studentOptions[highlightedIndex >= 0 ? highlightedIndex : 0]);
                  } else if (event.key === 'Escape') {
                    setStudentOptions([]);
                    setHighlightedIndex(-1);
                  }
                }} placeholder="Type student name or GR No." className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 read-only:bg-slate-50" />
                {studentOptions.length > 0 && <div id="infirmary-student-options" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {studentOptions.map((student, index) => <button key={student.id} type="button" data-index={index} onClick={() => selectStudent(student)} className={`block w-full px-3 py-2 text-left text-sm ${index === highlightedIndex ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}><span className="font-medium">{student.name}</span><span className="ml-2 text-slate-400">{student.enrollmentNo}</span></button>)}
                </div>}
              </label>
              <Field label="Medical Case No." value={form.medical_case_no} onChange={(value) => setForm((current) => ({ ...current, medical_case_no: value }))} readOnly />
              <Field label="Doctor Name" value={form.doctor_name} onChange={(value) => setForm((current) => ({ ...current, doctor_name: value }))} />
              <Field label="Doctor Contact" value={form.doctor_contact} onChange={(value) => setForm((current) => ({ ...current, doctor_contact: value }))} />
              <Field label="Open Date" type="date" value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} required />
              <Field label="Complaint" value={form.complaint} onChange={(value) => setForm((current) => ({ ...current, complaint: value }))} />
              <Field label="Symptoms" value={form.symptoms} onChange={(value) => setForm((current) => ({ ...current, symptoms: value }))} />
              <Field label="Disease" value={form.disease} onChange={(value) => setForm((current) => ({ ...current, disease: value }))} />
              <Field label="Treatments" value={form.treatments} onChange={(value) => setForm((current) => ({ ...current, treatments: value }))} />
              <Field label="Close Date" type="date" value={form.medical_close_date} onChange={(value) => setForm((current) => ({ ...current, medical_close_date: value }))} />
              <Field label="Health Center" value={form.health_center} onChange={(value) => setForm((current) => ({ ...current, health_center: value }))} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700">Cancel</button>
              <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white disabled:opacity-60">{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}

function Summary({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-sm text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div><span className="rounded-lg bg-indigo-50 p-3 text-indigo-600">{icon}</span></div>;
}

function Field({ label, value, onChange, type = 'text', readOnly = false, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean; required?: boolean }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-slate-700">{label}</span><input type={type} value={value} readOnly={readOnly} required={required} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 read-only:bg-slate-50" /></label>;
}
