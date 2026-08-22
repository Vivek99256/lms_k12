"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Download,
  FileCheck2,
  LoaderCircle,
  PencilLine,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAnnotateAssignments,
  type AnnotateRow,
} from "@/app/lms/lmsAnnotate_assignment/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

export default function AnnotateAssignmentPage() {
  const [rows, setRows] = useState<AnnotateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          : "Assignments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Assignment title</TableHead>
                <TableHead>Assigned on</TableHead>
                <TableHead>Submission date</TableHead>
                <TableHead>Assignment paper</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-slate-500"
                  >
                    <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : rows.length ? (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.standardName || "-"}</TableCell>
                    <TableCell>{row.studentName || "-"}</TableCell>
                    <TableCell>{row.subjectName || "-"}</TableCell>
                    <TableCell>{row.title || "-"}</TableCell>
                    <TableCell>{row.assignedOn || "-"}</TableCell>
                    <TableCell>{row.submissionDate || "-"}</TableCell>
                    <TableCell>
                      {row.examPdfUrl ? (
                        <a
                          href={row.examPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Download className="size-4" /> Download
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                        <span className="text-slate-400">Not submitted</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!row.studentSubmitted ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Awaiting submission
                        </span>
                      ) : row.teacherReviewed ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Completed
                        </span>
                      ) : (
                        <Link
                          href={`/lms/lmsAnnotate_assignment/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          <PencilLine className="size-4" /> Review
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-28 text-center text-slate-500"
                  >
                    <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                    No assignments found for this academic year.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
    </RequireStaff>
  );
}
