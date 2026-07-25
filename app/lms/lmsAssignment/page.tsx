"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SearchDropdown,
  type DropdownField,
  type SearchDropdownValues,
} from "@/components/search-dropdown";
import {
  createAssignment,
  listAssignmentStudents,
  listExamPapers,
  type AssignmentStudent,
  type ExamPaper,
} from "@/app/lms/lmsAssignment/api";

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

const controlClass =
  "h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50";

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function CreateAssignmentPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [students, setStudents] = useState<AssignmentStudent[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");

  const [examPapers, setExamPapers] = useState<ExamPaper[]>([]);
  const [examId, setExamId] = useState("");
  const [papersLoading, setPapersLoading] = useState(false);

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const section = readValue(filters.section ?? "");
  const standard = readValue(filters.standard ?? "");
  const division = readValue(filters.division ?? "");
  const subject = readValue(filters.subject ?? "");

  const allChecked = students.length > 0 && selected.size === students.length;

  // The exam-paper dropdown reloads whenever the subject changes — mirrors the
  // old ERP where the Exam select is populated from offline question papers for
  // the selected subject.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExamId("");
    setExamPapers([]);
    if (!subject) return;
    setPapersLoading(true);
    listExamPapers(subject)
      .then((papers) => {
        if (!cancelled) setExamPapers(papers);
      })
      .catch(() => {
        if (!cancelled) setExamPapers([]);
      })
      .finally(() => {
        if (!cancelled) setPapersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  const loadStudents = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    try {
      const rows = await listAssignmentStudents({
        grade: section,
        standard,
        division,
      });
      setStudents(rows);
    } catch (loadError: unknown) {
      setStudents([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Students could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [division, section, standard]);

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
      prev.size === students.length
        ? new Set()
        : new Set(students.map((student) => student.id))
    );
  }

  const validationError = useMemo(() => {
    if (!standard) return "Select a standard.";
    if (!subject) return "Select a subject.";
    if (!title.trim()) return "Enter an assignment title.";
    if (!examId) return "Select an exam paper.";
    if (selected.size === 0) return "Select at least one student.";
    return "";
  }, [standard, subject, title, examId, selected.size]);

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const paper = examPapers.find((item) => String(item.id) === examId);
      const count = await createAssignment({
        studentIds: Array.from(selected),
        title: title.trim(),
        description: description.trim(),
        submissionDate,
        standardId: standard,
        divisionId: division,
        subjectId: subject,
        examId,
        examPdf: paper?.pdfName ?? "",
      });
      setSuccess(`Assignment created for ${count} student(s) successfully.`);
      setTitle("");
      setDescription("");
      setSubmissionDate("");
      setExamId("");
      setSelected(new Set());
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Assignment could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Create Assignment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search students by class and assign an exam paper.
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
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={loadStudents} disabled={loading}>
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search students
          </Button>
        </div>
      </section>

      {searched ? (
        <form
          onSubmit={handleAssign}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="asg-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="asg-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Assignment title"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asg-date">Submission date</Label>
              <Input
                id="asg-date"
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asg-exam">
                Exam paper <span className="text-red-500">*</span>
              </Label>
              <select
                id="asg-exam"
                className={controlClass}
                value={examId}
                onChange={(event) => setExamId(event.target.value)}
                disabled={papersLoading || !subject}
              >
                <option value="">
                  {!subject
                    ? "Select a subject first"
                    : papersLoading
                    ? "Loading papers..."
                    : examPapers.length
                    ? "Select exam paper"
                    : "No exam papers found"}
                </option>
                {examPapers.map((paper) => (
                  <option key={paper.id} value={String(paper.id)}>
                    {paper.paperName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="asg-desc">Description</Label>
              <Textarea
                id="asg-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Assignment description"
                rows={3}
                maxLength={50}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all students"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Enrollment Code</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Mobile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : students.length ? (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${student.studentName}`}
                          checked={selected.has(student.id)}
                          onChange={() => toggle(student.id)}
                        />
                      </TableCell>
                      <TableCell>{student.studentName}</TableCell>
                      <TableCell>{student.enrollmentNo || "-"}</TableCell>
                      <TableCell>{student.standardName || "-"}</TableCell>
                      <TableCell>{student.divisionName || "-"}</TableCell>
                      <TableCell>{student.gender || "-"}</TableCell>
                      <TableCell>{student.mobile || "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-slate-500">
                      <Users className="mx-auto mb-2 size-8 text-slate-300" />
                      No students found for the selected class.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {selected.size} student(s) selected
            </span>
            <Button type="submit" disabled={saving || students.length === 0}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Create assignment
            </Button>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
          Select a class and search students to create an assignment.
        </section>
      )}
    </main>
  );
}
