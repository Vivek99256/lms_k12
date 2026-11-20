"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Download,
  FileCheck2,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  RotateCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getAssignmentAiStatus,
  listAnnotateAssignments,
  reevaluateAssignment,
  type AnnotateRow,
} from "@/app/lms/lmsAnnotate_assignment/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const AI_POLL_INTERVAL_MS = 8000;
const PAGE_SIZE = 25;

function aiStatusVariant(
  status: string,
  assignmentSourceType?: string
): "processing" | "active" | "error" | "default" {
  const normalized = status.toLowerCase();
  if (normalized === "checking") return "processing";
  if (normalized === "evaluated") return "active";
  if (normalized.includes("fail")) return "error";
  if (
    assignmentSourceType === "uploaded_homework" &&
    normalized === "not applicable"
  ) {
    return "default";
  }
  return "default";
}

function aiStatusLabel(
  status: string,
  assignmentSourceType?: string
): string {
  const normalized = status.toLowerCase();
  if (normalized === "checking") return "Checking...";
  if (
    assignmentSourceType === "uploaded_homework" &&
    normalized === "not applicable"
  ) {
    return "Not Applicable";
  }
  return status || "-";
}

export default function AnnotateAssignmentPage() {
  const [rows, setRows] = useState<AnnotateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Client-side filters: the list is already scoped to the school and year by the API.
  const [search, setSearch] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState<
    "all" | "submitted" | "pending"
  >("submitted");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reevaluatingId, setReevaluatingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const subjectOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.subjectName).filter(Boolean))).sort(),
    [rows]
  );
  const titleOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.title).filter(Boolean))).sort(),
    [rows]
  );

  const counts = useMemo(() => {
    const submitted = rows.filter((row) => row.studentSubmitted).length;
    return { all: rows.length, submitted, pending: rows.length - submitted };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (submissionFilter === "submitted" && !row.studentSubmitted) return false;
      if (submissionFilter === "pending" && row.studentSubmitted) return false;
      if (subjectFilter && row.subjectName !== subjectFilter) return false;
      if (titleFilter && row.title !== titleFilter) return false;
      if (needle) {
        const haystack = `${row.studentName} ${row.enrollmentNo} ${row.mobile}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, search, submissionFilter, subjectFilter, titleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleReevaluate = async (row: AnnotateRow) => {
    setReevaluatingId(row.id);
    setActionError("");
    try {
      await reevaluateAssignment(row.id);
      // The status poll below picks the row up and fills in the score when it finishes.
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, aiStatus: "Checking", aiFailureReason: "" }
            : item
        )
      );
    } catch (reevaluateError: unknown) {
      setActionError(
        reevaluateError instanceof Error
          ? reevaluateError.message
          : "Re-evaluation could not be started."
      );
    } finally {
      setReevaluatingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listAnnotateAssignments());
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Assignments couldn’t be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
            evaluatedAt: update.evaluatedAt,
          };
        })
      );
    }, AI_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [rows]);

  return (
    <RequireStaff>
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Annotate assignment
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review student submissions and grade them against the assigned exam
            paper.
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

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["submitted", "Submitted", counts.submitted],
              ["pending", "Not submitted", counts.pending],
              ["all", "All", counts.all],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSubmissionFilter(value);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                submissionFilter === value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label} <span className="ml-1 tabular-nums opacity-80">{count}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative block">
            <span className="sr-only">Search student</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search student name, enrollment no. or mobile"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={subjectFilter}
            onChange={(event) => {
              setSubjectFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by subject"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
          <select
            value={titleFilter}
            onChange={(event) => {
              setTitleFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by assignment"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All assignments</option>
            {titleOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Subject / Assignment</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>AI Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-slate-500"
                  >
                    <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : pageRows.length ? (
                pageRows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {row.studentName || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Std {row.standardName || "-"}
                        {row.divisionName ? ` - ${row.divisionName}` : ""}
                        {row.enrollmentNo ? ` · ${row.enrollmentNo}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {row.title || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.subjectName || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <div>Assigned: {row.assignedOn || "-"}</div>
                      <div className="text-xs text-slate-500">
                        Due: {row.submissionDate || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 whitespace-nowrap">
                        {row.examPdfUrl || row.homeworkFileUrl ? (
                          <a
                            href={row.examPdfUrl || row.homeworkFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                          >
                            <Download className="size-4" /> Paper
                          </a>
                        ) : null}
                        {row.studentSubmitted && row.submissionFileUrl ? (
                          <a
                            href={row.submissionFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
                          >
                            <FileCheck2 className="size-4" /> Submitted file
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Not submitted
                          </span>
                        )}
                        {row.reviewedPdfUrl ? (
                          <a
                            href={row.reviewedPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                          >
                            <Download className="size-4" /> Evaluation PDF
                          </a>
                        ) : null}
                      </div>
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
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.aiStatus ? (
                        <div className="max-w-[240px] space-y-1">
                          <StatusBadge
                            variant={aiStatusVariant(row.aiStatus, row.assignmentSourceType)}
                            label={aiStatusLabel(row.aiStatus, row.assignmentSourceType)}
                            icon={
                              row.aiStatus.toLowerCase() === "checking" ? (
                                <LoaderCircle className="size-3 animate-spin" />
                              ) : undefined
                            }
                            title={row.aiFailureReason || undefined}
                          />
                          {row.aiFailureReason &&
                          row.aiStatus.toLowerCase() !== "evaluated" ? (
                            <p className="line-clamp-2 text-xs text-red-600">
                              {row.aiFailureReason}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!row.studentSubmitted ? (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Awaiting submission
                        </span>
                      ) : row.teacherReviewed ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Completed
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-1.5">
                          <Link
                            href={`/lms/lmsAnnotate_assignment/${row.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            <PencilLine className="size-4" /> Review
                          </Link>
                          {/* Once the AI has scored it, evaluation is final: no re-evaluate. */}
                          {row.aiStatus.toLowerCase() !== "evaluated" &&
                          row.aiScore === null ? (
                            <button
                              type="button"
                              onClick={() => handleReevaluate(row)}
                              disabled={
                                reevaluatingId === row.id ||
                                row.aiStatus.toLowerCase() === "checking"
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RotateCw
                                className={`size-4 ${
                                  reevaluatingId === row.id ? "animate-spin" : ""
                                }`}
                              />
                              Re-evaluate
                            </button>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-28 text-center text-slate-500"
                  >
                    <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                    {rows.length
                      ? "No assignments match these filters."
                      : "No assignments found for this academic year."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filteredRows.length > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of{" "}
              {filteredRows.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
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
