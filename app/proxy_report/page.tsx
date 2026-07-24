"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import {
  getProxySession,
  listProxies,
  listTeachers,
  type ProxyRecord,
  type TeacherOption,
} from "@/app/proxy_master/api";

const PAGE_SIZE = 10;

const exportColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "date", label: "Date" },
  { key: "standard", label: "Standard" },
  { key: "division", label: "Division" },
  { key: "absentTeacher", label: "Absent Teacher" },
  { key: "proxyTeacher", label: "Proxy Teacher" },
  { key: "period", label: "Period" },
  { key: "subject", label: "Subject" },
];

type AppliedFilters = {
  fromDate: string;
  toDate: string;
  teacherId: number | null;
};

type ColumnFilters = {
  standard: string;
  division: string;
  absentTeacher: string;
  proxyTeacher: string;
  period: string;
  subject: string;
};

const emptyColumnFilters: ColumnFilters = {
  standard: "",
  division: "",
  absentTeacher: "",
  proxyTeacher: "",
  period: "",
  subject: "",
};

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function exportRow(record: ProxyRecord, index: number): TableExportRow {
  return {
    serial: String(index + 1),
    date: record.proxyDate,
    standard: record.standardName,
    division: record.divisionName,
    absentTeacher: record.teacherName,
    proxyTeacher: record.proxyTeacherName,
    period: record.periodName,
    subject: record.subjectName,
  };
}

