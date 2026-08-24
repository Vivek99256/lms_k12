'use client';

/**
 * New report card — pick a result template + format + type, list the
 * matching students, select some and generate their report-card HTML on
 * the server. The returned HTML renders in a printable area with paper
 * and mobile print actions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, Loader2, Printer, Smartphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, Checkbox, EmptyState, Skeleton, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { printElement } from '@/components/result/print';
import { asRecord, extractRows, readString, resultGet, resultPost, toCollection, toOptions } from '@/lib/result/api';

type StudentRow = {
  id: string;
<<<<<<< HEAD
=======
  rollNo: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  enrollmentNo: string;
  studentName: string;
  standard: string;
  division: string;
};

type StaticOption = { value: string; label: string };

export default function NewReportCardPage() {
  const { academicTerms } = useAuth();

  const [templateOptions, setTemplateOptions] = useState<StaticOption[]>([]);
  const [resultTypeOptions, setResultTypeOptions] = useState<StaticOption[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<Record<string, string>>({});

  const [generating, setGenerating] = useState(false);
  const [savingMobile, setSavingMobile] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
<<<<<<< HEAD
=======
  const [studentHtml, setStudentHtml] = useState<Record<string, string>>({});
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const printRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------ mount: templates + types */
  useEffect(() => {
    let cancelled = false;
<<<<<<< HEAD
    void resultGet('result/student-result')
      .then((payload) => {
        if (cancelled) return;
        const data = asRecord(payload.data ?? payload);
        const templates = toCollection(data.result_template_master ?? asRecord(payload).result_template_master)
=======
    void resultGet('api/result/student-result')
      .then((payload) => {
        if (cancelled) return;
        const data = asRecord(payload.data ?? payload);
        // Laravel's studentResultController::index() returns the template
        // list under the plain `data` key (result_template_master rows),
        // not a `result_template_master` key.
        const templates = toCollection(data.data)
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          .map(asRecord)
          .map((row) => ({
            value: readString(row.id),
            label: readString(row.module_name) || readString(row.title),
          }))
          .filter((option) => option.value && option.label);
<<<<<<< HEAD
        const types = toOptions(data.result_types ?? asRecord(payload).result_types)
          .map((option) => ({ value: option.id, label: option.label }));
=======
        // result_types is a flat array of plain strings (e.g. ['Regular',
        // 'HPC']), not row objects — toOptions() expects id/label-shaped
        // rows and drops plain strings, so map it directly instead.
        const types = toCollection(data.result_types)
          .map(readString)
          .filter(Boolean)
          .map((label) => ({ value: label, label }));
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        setTemplateOptions(templates);
        setResultTypeOptions(types);
        setBootError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Failed to load result templates.');
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const formatOptions = useMemo<StaticOption[]>(() => {
    const terms = toOptions(academicTerms).map((option) => ({ value: option.id, label: option.label }));
    return [...terms, { value: 'yearly', label: 'Yearly' }];
  }, [academicTerms]);

  const filterFields = useMemo<FilterFieldDef[]>(() => [
    { kind: 'static', name: 'template', label: 'Result template', required: true, options: templateOptions },
    { kind: 'static', name: 'format', label: 'Result format', required: true, options: formatOptions },
    { kind: 'static', name: 'result_type', label: 'Result type', required: true, options: resultTypeOptions },
    { kind: 'section' },
    { kind: 'standard' },
    { kind: 'division' },
  ], [templateOptions, formatOptions, resultTypeOptions]);

  /* --------------------------------------------------------- student list */
  const handleSearch = async (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setLastFilters(flat);
    setLoading(true);
    setError(null);
    setReportHtml('');
<<<<<<< HEAD
    try {
      const payload = await resultGet('result/student-result/create', flat);
      const rows = extractRows(payload).map((row): StudentRow => ({
        id: readString(row.id ?? row.student_id),
=======
    setStudentHtml({});
    try {
      const payload = await resultGet('api/result/student-result/create', flat);
      const rows = extractRows(payload, 'student_data').map((row): StudentRow => ({
        id: readString(row.id ?? row.student_id),
        rollNo: readString(row.roll_no),
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        enrollmentNo: readString(row.enrollment_no ?? row.gr_number ?? row.gr_no),
        studentName: readString(row.student_name ?? row.name ?? row.full_name),
        standard: readString(row.standard_name ?? row.standard),
        division: readString(row.division_name ?? row.division),
      })).filter((row) => row.id);
      setStudents(rows);
      setSelected(new Set());
    } catch (err) {
      setStudents([]);
      setSelected(new Set());
      setError(err instanceof Error ? err.message : 'Failed to load students.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const allSelected = students.length > 0 && students.every((student) => selected.has(student.id));
  const someSelected = students.some((student) => selected.has(student.id));

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(students.map((student) => student.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /* ------------------------------------------------------------- generate */
  const handleGenerate = async () => {
    if (selected.size === 0) {
      toast.error('No students selected', 'Select at least one student to generate report cards.');
      return;
    }
    setGenerating(true);
    try {
      const body: Record<string, string> = {
        template_id: readString(lastFilters.template),
        format: readString(lastFilters.format),
        grade_id: readString(lastFilters.grade),
        standard_id: readString(lastFilters.standard),
        division_id: readString(lastFilters.division),
        result_type: readString(lastFilters.result_type),
      };
      Array.from(selected).forEach((id, index) => { body[`students[${index}]`] = id; });
<<<<<<< HEAD
      const payload = await resultPost('result/student-result', body);
      const html = readString(asRecord(payload.data).html ?? payload.html);
=======
      const payload = await resultPost('api/result/student-result', body);
      const data = asRecord(payload.data ?? payload);
      const html = readString(data.html);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      if (!html) {
        toast.error('No report card returned', 'The server did not return report-card HTML for the selection.');
        setReportHtml('');
        return;
      }
      setReportHtml(html);
<<<<<<< HEAD
=======
      setStudentHtml(Object.fromEntries(
        Object.entries(asRecord(data.all_stud_html)).map(([studentId, value]) => [studentId, readString(value)]),
      ));
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      toast.success('Report cards generated', `${selected.size} report card(s) ready below.`);
    } catch (err) {
      toast.error('Failed to generate report cards', err instanceof Error ? err.message : undefined);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintMobile = async () => {
    setSavingMobile(true);
    try {
<<<<<<< HEAD
      await resultPost('result/save_result_html_new', {
        term_id: readString(lastFilters.format),
        student_arr: Array.from(selected).join(','),
        total_working_day: '0',
        present_working_day: '0',
        student_percentage: '0',
      });
=======
      const body: Record<string, string> = {
        term_id: readString(lastFilters.format),
        student_arr: Array.from(selected).join(','),
        grade_id: readString(lastFilters.grade),
        standard_id: readString(lastFilters.standard),
        division_id: readString(lastFilters.division),
        result_type: readString(lastFilters.result_type),
        total_working_day: '0',
        present_working_day: '0',
        student_percentage: '0',
      };
      Array.from(selected).forEach((studentId) => {
        body[`html_${studentId}`] = studentHtml[studentId] || reportHtml;
      });
      await resultPost('api/result/student-result/save-html', body);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      toast.success('Result HTML saved for mobile app');
    } catch (err) {
      toast.error('Failed to save result HTML', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingMobile(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={FileText}
          title="New report card"
          subtitle="Generate student report cards from a result template"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'New report card' }]}
          actions={
            <a
<<<<<<< HEAD
              href={`/api/proxy?path=${encodeURIComponent('result/all_results/create')}`}
=======
              href={`/api/proxy?path=${encodeURIComponent('api/result/all-results')}`}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              View saved results
            </a>
          }
        />

        {bootError && <Banner tone="error">{bootError}</Banner>}

        {bootLoading ? (
          <Card className="border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
            </div>
          </Card>
        ) : (
          <FilterBar fields={filterFields} onSearch={(values) => void handleSearch(values)} loading={loading} />
        )}

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Users className="h-4 w-4" />
                </div>
                Students {students.length > 0 && `(${students.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {error && <div className="p-4"><Banner tone="error">{error}</Banner></div>}
              {loading ? (
                <TableSkeleton columns={5} />
              ) : students.length === 0 ? (
                <EmptyState title="No students found" message="No students matched the selected criteria." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <th className="w-10 px-4 py-3">
                            <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
                          </th>
<<<<<<< HEAD
=======
                          <th className="px-4 py-3 font-semibold">Roll no</th>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                          <th className="px-4 py-3 font-semibold">Gr no</th>
                          <th className="px-4 py-3 font-semibold">Student name</th>
                          <th className="px-4 py-3 font-semibold">Standard</th>
                          <th className="px-4 py-3 font-semibold">Division</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <Checkbox checked={selected.has(student.id)} onChange={(checked) => toggleOne(student.id, checked)} />
                            </td>
<<<<<<< HEAD
=======
                            <td className="px-4 py-3 text-slate-600">{student.rollNo || '—'}</td>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.enrollmentNo || '—'}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{student.studentName || '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{student.standard || '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{student.division || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                    <span className="text-sm text-slate-500">{selected.size} selected</span>
                    <Button
                      onClick={() => void handleGenerate()}
                      disabled={generating || selected.size === 0}
                      className="h-10 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Generate report cards
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {reportHtml && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  Generated report cards
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => printElement(printRef.current, 'Report cards')}>
                    <Printer className="h-3.5 w-3.5" />
                    Print paper
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handlePrintMobile()} disabled={savingMobile}>
                    {savingMobile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                    Print mobile
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div
                ref={printRef}
                className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-4"
                dangerouslySetInnerHTML={{ __html: reportHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
