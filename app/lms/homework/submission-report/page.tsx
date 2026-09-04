"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Printer,
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
import {
  getAssignmentAiStatus,
  listAnnotateAssignments,
  type AnnotateRow,
} from "@/app/lms/lmsAnnotate_assignment/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const AI_POLL_INTERVAL_MS = 8000;

function aiStatusVariant(
  status: string
): "processing" | "active" | "error" | "default" {
  const normalized = status.toLowerCase();
  if (normalized === "checking") return "processing";
  if (normalized === "evaluated") return "active";
  if (normalized.includes("fail")) return "error";
  return "default";
}

function aiStatusLabel(status: string): string {
  return status.toLowerCase() === "checking" ? "Checking..." : status || "-";
}

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];
const PAGE_SIZE = 10;
const controlClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50";
const exportColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "grNo", label: "GR No" },
  { key: "name", label: "Student Name" },
  { key: "stdDiv", label: "Std/Div" },
  { key: "mobile", label: "SMS No." },
  { key: "sentDate", label: "Sent Date" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "submissionDate", label: "Submission Date" },
  { key: "remark", label: "Teacher Remarks" },
  { key: "aiScore", label: "AI Score" },
  { key: "status", label: "Status" },
];

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function StudentHomeworkSubmissionReportPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<"" | "Y" | "N">("");
  const [rows, setRows] = useState<AnnotateRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    setSearched(true);
    setPage(1);
    try {
      const data = await listAnnotateAssignments({
        grade: readValue(filters.section ?? ""),
        standardId: readValue(filters.standard ?? ""),
        divisionId: readValue(filters.division ?? ""),
        subjectId: readValue(filters.subject ?? ""),
        fromDate,
        toDate,
        status,
      });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Report could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, fromDate, toDate, status]);

  // Poll AI evaluation status for rows still "Checking" so the badge/score/PDF
  // link update in place once EvaluateAssignmentSubmissionJob finishes.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    const checkingIds = rows
      .filter((row) => row.aiStatus.toLowerCase() === "checking")
      .map((row) => row.id);
    if (!checkingIds.length) return;

    const interval = setInterval(async () => {
      const stillChecking = rowsRef.current.filter(
        (row) => row.aiStatus.toLowerCase() === "checking"
      );
      if (!stillChecking.length) {
        clearInterval(interval);
        return;
      }
      const updates = await Promise.all(
        stillChecking.map(async (row) => {
          try {
            return await getAssignmentAiStatus(row.id);
          } catch {
            return null;
          }
        })
      );
      setRows((current) =>
        current.map((row) => {
          const update = updates.find((item) => item && item.id === row.id);
          if (!update) return row;
          return {
            ...row,
            aiStatus: update.aiStatus,
            aiFailureReason: update.aiFailureReason,
            aiScore: update.aiScore,
            aiTotalQuestions: update.aiTotalQuestions,
            aiPercentage: update.aiPercentage,
            reviewedPdfUrl: update.reviewedPdfUrl || row.reviewedPdfUrl,
            teacherRemarks: update.teacherRemarks || row.teacherRemarks,
            evaluatedAt: update.evaluatedAt,
          };
        })
      );
    }, AI_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      [row.studentName, row.title, row.description, row.standardName, row.divisionName]
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const exportRows: TableExportRow[] = filtered.map((row, index) => ({
    serial: String(index + 1),
    grNo: row.enrollmentNo,
    name: row.studentName,
    stdDiv: [row.standardName, row.divisionName].filter(Boolean).join("-"),
    mobile: row.mobile,
    sentDate: row.assignedOn,
    title: row.title,
    description: row.description,
    submissionDate: row.submissionDate,
    remark: row.teacherRemarks,
    aiScore:
      row.aiScore !== null && row.aiTotalQuestions !== null
        ? `${row.aiScore}/${row.aiTotalQuestions}`
        : "-",
    status: row.aiStatus || (row.studentSubmitted ? "Submitted" : "Pending"),
  }));

  return (
    <RequireStaff>
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Student Homework Submission Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track assignment submissions, remarks and AI-checked work
          (sourced from the LMS Assignment module).
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SearchDropdown
            fields={academicFields}
            values={filters}
            onChange={(values) => setFilters(values)}
            className="contents"
          />
          <div className="space-y-2">
            <Label htmlFor="from-date">From date</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date">To date</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className={controlClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | "Y" | "N")}
            >
              <option value="">All</option>
              <option value="Y">Submitted</option>
              <option value="N">Pending</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search
          </Button>
        </div>
      </section>

      {searched ? (
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
                placeholder="Search submission report..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: "homework-submission-report.csv",
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
                    filename: "homework-submission-report.xls",
                    title: "Student Homework Submission Report",
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
                    title: "Student Homework Submission Report",
                    subtitle: "Assignment submissions",
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
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>GR No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Std/Div</TableHead>
                  <TableHead>SMS No.</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Assignment Paper</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Teacher Remarks</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Reviewed PDF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Student File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="h-24 text-center text-slate-500">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : visible.length ? (
                  visible.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>{row.enrollmentNo || "-"}</TableCell>
                      <TableCell>{row.studentName}</TableCell>
                      <TableCell>
                        {[row.standardName, row.divisionName].filter(Boolean).join("-") || "-"}
                      </TableCell>
                      <TableCell>{row.mobile || "-"}</TableCell>
                      <TableCell>{row.assignedOn || "-"}</TableCell>
                      <TableCell>{row.title || "-"}</TableCell>
                      <TableCell className="max-w-48 truncate" title={row.description}>
                        {row.description || "-"}
                      </TableCell>
                      <TableCell>
                        {row.examPdfUrl ? (
                          <a
                            href={row.examPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{row.submissionDate || "-"}</TableCell>
                      <TableCell className="max-w-48 whitespace-pre-line" title={row.teacherRemarks}>
                        {row.teacherRemarks || "-"}
                      </TableCell>
                      <TableCell>
                        {row.aiScore !== null && row.aiTotalQuestions !== null ? (
                          <span className="font-mono text-sm tabular-nums">
                            {row.aiScore}/{row.aiTotalQuestions}
                            {row.aiPercentage !== null ? (
                              <span className="ml-1 text-slate-500">
                                ({row.aiPercentage}%)
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.reviewedPdfUrl ? (
                          <a
                            href={row.reviewedPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 underline"
                          >
                            <Download className="size-3" />
                            Download Evaluation
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.aiStatus ? (
                          <StatusBadge
                            variant={aiStatusVariant(row.aiStatus)}
                            label={aiStatusLabel(row.aiStatus)}
                            icon={
                              row.aiStatus.toLowerCase() === "checking" ? (
                                <LoaderCircle className="size-3 animate-spin" />
                              ) : undefined
                            }
                            title={row.aiFailureReason || undefined}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.studentSubmitted && row.submissionFileUrl ? (
                          <a
                            href={row.submissionFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 underline"
                          >
                            <FileText className="size-3" />
                            Submitted
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={15} className="h-28 text-center text-slate-500">
                      <FileText className="mx-auto mb-2 size-8 text-slate-300" />
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
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
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
      ) : null}
    </main>
    </RequireStaff>
  );
}
