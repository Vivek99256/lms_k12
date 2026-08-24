'use client';

/**
 * Marks approval report — shows which scholastic exam/subject marks and
 * co-scholastic entries have been approved. The scholastic block is a
 * matrix (exam rows x subject columns), the co-scholastic block a
 * two-column list. Payload shapes vary, so parsing is defensive.
 */

import React, { useState } from 'react';
import { CheckSquare, ClipboardList, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, StatusChip, TableSkeleton } from '@/components/result/primitives';
import { asRecord, readString, resultPost, toCollection } from '@/lib/result/api';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term', required: true },
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  {
    kind: 'api', name: 'subject', label: 'Select subject', path: 'api/get-subject-list',
    params: { standard_id: '{standard}', division_id: '{division}' }, required: true,
  },
  {
    kind: 'api', name: 'exam', label: 'Select exam', path: 'api/get-exam-list',
    params: { standard_id: '{standard}', subject_id: '{subject}', term_id: '{term}' }, required: true,
  },
];

type ScholasticCell = { title: string; approved: boolean; present: boolean };
type ScholasticMatrix = { subjects: string[]; rows: { exam: string; cells: Record<string, ScholasticCell> }[] };
type CoScholasticRow = { examType: string; title: string; approved: boolean };

function isApproved(value: unknown): boolean {
  const text = readString(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'approved' || text === 'approve';
}

function parseCell(value: unknown): ScholasticCell {
  if (value == null) return { title: '', approved: false, present: false };
  if (typeof value !== 'object') {
    return { title: readString(value), approved: false, present: readString(value) !== '' };
  }
  const record = asRecord(value);
  return {
    title: readString(record.title ?? record.exam_title ?? record.ExamTitle ?? record.name ?? record.exam_name),
    approved: isApproved(record.approved ?? record.is_approved ?? record.approve ?? record.status ?? record.approval_status),
    present: true,
  };
}

/** Try to interpret the scholastic block as exam -> subject -> cell. */
function parseScholastic(data: Record<string, unknown>): ScholasticMatrix {
  const candidates = [
    data.scholastic, data.scholastic_data, data.scholastic_marks, data.marks_data,
    data.exam_data, data.approval_data,
  ];
  let source: Record<string, unknown> = {};
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (Object.keys(record).length > 0) { source = record; break; }
  }
  // Fallback: the whole payload may itself be the matrix (exam -> subject -> cell).
  if (Object.keys(source).length === 0) {
    const looksLikeMatrix = Object.values(data).some(
      (value) => value && typeof value === 'object' && !Array.isArray(value) &&
        Object.values(asRecord(value)).some((inner) => inner && typeof inner === 'object'),
    );
    if (looksLikeMatrix) source = data;
  }

  const subjects = new Set<string>();
  const rows: ScholasticMatrix['rows'] = [];
  for (const [exam, subjectMap] of Object.entries(source)) {
    const record = asRecord(subjectMap);
    if (Object.keys(record).length === 0) continue;
    const cells: Record<string, ScholasticCell> = {};
    for (const [subject, cell] of Object.entries(record)) {
      subjects.add(subject);
      cells[subject] = parseCell(cell);
    }
    rows.push({ exam, cells });
  }
  return { subjects: Array.from(subjects), rows };
}

function parseCoScholastic(data: Record<string, unknown>): CoScholasticRow[] {
  const candidates = [
    data.co_scholastic, data.coscholastic, data.co_scholastic_data, data.coScholastic, data.co_scholastic_list,
  ];
  const rows: CoScholasticRow[] = [];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const record = asRecord(item);
        rows.push({
          examType: readString(record.exam_type ?? record.exam_master_name ?? record.exam_name ?? record.type),
          title: readString(record.title ?? record.co_scholastic_title ?? record.main_title ?? record.name),
          approved: isApproved(record.approved ?? record.is_approved ?? record.status ?? record.approval_status),
        });
      }
    } else if (typeof candidate === 'object') {
      // Record<examType, items[]>
      for (const [examType, items] of Object.entries(asRecord(candidate))) {
        for (const item of toCollection(items)) {
          const record = asRecord(item);
          rows.push({
            examType,
            title: readString(record.title ?? record.co_scholastic_title ?? record.main_title ?? record.name ?? item),
            approved: isApproved(record.approved ?? record.is_approved ?? record.status ?? record.approval_status),
          });
        }
      }
    }
    if (rows.length > 0) break;
  }
  return rows.filter((row) => row.title || row.examType);
}

export default function MarksApprovalReportPage() {
  const [scholastic, setScholastic] = useState<ScholasticMatrix>({ subjects: [], rows: [] });
  const [coScholastic, setCoScholastic] = useState<CoScholasticRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (values: FilterValues) => {
    setLoading(true);
    setError(null);
    try {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
      const payload = await resultPost('result/getMarksApproval', flat);
      const data = asRecord(payload.data ?? payload);
      setScholastic(parseScholastic(data));
      setCoScholastic(parseCoScholastic(data));
    } catch (err) {
      setScholastic({ subjects: [], rows: [] });
      setCoScholastic([]);
      setError(err instanceof Error ? err.message : 'Failed to load approval data. Please try again.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-6 py-3 text-sm text-slate-500">
      <span className="flex items-center gap-2"><StatusChip tone="success">Approved</StatusChip> marks approved by the reviewer</span>
      <span className="flex items-center gap-2"><StatusChip tone="warning">Pending</StatusChip> approval still awaited</span>
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={CheckSquare}
          title="Marks approval report"
          subtitle="Track scholastic and co-scholastic marks approval status"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'Marks approval report' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {error && <Banner tone="error">{error}</Banner>}

        {searched && !error && (
          <>
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-6 py-5">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Table2 className="h-4 w-4" />
                  </div>
                  Scholastic approvals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <TableSkeleton columns={4} />
                ) : scholastic.rows.length === 0 ? (
                  <EmptyState title="No scholastic approval data" message="The payload did not contain a recognisable scholastic approval matrix for the selected criteria." />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3 font-semibold">Exam name</th>
                            {scholastic.subjects.map((subject) => (
                              <th key={subject} className="px-4 py-3 font-semibold">{subject}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {scholastic.rows.map((row) => (
                            <tr key={row.exam} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-medium text-slate-800">{row.exam}</td>
                              {scholastic.subjects.map((subject) => {
                                const cell = row.cells[subject];
                                return (
                                  <td key={subject} className="px-4 py-3 text-slate-600">
                                    {cell?.present ? (
                                      <span className="flex flex-col items-start gap-1">
                                        {cell.title && <span>{cell.title}</span>}
                                        <StatusChip tone={cell.approved ? 'success' : 'warning'}>
                                          {cell.approved ? 'Approved' : 'Pending'}
                                        </StatusChip>
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {legend}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-6 py-5">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  Co-scholastic approvals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <TableSkeleton columns={2} />
                ) : coScholastic.length === 0 ? (
                  <EmptyState title="No co-scholastic approval data" message="The payload did not contain co-scholastic approval entries for the selected criteria." />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3 font-semibold">Exam type</th>
                            <th className="px-4 py-3 font-semibold">Co-scholastic</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coScholastic.map((row, index) => (
                            <tr key={`${row.examType}-${row.title}-${index}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-medium text-slate-800">{row.examType || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">
                                <span className="flex items-center gap-2">
                                  {row.title && <span>{row.title}</span>}
                                  <StatusChip tone={row.approved ? 'success' : 'warning'}>
                                    {row.approved ? 'Approved' : 'Pending'}
                                  </StatusChip>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {legend}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
