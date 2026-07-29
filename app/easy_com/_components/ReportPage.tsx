'use client';

import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import PageHeader from '@/components/result/PageHeader';
import { EmptyState } from '@/components/result/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSessionContext, readString } from '@/lib/erp-client';
import { communicationRequest, dataRecords, postForm } from '../_lib/api';
import type { JsonRecord, ReportConfig } from '../_lib/types';
import { ErrorBanner, Field, PageFrame, Panel } from './shared';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export default function ReportPage({ config }: { config: ReportConfig }) {
  const session = buildSessionContext();
  const [academic, setAcademic] = useState<Partial<SearchDropdownValues>>({});
  const [filters, setFilters] = useState({ from_date: '', to_date: '', mobile_no: '', user_id: '', query: '' });
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visibleRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return query ? rows.filter((row) => config.columns.some((column) => readString(row[column.key]).toLowerCase().includes(query))) : rows;
  }, [config.columns, filters.query, rows]);

  async function runReport() {
    if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) {
      setError('From date cannot be after to date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date, to_date: filters.to_date,
        mobile_no: filters.mobile_no, user_id: filters.user_id,
        grade: first(academic.section), standard: first(academic.standard), division: first(academic.division),
        academic_year: session.syear,
      });
      const payload = config.kind === 'whatsapp' || config.submit
        ? await postForm(config.path, Object.fromEntries(params.entries()))
        : await communicationRequest(`${config.path}/create`, undefined, params);
      const root = payload as Record<string, unknown>;
      setRows(dataRecords(root.data ?? root));
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the report.');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const content = [
      config.columns.map((column) => csvCell(column.label)).join(','),
      ...visibleRows.map((row) => config.columns.map((column) => csvCell(readString(row[column.key]))).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.kind}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <PageFrame>
    <PageHeader icon={config.icon} title={config.title} subtitle={config.description} breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]} actions={visibleRows.length ? <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button> : undefined} />
    <ErrorBanner message={error} />
    <Panel title="Report filters">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From date"><Input type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} /></Field>
        <Field label="To date"><Input type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} /></Field>
        {config.mobile && <Field label="Mobile number"><Input inputMode="numeric" maxLength={10} value={filters.mobile_no} onChange={(event) => setFilters({ ...filters, mobile_no: event.target.value.replace(/\D/g, '') })} /></Field>}
        {config.user && <Field label="Sender/User ID"><Input value={filters.user_id} onChange={(event) => setFilters({ ...filters, user_id: event.target.value })} /></Field>}
      </div>
      {config.academic && <div className="mt-4"><SearchDropdown fields={['section', 'standard', 'division']} token={session.token} subInstituteId={session.subInstituteId} values={academic} onChange={(values) => setAcademic(values)} /></div>}
      <div className="mt-4 flex justify-end"><Button onClick={runReport} disabled={busy}><Search className="h-4 w-4" />{busy ? 'Loading…' : 'Search'}</Button></div>
    </Panel>
    <Panel title={`Results (${visibleRows.length})`}>
      {rows.length > 0 && <div className="mb-4 max-w-md"><Input placeholder="Search report results…" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></div>}
      {!visibleRows.length ? <EmptyState title={searched ? 'No matching records' : 'Run the report'} message={searched ? 'Try changing the report filters.' : 'Choose filters and select Search to load records.'} /> :
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-max text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{config.columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row, index) => <tr key={readString(row.id) || index}>{config.columns.map((column) => <td key={column.key} className="max-w-md px-3 py-3 align-top text-slate-700">{readString(row[column.key]) || '—'}</td>)}</tr>)}</tbody></table></div>}
    </Panel>
  </PageFrame>;
}
