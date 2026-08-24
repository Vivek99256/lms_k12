"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  LoaderCircle,
  Send,
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
  listAssignmentSubmissions,
  submitAssignments,
  type AssignmentSubmissionRow,
} from "@/app/lms/lmsAssignment_submission/api";

export default function AssignmentSubmissionPage() {
  const [rows, setRows] = useState<AssignmentSubmissionRow[]>([]);
  const [files, setFiles] = useState<Record<number, File>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listAssignmentSubmissions());
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Your assignments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = useMemo(
    () => rows.filter((row) => !row.studentSubmitted).length,
    [rows]
  );

  function pickFile(assignmentId: number, file: File | null) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[assignmentId] = file;
      else delete next[assignmentId];
      return next;
    });
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    const uploads = Object.entries(files).map(([assignmentId, file]) => ({
      assignmentId: Number(assignmentId),
      file,
    }));
    if (uploads.length === 0) {
      setError("Choose at least one file to submit.");
      return;
    }
    setSaving(true);
    try {
      const updated = await submitAssignments(uploads);
      setSuccess(`Submitted ${updated} assignment(s) successfully.`);
      setFiles({});
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your assignment could not be submitted."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Student assignment submission
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Download the assignment paper, upload your completed work, and track
          your teacher&apos;s remarks.
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
      {success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          <CheckCircle2 className="size-4" />
          {success}
        </div>
      ) : null}

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Assignment title</TableHead>
                <TableHead>Assigned on</TableHead>
                <TableHead>Submission date</TableHead>
                <TableHead>Assignment paper</TableHead>
                <TableHead>Your submission</TableHead>
                <TableHead>Teacher remarks</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-slate-500"
                  >
                    <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : rows.length ? (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>{index + 1}</TableCell>
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
                      {row.studentSubmitted ? (
                        <a
                          href={row.submissionFileUrl || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
                        >
                          <FileCheck2 className="size-4" /> Submitted file
                        </a>
                      ) : (
                        <input
                          type="file"
                          aria-label={`Upload file for ${row.title}`}
                          onChange={(event) =>
                            pickFile(row.id, event.target.files?.[0] ?? null)
                          }
                          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                        />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-slate-600">
                      {row.teacherRemarks || "-"}
                    </TableCell>
                    <TableCell>
                      {row.teacherReviewed ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Reviewed
                        </span>
                      ) : row.studentSubmitted ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Awaiting review
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Not submitted
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-28 text-center text-slate-500"
                  >
                    <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                    No assignments have been assigned to you yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {pendingCount} assignment(s) pending submission
          </span>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || Object.keys(files).length === 0}
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit
          </Button>
        </div>
      </section>
    </main>
  );
}
