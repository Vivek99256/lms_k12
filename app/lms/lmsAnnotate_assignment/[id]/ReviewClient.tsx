"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getReviewDetail,
  saveReview,
  type ReviewDetail,
} from "@/app/lms/lmsAssignment/api";

const MCQ_TYPE_ID = 1;
const LIST_ROUTE = "/lms/lmsAnnotate_assignment";

export default function ReviewClient({ assignmentId }: { assignmentId: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [remarks, setRemarks] = useState("");
  const [annotation, setAnnotation] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getReviewDetail(assignmentId);
      setDetail(data);
      setRemarks(data.teacherRemarks);
      setAnnotation(data.jsonAnnotation);
      // Seed MCQ questions at 0; teacher toggles them on. Non-MCQ start empty.
      const seeded: Record<number, number> = {};
      data.questions.forEach((question) => {
        seeded[question.id] = 0;
      });
      setMarks(seeded);
    } catch (loadError: unknown) {
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Assignment could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalObtained = useMemo(
    () => Object.values(marks).reduce((sum, value) => sum + (value || 0), 0),
    [marks]
  );

  function setMark(questionId: number, value: number, max: number) {
    const clamped = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max));
    setMarks((prev) => ({ ...prev, [questionId]: clamped }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await saveReview({
        assignmentId: detail.assignmentId,
        studentId: detail.studentId,
        paperId: detail.paperId,
        marks,
        teacherRemarks: remarks.trim(),
        jsonAnnotation: annotation.trim() || undefined,
      });
      setSuccess("Assignment reviewed successfully.");
      // Return to the list after a short beat so the success state is visible.
      window.setTimeout(() => router.push(LIST_ROUTE), 900);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Review could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href={LIST_ROUTE}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-slate-900">
            Review Student Assignment
          </h1>
          {detail ? (
            <p className="mt-1 text-sm text-slate-500">
              {detail.studentName ? `${detail.studentName} · ` : ""}
              {detail.title}
            </p>
          ) : null}
        </header>
      </div>

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

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <LoaderCircle className="size-6 animate-spin text-slate-300" />
        </div>
      ) : detail ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Submission preview — mirrors the old ERP's iframe of the submitted file. */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Student Submission
              </h2>
              {detail.submissionImage ? (
                <a
                  href={detail.submissionImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  Open in new tab
                </a>
              ) : null}
            </div>
            {detail.submissionImage ? (
              <iframe
                src={detail.submissionImage}
                title="Student submission"
                className="h-[520px] w-full rounded-lg border border-slate-200"
              />
            ) : (
              <div className="flex h-[520px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                No submission file available.
              </div>
            )}
          </section>

          {/* Grading form */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">
                  {detail.paperName || "Question Paper"}
                </span>
                <span className="text-slate-500">
                  Total Marks: {detail.totalMarks}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="w-28">Points</TableHead>
                      <TableHead className="w-36">Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.questions.length ? (
                      detail.questions.map((question, index) => (
                        <TableRow key={question.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell
                            className="max-w-64 truncate"
                            title={question.questionName}
                          >
                            {question.questionName || `Question ${index + 1}`}
                          </TableCell>
                          <TableCell>{question.points}</TableCell>
                          <TableCell>
                            {question.questionTypeId === MCQ_TYPE_ID ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={(marks[question.id] ?? 0) > 0}
                                  onChange={(event) =>
                                    setMark(
                                      question.id,
                                      event.target.checked ? question.points : 0,
                                      question.points
                                    )
                                  }
                                />
                                Correct
                              </label>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={question.points}
                                value={marks[question.id] ?? 0}
                                onChange={(event) =>
                                  setMark(
                                    question.id,
                                    Number(event.target.value),
                                    question.points
                                  )
                                }
                                className="h-8 w-24 rounded-lg border border-input bg-white px-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-20 text-center text-slate-500"
                        >
                          No questions linked to this assignment.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">Total Obtained</span>
                <span className="font-semibold text-slate-900">
                  {totalObtained}
                  {detail.totalMarks ? ` / ${detail.totalMarks}` : ""}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher-remarks">Teacher Remarks</Label>
                <Textarea
                  id="teacher-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  maxLength={250}
                  placeholder="Feedback for the student"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annotation">Annotation notes (optional)</Label>
                <Textarea
                  id="annotation"
                  value={annotation}
                  onChange={(event) => setAnnotation(event.target.value)}
                  rows={2}
                  placeholder="Notes stored with the submission"
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save review
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
