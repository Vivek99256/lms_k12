'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Edit3, FileHeart, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { searchInfirmaryStudents, type StudentOption } from '@/app/student/student_infirmary/api';
import { deleteCareRecord, listCareRecords, saveCareRecord, type CareModule, type CareRecord } from './student-care-api';

export type CareField = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'textarea' | 'select' | 'file';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export type CareConfig = {
  module: CareModule;
  title: string;
  singular: string;
  fields: CareField[];
};

export default function StudentCareModule({ config }: { config: CareConfig }) {
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [form, setForm] = useState<CareRecord>({ id: '', student_id: '', student_name: '' });
  const [editingId, setEditingId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const freshForm = () => Object.fromEntries([
    ['id', ''], ['student_id', ''], ['student_name', ''],
    ...config.fields.map((field) => [field.key, field.type === 'date' ? new Date().toISOString().slice(0, 10) : '']),
  ]) as CareRecord;

  const load = async () => setRecords(await listCareRecords(config.module));

  useEffect(() => {
    const controller = new AbortController();
    listCareRecords(config.module, controller.signal).then(setRecords).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load records.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [config.module]);

  useEffect(() => {
    if (studentQuery.trim().length < 2 || form.student_id) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => searchInfirmaryStudents(studentQuery, controller.signal).then(setStudentOptions).catch(() => setStudentOptions([])), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [studentQuery, form.student_id]);

  const shown = useMemo(() => {
    const query = filter.toLowerCase();
    return records.filter((record) => !query || Object.values(record).some((value) => value.toLowerCase().includes(query)));
  }, [filter, records]);

  const openCreate = () => {
    setEditingId(''); setForm(freshForm()); setStudentQuery(''); setStudentOptions([]); setShowForm(true); setError('');
  };
  const openEdit = (record: CareRecord) => {
    setEditingId(record.id); setForm({ ...record }); setStudentQuery(record.student_name); setStudentOptions([]); setShowForm(true); setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.student_id) { setError('Select a student from the search results.'); return; }
    setSaving(true); setError('');
    try { setMessage(await saveCareRecord(config.module, form, editingId || undefined)); setShowForm(false); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save record.'); }
    finally { setSaving(false); }
  };
  const remove = async (record: CareRecord) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()} record?`)) return;
    try { setMessage(await deleteCareRecord(config.module, record.id)); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete record.'); }
  };
  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading {config.title.toLowerCase()}…</div>;

  return <div className="space-y-5 p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-bold text-slate-950">{config.title}</h1><p className="mt-1 text-sm text-slate-500">Manage student {config.singular.toLowerCase()} records.</p></div>
      <button type="button" onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />Add {config.singular}</button>
    </div>
    {(error || message) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search records" className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" /></div>
        <span className="ml-3 whitespace-nowrap text-sm text-slate-500">{records.length} records</span>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50"><tr><th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Student</th>{config.fields.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">{field.label}</th>)}<th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{shown.map((record) => <tr key={record.id} className="hover:bg-slate-50">
          <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-slate-900">{record.student_name}</td>
          {config.fields.map((field) => <td key={field.key} className="max-w-64 truncate whitespace-nowrap px-3 py-3 text-sm text-slate-600">{field.type === 'file' && record[field.key] ? <span className="text-indigo-600">Attached</span> : record[field.key] || '-'}</td>)}
          <td className="px-3 py-3"><div className="flex"><button type="button" onClick={() => openEdit(record)} className="rounded p-2 text-indigo-600 hover:bg-indigo-50"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => remove(record)} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
        </tr>)}{shown.length === 0 && <tr><td colSpan={config.fields.length + 2} className="py-14 text-center text-sm text-slate-500"><FileHeart className="mx-auto mb-2 h-8 w-8 text-slate-300" />No records found.</td></tr>}</tbody>
      </table></div>
    </section>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" aria-label="Close" onClick={() => setShowForm(false)} className="absolute inset-0 bg-slate-950/50" /><div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><h2 className="text-lg font-bold">{editingId ? 'Edit' : 'Add'} {config.singular}</h2><button type="button" onClick={() => setShowForm(false)} className="rounded p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <form onSubmit={submit} className="space-y-4 p-6">
        <label className="relative block space-y-1"><span className="text-xs font-medium text-slate-700">Student</span><input required readOnly={Boolean(editingId)} value={studentQuery} onChange={(event) => { setStudentQuery(event.target.value); setStudentOptions([]); setValue('student_id', ''); }} placeholder="Type student name or GR No." className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm read-only:bg-slate-50" />{studentOptions.length > 0 && <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">{studentOptions.map((student) => <button key={student.id} type="button" onClick={() => { setStudentQuery(`${student.enrollmentNo} / ${student.name}`); setForm((current) => ({ ...current, student_id: student.id, student_name: student.name })); setStudentOptions([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{student.name}<span className="ml-2 text-slate-400">{student.enrollmentNo}</span></button>)}</div>}</label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{config.fields.map((field) => <CareInput key={field.key} field={field} value={form[field.key] ?? ''} onChange={(value) => setValue(field.key, value)} onFile={(name, data) => setForm((current) => ({ ...current, file_name: name, file_data: data }))} />)}</div>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-md border px-4 text-sm font-medium">Cancel</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? 'Update' : 'Save'}</button></div>
      </form>
    </div></div>}
  </div>;
}

function CareInput({ field, value, onChange, onFile }: { field: CareField; value: string; onChange: (value: string) => void; onFile: (name: string, data: string) => void }) {
  if (field.type === 'textarea') return <label className="space-y-1 md:col-span-2"><span className="text-xs font-medium text-slate-700">{field.label}</span><textarea required={field.required} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>;
  if (field.type === 'select') return <label className="space-y-1"><span className="text-xs font-medium text-slate-700">{field.label}</span><select required={field.required} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Select {field.label}</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.type === 'file') return <label className="space-y-1 md:col-span-2"><span className="text-xs font-medium text-slate-700">{field.label}</span><input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onFile(file.name, String(reader.result)); reader.readAsDataURL(file); }} className="block w-full rounded-md border border-slate-200 p-2 text-sm" /></label>;
  return <label className="space-y-1"><span className="text-xs font-medium text-slate-700">{field.label}</span><input required={field.required} type={field.type ?? 'text'} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>;
}
