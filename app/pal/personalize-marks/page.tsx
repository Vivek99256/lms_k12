'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchPersonalizeMarksOptions,
  submitPersonalizeMarks,
  type PersonalizeMarkRow,
  type StdDivOption,
} from '@/app/pal/data/pal';

interface FormRow extends PersonalizeMarkRow {
  key: number;
}

function emptyRow(key: number): FormRow {
  return {
    key,
    stdDiv: '',
    studentName: '',
    enrollmentNo: '',
    subject: '',
    exam: '',
    total: '',
    obtain: '',
  };
}

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export default function PersonalizeMarksPage() {
  const [options, setOptions] = useState<StdDivOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const keyRef = useRef(1);
  const [rows, setRows] = useState<FormRow[]>([emptyRow(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saved, setSaved] = useState<PersonalizeMarkRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        setOptions(await fetchPersonalizeMarksOptions(controller.signal));
      } catch (reason) {
        if (controller.signal.aborted) return;
        setOptionsError(
          reason instanceof Error ? reason.message : 'Unable to load standard/division list.'
        );
      } finally {
        if (!controller.signal.aborted) setLoadingOptions(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(keyRef.current++)]);
  };

  const removeRow = (key: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)));
  };

  const updateRow = (key: number, field: keyof PersonalizeMarkRow, value: string) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  const filledRows = useMemo(
    () => rows.filter((row) => row.stdDiv && row.studentName.trim()),
    [rows]
  );

  const validate = (): string | null => {
    if (filledRows.length === 0) {
      return 'Add at least one row with a standard/division and student name.';
    }
    for (const row of filledRows) {
      if (!row.enrollmentNo.trim() || !row.subject.trim() || !row.exam.trim()) {
        return 'Enrollment no, subject and exam are required for each row.';
      }
      if (!DECIMAL_PATTERN.test(row.total) || !DECIMAL_PATTERN.test(row.obtain)) {
        return 'Total and obtained marks must be numbers (up to 2 decimals).';
      }
      if (Number(row.obtain) > Number(row.total)) {
        return `Obtained marks cannot exceed total for ${row.studentName || 'a student'}.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const payload: PersonalizeMarkRow[] = filledRows.map((row) => ({
        stdDiv: row.stdDiv,
        studentName: row.studentName.trim(),
        enrollmentNo: row.enrollmentNo.trim(),
        subject: row.subject.trim(),
        exam: row.exam.trim(),
        total: row.total,
        obtain: row.obtain,
      }));
      const result = await submitPersonalizeMarks(payload);
      setSaved(payload);
      setMessage({
        type: 'success',
        text: result.message || `Saved ${payload.length} record${payload.length === 1 ? '' : 's'}.`,
      });
      setRows([emptyRow(keyRef.current++)]);
    } catch (reason) {
      setMessage({
        type: 'error',
        text: reason instanceof Error ? reason.message : 'Unable to save marks.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Personalize Marks</h1>
            <p className="text-sm text-slate-500">
              Enter offline exam marks for students, one row per student.
            </p>
          </div>
        </div>

        {optionsError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {optionsError}
          </div>
        )}
        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-semibold">Standard / Division</th>
                  <th className="px-3 py-3 font-semibold">Student name</th>
                  <th className="px-3 py-3 font-semibold">Enrollment no</th>
                  <th className="px-3 py-3 font-semibold">Subject</th>
                  <th className="px-3 py-3 font-semibold">Exam</th>
                  <th className="px-3 py-3 font-semibold">Total</th>
                  <th className="px-3 py-3 font-semibold">Obtained</th>
                  <th className="px-3 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const invalidObtain =
                    row.total &&
                    row.obtain &&
                    DECIMAL_PATTERN.test(row.total) &&
                    DECIMAL_PATTERN.test(row.obtain) &&
                    Number(row.obtain) > Number(row.total);
                  return (
                    <tr key={row.key} className="align-top">
                      <td className="px-3 py-2">
                        <select
                          value={row.stdDiv}
                          disabled={loadingOptions}
                          onChange={(event) => updateRow(row.key, 'stdDiv', event.target.value)}
                          className="h-9 w-full min-w-[170px] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">
                            {loadingOptions ? 'Loading...' : '-- Select --'}
                          </option>
                          {options.map((option) => (
                            <option key={`${option.stdId}-${option.divId}`} value={option.label}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.studentName}
                          onChange={(event) => updateRow(row.key, 'studentName', event.target.value)}
                          placeholder="Student name"
                          className="h-9 min-w-[150px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.enrollmentNo}
                          onChange={(event) => updateRow(row.key, 'enrollmentNo', event.target.value)}
                          placeholder="Enrollment"
                          className="h-9 min-w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.subject}
                          onChange={(event) => updateRow(row.key, 'subject', event.target.value)}
                          placeholder="Subject"
                          className="h-9 min-w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.exam}
                          onChange={(event) => updateRow(row.key, 'exam', event.target.value)}
                          placeholder="Exam"
                          className="h-9 min-w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.total}
                          inputMode="decimal"
                          onChange={(event) => updateRow(row.key, 'total', event.target.value)}
                          placeholder="0"
                          className="h-9 w-20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.obtain}
                          inputMode="decimal"
                          onChange={(event) => updateRow(row.key, 'obtain', event.target.value)}
                          placeholder="0"
                          className={`h-9 w-20 ${invalidObtain ? 'border-rose-400 focus-visible:ring-rose-500/30' : ''}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length === 1}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Add row
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || loadingOptions}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save marks
            </Button>
          </div>
        </div>

        {saved.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Last saved</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Std/Div</th>
                    <th className="px-4 py-2.5 font-semibold">Student</th>
                    <th className="px-4 py-2.5 font-semibold">Enrollment</th>
                    <th className="px-4 py-2.5 font-semibold">Subject</th>
                    <th className="px-4 py-2.5 font-semibold">Exam</th>
                    <th className="px-4 py-2.5 font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Obtained</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saved.map((row, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2.5 text-slate-600">{row.stdDiv}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.studentName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.enrollmentNo}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.subject}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.exam}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.total}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.obtain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
