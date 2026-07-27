"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  getReviewContext,
  submitAnnotation,
  type ReviewContext,
} from "@/app/lms/lmsAnnotate_assignment/api";

export default function ReviewAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = Number(params?.id);

  const [context, setContext] = useState<ReviewContext | null>(null);
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!assignmentId) {
      setError("Invalid assignment reference.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ctx = await getReviewContext(assignmentId);
      setContext(ctx);
      setMarks({});
    } catch (loadError: unknown) {
      setContext(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This assignment could not be loaded for review."
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalObtained = useMemo(
    () => Object.values(marks).reduce((sum, value) => sum + (value || 0), 0),
    [marks]
  );

  function setQuestionMark(questionId: number, value: number) {
    setMarks((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!context) return;

    // Non-MCQ questions require a mark within [0, points].
    for (const question of context.questions) {
      if (!question.isMcq) {
        const value = marks[question.id];
        if (value == null || Number.isNaN(value)) {
          setError("Enter marks for every descriptive question.");
          return;
        }
        if (value < 0 || value > question.points) {
          setError(`Marks must be between 0 and ${question.points}.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const obtained = await submitAnnotation({
        assignmentId: context.assignmentId,
        studentId: context.studentId,
        questionPaperId: context.questionPaperId,
        marks,
        teacherRemarks: remarks.trim(),
      });
      setSuccess(
        `Assignment reviewed successfully — ${obtained}/${context.totalMarks} marks awarded.`
      );
      setTimeout(() => router.push("/lms/lmsAnnotate_assignment"), 1200);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The review could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Review student assignment
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {context
              ? `${context.title || "Assignment"} — ${context.studentName || "Student"}`
              : "Grade the submission against the assigned exam paper."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/lms/lmsAnnotate_assignment")}
        >
          <ArrowLeft className="size-4" />
          Back to list
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
      ) : context ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Student submission
            </h2>
            {context.submissionFileUrl ? (
              <div className="space-y-3">
                <iframe
                  title="Student submission"
                  src={context.submissionFileUrl}
                  className="aspect-[4/3] w-full rounded-lg border border-slate-200"
                />
                <a
                  href={context.submissionFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  <FileText className="size-4" /> Open in new tab
                </a>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No submission file is available for this assignment.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {context.paperName || "Question paper"}
                  </span>
                </span>
                <span className="text-slate-600">
                  Total marks:{" "}
                  <span className="font-semibold text-slate-800">
                    {context.totalMarks}
                  </span>
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="w-48">Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {context.questions.length ? (
                      context.questions.map((question, index) => (
                        <TableRow key={question.id}>
                          <TableCell>Question {index + 1}</TableCell>
                          <TableCell>
                            {question.isMcq ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                                <input
                                  type="checkbox"
                                  aria-label={`Mark question ${index + 1} correct`}
                                  checked={(marks[question.id] ?? 0) > 0}
                                  onChange={(event) =>
                                    setQuestionMark(
                                      question.id,
                                      event.target.checked ? question.points : 0
                                    )
                                  }
                                />
                                Correct / {question.points}
                              </label>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={question.points}
                                  value={marks[question.id] ?? ""}
                                  onChange={(event) =>
                                    setQuestionMark(
                                      question.id,
                                      event.target.value === ""
                                        ? Number.NaN
                                        : Number(event.target.value)
                                    )
                                  }
                                  required
                                  className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <span className="text-sm text-slate-500">
                                  / {question.points}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="h-20 text-center text-slate-500"
                        >
                          No questions found on this paper.
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell>
                        {totalObtained} / {context.totalMarks}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teacher-remarks">Remarks</Label>
                <Textarea
                  id="teacher-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Feedback for the student"
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving || context.questions.length === 0}
                >
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
      ) : null}
    </main>
  );
}
