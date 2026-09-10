"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Download,
  FileText,
  LoaderCircle,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getHomeworkDetail,
  type HomeworkDetail,
  type HomeworkSubmissionRecord,
} from "../api";
import SubmitHomeworkDialog from "./SubmitHomeworkDialog";

/** Extensions treated as previewable images; everything else falls back to an iframe (PDF viewer). */
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function fileExtension(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.has(fileExtension(url));
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

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BLOCKING_STATUSES = new Set(["under review", "reviewed"]);

export default function HomeworkDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const homeworkId = Number(params?.id);

  const [detail, setDetail] = useState<HomeworkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!homeworkId || Number.isNaN(homeworkId)) {
      setError("Invalid homework reference.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getHomeworkDetail(homeworkId);
      setDetail(data);
    } catch (loadError: unknown) {
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This homework could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [homeworkId]);

  useEffect(() => {
    load();
  }, [load]);

  const latestSubmission: HomeworkSubmissionRecord | null = useMemo(() => {
    if (!detail || detail.submissions.length === 0) return null;
    return [...detail.submissions].sort(
      (a, b) => b.attemptNumber - a.attemptNumber
    )[0];
  }, [detail]);

  const blockedStatus = latestSubmission
    ? BLOCKING_STATUSES.has(latestSubmission.status.trim().toLowerCase())
    : false;

  function handleSubmitted() {
    setDialogOpen(false);
    setNotice(
      latestSubmission
        ? "Homework resubmitted successfully."
        : "Homework submitted successfully."
    );
    void load();
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {detail?.homework.title || "Homework details"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View the assignment details and manage your submissions.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push("/lms/homework")}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        </div>
      ) : !detail ? (
        !error ? (
          <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
            This homework could not be found.
          </section>
        ) : null
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Assignment details</h2>
              <p className="whitespace-pre-line break-words text-sm text-slate-700">
                {detail.homework.description || "No description provided."}
              </p>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <BookOpen className="size-4 shrink-0 text-slate-400" />
                  <span>{detail.homework.subjectName || "Subject not set"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="size-4 shrink-0 text-slate-400" />
                  <span>{detail.homework.teacherName || "Teacher not set"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="size-4 shrink-0 text-slate-400" />
                  <span>Assigned: {detail.homework.dateFmt || detail.homework.date || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="size-4 shrink-0 text-slate-400" />
                  <span>
                    Due: {detail.homework.submissionDateFmt || detail.homework.submissionDate || "-"}
                  </span>
                </div>
              </dl>

              {detail.homework.sourceType === "question_bank" &&
              detail.homework.questions?.length ? (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Homework questions
                  </p>
                  <ol className="space-y-2">
                    {detail.homework.questions.map((question, index) => (
                      <li
                        key={question.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <span className="min-w-0 text-sm text-slate-700">
                          <span className="mr-2 font-medium text-slate-400">
                            {index + 1}.
                          </span>
                          {question.title || "Untitled question"}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Type {question.questionTypeId}
                          </span>
                          <span className="text-xs text-slate-400">
                            {question.points} pts
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : detail.homework.referenceFileUrl ? (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Reference file
                  </p>
                  {isImageUrl(detail.homework.referenceFileUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.homework.referenceFileUrl}
                      alt="Reference attachment"
                      className="max-h-64 w-full rounded-lg border border-slate-200 object-contain"
                    />
                  ) : (
                    <iframe
                      title="Reference attachment"
                      src={detail.homework.referenceFileUrl}
                      className="aspect-[4/3] w-full rounded-lg border border-slate-200"
                    />
                  )}
                  <a
                    href={detail.homework.referenceFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <FileText className="size-4" /> Open in new tab
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-700">Your submission</h2>
                <Button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  disabled={blockedStatus}
                >
                  <Send className="size-4" />
                  {latestSubmission ? "Resubmit homework" : "Submit homework"}
                </Button>
              </div>
              {blockedStatus ? (
                <p className="mt-2 text-xs text-slate-500">
                  {latestSubmission?.status === "Reviewed"
                    ? "This homework has already been reviewed and cannot be resubmitted."
                    : "This submission is under review — you can resubmit once the review is complete."}
                </p>
              ) : null}

              {!detail.submissions.length ? (
                <p className="mt-6 text-sm text-slate-500">
                  You haven&apos;t submitted this homework yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {[...detail.submissions]
                    .sort((a, b) => b.attemptNumber - a.attemptNumber)
                    .map((submission) => (
                      <li
                        key={submission.id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            Attempt {submission.attemptNumber}
                          </span>
                          <StatusBadge
                            variant={statusVariant(submission.status)}
                            label={submission.status || "Pending"}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted {submission.submittedAtFmt || submission.submittedAt || "-"}
                        </p>

                        {submission.submissionRemarks ? (
                          <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">
                            {submission.submissionRemarks}
                          </p>
                        ) : null}

                        {submission.files.length ? (
                          <ul className="mt-3 space-y-1">
                            {submission.files.map((file) => (
                              <li key={file.id}>
                                <a
                                  href={file.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                                >
                                  <Download className="size-3.5" />
                                  {file.originalName || "Download file"}
                                  {file.fileSize ? (
                                    <span className="text-xs text-slate-400">
                                      ({formatBytes(file.fileSize)})
                                    </span>
                                  ) : null}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {submission.feedbackPublished && submission.teacherRemarks ? (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                              Teacher remarks
                            </p>
                            <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">
                              {submission.teacherRemarks}
                            </p>
                          </div>
                        ) : null}

                        {submission.aiStatus &&
                        submission.aiStatus.toLowerCase() === "evaluated" ? (
                          <p className="mt-2 text-xs text-slate-500">
                            AI score: {submission.aiScore ?? "-"}
                            {submission.aiTotalQuestions
                              ? ` / ${submission.aiTotalQuestions}`
                              : ""}
                            {submission.aiPercentage !== null
                              ? ` (${submission.aiPercentage}%)`
                              : ""}
                          </p>
                        ) : submission.aiStatus &&
                          submission.aiStatus.toLowerCase() === "checking" ? (
                          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                            <LoaderCircle className="size-3 animate-spin" />
                            AI is checking this submission…
                          </p>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>

          <SubmitHomeworkDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            homeworkId={homeworkId}
            onSubmitted={handleSubmitted}
          />
        </>
      )}
    </main>
  );
}
