"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import {
  getReviewDetail,
  reprocessReview,
  submitReview,
  type ReviewAnswer,
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

const ANSWER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  correct: { label: "Correct", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  partially_correct: { label: "Partly correct", className: "border-amber-200 bg-amber-50 text-amber-700" },
  wrong: { label: "Wrong", className: "border-red-200 bg-red-50 text-red-700" },
  unattempted: { label: "Not attempted", className: "border-slate-200 bg-slate-100 text-slate-600" },
};

function trimMarks(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(Math.round(value * 100) / 100);
}

/** Empty stays empty — meaning "keep taking the AI's figure for this one". */
function parseMark(raw: string | undefined, max: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(0, parsed));
}

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
  // Mark boxes are held as strings so a half-typed "1." does not snap to 1.
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [rerunning, setRerunning] = useState(false);

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
      setMarks(seedMarks(data.answers));
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
        marks: detail.answers.map((answer) => ({
          questionNo: answer.questionNo,
          teacherMarks: parseMark(marks[answer.questionNo], answer.maxMarks),
        })),
      });
      setDetail((prev) => (prev ? { ...prev, submission: updated } : prev));
      setSuccess(
        status === "Reviewed"
          ? "Review saved. The marks are now yours — re-running the AI will not change them."
          : "Review saved successfully."
      );
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

  async function handleRerun() {
    if (!detail) return;
    setSaveError("");
    setSuccess("");
    setRerunning(true);
    try {
      const result = await reprocessReview(detail.submission.id);
      setDetail((prev) =>
        prev ? { ...prev, submission: result.submission, answers: result.answers } : prev
      );
      setMarks(seedMarks(result.answers));
      setSuccess("The submission was marked again.");
    } catch (rerunError: unknown) {
      setSaveError(
        rerunError instanceof Error
          ? rerunError.message
          : "The evaluation could not be re-run."
      );
    } finally {
      setRerunning(false);
    }
  }

  const marksTotal = detail
    ? detail.answers.reduce((sum, answer) => {
        const typed = parseMark(marks[answer.questionNo], answer.maxMarks);
        return sum + (typed ?? answer.aiMarks ?? 0);
      }, 0)
    : 0;
  const marksMax = detail
    ? detail.answers.reduce((sum, answer) => sum + answer.maxMarks, 0)
    : 0;
  const attention = detail ? detail.answers.filter((answer) => answer.needsAttention).length : 0;
  const isReviewed = detail?.submission.status === "Reviewed";

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
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">AI evaluation</h2>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      {detail.submission.evaluationMode === "answer_key"
                        ? "Marked against this homework's own questions — objective answers checked against the answer key, written answers against their model answers."
                        : "Marked from the homework file and the student's pages, one mark per question."}
                    </p>
                  </div>

                  {isReviewed ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRerun}
                      disabled={rerunning}
                    >
                      {rerunning ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Mark again
                    </Button>
                  )}
                </div>

                {detail.submission.aiStatus.toLowerCase() === "checking" ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle className="size-4 animate-spin" />
                    AI is still checking this submission.
                  </p>
                ) : detail.submission.aiStatus.toLowerCase() === "evaluated" ? (
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-700">
                        {trimMarks(marksTotal)} / {trimMarks(marksMax)} marks
                      </span>
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                        {detail.submission.aiScore ?? "-"}
                        {detail.submission.aiTotalQuestions
                          ? ` / ${detail.submission.aiTotalQuestions}`
                          : ""}{" "}
                        correct
                      </span>
                      {attention > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="size-3.5" />
                          {attention} to check
                        </span>
                      ) : null}
                      {detail.submission.reviewedPdfPath ? (
                        <a
                          href={detail.submission.reviewedPdfPath}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Download className="size-4" /> Marked-up copy
                        </a>
                      ) : null}
                    </div>

                    {detail.answers.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        This submission was evaluated before per-question marks existed. Use
                        &ldquo;Mark again&rdquo; to get the question-by-question breakdown.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.answers.map((answer) => (
                          <AnswerRow
                            key={answer.questionNo}
                            answer={answer}
                            value={marks[answer.questionNo] ?? ""}
                            disabled={isReviewed}
                            onChange={(value) =>
                              setMarks((current) => ({ ...current, [answer.questionNo]: value }))
                            }
                          />
                        ))}

                        <p className="pt-1 text-xs leading-5 text-slate-500">
                          Every box starts at what the AI proposed and can be changed. Saving with
                          status <strong>Reviewed</strong> makes these marks yours — the AI&rsquo;s
                          figures are copied into any box you left alone, and re-running will no
                          longer move the total.
                        </p>
                      </div>
                    )}
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


/** Seeds every mark box from the teacher's own figure, or the AI's where none. */
function seedMarks(answers: ReviewAnswer[]): Record<number, string> {
  return Object.fromEntries(
    answers.map((answer) => {
      const value = answer.teacherMarks ?? answer.aiMarks;
      return [answer.questionNo, value === null || value === undefined ? "" : String(value)];
    })
  );
}

/**
 * One question, with what the student put, what the key expected, and an
 * editable mark.
 *
 * A written answer the model was unsure of is tinted, because that is the one
 * worth a teacher's eye — an objective mark was compared to the key in code and
 * needs no second opinion.
 */
function AnswerRow({
  answer,
  value,
  disabled,
  onChange,
}: {
  answer: ReviewAnswer;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const status = ANSWER_STATUS_LABELS[answer.status] ?? ANSWER_STATUS_LABELS.unattempted;

  return (
    <div
      className={`rounded-lg border p-3 ${
        answer.needsAttention ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700">
            Q{answer.questionNo}
            <span className="ml-2 font-normal text-slate-400">
              {answer.isObjective ? "Objective" : "Written"} · {answer.maxMarks} mark
              {answer.maxMarks === 1 ? "" : "s"}
            </span>
          </p>
          {answer.questionTitle ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
              {answer.questionTitle}
            </p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-400">Student</dt>
        <dd className="min-w-0 break-words text-slate-600">
          {answer.selectedOptions.length > 0
            ? answer.selectedOptions.join(", ")
            : answer.detectedAnswer || <span className="italic text-slate-400">nothing written</span>}
        </dd>
        <dt className="text-slate-400">Key</dt>
        <dd className="min-w-0 break-words text-slate-600">
          {answer.expectedAnswer || <span className="italic text-slate-400">no model answer saved</span>}
        </dd>
      </dl>

      {answer.aiRemark ? (
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{answer.aiRemark}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          AI proposed {trimMarks(answer.aiMarks)}
          {answer.isObjective
            ? " (checked against the key)"
            : answer.aiConfidence !== null
              ? ` · ${Math.round(answer.aiConfidence)}% confident`
              : ""}
        </span>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          Final
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={answer.maxMarks}
            step={0.5}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-[76px] text-right font-semibold tabular-nums"
          />
          <span className="text-slate-400">/ {answer.maxMarks}</span>
        </label>
      </div>
    </div>
  );
}
