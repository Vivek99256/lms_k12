"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  loadTeacherDailyDetails,
  searchTeacherDaily,
  type ActivityAction,
  type DetailColumn,
  type TeacherDailyRecord,
} from "./api";

const PAGE_SIZE = 10;
const summaryColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "teacher", label: "Teacher" },
  { key: "attendance", label: "Attendance" },
  { key: "homeworkAssigned", label: "Homework Assigned" },
  { key: "homeworkChecked", label: "Homework Checked" },
  { key: "parentCommunication", label: "Parent Communication" },
  { key: "studentLeave", label: "Student Leave Approval" },
];
const actions: Array<{
  key: ActivityAction;
  label: string;
  field: keyof Pick<
    TeacherDailyRecord,
    | "attendance"
    | "homeworkAssigned"
    | "homeworkChecked"
    | "parentCommunication"
    | "studentLeave"
  >;
}> = [
  { key: "attendance", label: "Attendance", field: "attendance" },
  {
    key: "homework_assign",
    label: "Homework Assigned",
    field: "homeworkAssigned",
  },
  {
    key: "homework_check",
    label: "Homework Checked",
    field: "homeworkChecked",
  },
  {
    key: "parent_comm",
    label: "Parent Communication",
    field: "parentCommunication",
  },
  {
    key: "student_leave",
    label: "Student Leave Approval",
    field: "studentLeave",
  },
];

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function summaryRow(
  record: TeacherDailyRecord,
  index: number
): TableExportRow {
  return {
    serial: String(index + 1),
    teacher: record.teacherName,
    attendance: record.attendance ? "Yes" : "No",
    homeworkAssigned: record.homeworkAssigned ? "Yes" : "No",
    homeworkChecked: record.homeworkChecked ? "Yes" : "No",
    parentCommunication: record.parentCommunication ? "Yes" : "No",
    studentLeave: record.studentLeave ? "Yes" : "No",
  };
}

export default function TeacherDailyReportPage() {
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState<"" | "Y" | "N">("");
  const [records, setRecords] = useState<TeacherDailyRecord[]>([]);
  const [generated, setGenerated] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailTitle, setDetailTitle] = useState("");
  const [detailColumns, setDetailColumns] = useState<DetailColumn[]>([]);
  const [detailRows, setDetailRows] = useState<Record<string, unknown>[]>([]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return !search
      ? records
      : records.filter((record) =>
          record.teacherName.toLowerCase().includes(search)
        );
  }, [query, records]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const exportRows = filtered.map(summaryRow);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!date) {
      setError("Select a report date.");
      return;
    }
    setLoading(true);
    setError("");
    setQuery("");
    setPage(1);
    try {
      setRecords(await searchTeacherDaily({ date, status }));
      setGenerated(true);
    } catch (searchError: unknown) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Teacher daily report could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(
    record: TeacherDailyRecord,
    action: ActivityAction,
    label: string
  ) {
    setDetailTitle(`${record.teacherName} · ${label}`);
    setDetailColumns([]);
    setDetailRows([]);
    setDetailLoading(true);
    setError("");
    try {
      const result = await loadTeacherDailyDetails({
        teacherId: record.teacherId,
        date,
        action,
      });
      setDetailColumns(result.columns);
      setDetailRows(result.rows);
    } catch (detailError: unknown) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Activity details could not be loaded."
      );
      setDetailTitle("");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Teacher Wise Daily Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review daily teacher activity and open supporting details.
        </p>
      </header>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      <form
        onSubmit={generate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="daily-report-date">Date *</Label>
            <Input
              id="daily-report-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-report-status">Activity status</Label>
            <select
              id="daily-report-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "" | "Y" | "N")
              }
              className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="">All teachers</option>
              <option value="Y">Has activity</option>
              <option value="N">No activity</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Generate report
            </Button>
          </div>
        </div>
      </form>

      {generated ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search teachers..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: "teacher-daily-report.csv",
                    columns: summaryColumns,
                    rows: exportRows,
                  })
                }
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsExcel({
                    filename: "teacher-daily-report.xls",
                    title: "Teacher Wise Daily Report",
                    columns: summaryColumns,
                    rows: exportRows,
                  })
                }
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  openPrintPreview({
                    title: "Teacher Wise Daily Report",
                    subtitle: date,
                    columns: summaryColumns,
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
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>Teacher</TableHead>
                  {actions.map((action) => (
                    <TableHead key={action.key}>{action.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length ? (
                  visible.map((record, index) => (
                    <TableRow key={record.teacherId}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.teacherName}
                      </TableCell>
                      {actions.map((action) => (
                        <TableCell key={action.key}>
                          <ActivityButton
                            active={record[action.field]}
                            onClick={() =>
                              void openDetails(
                                record,
                                action.key,
                                action.label
                              )
                            }
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-slate-500"
                    >
                      No teacher activity found.
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
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {detailTitle ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-detail-title"
        >
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2
                  id="daily-detail-title"
                  className="font-semibold text-slate-900"
                >
                  {detailTitle}
                </h2>
                <p className="text-sm text-slate-500">{date}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close activity details"
                onClick={() => setDetailTitle("")}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-5">
              {detailLoading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="size-5 animate-spin" />
                  Loading activity details...
                </div>
              ) : detailRows.length ? (
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Sr. No.</TableHead>
                      {detailColumns.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        {detailColumns.map((column) => (
                          <TableCell
                            key={column.key}
                            className="max-w-80 whitespace-normal"
                          >
                            {String(row[column.key] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                  No supporting activity records found.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ActivityButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
      aria-label={`${active ? "Yes" : "No"}; open details`}
    >
      {active ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <XCircle className="size-3.5" />
      )}
      {active ? "Yes" : "No"}
    </button>
  );
}
