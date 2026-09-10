"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReviewDetail,
  submitReview,
  type ReviewDetail,
} from "../../api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

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

const REVIEW_STATUS_OPTIONS = ["Under Review", "Reviewed", "Rejected"] as const;

export default function HomeworkReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const submissionId = Number(params?.id);

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [status, setStatus] = useState<string>("Reviewed");
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!submissionId || Number.isNaN(submissionId)) {
      setError("Invalid submission reference.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getReviewDetail(submissionId);
      setDetail(data);
      setTeacherRemarks(data.submission.teacherRemarks || "");
      setStatus(
        REVIEW_STATUS_OPTIONS.includes(data.submission.status as (typeof REVIEW_STATUS_OPTIONS)[number])
          ? data.submission.status
          : "Reviewed"
      );
      setPublish(data.submission.feedbackPublished);
    } catch (loadError: unknown) {
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This submission could not be loaded for review."
      );
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveError("");
    setSuccess("");
    if (!detail) return;

    setSaving(true);
    try {
      const updated = await submitReview({
        submissionId: detail.submission.id,
        teacherRemarks: teacherRemarks.trim(),
        status,
        publish,
      });
      setDetail((prev) => (prev ? { ...prev, submission: updated } : prev));
      setSuccess("Review saved successfully.");
      window.setTimeout(() => router.push("/lms/homework/review"), 1000);
    } catch (submitError: unknown) {
      setSaveError(
        submitError instanceof Error
          ? submitError.message
          : "The review could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireStaff>
      <main className="mx-auto space-y-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Review homework submission</h1>
            <p className="mt-1 text-sm text-slate-500">
              {detail
                ? `${detail.homework.title || "Homework"} — ${detail.submission.attemptNumber ? `Attempt ${detail.submission.attemptNumber}` : ""}`
                : "Grade the student's submitted work."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/lms/homework/review")}
          >
            <ArrowLeft className="size-4" />
            Back to queue
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

        {loading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <LoaderCircle className="size-6 animate-spin text-slate-300" />
          </div>
        ) : detail ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  Student submission
                </h2>
                {detail.files.length ? (
                  <div className="space-y-4">
                    {detail.files.map((file) => (
                      <div key={file.id} className="space-y-2">
                        {isImageUrl(file.fileUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={file.fileUrl}
                            alt={file.originalName || "Submitted file"}
                            className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                          />
                        ) : (
                          <iframe
                            title={file.originalName || "Submitted file"}
                            src={file.fileUrl}
                            className="aspect-[4/3] w-full rounded-lg border border-slate-200"
                          />
                        )}
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Download className="size-4" />
                          {file.originalName || "Open in new tab"}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No files were submitted for this attempt.
                  </p>
                )}

                {detail.submission.submissionRemarks ? (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Student remarks
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">
                      {detail.submission.submissionRemarks}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">AI evaluation</h2>
                {detail.submission.aiStatus.toLowerCase() === "checking" ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle className="size-4 animate-spin" />
                    AI is still checking this submission.
                  </p>
                ) : detail.submission.aiStatus.toLowerCase() === "evaluated" ? (
                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="font-mono tabular-nums">
                      Score: {detail.submission.aiScore ?? "-"}
                      {detail.submission.aiTotalQuestions
                        ? ` / ${detail.submission.aiTotalQuestions}`
                        : ""}
                      {detail.submission.aiPercentage !== null
                        ? ` (${detail.submission.aiPercentage}%)`
                        : ""}
                    </p>
                    {detail.submission.reviewedPdfPath ? (
                      <a
                        href={detail.submission.reviewedPdfPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                      >
                        <Download className="size-4" /> Download evaluation
                      </a>
                    ) : null}
                  </div>
                ) : detail.submission.aiStatus ? (
                  <p className="text-sm text-slate-500">
                    {detail.submission.aiStatus}
                    {detail.submission.aiFailureReason
                      ? ` — ${detail.submission.aiFailureReason}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No AI evaluation available.</p>
                )}
              </section>

              {detail.previousAttempts.length ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-slate-700">Previous attempts</h2>
                  <ul className="space-y-2">
                    {detail.previousAttempts.map((attempt) => (
                      <li
                        key={attempt.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <span>Attempt {attempt.attemptNumber}</span>
                        <span className="flex items-center gap-2 text-slate-500">
                          {attempt.submittedAtFmt || "-"}
                          <StatusBadge variant={statusVariant(attempt.status)} label={attempt.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-4">
                {saveError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {saveError}
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

                <div className="space-y-2">
                  <Label htmlFor="review-remarks">Teacher remarks</Label>
                  <Textarea
                    id="review-remarks"
                    value={teacherRemarks}
                    onChange={(event) => setTeacherRemarks(event.target.value)}
                    placeholder="Feedback for the student"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value ?? "Reviewed")}
                  >
                    <SelectTrigger id="review-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Publish feedback to student
                    </p>
                    <p className="text-xs text-slate-500">
                      The student can see your remarks once published.
                    </p>
                  </div>
                  <Switch
                    checked={publish}
                    onChange={(event) => setPublish(event.target.checked)}
                    aria-label="Publish feedback to student"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Submit review
                  </Button>
                </div>
              </form>
            </section>
          </div>
        ) : !error ? (
          <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <FileText className="mx-auto mb-2 size-8 text-slate-300" />
            This submission could not be found.
          </section>
        ) : null}
      </main>
    </RequireStaff>
  );
}
