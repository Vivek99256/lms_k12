"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  LoaderCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listMyAssignments,
  submitAssignments,
  type AssignmentSubmissionInput,
  type AssignmentSubmissionRow,
} from "@/app/lms/lmsAssignment/api";

export default function AssignmentSubmissionPage() {
  const [rows, setRows] = useState<AssignmentSubmissionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [files, setFiles] = useState<Record<number, File | null>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    setSelected(new Set());
    setFiles({});
    try {
      const data = await listMyAssignments();
      setRows(data);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Only rows the student has not submitted yet are selectable for upload.
  const pending = useMemo(
    () => rows.filter((row) => row.studentSubmissionStatus !== "Y"),
    [rows]
  );
  const allChecked =
    pending.length > 0 && pending.every((row) => selected.has(row.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (pending.every((row) => prev.has(row.id))) return new Set();
      return new Set(pending.map((row) => row.id));
    });
  }

  const items = useMemo<AssignmentSubmissionInput[]>(
    () =>
      Array.from(selected).map((assignmentId) => ({
        assignmentId,
        file: files[assignmentId] ?? null,
      })),
    [selected, files]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (items.length === 0) {
      setError("Select at least one assignment to submit.");
      return;
    }
    if (items.some((item) => !item.file)) {
      setError("Attach a file for every selected assignment.");
      return;
    }
    setSaving(true);
    try {
      const count = await submitAssignments(items);
      setSuccess(`${count} assignment(s) submitted successfully.`);
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Assignment submission failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Assignment Submission
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Download your assignments, attach your work and submit.
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

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={pending.length === 0}
                  />
                </TableHead>
                <TableHead>Sr. No.</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Assignment Title</TableHead>
                <TableHead>Assigned On</TableHead>
                <TableHead>Submission Date</TableHead>
                <TableHead>Download File</TableHead>
                <TableHead>Submission File</TableHead>
                <TableHead>Teacher Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                    <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : rows.length ? (
                rows.map((row, index) => {
                  const submitted = row.studentSubmissionStatus === "Y";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.title}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          disabled={submitted}
                        />
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>
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
                            Attachment
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {submitted ? (
                          <a
                            href={row.submissionImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 underline"
                          >
                            Submitted File
                          </a>
                        ) : (
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="min-w-44"
                            onChange={(event) =>
                              setFiles((prev) => ({
                                ...prev,
                                [row.id]: event.target.files?.[0] ?? null,
                              }))
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate" title={row.teacherRemarks}>
                        {row.teacherSubmissionStatus === "Y" ? (
                          row.teacherRemarks || (
                            <Badge variant="secondary">Reviewed</Badge>
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-slate-500">
                    <FileCheck2 className="mx-auto mb-2 size-8 text-slate-300" />
                    No assignments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {selected.size} selected
          </span>
          <Button type="submit" disabled={saving || pending.length === 0}>
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit
          </Button>
        </div>
      </form>
    </main>
  );
}
