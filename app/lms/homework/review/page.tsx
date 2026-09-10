"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  PencilLine,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchDropdown,
  type DropdownField,
  type SearchDropdownValues,
} from "@/components/search-dropdown";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import { listReviewQueue, type ReviewQueueRow } from "../api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const academicFields: DropdownField[] = ["section", "standard", "division", "subject"];
const PAGE_SIZE = 10;
const controlClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50";

const STATUS_OPTIONS = ["", "Pending", "Submitted", "Under Review", "Reviewed", "Rejected"] as const;

const exportColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "studentName", label: "Student Name" },
  { key: "rollNo", label: "Roll No" },
  { key: "standard", label: "Standard" },
  { key: "division", label: "Division" },
  { key: "subject", label: "Subject" },
  { key: "title", label: "Title" },
  { key: "submittedAt", label: "Submitted On" },
  { key: "attemptNumber", label: "Attempt" },
  { key: "status", label: "Status" },
];

function readValue(value: SearchDropdownValues[keyof SearchDropdownValues]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function statusVariant(
  status: string
): "inactive" | "pending" | "processing" | "active" | "error" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") return "inactive";
  if (normalized === "submitted") return "pending";
  if (normalized === "under review") return "processing";
  if (normalized === "reviewed") return "active";
  if (normalized === "rejected") return "error";
  return "inactive";
}

export default function HomeworkReviewQueuePage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    setPage(1);
    try {
      const data = await listReviewQueue({ status: status || undefined });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The review queue could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // listReviewQueue only accepts a status filter server-side; the class
  // dropdowns above return standard/division/subject ids while the queue row
  // only carries display labels, so they aren't safe to cross-filter against
  // client-side. The free-text search below covers ad hoc narrowing instead.
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      [row.studentName, row.title, row.standard, row.division, row.subject]
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportRows: TableExportRow[] = filtered.map((row, index) => ({
    serial: String(index + 1),
    studentName: row.studentName,
    rollNo: row.rollNo,
    standard: row.standard,
    division: row.division,
    subject: row.subject,
    title: row.title,
    submittedAt: row.submittedAtFmt || row.submittedAt,
    attemptNumber: String(row.attemptNumber),
    status: row.status,
  }));

  return (
    <RequireStaff>
      <main className="mx-auto space-y-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Homework review</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review and grade student homework submissions.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SearchDropdown
              fields={academicFields}
              values={filters}
              onChange={(values) => setFilters(values)}
              className="contents"
            />
            <div className="space-y-2">
              <Label htmlFor="review-status">Status</Label>
              <select
                id="review-status"
                className={controlClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "All"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

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
                placeholder="Search by student, title or class..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: "homework-review-queue.csv",
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
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsExcel({
                    filename: "homework-review-queue.xls",
                    title: "Homework Review Queue",
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
                disabled={!exportRows.length}
                onClick={() =>
                  openPrintPreview({
                    title: "Homework Review Queue",
                    subtitle: "Submissions awaiting review",
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
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>AI status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-slate-500">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : visible.length ? (
                  visible.map((row, index) => (
                    <TableRow key={row.submissionId}>
                      <TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell>{row.studentName || "-"}</TableCell>
                      <TableCell>{row.rollNo || "-"}</TableCell>
                      <TableCell>{row.standard || "-"}</TableCell>
                      <TableCell>{row.division || "-"}</TableCell>
                      <TableCell>{row.subject || "-"}</TableCell>
                      <TableCell>{row.title || "-"}</TableCell>
                      <TableCell>{row.attemptNumber || 1}</TableCell>
                      <TableCell>{row.submittedAtFmt || row.submittedAt || "-"}</TableCell>
                      <TableCell>
                        {row.aiStatus ? (
                          <span className="text-xs text-slate-500">
                            {row.aiStatus}
                            {row.aiPercentage !== null ? ` (${row.aiPercentage}%)` : ""}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariant(row.status)} label={row.status || "Pending"} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/lms/homework/review/${row.submissionId}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          <PencilLine className="size-4" /> Review
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-28 text-center text-slate-500">
                      <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                      No submissions found for the selected filters.
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
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
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
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </RequireStaff>
  );
}
