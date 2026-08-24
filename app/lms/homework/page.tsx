"use client";

import { useCallback, useMemo, useState } from "react";
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
  assignHomework,
  listStudents,
  type StudentRow,
} from "@/app/lms/homework/api";
<<<<<<< HEAD
=======
import RequireStaff from "@/app/lms/_shared/RequireStaff";
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readValue(value: SearchDropdownValues[keyof SearchDropdownValues]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function StudentHomeworkPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [standardName, setStandardName] = useState("");
  const [subjectName, setSubjectName] = useState("");

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const standard = readValue(filters.standard ?? "");
  const division = readValue(filters.division ?? "");
  const subject = readValue(filters.subject ?? "");
  const section = readValue(filters.section ?? "");

  const allChecked = students.length > 0 && selected.size === students.length;

  const loadStudents = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    try {
      const rows = await listStudents({
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
    if (!title.trim()) return "Enter a homework title.";
    if (!submissionDate) return "Select a submission date.";
    if (selected.size === 0) return "Select at least one student.";
    return "";
  }, [standard, subject, title, submissionDate, selected.size]);

  // Mirrors the Laravel assign form's generateTitleDescriptionPrompt(): every
  // homework stores a `prompt` built from the class/title/description, which the
  // submission flow later feeds to the AI validation. Kept as a read-only
  // preview so the assign screen matches the old ERP's "Prompt Preview" field.
  const prompt = useMemo(() => {
    const std = standardName || "Not Selected";
    const subj = subjectName || "Not Selected";
    const promptTitle = title.trim() || "No title provided";
    const promptDescription = description.trim() || "No description provided";
    return [
      "HOMEWORK ASSIGNMENT",
      "===================",
      "",
      `Standard: ${std}`,
      `Subject: ${subj}`,
      "",
      `Title: ${promptTitle}`,
      "",
      "Description:",
      "------------",
      promptDescription,
      "",
      "===================",
      "End of Homework Assignment",
    ].join("\n");
  }, [standardName, subjectName, title, description]);

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
      const count = await assignHomework({
        studentIds: Array.from(selected),
        title: title.trim(),
        description: description.trim(),
        submissionDate,
        standardId: standard,
        divisionId: division,
        subjectId: subject,
        prompt,
        image,
      });
      setSuccess(`Homework assigned to ${count} student(s) successfully.`);
      setTitle("");
      setDescription("");
      setSubmissionDate("");
      setImage(null);
      setSelected(new Set());
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Homework could not be assigned."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
<<<<<<< HEAD
=======
    <RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Student Homework</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search students by class and assign homework.
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
            onStandardChange={(_value, rows) =>
              setStandardName(rows[0]?.name ?? "")
            }
            onSubjectChange={(_value, rows) =>
              setSubjectName(rows[0]?.subject_name ?? "")
            }
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
              <Label htmlFor="hw-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="hw-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Homework title"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-date">
                Submission date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="hw-date"
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-image">Attachment</Label>
              <Input
                id="hw-image"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="hw-desc">Description</Label>
              <Textarea
                id="hw-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Homework description"
                rows={3}
              />
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="hw-prompt">AI prompt preview</Label>
              <Textarea
                id="hw-prompt"
                value={prompt}
                readOnly
                rows={6}
                className="bg-slate-50 font-mono text-xs text-slate-600"
              />
              <p className="text-xs text-slate-400">
                Auto-generated from the class, title and description. Stored with
                the homework and used for AI submission checking.
              </p>
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
                  <TableHead>GR No</TableHead>
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
              Assign homework
            </Button>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
          Select a class and search students to assign homework.
        </section>
      )}
    </main>
<<<<<<< HEAD
=======
    </RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
