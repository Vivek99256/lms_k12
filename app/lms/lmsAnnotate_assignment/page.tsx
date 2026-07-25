"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  LoaderCircle,
  PenLine,
  Search,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  SearchDropdown,
  type DropdownField,
  type SearchDropdownValues,
} from "@/components/search-dropdown";
import {
  listReviewAssignments,
  type AnnotateRow,
} from "@/app/lms/lmsAssignment/api";

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];
const PAGE_SIZE = 10;
const controlClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50";

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function AnnotateAssignmentPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [teacherStatus, setTeacherStatus] = useState<"" | "Y" | "N">("");
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
      const data = await listReviewAssignments({
        grade: readValue(filters.section ?? ""),
        standard: readValue(filters.standard ?? ""),
        division: readValue(filters.division ?? ""),
        subject: readValue(filters.subject ?? ""),
        teacherStatus,
      });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Submissions could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, teacherStatus]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      [row.studentName, row.title, row.subjectName, row.standardName].some(
        (value) => value.toLowerCase().includes(search)
      )
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Annotate Assignment
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review submitted assignments and record marks and remarks.
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
          />
          <div className="space-y-2">
            <Label htmlFor="teacher-status">Review status</Label>
            <select
              id="teacher-status"
              className={controlClass}
              value={teacherStatus}
              onChange={(event) =>
                setTeacherStatus(event.target.value as "" | "Y" | "N")
              }
            >
              <option value="">All</option>
              <option value="N">Pending review</option>
              <option value="Y">Reviewed</option>
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
                placeholder="Search submissions..."
                className="h-8 pl-8"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Assignment Title</TableHead>
                  <TableHead>Assigned On</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Download File</TableHead>
                  <TableHead>Submission File</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : visible.length ? (
                  visible.map((row, index) => {
                    const submitted = row.studentSubmissionStatus === "Y";
                    const reviewed = row.teacherSubmissionStatus === "Y";
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell>{row.standardName || "-"}</TableCell>
                        <TableCell>{row.studentName || "-"}</TableCell>
                        <TableCell>{row.subjectName || "-"}</TableCell>
                        <TableCell>{row.title || "-"}</TableCell>
                        <TableCell>{row.createdDate || "-"}</TableCell>
                        <TableCell>{row.submissionDate || "-"}</TableCell>
                        <TableCell>
                          {row.examPdf ? (
                            <a
                              href={row.examPdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 underline"
                            >
                              <Download className="size-3" />
                              File
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {submitted && row.submissionImage ? (
                            <a
                              href={row.submissionImage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 underline"
                            >
                              <FileText className="size-3" />
                              Submitted
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {!submitted ? (
                            <span className="text-slate-400">Not submitted</span>
                          ) : reviewed ? (
                            <Badge variant="secondary">Completed</Badge>
                          ) : (
                            <Link
                              href={`/lms/lmsAnnotate_assignment/${row.id}`}
                              className={cn(
                                buttonVariants({ size: "sm", variant: "outline" })
                              )}
                            >
                              <PenLine className="size-3" />
                              Review
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-28 text-center text-slate-500">
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
  );
}