export default function ProxyReportPage() {
  const initialDate = todayIso();
  const [records, setRecords] = useState<ProxyRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [fromDate, setFromDate] = useState(initialDate);
  const [toDate, setToDate] = useState(initialDate);
  const [teacherId, setTeacherId] = useState("");
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] =
    useState<ColumnFilters>(emptyColumnFilters);
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = getProxySession();
      const [proxyRecords, teacherOptions] = await Promise.all([
        listProxies(session),
        listTeachers(session),
      ]);
      setRecords(proxyRecords);
      setTeachers(teacherOptions);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Proxy report data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The authenticated ERP session is stored in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!applied) return [];
    const search = query.trim().toLowerCase();
    const includes = (value: string, filter: string) =>
      value.toLowerCase().includes(filter.trim().toLowerCase());

    return records
      .filter(
        (record) =>
          record.proxyDate >= applied.fromDate &&
          record.proxyDate <= applied.toDate &&
          (!applied.teacherId ||
            record.proxyTeacherId === applied.teacherId) &&
          (!search ||
            [
              record.proxyDate,
              record.standardName,
              record.divisionName,
              record.teacherName,
              record.proxyTeacherName,
              record.periodName,
              record.subjectName,
            ].some((value) => value.toLowerCase().includes(search))) &&
          includes(record.standardName, columnFilters.standard) &&
          includes(record.divisionName, columnFilters.division) &&
          includes(record.teacherName, columnFilters.absentTeacher) &&
          includes(record.proxyTeacherName, columnFilters.proxyTeacher) &&
          includes(record.periodName, columnFilters.period) &&
          includes(record.subjectName, columnFilters.subject)
      )
      .sort((left, right) => {
        const comparison =
          left.proxyDate.localeCompare(right.proxyDate) ||
          left.periodName.localeCompare(right.periodName, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        return sortAscending ? comparison : -comparison;
      });
  }, [applied, columnFilters, query, records, sortAscending]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const uniqueProxyTeachers = new Set(
    filtered.map((record) => record.proxyTeacherId)
  ).size;
  const uniqueAbsentTeachers = new Set(
    filtered.map((record) => record.teacherName)
  ).size;
  const exportRows = filtered.map(exportRow);

  function generateReport(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!fromDate || !toDate) {
      setError("Select both the from date and to date.");
      return;
    }
    if (fromDate > toDate) {
      setError("The from date must be on or before the to date.");
      return;
    }
    setApplied({
      fromDate,
      toDate,
      teacherId: teacherId ? Number(teacherId) : null,
    });
    setQuery("");
    setColumnFilters(emptyColumnFilters);
    setPage(1);
  }

  function updateColumnFilter(key: keyof ColumnFilters, value: string) {
    setColumnFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Proxy Report</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review teacher substitutions by date and proxy teacher.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={generateReport}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="proxy-report-from">From date *</Label>
            <Input
              id="proxy-report-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proxy-report-to">To date *</Label>
            <Input
              id="proxy-report-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proxy-report-teacher">Proxy teacher</Label>
            <SearchableTeacherSelect
              id="proxy-report-teacher"
              value={teacherId}
              options={teachers}
              onChange={setTeacherId}
            />
          </div>
        </div>
        <div className="mt-5">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Generate report
          </Button>
        </div>
      </form>

      {applied ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Assignments"
              value={filtered.length}
              icon={<CalendarDays className="size-4" />}
            />
            <SummaryCard
              label="Proxy teachers"
              value={uniqueProxyTeachers}
              icon={<UserRoundCheck className="size-4" />}
            />
            <SummaryCard
              label="Absent teachers"
              value={uniqueAbsentTeachers}
              icon={<Users className="size-4" />}
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search proxy report..."
                  className="pl-9"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSortAscending((current) => !current);
                    setPage(1);
                  }}
                >
                  {sortAscending ? (
                    <ArrowDownAZ className="size-4" />
                  ) : (
                    <ArrowUpAZ className="size-4" />
                  )}
                  Date {sortAscending ? "oldest first" : "newest first"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!filtered.length}
                  onClick={() =>
                    exportRowsAsCsv({
                      filename: "proxy-report.csv",
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <Download className="size-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={!filtered.length}
                  onClick={() =>
                    exportRowsAsExcel({
                      filename: "proxy-report.xls",
                      title: "Proxy Report",
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  disabled={!filtered.length}
                  onClick={() =>
                    openPrintPreview({
                      title: "Proxy Report",
                      subtitle: `${applied.fromDate} to ${applied.toDate}`,
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <Printer className="size-4" />
                  Print / PDF
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[1280px] table-fixed">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-20">Sr. No.</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-36">Standard</TableHead>
                    <TableHead className="w-32">Division</TableHead>
                    <TableHead className="w-56">Absent teacher</TableHead>
                    <TableHead className="w-56">Proxy teacher</TableHead>
                    <TableHead className="w-36">Period</TableHead>
                    <TableHead className="w-56">Subject</TableHead>
                  </TableRow>
                  <TableRow className="border-t border-slate-200 bg-white hover:bg-white">
                    <TableHead aria-hidden="true" />
                    <TableHead aria-hidden="true" />
                    <FilterCell
                      label="Standard"
                      value={columnFilters.standard}
                      onChange={(value) =>
                        updateColumnFilter("standard", value)
                      }
                    />
                    <FilterCell
                      label="Division"
                      value={columnFilters.division}
                      onChange={(value) =>
                        updateColumnFilter("division", value)
                      }
                    />
                    <FilterCell
                      label="Absent teacher"
                      value={columnFilters.absentTeacher}
                      onChange={(value) =>
                        updateColumnFilter("absentTeacher", value)
                      }
                    />
                    <FilterCell
                      label="Proxy teacher"
                      value={columnFilters.proxyTeacher}
                      onChange={(value) =>
                        updateColumnFilter("proxyTeacher", value)
                      }
                    />
                    <FilterCell
                      label="Period"
                      value={columnFilters.period}
                      onChange={(value) =>
                        updateColumnFilter("period", value)
                      }
                    />
                    <FilterCell
                      label="Subject"
                      value={columnFilters.subject}
                      onChange={(value) =>
                        updateColumnFilter("subject", value)
                      }
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.length ? (
                    visibleRecords.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell>{record.proxyDate}</TableCell>
                        <TableCell>{record.standardName || "—"}</TableCell>
                        <TableCell>{record.divisionName || "—"}</TableCell>
                        <TableCell>{record.teacherName || "—"}</TableCell>
                        <TableCell>
                          {record.proxyTeacherName || "—"}
                        </TableCell>
                        <TableCell>{record.periodName || "—"}</TableCell>
                        <TableCell>{record.subjectName || "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-28 text-center text-slate-500"
                      >
                        No proxy assignments found for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {filtered.length ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </Button>
                  <span className="px-2">
                    Page {currentPage} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === pageCount}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pageCount, current + 1)
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function FilterCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TableHead className="px-2 py-2">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Filter ${label.toLowerCase()}`}
        aria-label={`Filter ${label}`}
        className="h-8 bg-white text-xs font-normal"
      />
    </TableHead>
  );
}

function SearchableTeacherSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: TeacherOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => String(option.id) === value);
  const filteredOptions = options.filter((option) =>
    option.teacherName.toLowerCase().includes(search.trim().toLowerCase())
  );

  function choose(nextValue: string) {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between rounded-lg px-2.5 font-normal"
          >
            <span className="truncate">
              {selected?.teacherName || "All proxy teachers"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-64 gap-2 p-2"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teacher..."
            className="h-8 pl-8"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          <TeacherOptionButton
            label="All proxy teachers"
            selected={!value}
            onClick={() => choose("")}
          />
          {filteredOptions.map((option) => (
            <TeacherOptionButton
              key={option.id}
              label={option.teacherName}
              selected={String(option.id) === value}
              onClick={() => choose(String(option.id))}
            />
          ))}
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-slate-500">
              No teachers found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TeacherOptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
    >
      <Check
        className={`size-4 shrink-0 ${selected ? "text-indigo-600" : "invisible"}`}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}
