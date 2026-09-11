"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  LoaderCircle,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  listSubmissions,
  submitHomework,
  listMySubmissions,
  submitHomeworkSubmission,
  getSubmissionAiStatus,
  type SubmissionInput,
  type SubmissionRow,
  type MySubmissionRow,
} from "@/app/lms/homework/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";
import { isStudentSession } from "@/app/pal/data/pal-lookups";
import { studentSubmissionStatus } from "@/app/lms/_shared/submission-status";

const AI_POLL_INTERVAL_MS = 8000;

/**
 * Homework Submission — role-branched at the same URL, matching how
 * `/lms/dashboard` already splits student vs staff content in one file.
 * Students get an Assignment-Submission-style table (self-scoped, safe
 * `lms-homework/my-submissions` endpoint); staff keep the existing bulk
 * class-wide recording tool below, byte-for-byte unchanged.
 */
export default function HomeworkSubmissionEntryPage() {
  const isStudent = useMemo(() => isStudentSession(), []);
  if (isStudent) {
    return <StudentHomeworkSubmissionView />;
  }
  return <StaffHomeworkSubmissionPage />;
}

function StudentHomeworkSubmissionView() {
  const router = useRouter();
  const [rows, setRows] = useState<MySubmissionRow[]>([]);
  const [files, setFiles] = useState<Record<number, File>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listMySubmissions());
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Your homework could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll AI evaluation status for rows still "Checking", same pattern as
  // /lms/lmsAssignment_submission.
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
            return await getSubmissionAiStatus(row.id);
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
            status: update.status || row.status,
            aiStatus: update.aiStatus,
            teacherRemarks: update.teacherRemarks || row.teacherRemarks,
            feedbackPublished: update.feedbackPublished || row.feedbackPublished,
          };
        })
      );
    }, AI_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [rows]);

  const pendingCount = useMemo(
    () => rows.filter((row) => row.files.length === 0).length,
    [rows]
  );

  function pickFile(homeworkId: number, file: File | null) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[homeworkId] = file;
      else delete next[homeworkId];
      return next;
    });
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    const uploads = Object.entries(files);
    if (uploads.length === 0) {
      setError("Choose at least one file to submit.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        uploads.map(([homeworkId, file]) =>
          submitHomeworkSubmission({
            homeworkId: Number(homeworkId),
            remarks: "",
            files: [file],
          })
        )
      );
      setSuccess(`Submitted ${uploads.length} homework(s) successfully.`);
      setFiles({});
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your homework could not be submitted."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Homework submission
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Download homework, upload your completed work, and track your
          teacher&apos;s remarks.
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
                <TableHead>Homework title</TableHead>
                <TableHead>Assigned on</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Homework file</TableHead>
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
                rows.map((row, index) => {
                  const submitted = row.files.length > 0;
                  const status = studentSubmissionStatus({
                    studentSubmitted: submitted,
                    teacherReviewed: row.status.toLowerCase() === "reviewed",
                    aiStatus: row.aiStatus,
                  });
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.subjectName || "-"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => router.push(`/lms/homework/${row.id}`)}
                          className="text-left text-sm font-medium text-blue-600 hover:underline"
                        >
                          {row.title || "Untitled homework"}
                        </button>
                      </TableCell>
                      <TableCell>{row.dateFmt || row.date || "-"}</TableCell>
                      <TableCell>
                        {row.submissionDateFmt || row.submissionDate || "-"}
                      </TableCell>
                      <TableCell>
                        {row.referenceFileUrl ? (
                          <a
                            href={row.referenceFileUrl}
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
                        {submitted ? (
                          <div className="space-y-1">
                            {row.files.map((file) => (
                              <a
                                key={file.id}
                                href={file.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
                              >
                                <FileCheck2 className="size-4" />
                                {file.originalName || "Submitted file"}
                              </a>
                            ))}
                          </div>
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
                      <TableCell className="max-w-56 min-w-40 whitespace-normal align-top py-2.5">
                        {row.feedbackPublished && row.teacherRemarks ? (
                          <p className="line-clamp-3 whitespace-pre-line break-words text-sm text-slate-600">
                            {row.teacherRemarks}
                          </p>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={status.variant}
                          label={status.label}
                          icon={
                            status.variant === "processing" ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : undefined
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-28 text-center text-slate-500"
                  >
                    <FileCheck2 className="mx-auto mb-2 size-8 text-slate-300" />
                    No homework has been assigned to you yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {pendingCount} homework(s) pending submission
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

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type RowState = { remark: string; file: File | null };

function StaffHomeworkSubmissionPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [submissionDate, setSubmissionDate] = useState("");
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allChecked = rows.length > 0 && selected.size === rows.length;

  const load = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    setRowState({});
    try {
      const data = await listSubmissions({
        grade: readValue(filters.section ?? ""),
        standard: readValue(filters.standard ?? ""),
        division: readValue(filters.division ?? ""),
        subject: readValue(filters.subject ?? ""),
        submissionDate,
      });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Homework could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, submissionDate]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map((row) => row.id))
    );
  }

  function updateRow(id: number, patch: Partial<RowState>) {
    setRowState((prev) => ({
      ...prev,
      [id]: {
        remark: prev[id]?.remark ?? "",
        file: prev[id]?.file ?? null,
        ...patch,
      },
    }));
  }

  const items = useMemo<SubmissionInput[]>(
    () =>
      Array.from(selected).map((homeworkId) => ({
        homeworkId,
        remark: rowState[homeworkId]?.remark ?? "",
        file: rowState[homeworkId]?.file ?? null,
      })),
    [selected, rowState]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (items.length === 0) {
      setError("Select at least one homework to submit.");
      return;
    }
    setSaving(true);
    try {
      const count = await submitHomework(items);
      setSuccess(`${count} submission(s) recorded successfully.`);
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Homework submission failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireStaff>
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Homework Submission
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Record student homework submissions and attach checked work.
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SearchDropdown
            fields={academicFields}
            values={filters}
            onChange={(values) => setFilters(values)}
            className="contents"
          />
          <div className="space-y-2">
            <Label htmlFor="submission-date">Submission date</Label>
            <Input
              id="submission-date"
              type="date"
              value={submissionDate}
              onChange={(event) => setSubmissionDate(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Choose a section, standard, division and subject, then search.
          </p>
          <Button
            type="button"
            onClick={load}
            disabled={loading}
            className="w-full sm:w-auto"
          >
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
                    />
                  </TableHead>
                  <TableHead>GR No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>HW Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>HW File</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead>Submission File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="h-24 text-center text-slate-500"
                    >
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.studentName}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                        />
                      </TableCell>
                      <TableCell>{row.enrollmentNo || "-"}</TableCell>
                      <TableCell>{row.studentName}</TableCell>
                      <TableCell>{row.standard || "-"}</TableCell>
                      <TableCell>{row.division || "-"}</TableCell>
                      <TableCell>{row.mobile || "-"}</TableCell>
                      <TableCell>{row.homeworkDate || "-"}</TableCell>
                      <TableCell>{row.title || "-"}</TableCell>
                      <TableCell className="max-w-40 truncate" title={row.description}>
                        {row.description || "-"}
                      </TableCell>
                      <TableCell>
                        {row.image ? (
                          <a
                            href={row.image}
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
                      <TableCell>
                        <Textarea
                          rows={2}
                          className="min-w-48"
                          value={rowState[row.id]?.remark ?? ""}
                          onChange={(event) =>
                            updateRow(row.id, { remark: event.target.value })
                          }
                          placeholder="Remark"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="min-w-44"
                          onChange={(event) =>
                            updateRow(row.id, {
                              file: event.target.files?.[0] ?? null,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="h-36 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <FileCheck2 className="size-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">
                          No pending homework
                        </p>
                        <p className="text-xs text-slate-400">
                          Try a different standard, division or section.
                        </p>
                      </div>
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
            <Button type="submit" disabled={saving || rows.length === 0}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Submit
            </Button>
          </div>
        </form>
      ) : null}
    </main>
    </RequireStaff>
  );
}
