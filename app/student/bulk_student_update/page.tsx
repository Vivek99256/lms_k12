'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Loader2, Save, Search, Settings2, Users } from 'lucide-react';
import {
  fetchAcademicSections,
  fetchDivisions,
  fetchStandards,
  type StudentSearchOption,
} from '@/app/students/search_student/api';
import {
  getBulkMetadata,
  saveBulkStudents,
  searchBulkStudents,
  type BulkField,
  type BulkOptions,
  type BulkStudentRow,
} from './api';

const DEFAULT_FIELDS = ['enrollment_no', 'first_name', 'last_name', 'roll_no'];

export default function BulkStudentUpdatePage() {
  const [fields, setFields] = useState<BulkField[]>([]);
  const [options, setOptions] = useState<BulkOptions>({});
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_FIELDS);
  const [sections, setSections] = useState<StudentSearchOption[]>([]);
  const [standards, setStandards] = useState<StudentSearchOption[]>([]);
  const [divisions, setDivisions] = useState<StudentSearchOption[]>([]);
  const [grade, setGrade] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [orderBy, setOrderBy] = useState('student_name');
  const [showFields, setShowFields] = useState(false);
  const [rows, setRows] = useState<BulkStudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getBulkMetadata(controller.signal),
      fetchAcademicSections(controller.signal),
    ]).then(([metadata, sectionOptions]) => {
      setFields(metadata.fields);
      setOptions(metadata.options);
      setSections(sectionOptions);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load bulk update.');
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!grade) return;
    const controller = new AbortController();
    fetchStandards(grade, controller.signal).then(setStandards).catch(() => setStandards([]));
    return () => controller.abort();
  }, [grade]);

  useEffect(() => {
    if (!standard) return;
    const controller = new AbortController();
    fetchDivisions(standard, controller.signal).then(setDivisions).catch(() => setDivisions([]));
    return () => controller.abort();
  }, [standard]);

  const selectedDefinitions = useMemo(
    () => selectedFields.map((key) => fields.find((field) => field.key === key)).filter((field): field is BulkField => Boolean(field)),
    [fields, selectedFields],
  );

  const handleSearch = async () => {
    if (selectedFields.length === 0) {
      setError('Select at least one field to update.');
      setShowFields(true);
      return;
    }
    setIsSearching(true);
    setError('');
    setMessage('');
    try {
      setRows(await searchBulkStudents({ grade, standard, division, orderBy, fields: selectedFields }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to search students.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (rows.length === 0) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      setMessage(await saveBulkStudents(rows, selectedFields));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update students.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateCell = (studentId: string, field: string, value: string) => {
    setRows((current) => current.map((row) => row.id === studentId ? { ...row, [field]: value } : row));
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading bulk update…</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Bulk Student Update</h1>
        <p className="mt-1 text-sm text-slate-500">Search students and update selected fields in one place.</p>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect label="Section" value={grade} onChange={(value) => {
            setGrade(value); setStandard(''); setDivision(''); setStandards([]); setDivisions([]);
          }} options={sections} placeholder="All Sections" />
          <FilterSelect label="Standard" value={standard} onChange={(value) => {
            setStandard(value); setDivision(''); setDivisions([]);
          }} options={standards} placeholder={grade ? 'All Standards' : 'Select Section first'} disabled={!grade} />
          <FilterSelect label="Division" value={division} onChange={setDivision} options={divisions} placeholder={standard ? 'All Divisions' : 'Select Standard first'} disabled={!standard} />
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Order By</span>
            <select value={orderBy} onChange={(event) => setOrderBy(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500">
              <option value="student_name">Student Name</option>
              <option value="standard_id">Standard</option>
              <option value="enrollment_no">GR No.</option>
              <option value="roll_no">Roll No.</option>
              <option value="last_name">Last Name</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setShowFields((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Settings2 className="h-4 w-4" />Choose Fields ({selectedFields.length})
          </button>
          <button type="button" onClick={handleSearch} disabled={isSearching} className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search
          </button>
        </div>

        {showFields && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Fields to update</span>
              <button type="button" onClick={() => setSelectedFields(selectedFields.length === fields.length ? [] : fields.map((field) => field.key))} className="text-xs font-medium text-indigo-600">
                {selectedFields.length === fields.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {fields.map((field) => (
                <label key={field.key} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => setSelectedFields((current) => current.includes(field.key) ? current.filter((key) => key !== field.key) : [...current, field.key])} />
                  {field.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4 text-indigo-600" />{rows.length} students</div>
          <button type="button" onClick={handleSave} disabled={isSaving || rows.length === 0} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Update Students
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Student</th>
              {selectedDefinitions.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">{field.label}</th>)}
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Updated On</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{row.student_name}</td>
                {selectedDefinitions.map((field) => <td key={field.key} className="min-w-44 px-3 py-2">
                  {field.type === 'select' ? (
                    <select value={row[field.key] ?? ''} onChange={(event) => updateCell(row.id, field.key, event.target.value)} className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm">
                      <option value="">Select {field.label}</option>
                      {(options[field.key] ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input type={field.type} value={row[field.key] ?? ''} onChange={(event) => updateCell(row.id, field.key, event.target.value)} className="h-9 w-full rounded border border-slate-200 px-2 text-sm outline-none focus:border-indigo-500" />
                  )}
                </td>)}
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{row.updated_on || '-'}</td>
              </tr>)}
              {rows.length === 0 && <tr><td colSpan={selectedDefinitions.length + 2} className="px-4 py-14 text-center text-sm text-slate-500"><CheckSquare className="mx-auto mb-2 h-8 w-8 text-slate-300" />Choose fields and search to load students.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: StudentSearchOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  return <label className="space-y-1">
    <span className="text-xs font-medium text-slate-600">{label}</span>
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400">
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
