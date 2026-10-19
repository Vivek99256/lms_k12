"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  Send,
  Sparkles,
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
const QUESTION_SOURCE_TYPES = ["question_bank", "exam_paper"];

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-600", icon: "text-slate-400" },
  submitted: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
  "under review": { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
  reviewed: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500" },
  rejected: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-500" },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status.trim().toLowerCase()] ?? STATUS_COLORS.pending;
}

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
      setError("This homework link isn't valid. Go back and try again.");
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
          : "This homework couldn't be loaded."
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
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* Back button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.push("/lms/homework/list")}
        className="gap-2"
      >
        <ArrowLeft className="size-4" />
        Back to homework list
      </Button>

      {/* Alerts */}
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
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
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          {notice}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
            <div className="h-64 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          </div>
        </div>
      ) : !detail ? (
        !error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <ClipboardList className="size-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              This homework couldn&apos;t be found.
            </p>
          </div>
        ) : null
      ) : (
        <>
          {/* Hero header card */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                    <BookOpen className="size-3" />
                    {detail.homework.subjectName || "Subject"}
                  </span>
                  {latestSubmission ? (
                    <StatusBadge
                      variant={statusVariant(latestSubmission.status)}
                      label={latestSubmission.status}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <Clock className="size-3" />
                      Not submitted
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {detail.homework.title || "Homework details"}
                </h1>
              </div>
              <Button
                type="button"
                onClick={() => setDialogOpen(true)}
                disabled={blockedStatus}
                className="shrink-0"
              >
                <Send className="size-4" />
                {latestSubmission ? "Resubmit" : "Submit homework"}
              </Button>
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap gap-4 border-t border-indigo-100 pt-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <User className="size-3.5 text-indigo-400" />
                <span className="font-medium">{detail.homework.teacherName || "Teacher"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar className="size-3.5 text-indigo-400" />
                Assigned: <span className="font-medium ml-1">{detail.homework.dateFmt || detail.homework.date || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="size-3.5 text-indigo-400" />
                Due: <span className="font-semibold text-indigo-700 ml-1">{detail.homework.submissionDateFmt || detail.homework.submissionDate || "—"}</span>
              </div>
            </div>

            {blockedStatus ? (
              <p className="mt-2 text-xs text-slate-500">
                {latestSubmission?.status === "Reviewed"
                  ? "This homework has been reviewed — resubmission is closed."
                  : "Under review — you can resubmit once the review is complete."}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Assignment details card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100">
                  <FileText className="size-4 text-violet-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-700">Assignment details</h2>
              </div>

              <p className="mb-4 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
                {detail.homework.description || "No description provided."}
              </p>

              {/* Question list */}
              {QUESTION_SOURCE_TYPES.includes(detail.homework.sourceType ?? "") &&
              detail.homework.questions?.length ? (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Homework questions ({detail.homework.questions.length})
                  </p>
                  <ol className="space-y-2">
                    {detail.homework.questions.map((question, index) => (
                      <li
                        key={question.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <span className="min-w-0 text-sm text-slate-700">
                          <span className="mr-2 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                            {index + 1}
                          </span>
                          {question.title || "Untitled question"}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                            {question.questionTypeLabel ||
                              `Type ${question.questionTypeId}`}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            {question.points} pts
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : detail.homework.referenceFileUrl ? (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Reference file
                  </p>
                  {isImageUrl(detail.homework.referenceFileUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.homework.referenceFileUrl}
                      alt="Reference attachment"
                      className="max-h-64 w-full rounded-xl border border-slate-200 object-contain"
                    />
                  ) : (
                    <iframe
                      title="Reference attachment"
                      src={detail.homework.referenceFileUrl}
                      className="aspect-[4/3] w-full rounded-xl border border-slate-200"
                    />
                  )}
                  <a
                    href={detail.homework.referenceFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    <FileText className="size-3.5" />
                    Open in new tab
                  </a>
                </div>
              ) : null}
            </section>

            {/* Submissions card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-700">Your submissions</h2>
                </div>
                {detail.submissions.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {detail.submissions.length} attempt{detail.submissions.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {!detail.submissions.length ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber-100 bg-amber-50/50 p-8 text-center">
                  <Clock className="size-8 text-amber-400" />
                  <p className="text-sm font-medium text-slate-700">
                    Not submitted yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Submit before the due date to get it reviewed.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-1"
                    onClick={() => setDialogOpen(true)}
                    disabled={blockedStatus}
                  >
                    <Send className="size-3.5" />
                    Submit now
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {[...detail.submissions]
                    .sort((a, b) => b.attemptNumber - a.attemptNumber)
                    .map((submission) => {
                      const style = getStatusStyle(submission.status);
                      return (
                        <li
                          key={submission.id}
                          className={`rounded-xl border p-4 ${style.bg} border-opacity-60 border-current`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.bg} ${style.text}`}>
                                Attempt {submission.attemptNumber}
                              </span>
                              <StatusBadge
                                variant={statusVariant(submission.status)}
                                label={submission.status || "Pending"}
                              />
                            </div>
                            <p className={`text-xs ${style.text} opacity-80`}>
                              {submission.submittedAtFmt || submission.submittedAt || "—"}
                            </p>
                          </div>

                          {submission.submissionRemarks ? (
                            <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">
                              {submission.submissionRemarks}
                            </p>
                          ) : null}

                          {submission.files.length ? (
                            <ul className="mt-3 flex flex-wrap gap-2">
                              {submission.files.map((file) => (
                                <li key={file.id}>
                                  <a
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                                  >
                                    <Download className="size-3.5" />
                                    {file.originalName || "Download"}
                                    {file.fileSize ? (
                                      <span className="text-slate-400">
                                        ({formatBytes(file.fileSize)})
                                      </span>
                                    ) : null}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {submission.feedbackPublished && submission.teacherRemarks ? (
                            <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-400">
                                Teacher remarks
                              </p>
                              <p className="whitespace-pre-line break-words text-sm text-slate-700">
                                {submission.teacherRemarks}
                              </p>
                            </div>
                          ) : null}

                          {submission.aiStatus &&
                          submission.aiStatus.toLowerCase() === "evaluated" ? (
                            <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                              <Sparkles className="size-3.5 shrink-0 text-violet-500" />
                              <p className="text-xs font-medium text-violet-700">
                                AI score: {submission.aiScore ?? "—"}
                                {submission.aiTotalQuestions
                                  ? ` / ${submission.aiTotalQuestions}`
                                  : ""}
                                {submission.aiPercentage !== null
                                  ? ` (${submission.aiPercentage}%)`
                                  : ""}
                              </p>
                            </div>
                          ) : submission.aiStatus &&
                            submission.aiStatus.toLowerCase() === "checking" ? (
                            <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                              <LoaderCircle className="size-3.5 shrink-0 animate-spin text-violet-500" />
                              <p className="text-xs font-medium text-violet-700">
                                AI is checking this submission…
                              </p>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              )}
            </section>
          </div>

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
