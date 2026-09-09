"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  LoaderCircle,
  Send,
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
  listAssignmentSubmissions,
  submitAssignments,
  type AssignmentSubmissionRow,
} from "@/app/lms/lmsAssignment_submission/api";
import { getAssignmentAiStatus } from "@/app/lms/lmsAnnotate_assignment/api";
import { studentSubmissionStatus } from "@/app/lms/_shared/submission-status";

const AI_POLL_INTERVAL_MS = 8000;

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

  // Poll AI evaluation status for rows still "Checking" so the status badge
  // updates in place (e.g. "AI Evaluating" -> "AI Evaluated - Awaiting
  // Teacher Review") once EvaluateAssignmentSubmissionJob finishes, without
  // the student needing to reload the page.
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
            teacherRemarks: update.teacherRemarks || row.teacherRemarks,
          };
        })
      );
    }, AI_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [rows]);

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
                      {(row.examPdfUrl || row.homeworkFileUrl) ? (
                        <a
                          href={row.examPdfUrl || row.homeworkFileUrl}
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
                      {(() => {
                        const status = studentSubmissionStatus(row);
                        return (
                          <StatusBadge
                            variant={status.variant}
                            label={status.label}
                            icon={
                              status.variant === "processing" ? (
                                <LoaderCircle className="size-3 animate-spin" />
                              ) : undefined
                            }
                          />
                        );
                      })()}
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
