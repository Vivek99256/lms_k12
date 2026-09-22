"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Paperclip,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AiFieldAssistant } from "@/components/ai/AiFieldAssistant";
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
  listHomeworkChapters,
  listHomeworkQuestionTypes,
  listHomeworkQuestions,
  listStudents,
  type HomeworkChapter,
  type HomeworkQuestion,
  type HomeworkQuestionType,
  type StudentRow,
} from "@/app/lms/homework/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readValue(value: SearchDropdownValues[keyof SearchDropdownValues]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Same accepted types as the LMS Assignment homework-file upload (which also
// allows Word docs), plus Word support for homework's own attachment field.
// homework's single-file `image` column and `assignHomework` call are
// unchanged; the backend's store() has no mime/extension restriction.
const ATTACHMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

function validateAttachment(file: File): string {
  const extension = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
  if (!ATTACHMENT_EXTENSIONS.includes(extension)) {
    return "Only PDF, DOC, DOCX, JPG, JPEG or PNG files are allowed.";
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return "File must be 10MB or smaller.";
  }
  return "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [attachmentError, setAttachmentError] = useState("");
  const [standardName, setStandardName] = useState("");
  const [subjectName, setSubjectName] = useState("");

  // Question-bank ("Send homework from system") workflow — additive to the
  // attachment flow above; only consulted when sendFromSystem is true.
  const [sendFromSystem, setSendFromSystem] = useState(false);
  const [chapters, setChapters] = useState<HomeworkChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersError, setChaptersError] = useState("");
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [questionTypes, setQuestionTypes] = useState<HomeworkQuestionType[]>([]);
  const [questionTypesLoading, setQuestionTypesLoading] = useState(false);
  const [questionTypesError, setQuestionTypesError] = useState("");
  const [selectedQuestionTypeIds, setSelectedQuestionTypeIds] = useState<number[]>([]);
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

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

  // Question-bank workflow: load chapters whenever the picker is on and the
  // standard changes. Independent of the attachment flow above.
  useEffect(() => {
    if (!sendFromSystem || !standard) {
      setChapters([]);
      setSelectedChapterIds([]);
      return;
    }
    let cancelled = false;
    setChaptersLoading(true);
    setChaptersError("");
    setSelectedChapterIds([]);
    listHomeworkChapters({ standardId: standard, subjectId: subject })
      .then((rows) => {
        if (!cancelled) setChapters(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setChapters([]);
          setChaptersError(
            loadError instanceof Error
              ? loadError.message
              : "Chapters could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sendFromSystem, standard, subject]);

  // Question types load once per entry into the picker (don't depend on
  // chapter/subject selection).
  useEffect(() => {
    if (!sendFromSystem) return;
    let cancelled = false;
    setQuestionTypesLoading(true);
    setQuestionTypesError("");
    listHomeworkQuestionTypes()
      .then((rows) => {
        if (!cancelled) setQuestionTypes(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setQuestionTypes([]);
          setQuestionTypesError(
            loadError instanceof Error
              ? loadError.message
              : "Question types could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setQuestionTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sendFromSystem]);

  // Questions re-fetch whenever the subject/standard/chapter/type selection
  // changes, once at least one chapter is selected.
  useEffect(() => {
    if (!sendFromSystem || selectedChapterIds.length === 0 || !subject || !standard) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionsError("");
    listHomeworkQuestions({
      subjectId: subject,
      standardId: standard,
      chapterIds: selectedChapterIds,
      questionTypeIds: selectedQuestionTypeIds,
    })
      .then((rows) => {
        if (!cancelled) setQuestions(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setQuestions([]);
          setQuestionsError(
            loadError instanceof Error
              ? loadError.message
              : "Questions could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sendFromSystem, subject, standard, selectedChapterIds, selectedQuestionTypeIds]);

  function handleChapterSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const ids = Array.from(event.target.selectedOptions, (option) => Number(option.value));
    setSelectedChapterIds(ids);
  }

  function toggleQuestionTypeId(id: number) {
    setSelectedQuestionTypeIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function toggleQuestionId(id: number) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function selectAllQuestions() {
    setSelectedQuestionIds(questions.map((question) => question.id));
  }

  function deselectAllQuestions() {
    setSelectedQuestionIds([]);
  }

  const questionTypeLabel = useCallback(
    (questionTypeId: number) =>
      questionTypes.find((type) => type.id === questionTypeId)?.label ||
      `Type ${questionTypeId}`,
    [questionTypes]
  );

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

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    const validationMessage = validateAttachment(file);
    if (validationMessage) {
      setAttachmentError(validationMessage);
      setImage(null);
      event.target.value = "";
      return;
    }
    setAttachmentError("");
    setImage(file);
  }

  function removeAttachment() {
    setImage(null);
    setAttachmentError("");
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
    if (sendFromSystem && selectedQuestionIds.length === 0) {
      return "Select at least one question.";
    }
    if (selected.size === 0) return "Select at least one student.";
    return "";
  }, [
    standard,
    subject,
    title,
    submissionDate,
    sendFromSystem,
    selectedQuestionIds.length,
    selected.size,
  ]);

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
        image: sendFromSystem ? null : image,
        ...(sendFromSystem
          ? { sourceType: "question_bank" as const, questionIds: selectedQuestionIds }
          : {}),
      });
      setSuccess(`Homework assigned to ${count} student(s) successfully.`);
      setTitle("");
      setDescription("");
      setSubmissionDate("");
      setImage(null);
      setAttachmentError("");
      setSelected(new Set());
      setSendFromSystem(false);
      setSelectedChapterIds([]);
      setSelectedQuestionTypeIds([]);
      setSelectedQuestionIds([]);
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
    <RequireStaff>
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
          className="gap-x-5 gap-y-4"
        />
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Choose a section, standard, division and subject, then search.
          </p>
          <Button
            type="button"
            onClick={loadStudents}
            disabled={loading}
            className="w-full sm:w-auto"
          >
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
              <div className="flex items-center justify-between">
                <Label htmlFor="hw-source-toggle">Send homework from system</Label>
                <Switch
                  id="hw-source-toggle"
                  checked={sendFromSystem}
                  onChange={(event) => setSendFromSystem(event.target.checked)}
                />
              </div>
              {!sendFromSystem ? (
                <p className="text-xs text-slate-400">
                  Off: attach a file. On: pick questions from the question bank below.
                </p>
              ) : null}
            </div>
            {!sendFromSystem ? (
            <div className="space-y-2">
              <Label htmlFor="hw-image">Attachment</Label>
              {image ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700" title={image.name}>
                        {image.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(image.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <label
                      htmlFor="hw-image"
                      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      Replace
                      <input
                        id="hw-image"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        className="sr-only"
                        onChange={handleAttachmentChange}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      aria-label="Remove attachment"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="hw-image"
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/60"
                >
                  <Paperclip className="size-4 text-slate-400" />
                  Choose PDF, DOC, DOCX, JPG, JPEG or PNG
                  <input
                    id="hw-image"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="sr-only"
                    onChange={handleAttachmentChange}
                  />
                </label>
              )}
              {attachmentError ? (
                <p className="text-xs text-red-600">{attachmentError}</p>
              ) : (
                <p className="text-xs text-slate-400">Up to 10MB.</p>
              )}
            </div>
            ) : null}
            {sendFromSystem ? (
            <div className="space-y-5 md:col-span-2 xl:col-span-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hw-chapter">Select Chapter</Label>
                  {selectedChapterIds.length > 0 ? (
                    <span className="text-xs text-slate-500">
                      {selectedChapterIds.length} selected
                    </span>
                  ) : null}
                </div>
                {!standard ? (
                  <p className="text-sm text-slate-400">Select a standard above first.</p>
                ) : chaptersError ? (
                  <p className="text-sm text-red-600">{chaptersError}</p>
                ) : (
                  <select
                    id="hw-chapter"
                    multiple
                    value={selectedChapterIds.map(String)}
                    onChange={handleChapterSelect}
                    disabled={chaptersLoading || chapters.length === 0}
                    className="min-h-28 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name || `Chapter ${chapter.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-slate-400">
                  {chaptersLoading
                    ? "Loading chapters…"
                    : !standard || chapters.length > 0
                      ? "Hold Ctrl (Cmd on Mac) to select multiple chapters."
                      : "No chapters available for this standard/subject."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Select question types
                </p>
                {questionTypesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading question types…
                  </div>
                ) : questionTypesError ? (
                  <p className="text-sm text-red-600">{questionTypesError}</p>
                ) : questionTypes.length === 0 ? (
                  <p className="text-sm text-slate-400">No question types available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {questionTypes.map((type) => {
                      const isSelected = selectedQuestionTypeIds.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleQuestionTypeId(type.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                          }`}
                        >
                          {type.label || `Type ${type.id}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Available questions
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {selectedQuestionIds.length} question(s) selected
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={selectAllQuestions} disabled={questions.length === 0}>
                      Select all
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={deselectAllQuestions} disabled={selectedQuestionIds.length === 0}>
                      Deselect all
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            aria-label="Select all questions"
                            checked={questions.length > 0 && selectedQuestionIds.length === questions.length}
                            onChange={() =>
                              selectedQuestionIds.length === questions.length
                                ? deselectAllQuestions()
                                : selectAllQuestions()
                            }
                          />
                        </TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedChapterIds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400">
                            Select at least one chapter to load questions.
                          </TableCell>
                        </TableRow>
                      ) : questionsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                            <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                          </TableCell>
                        </TableRow>
                      ) : questionsError ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-sm text-red-600">
                            {questionsError}
                          </TableCell>
                        </TableRow>
                      ) : questions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400">
                            No questions found for the selected chapters/types.
                          </TableCell>
                        </TableRow>
                      ) : (
                        questions.map((question) => {
                          const isSelected = selectedQuestionIds.includes(question.id);
                          return (
                            <TableRow key={question.id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Select question ${question.id}`}
                                  checked={isSelected}
                                  onChange={() => toggleQuestionId(question.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <span
                                  className="line-clamp-1 max-w-md text-sm text-slate-700"
                                  title={question.description || question.title}
                                >
                                  {question.title || "Untitled question"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                  {questionTypeLabel(question.questionTypeId)}
                                </span>
                              </TableCell>
                              <TableCell>{question.points || "-"}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            ) : null}
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="hw-desc">Description</Label>
                <AiFieldAssistant
                  value={description}
                  onApply={setDescription}
                  fieldType="instructions"
                  label="Homework description"
                  module="lms"
                  page="Homework"
                  entityType="homework"
                  grade={standardName}
                  subject={subjectName}
                  related={{ "Homework title": title }}
                />
              </div>
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
                    <TableCell colSpan={7} className="h-36 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <Users className="size-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">
                          No students found
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
        <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <ClipboardList className="size-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            No students loaded yet
          </p>
          <p className="max-w-sm text-sm text-slate-400">
            Select a section, standard, division and subject above, then search
            to load students and assign homework.
          </p>
        </section>
      )}
    </main>
    </RequireStaff>
  );
}
