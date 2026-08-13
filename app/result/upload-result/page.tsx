'use client';

/**
 * Upload result — attach a result PDF/image per student and upload the
 * checked rows as multipart form data.
 *
 * Backed by the dedicated `api/result/upload-result` REST API. Confirmed
 * against the Laravel controller: the student identifier column is
 * aliased `CHECKBOX` (not `id`/`student_id`), standard/division come back
 * as `standard_name`/`division_name`, and — critically — uploaded files
 * must be keyed by the student's actual id (`image[{studentId}]`), not a
 * sequential array index. The existing `file_name` is a bare filename
 * that only resolves against the Laravel origin, not the Next.js one, so
 * the "View" link is built from `API_BASE_URL`.
 */

import React, { useRef, useState } from 'react';
import { ExternalLink, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, Checkbox, EmptyState, StatusChip, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { assertOk, extractRows, readString, resultGet, resultPost } from '@/lib/result/api';
import { API_BASE_URL } from '@/app/components/utils/api_url';

type StudentRow = {
  id: string;
  name: string;
  enrollmentNo: string;
  stdDiv: string;
  mobile: string;
  termName: string;
  fileName: string;
};

type Criteria = {
  grade: string;
  standard: string;
  division: string;
  term: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term', required: true },
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division' },
];

function FileButton({
  file,
  invalid,
  onSelect,
  ariaLabel,
}: {
  file: File | null;
  invalid: boolean;
  onSelect: (file: File | null) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={ariaLabel}
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`inline-flex h-9 max-w-52 items-center gap-2 truncate rounded-lg border border-dashed px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          invalid
            ? 'border-rose-400 bg-rose-50 text-rose-600 hover:bg-rose-100'
            : file
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600'
        }`}
      >
        <Upload className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{file ? file.name : 'Choose file'}</span>
      </button>
    </>
  );
}

export default function UploadResultPage() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    const next: Criteria = {
      grade: readString(values.grade),
      standard: readString(values.standard),
      division: readString(values.division),
      term: readString(values.term),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    setChecked(new Set());
    setFiles({});
    setMissingFiles(new Set());
    try {
      const payload = await resultGet('api/result/upload-result/create', { ...next });
      const list = extractRows(payload);

      setRows(
        list
          .map((record) => ({
            id: readString(record.CHECKBOX),
            name: readString(record.student_name),
            enrollmentNo: readString(record.enrollment_no),
            stdDiv: [record.standard_name, record.division_name].map(readString).filter(Boolean).join(' / '),
            mobile: readString(record.mobile),
            termName: readString(record.term_name),
            fileName: readString(record.file_name),
          }))
          .filter((student) => student.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string, value: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!value) {
      setMissingFiles((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleAll = (value: boolean) => {
    setChecked(value ? new Set(rows.map((row) => row.id)) : new Set());
    if (!value) setMissingFiles(new Set());
  };

  const handleFileSelect = (id: string, file: File | null) => {
    setFiles((current) => ({ ...current, [id]: file }));
    if (file) {
      // Selecting a file auto-checks the row.
      setChecked((current) => new Set(current).add(id));
      setMissingFiles((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUpload = async () => {
    if (!criteria) return;
    const checkedRows = rows.filter((row) => checked.has(row.id));
    if (checkedRows.length === 0) {
      toast.error('Nothing selected', 'Check at least one student and attach their result file.');
      return;
    }
    const missing = checkedRows.filter((row) => !files[row.id]);
    if (missing.length > 0) {
      setMissingFiles(new Set(missing.map((row) => row.id)));
      toast.error(
        'Files missing',
        `Attach a file for every checked student (${missing.length} row${missing.length > 1 ? 's' : ''} without a file).`,
      );
      return;
    }
    setMissingFiles(new Set());
    setSaving(true);
    try {
      const form = new FormData();
      checkedRows.forEach((row) => {
        const file = files[row.id];
        form.append('students[]', row.id);
        if (file) form.append(`image[${row.id}]`, file);
      });
      form.append('division_id', criteria.division);
      form.append('standard_id', criteria.standard);
      form.append('grade_id', criteria.grade);
      form.append('term_id', criteria.term);

      const payload = await resultPost('api/result/upload-result', form, { multipart: true });
      const message = assertOk(payload, 'Laravel did not confirm the upload.');
      toast.success('Results uploaded', message || `${checkedRows.length} file(s) uploaded.`);
      setFiles({});
      setChecked(new Set());
    } catch (err) {
      toast.error('Could not upload results', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const someChecked = checked.size > 0 && checked.size < rows.length;

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Upload}
          title="Upload result"
          subtitle="Attach and publish result documents per student"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'Upload result' },
          ]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={handleSearch} loading={loading} />

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  Student list
                  {rows.length > 0 && (
                    <StatusChip tone="info">{checked.size} of {rows.length} selected</StatusChip>
                  )}
                </CardTitle>
                {rows.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleUpload}
                    disabled={saving}
                    className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Upload className="h-4 w-4" />
                    {saving ? 'Uploading…' : 'Upload results'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && (
                <div className="p-4">
                  <Banner tone="error">{error}</Banner>
                </div>
              )}
              {loading ? (
                <TableSkeleton columns={8} />
              ) : rows.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected class and term. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-12 px-5 py-3">
                          <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
                        </th>
                        <th className="px-5 py-3 font-semibold">Student name</th>
                        <th className="px-5 py-3 font-semibold">Enrollment no</th>
                        <th className="px-5 py-3 font-semibold">Std / Div</th>
                        <th className="px-5 py-3 font-semibold">Mobile</th>
                        <th className="px-5 py-3 font-semibold">Term</th>
                        <th className="px-5 py-3 font-semibold">File</th>
                        <th className="px-5 py-3 font-semibold">File link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const invalid = missingFiles.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className={`border-b border-slate-100 last:border-0 ${
                              invalid ? 'bg-rose-50/60' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="px-5 py-4">
                              <Checkbox checked={checked.has(row.id)} onChange={(value) => toggleRow(row.id, value)} />
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-900">{row.name}</td>
                            <td className="px-5 py-4 font-mono text-xs text-slate-600">{row.enrollmentNo}</td>
                            <td className="px-5 py-4 text-slate-600">{row.stdDiv}</td>
                            <td className="px-5 py-4 text-slate-600">{row.mobile || '—'}</td>
                            <td className="px-5 py-4 text-slate-600">{row.termName}</td>
                            <td className="px-5 py-4">
                              <FileButton
                                file={files[row.id] ?? null}
                                invalid={invalid}
                                onSelect={(file) => handleFileSelect(row.id, file)}
                                ariaLabel={`Result file for ${row.name}`}
                              />
                            </td>
                            <td className="px-5 py-4">
                              {row.fileName ? (
                                <a
                                  href={`${API_BASE_URL}/storage/upload_result/${row.fileName}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View
                                </a>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
