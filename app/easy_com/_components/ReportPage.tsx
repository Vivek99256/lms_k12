'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import PageHeader from '@/components/result/PageHeader';
import { EmptyState } from '@/components/result/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSessionContext, readString } from '@/lib/erp-client';
import { asRecord, cellValue, getJson, records } from '../_lib/api';
import type { JsonRecord, ReportConfig } from '../_lib/types';
import { ErrorBanner, Field, PageFrame, Panel, Select } from './shared';

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

interface Option {
  id: string;
  name: string;
}

export default function ReportPage({ config }: { config: ReportConfig }) {
  const session = useMemo(() => buildSessionContext(), []);

  const [academic, setAcademic] = useState<Partial<SearchDropdownValues>>({});
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    mobile_no: '',
    user_id: '',
    academic_year: '',
    tbl: 'parents',
  });
  const [query, setQuery] = useState('');

  const [users, setUsers] = useState<Option[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [sources, setSources] = useState<Option[]>([]);

  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* ---------------- filter dropdown data ---------------- */

  useEffect(() => {
    if (!config.optionsPath) return;
    let active = true;

    getJson(config.optionsPath)
      .then((response) => {
        if (!active) return;
        const data = asRecord(response.data);

        const yearList = data.academicYears;
        if (Array.isArray(yearList)) setAcademicYears(yearList.map((year) => readString(year)));

        setUsers(
          records(data.users).map((row) => ({
            id: readString(row.id),
            name: readString(row.name),
          })),
        );

        setSources(
          records(data.sources).map((row) => ({
            id: readString(row.id),
            name: readString(row.name),
          })),
        );
      })
      .catch(() => {
        /* filter dropdowns are optional - never block the report itself */
      });

    return () => {
      active = false;
    };
  }, [config.optionsPath]);

  /* ---------------- run ---------------- */

  const runReport = useCallback(async () => {
    if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) {
      setError('From date cannot be after to date.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const params: Record<string, string> = {
        from_date: filters.from_date,
        to_date: filters.to_date,
      };

      if (config.mobile) params.mobile_no = filters.mobile_no;
      if (config.users) params.user_id = filters.user_id;
      if (config.academicYear) params.academic_year = filters.academic_year;
      if (config.source) params.tbl = filters.tbl;
      if (config.academic) {
        params.grade = first(academic.section);
        params.standard = first(academic.standard);
        params.division = first(academic.division);
      }

      const response = await getJson(config.path, params);
      setRows(records(response.data));
      setSearched(true);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load the report.');
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }, [academic, config, filters]);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      config.columns.some((column) => cellValue(row, column.key).toLowerCase().includes(term)),
    );
  }, [config.columns, query, rows]);

  function exportCsv() {
    const content = [
      config.columns.map((column) => csvCell(column.label)).join(','),
      ...visibleRows.map((row) =>
        config.columns.map((column) => csvCell(cellValue(row, column.key))).join(','),
      ),
    ].join('\r\n');

    // BOM so Excel reads the UTF-8 names and ₹ amounts correctly.
    const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${config.kind}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageFrame>
      <PageHeader
        icon={config.icon}
        title={config.title}
        subtitle={config.description}
        breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]}
        actions={
          visibleRows.length ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <ErrorBanner message={error} />

      <Panel title="Report filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {config.source && (
            <Field label="Sent to">
              <Select
                value={filters.tbl}
                onChange={(value) => setFilters({ ...filters, tbl: value })}
                ariaLabel="Sent to"
              >
                {(sources.length ? sources : [{ id: 'parents', name: 'Parents' }]).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="From date">
            <Input
              type="date"
              value={filters.from_date}
              onChange={(event) => setFilters({ ...filters, from_date: event.target.value })}
            />
          </Field>

          <Field label="To date">
            <Input
              type="date"
              value={filters.to_date}
              onChange={(event) => setFilters({ ...filters, to_date: event.target.value })}
            />
          </Field>

          {config.academicYear && (
            <Field label="Academic year">
              <Select
                value={filters.academic_year}
                onChange={(value) => setFilters({ ...filters, academic_year: value })}
                ariaLabel="Academic year"
              >
                <option value="">All years</option>
                {academicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {config.mobile && (
            <Field label="Mobile number">
              <Input
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit number"
                value={filters.mobile_no}
                onChange={(event) =>
                  setFilters({ ...filters, mobile_no: event.target.value.replace(/\D/g, '') })
                }
              />
            </Field>
          )}

          {config.users && (
            <Field label="Sent by">
              <Select
                value={filters.user_id}
                onChange={(value) => setFilters({ ...filters, user_id: value })}
                ariaLabel="Sent by"
              >
                <option value="">All users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {config.academic && (
          <div className="mt-4">
            <SearchDropdown
              fields={['section', 'standard', 'division']}
              token={session.token}
              subInstituteId={session.subInstituteId}
              values={academic}
              onChange={(values) => setAcademic(values)}
            />
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={runReport} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy ? 'Loading…' : 'Search'}
          </Button>
        </div>
      </Panel>

      <Panel title={`Results (${visibleRows.length})`}>
        {rows.length > 0 && (
          <div className="mb-4 max-w-md">
            <Input
              placeholder="Filter loaded results…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}

        {!visibleRows.length ? (
          <EmptyState
            title={searched ? 'No matching records' : 'Run the report'}
            message={
              searched
                ? 'Try changing the report filters.'
                : 'Choose filters and select Search to load records.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key} className="whitespace-nowrap px-3 py-3 font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row, index) => (
                  <tr key={readString(row.id) || index}>
                    {config.columns.map((column) => (
                      <td
                        key={column.key}
                        className={
                          column.wide
                            ? 'max-w-md whitespace-pre-wrap break-words px-3 py-3 align-top text-slate-700'
                            : 'px-3 py-3 align-top text-slate-700'
                        }
                      >
                        {cellValue(row, column.key) || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageFrame>
  );
}
