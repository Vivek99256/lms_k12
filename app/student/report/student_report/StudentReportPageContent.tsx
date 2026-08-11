'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Modal } from '@/components/result/primitives';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from '@/components/search-dropdown/types';
import {
  Field,
  InlineMessage,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  fetchStudentListingReport,
  loadDynamicBootstrap,
  formatCellValue,
  type DynamicFieldGroup,
  type FlatRow,
} from '../_lib/student-report';
import type { LabelledKey } from '@/lib/erp-legacy';

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function DynamicFieldPickerButton({
  groups,
  selected,
  onChange,
}: {
  groups: DynamicFieldGroup[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" />
        Choose Field {selected.length > 0 ? `(${selected.length})` : ''}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choose Field" size="xl">
        <DynamicFieldPicker groups={groups} selected={selected} onChange={onChange} />
      </Modal>
    </>
  );
}

function DynamicFieldPicker({
  groups,
  selected,
  onChange,
}: {
  groups: DynamicFieldGroup[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">No dynamic fields were returned for this report.</p>
      ) : null}
      {groups.map((group) => {
        const groupIds = group.options.map((option) => option.id);
        const allChecked = groupIds.length > 0 && groupIds.every((id) => selected.includes(id));

        const toggleAll = () => {
          if (allChecked) {
            onChange(selected.filter((value) => !groupIds.includes(value)));
            return;
          }
          onChange([...new Set([...selected, ...groupIds])]);
        };

        return (
          <div key={group.title} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                Check All
              </label>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label key={option.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onChange([...selected, option.id]);
                          return;
                        }
                        onChange(selected.filter((value) => value !== option.id));
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentReportPageContent() {
  const [section, setSection] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [standardLabel, setStandardLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [orderBy, setOrderBy] = useState('student_name');
  const [dynamicGroups, setDynamicGroups] = useState<DynamicFieldGroup[]>([]);
  const [selectedDynamicFields, setSelectedDynamicFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [headers, setHeaders] = useState<LabelledKey[]>([]);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBootstrapping(true);
      try {
        const groups = await loadDynamicBootstrap('student_report');
        if (!cancelled) {
          setDynamicGroups(groups);
          if (groups.length > 0 && selectedDynamicFields.length === 0) {
            const firstGroup = groups[0];
            if (firstGroup.options.length > 0) {
              setSelectedDynamicFields([firstGroup.options[0].id]);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Unable to load report configuration.');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    const selectedValue = getSingleValue(value);
    setSection(selectedValue);
    setSectionLabel(selectedData[0]?.title || '');
    setStandard('');
    setStandardLabel('');
    setDivision('');
    setDivisionLabel('');
  };

  const handleStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    const selectedValue = getSingleValue(value);
    setStandard(selectedValue);
    setStandardLabel(selectedData[0]?.name || '');
    setDivision('');
    setDivisionLabel('');
  };

  const handleDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    const selectedValue = getSingleValue(value);
    setDivision(selectedValue);
    setDivisionLabel(selectedData[0]?.name || '');
  };

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    setMessage(null);

    try {
      const response = await fetchStudentListingReport({
        grade: section,
        standard,
        division,
        orderBy,
        dynamicFields: selectedDynamicFields,
      });
      setHeaders(response.headers);
      setRows(response.rows);
      setMessage(response.rows.length > 0 ? '' : 'No rows match the current filters.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load report.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo(() => {
    return headers.map((header) => ({
      key: header.key,
      label: header.label,
      value: (row: FlatRow) => formatCellValue(header.key, row[header.key]),
      render: (row: FlatRow) => {
        const value = formatCellValue(header.key, row[header.key]);
        if (value === 'Submitted') return <span className="font-medium text-emerald-700">Submitted</span>;
        if (value === 'Missing') return <span className="font-medium text-red-600">Missing</span>;
        return value;
      },
      sortable: true,
      align: 'left' as const,
    }));
  }, [headers]);

  return (
    <PageFrame>
      <PageHeader
        title="Student Report"
        description="Active-student listing with dynamic fields, ordering, and export."
        action={<Search className="h-4 w-4" />}
      />

      {message && (
        <InlineMessage type={message.includes('Unable') || message.includes('No rows') ? 'info' : 'success'} text={message} />
      )}

      <SectionPanel
        title="Filters"
        description="Select grade, standard, division, order by, and choose the fields to display in the report."
      >
        <div className="space-y-4">
          <SearchDropdown
            fields={['section', 'standard', 'division']}
            values={{ section, standard, division }}
            required={{ section: false, standard: false }}
            labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
            placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
            onSectionChange={handleSectionChange}
            onStandardChange={handleStandardChange}
            onDivisionChange={handleDivisionChange}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Order By">
              <NativeSelect value={orderBy} onChange={(value) => setOrderBy(value)}>
                <option value="student_name">Student Name</option>
                <option value="standard_id">Standard</option>
                <option value="enrollment_no">GR No</option>
                <option value="roll_no">Roll No</option>
                <option value="last_name">Last Name</option>
              </NativeSelect>
            </Field>
            <div className="flex items-end gap-2">
              <DynamicFieldPickerButton
                groups={dynamicGroups}
                selected={selectedDynamicFields}
                onChange={setSelectedDynamicFields}
              />
              <Button
                type="button"
                className="h-10 flex-1"
                onClick={() => void handleSearch()}
                disabled={loading || bootstrapping}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>
        </div>
      </SectionPanel>

      {bootstrapping ? (
        <SectionPanel title="Loading">
          <div className="flex h-28 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading report configuration...
          </div>
        </SectionPanel>
      ) : null}

      {searched && (
        <SectionPanel
          title="Student Report"
          description={[sectionLabel, standardLabel, divisionLabel].filter(Boolean).join(' | ') || 'All classes'}
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead className="w-14">Sr. no.</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row, index) => (
                    <TableRow key={`${String(row.id || row.enrollment_no || row.student_name || 'row')}-${index}`}>
                      <TableCell className="text-slate-500">{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          {column.render ? column.render(row) : column.value(row) || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-sm text-slate-500">
                      {searched ? 'No rows match the current filters.' : 'Search to load report data.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => {
                const headers = columns.map((c) => ({ key: c.key, label: c.label }));
                const rowsData = rows.map((row) => {
                  const entry: Record<string, string> = {};
                  headers.forEach((h) => {
                    entry[h.key] = String(row[h.key] ?? '');
                  });
                  return entry;
                });
                import('@/lib/table-export').then(({ exportRowsAsCsv }) => {
                  exportRowsAsCsv({
                    filename: 'student-report.csv',
                    columns: headers,
                    rows: rowsData,
                  });
                });
              }}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => {
                const headers = columns.map((c) => ({ key: c.key, label: c.label, align: c.align }));
                const rowsData = rows.map((row) => {
                  const entry: Record<string, string> = {};
                  headers.forEach((h) => {
                    entry[h.key] = String(row[h.key] ?? '');
                  });
                  return entry;
                });
                import('@/lib/table-export').then(({ exportRowsAsExcel }) => {
                  exportRowsAsExcel({
                    filename: 'student-report.xls',
                    title: 'Student Report',
                    columns: headers,
                    rows: rowsData,
                  });
                });
              }}
            >
              Export Excel
            </Button>
          </div>
        </SectionPanel>
      )}
    </PageFrame>
  );
}
