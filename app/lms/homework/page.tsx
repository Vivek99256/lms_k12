"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Paperclip,
  Send,
  Users,
  X,
  BookOpen,
  Calendar,
  FileText,
  Layers,
  ChevronDown,
  AlertCircle,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listExamPaperQuestions,
  listHomeworkChapters,
  listHomeworkExamPapers,
  listHomeworkQuestionTypes,
  listHomeworkQuestions,
  listStudents,
  type HomeworkChapter,
  type HomeworkExamPaper,
  type HomeworkQuestion,
  type HomeworkQuestionType,
  type StudentRow,
} from "@/app/lms/homework/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";
import { StudentScopeToggle, type StudentScope } from "@/app/lms/_shared/StudentScopeToggle";

type HomeworkSource = "chapter" | "attachment" | "exam_paper";

const SOURCE_OPTIONS: Array<{ value: HomeworkSource; label: string; hint: string; color: string }> = [
  {
    value: "chapter",
    label: "Chapter",
    hint: "Pick questions from the question bank, chapter by chapter.",
    color: "violet",
  },
  {
    value: "attachment",
    label: "Attachment",
    hint: "Attach a PDF, Word document or image for students to work from.",
    color: "blue",
  },
  {
    value: "exam_paper",
    label: "Homework paper",
    hint: "Assign an existing homework paper — its questions come with it.",
    color: "emerald",
  },
];

function examPaperLabel(paper: HomeworkExamPaper): string {
  const name = paper.title || `Paper ${paper.id}`;
  const marks = paper.totalMarks ? ` (${paper.totalMarks} marks)` : "";
  const context = [
    paper.standardName ? `Grade ${paper.standardName}` : "",
    paper.subjectName,
  ]
    .filter(Boolean)
    .join(" · ");
  return context ? `${name}${marks} — ${context}` : `${name}${marks}`;
}

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readValue(value: SearchDropdownValues[keyof SearchDropdownValues]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const ATTACHMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

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
  const [scope, setScope] = useState<StudentScope>("student_wise");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [standardName, setStandardName] = useState("");
  const [subjectName, setSubjectName] = useState("");

  const [source, setSource] = useState<HomeworkSource>("attachment");
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

  const [examPapers, setExamPapers] = useState<HomeworkExamPaper[]>([]);
  const [examPapersLoading, setExamPapersLoading] = useState(false);
  const [examPapersError, setExamPapersError] = useState("");
  const [selectedExamPaperId, setSelectedExamPaperId] = useState("");
  const [examPaperQuestions, setExamPaperQuestions] = useState<HomeworkQuestion[]>([]);
  const [examPaperQuestionsLoading, setExamPaperQuestionsLoading] = useState(false);
  const [examPaperQuestionsError, setExamPaperQuestionsError] = useState("");

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
  const assignToAll = scope === "all_students";

  const fromChapters = source === "chapter";
  const fromAttachment = source === "attachment";
  const fromExamPaper = source === "exam_paper";

  useEffect(() => {
    if (!fromChapters || !standard) {
      setChapters([]);
      setSelectedChapterIds([]);
      return;
    }
    let cancelled = false;
    setChaptersLoading(true);
    setChaptersError("");
    setSelectedChapterIds([]);
    listHomeworkChapters({ standardId: standard, subjectId: subject })
      .then((rows) => { if (!cancelled) setChapters(rows); })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setChapters([]);
          setChaptersError(loadError instanceof Error ? loadError.message : "Chapters couldn't be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setChaptersLoading(false); });
    return () => { cancelled = true; };
  }, [fromChapters, standard, subject]);

  useEffect(() => {
    if (!fromChapters) return;
    let cancelled = false;
    setQuestionTypesLoading(true);
    setQuestionTypesError("");
    listHomeworkQuestionTypes()
      .then((rows) => { if (!cancelled) setQuestionTypes(rows); })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setQuestionTypes([]);
          setQuestionTypesError(loadError instanceof Error ? loadError.message : "Question types couldn't be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setQuestionTypesLoading(false); });
    return () => { cancelled = true; };
  }, [fromChapters]);

  useEffect(() => {
    if (!fromChapters || selectedChapterIds.length === 0 || !subject || !standard) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionsError("");
    listHomeworkQuestions({ subjectId: subject, standardId: standard, chapterIds: selectedChapterIds, questionTypeIds: selectedQuestionTypeIds })
      .then((rows) => { if (!cancelled) setQuestions(rows); })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setQuestions([]);
          setQuestionsError(loadError instanceof Error ? loadError.message : "Questions couldn't be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setQuestionsLoading(false); });
    return () => { cancelled = true; };
  }, [fromChapters, subject, standard, selectedChapterIds, selectedQuestionTypeIds]);

  useEffect(() => {
    if (!fromExamPaper) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setExamPapersLoading(true);
      setExamPapersError("");
      listHomeworkExamPapers()
        .then((rows) => { if (!cancelled) setExamPapers(rows); })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setExamPapers([]);
            setExamPapersError(loadError instanceof Error ? loadError.message : "Exam papers couldn't be loaded.");
          }
        })
        .finally(() => { if (!cancelled) setExamPapersLoading(false); });
    });
    return () => { cancelled = true; };
  }, [fromExamPaper]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!fromExamPaper || !selectedExamPaperId) {
        setExamPaperQuestions([]);
        setExamPaperQuestionsError("");
        return;
      }
      setExamPaperQuestionsLoading(true);
      setExamPaperQuestionsError("");
      listExamPaperQuestions(Number(selectedExamPaperId))
        .then((rows) => { if (!cancelled) setExamPaperQuestions(rows); })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setExamPaperQuestions([]);
            setExamPaperQuestionsError(loadError instanceof Error ? loadError.message : "The exam paper's questions couldn't be loaded.");
          }
        })
        .finally(() => { if (!cancelled) setExamPaperQuestionsLoading(false); });
    });
    return () => { cancelled = true; };
  }, [fromExamPaper, selectedExamPaperId]);

  function handleChapterSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const ids = Array.from(event.target.selectedOptions, (option) => Number(option.value));
    setSelectedChapterIds(ids);
  }

  function toggleQuestionTypeId(id: number) {
    setSelectedQuestionTypeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function toggleQuestionId(id: number) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function selectAllQuestions() {
    setSelectedQuestionIds(questions.map((q) => q.id));
  }

  function deselectAllQuestions() {
    setSelectedQuestionIds([]);
  }

  const questionTypeLabel = useCallback(
    (questionTypeId: number) =>
      questionTypes.find((t) => t.id === questionTypeId)?.label || `Type ${questionTypeId}`,
    [questionTypes]
  );

  function changeScope(next: StudentScope) {
    setScope(next);
    setSelected(new Set());
    setError("");
    setSuccess("");
  }

  const lastSearchKeyRef = useRef("");
  const searchRequestRef = useRef(0);

  const runStudentSearch = useCallback(
    async (values: Partial<SearchDropdownValues>) => {
      const nextSection = readValue(values.section ?? "");
      const nextStandard = readValue(values.standard ?? "");
      const nextDivision = readValue(values.division ?? "");
      const nextSubject = readValue(values.subject ?? "");

      if (!nextStandard || !nextSubject) {
        lastSearchKeyRef.current = "";
        searchRequestRef.current += 1;
        setStudents([]);
        setSelected(new Set());
        setLoading(false);
        return;
      }

      const key = [nextSection, nextStandard, nextDivision, nextSubject].join("|");
      if (key === lastSearchKeyRef.current) return;
      lastSearchKeyRef.current = key;

      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      setError("");
      setSuccess("");
      setLoading(true);
      setSearched(true);
      setStudents([]);
      setSelected(new Set());
      try {
        const rows = await listStudents({ grade: nextSection, standard: nextStandard, division: nextDivision });
        if (searchRequestRef.current !== requestId) return;
        setStudents(rows);
      } catch (loadError: unknown) {
        if (searchRequestRef.current !== requestId) return;
        lastSearchKeyRef.current = "";
        setStudents([]);
        setError(loadError instanceof Error ? loadError.message : "Students couldn't be loaded.");
      } finally {
        if (searchRequestRef.current === requestId) setLoading(false);
      }
    },
    []
  );

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
    if (!file) return;
    const msg = validateAttachment(file);
    if (msg) {
      setAttachmentError(msg);
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
        : new Set(students.map((s) => s.id))
    );
  }

  const validationError = useMemo(() => {
    if (!standard) return "Select a standard.";
    if (!subject) return "Select a subject.";
    if (!title.trim()) return "Enter a homework title.";
    if (!submissionDate) return "Select a submission date.";
    if (fromChapters && selectedQuestionIds.length === 0) return "Select at least one question.";
    if (fromExamPaper) {
      if (!selectedExamPaperId) return "Select a homework paper.";
      if (examPaperQuestionsLoading) return "Wait for the homework paper's questions to load.";
      if (examPaperQuestions.length === 0) return "The selected homework paper has no questions.";
    }
    if (!assignToAll && selected.size === 0) return "Select at least one student.";
    if (assignToAll && students.length === 0) return "No students found for the selected class.";
    return "";
  }, [standard, subject, title, submissionDate, fromChapters, fromExamPaper, selectedQuestionIds.length, selectedExamPaperId, examPaperQuestions.length, examPaperQuestionsLoading, selected.size, assignToAll, students.length]);

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
        studentIds: assignToAll ? [] : Array.from(selected),
        assignMode: assignToAll ? "all" : "selected",
        grade: section,
        title: title.trim(),
        description: description.trim(),
        submissionDate,
        standardId: standard,
        divisionId: division,
        subjectId: subject,
        prompt,
        image: fromAttachment ? image : null,
        ...(fromChapters ? { sourceType: "question_bank" as const, questionIds: selectedQuestionIds } : {}),
        ...(fromExamPaper ? { sourceType: "exam_paper" as const, examPaperId: Number(selectedExamPaperId), questionIds: examPaperQuestions.map((q) => q.id) } : {}),
      });
      setSuccess(`Homework assigned to ${count} student(s) successfully.`);
      setTitle("");
      setDescription("");
      setSubmissionDate("");
      setImage(null);
      setAttachmentError("");
      setSelected(new Set());
      setSource("attachment");
      setSelectedChapterIds([]);
      setSelectedQuestionTypeIds([]);
      setSelectedQuestionIds([]);
      setSelectedExamPaperId("");
      setExamPaperQuestions([]);
      setExamPaperQuestionsError("");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Homework couldn't be assigned.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireStaff>
      <main className="mx-auto  space-y-5 p-4 sm:p-6">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student homework</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Search students by class and assign homework
            </p>
          </div>
          {success ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              {success}
            </div>
          ) : null}
        </div>

        {/* Error banner */}
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="size-4 shrink-0 text-red-500" />
            {error}
          </div>
        ) : null}

        {/* ── Step 1: Assign to ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Section header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-100">
              <span className="text-xs font-bold text-indigo-700">1</span>
            </div>
            <h2 className="text-sm font-bold text-slate-700">Select class &amp; assign to</h2>
          </div>

          <div className="p-5 space-y-5">
            {/* Same segmented control the Assignment, Worksheet and Project screens use. */}
            <StudentScopeToggle value={scope} onChange={changeScope} name="homework-scope" />

            {/* Class filters */}
            <SearchDropdown
              fields={academicFields}
              values={filters}
              onChange={(values) => {
                setFilters(values);
                void runStudentSearch(values);
              }}
              onStandardChange={(_value, rows) => setStandardName(rows[0]?.name ?? "")}
              onSubjectChange={(_value, rows) => setSubjectName(rows[0]?.subject_name ?? "")}
              className="gap-x-5 gap-y-4"
            />

            <p className="flex items-center gap-2 text-sm text-slate-500">
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin text-indigo-400" />
                  <span className="text-indigo-600">Loading students…</span>
                </>
              ) : searched && students.length > 0 ? (
                <>
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {students.length}
                  </span>
                  <span className="text-emerald-700 font-medium">
                    student{students.length !== 1 ? "s" : ""} found in this class
                  </span>
                </>
              ) : (
                "Students load automatically once a standard and subject are selected."
              )}
            </p>
          </div>
        </section>

        {/* ── Step 2: Homework details + student picker ── */}
        {searched ? (
          <form onSubmit={handleAssign} className="space-y-5">

            {/* Homework details card */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100">
                  <span className="text-xs font-bold text-amber-700">2</span>
                </div>
                <h2 className="text-sm font-bold text-slate-700">Homework details</h2>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="hw-title" className="text-sm font-semibold text-slate-700">
                      Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="hw-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter homework title"
                      maxLength={50}
                    />
                  </div>

                  {/* Submission date */}
                  <div className="space-y-2">
                    <Label htmlFor="hw-date" className="text-sm font-semibold text-slate-700">
                      Submission date <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="hw-date"
                        type="date"
                        value={submissionDate}
                        onChange={(e) => setSubmissionDate(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Source type */}
                  <div className="space-y-2">
                    <p id="hw-source-label" className="text-sm font-semibold text-slate-700">
                      Send homework from system
                    </p>
                    <div role="radiogroup" aria-labelledby="hw-source-label" className="flex flex-wrap gap-2">
                      {SOURCE_OPTIONS.map((option) => {
                        const isSelected = source === option.value;
                        const colorMap: Record<string, string> = {
                          violet: isSelected
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-violet-50",
                          blue: isSelected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50",
                          emerald: isSelected
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50",
                        };
                        return (
                          <label
                            key={option.value}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-indigo-200 ${colorMap[option.color]}`}
                          >
                            <input
                              type="radio"
                              name="hw-source"
                              value={option.value}
                              checked={isSelected}
                              onChange={() => setSource(option.value)}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400">
                      {SOURCE_OPTIONS.find((o) => o.value === source)?.hint}
                    </p>
                  </div>

                  {/* Attachment */}
                  {fromAttachment ? (
                    <div className="space-y-2">
                      <Label htmlFor="hw-image" className="text-sm font-semibold text-slate-700">
                        Attachment
                      </Label>
                      {image ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <Paperclip className="size-4 shrink-0 text-blue-400" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-blue-700" title={image.name}>
                                {image.name}
                              </p>
                              <p className="text-xs text-blue-400">{formatFileSize(image.size)}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <label
                              htmlFor="hw-image"
                              className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                            >
                              Replace
                              <input id="hw-image" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="sr-only" onChange={handleAttachmentChange} />
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
                          className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/60"
                        >
                          <Paperclip className="size-4 text-slate-400" />
                          Choose PDF, DOC, DOCX, JPG, JPEG or PNG
                          <input id="hw-image" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="sr-only" onChange={handleAttachmentChange} />
                        </label>
                      )}
                      {attachmentError ? (
                        <p className="text-xs text-red-600">{attachmentError}</p>
                      ) : (
                        <p className="text-xs text-slate-400">Up to 10 MB.</p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Chapter picker */}
                {fromChapters ? (
                  <div className="space-y-5 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="size-4 text-violet-600" />
                      <p className="text-sm font-bold text-violet-700">Question bank</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="hw-chapter" className="text-sm font-semibold text-slate-700">
                          Select chapter
                        </Label>
                        {selectedChapterIds.length > 0 ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
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
                          className="min-h-28 w-full max-w-sm rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {chapters.map((chapter) => (
                            <option key={chapter.id} value={chapter.id}>
                              {chapter.name || `Chapter ${chapter.id}`}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-xs text-slate-400">
                        {chaptersLoading ? "Loading chapters…" : !standard || chapters.length > 0 ? "Hold Ctrl (Cmd on Mac) to select multiple chapters." : "No chapters available for this standard/subject."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Question types</p>
                      {questionTypesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <LoaderCircle className="size-4 animate-spin" /> Loading…
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
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-violet-500 bg-violet-500 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
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
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Available questions
                        </p>
                        <div className="flex items-center gap-2">
                          {selectedQuestionIds.length > 0 && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                              {selectedQuestionIds.length} selected
                            </span>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={selectAllQuestions} disabled={questions.length === 0}>
                            Select all
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={deselectAllQuestions} disabled={selectedQuestionIds.length === 0}>
                            Deselect all
                          </Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-violet-100">
                        <Table>
                          <TableHeader className="bg-violet-50">
                            <TableRow>
                              <TableHead className="w-12">
                                <input
                                  type="checkbox"
                                  aria-label="Select all questions"
                                  checked={questions.length > 0 && selectedQuestionIds.length === questions.length}
                                  onChange={() => selectedQuestionIds.length === questions.length ? deselectAllQuestions() : selectAllQuestions()}
                                />
                              </TableHead>
                              <TableHead>Question</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedChapterIds.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-slate-400">Select at least one chapter to load questions.</TableCell></TableRow>
                            ) : questionsLoading ? (
                              <TableRow><TableCell colSpan={4} className="h-20 text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-violet-300" /></TableCell></TableRow>
                            ) : questionsError ? (
                              <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-red-600">{questionsError}</TableCell></TableRow>
                            ) : questions.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-slate-400">No questions found for the selected chapters/types.</TableCell></TableRow>
                            ) : (
                              questions.map((question) => {
                                const isQSelected = selectedQuestionIds.includes(question.id);
                                return (
                                  <TableRow key={question.id} className={isQSelected ? "bg-violet-50/60" : ""}>
                                    <TableCell>
                                      <input type="checkbox" aria-label={`Select question ${question.id}`} checked={isQSelected} onChange={() => toggleQuestionId(question.id)} />
                                    </TableCell>
                                    <TableCell>
                                      <span className="line-clamp-1 max-w-md text-sm text-slate-700" title={question.description || question.title}>
                                        {question.title || "Untitled question"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                                        {questionTypeLabel(question.questionTypeId)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="font-semibold text-emerald-600">{question.points || "—"}</TableCell>
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

                {/* Exam paper picker */}
                {fromExamPaper ? (
                  <div className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="size-4 text-emerald-600" />
                      <p className="text-sm font-bold text-emerald-700">Homework paper</p>
                    </div>
                    {examPapersError ? (
                      <p className="text-sm text-red-600">{examPapersError}</p>
                    ) : (
                      <div className="relative">
                        <select
                          id="hw-exam-paper"
                          value={selectedExamPaperId}
                          onChange={(e) => setSelectedExamPaperId(e.target.value)}
                          disabled={examPapersLoading || examPapers.length === 0}
                          className="h-11 w-full max-w-xl appearance-none rounded-xl border border-emerald-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">
                            {examPapersLoading ? "Loading homework papers…" : examPapers.length === 0 ? "No homework papers available" : "Select a homework paper"}
                          </option>
                          {examPapers.map((paper) => (
                            <option key={paper.id} value={paper.id}>{examPaperLabel(paper)}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    )}
                    <p className="text-xs text-slate-400">
                      Only homework papers are listed. Its questions are assigned as they are.
                    </p>

                    {selectedExamPaperId ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Questions from this paper</p>
                          <span className="text-xs text-slate-500">
                            {examPaperQuestions.length} question(s) · {examPaperQuestions.reduce((t, q) => t + q.points, 0)} marks
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-emerald-100">
                          <Table>
                            <TableHeader className="bg-emerald-50">
                              <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Question</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Points</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {examPaperQuestionsLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-20 text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-emerald-300" /></TableCell></TableRow>
                              ) : examPaperQuestionsError ? (
                                <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-red-600">{examPaperQuestionsError}</TableCell></TableRow>
                              ) : examPaperQuestions.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-slate-400">This exam paper has no questions yet.</TableCell></TableRow>
                              ) : (
                                examPaperQuestions.map((question, index) => (
                                  <TableRow key={question.id}>
                                    <TableCell className="text-sm font-medium text-slate-500">{index + 1}</TableCell>
                                    <TableCell>
                                      <span className="line-clamp-1 max-w-md text-sm text-slate-700" title={question.title}>
                                        {question.title || "Untitled question"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                        {question.questionTypeLabel || questionTypeLabel(question.questionTypeId)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="font-semibold text-emerald-600">{question.points || "—"}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hw-desc" className="text-sm font-semibold text-slate-700">
                      Description
                    </Label>
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
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the homework task for students…"
                    rows={3}
                  />
                </div>

                {/* AI prompt preview */}
                <div className="space-y-2">
                  <Label htmlFor="hw-prompt" className="text-sm font-semibold text-slate-700">
                    AI prompt preview
                  </Label>
                  <Textarea
                    id="hw-prompt"
                    value={prompt}
                    readOnly
                    rows={6}
                    className="bg-slate-50 font-mono text-xs text-slate-500"
                  />
                  <p className="text-xs text-slate-400">
                    Auto-generated from the class, title and description. Used for AI submission checking.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Step 3: Student selection ── */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div
                  className={`flex size-7 items-center justify-center rounded-lg ${
                    assignToAll ? "bg-violet-100" : "bg-indigo-100"
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      assignToAll ? "text-violet-700" : "text-indigo-700"
                    }`}
                  >
                    3
                  </span>
                </div>
                <h2 className="text-sm font-bold text-slate-700">
                  {assignToAll ? "Confirm class assignment" : "Select students"}
                </h2>
                {!assignToAll && selected.size > 0 && (
                  <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                    {selected.size} selected
                  </span>
                )}
              </div>

              <div className="p-5">
                {/* ALL STUDENTS MODE */}
                {assignToAll ? (
                  <div className="flex items-start gap-4 rounded-2xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-sm">
                      <UsersRound className="size-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-violet-800">
                        {loading
                          ? "Counting students…"
                          : `${students.length} student${students.length !== 1 ? "s" : ""} in this class`}
                      </p>
                      <p className="mt-1 text-sm text-violet-600">
                        The homework will be sent to every student enrolled in{" "}
                        <span className="font-semibold">{standardName || "the selected standard"}</span>
                        {subjectName ? (
                          <> — <span className="font-semibold">{subjectName}</span></>
                        ) : null}
                        . No individual selection needed.
                      </p>
                      {students.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {students.slice(0, 8).map((s) => (
                            <span key={s.id} className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                              {s.studentName.split(" ")[0]}
                            </span>
                          ))}
                          {students.length > 8 && (
                            <span className="rounded-full bg-violet-200 px-2.5 py-1 text-xs font-bold text-violet-700">
                              +{students.length - 8} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* STUDENT WISE MODE */
                  <div className="overflow-x-auto rounded-xl border border-indigo-100">
                    <Table>
                      <TableHeader className="bg-indigo-50">
                        <TableRow>
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              aria-label="Select all students"
                              checked={allChecked}
                              onChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead className="font-bold text-indigo-700">Student name</TableHead>
                          <TableHead className="font-bold text-indigo-700">GR no.</TableHead>
                          <TableHead className="font-bold text-indigo-700">Standard</TableHead>
                          <TableHead className="font-bold text-indigo-700">Division</TableHead>
                          <TableHead className="font-bold text-indigo-700">Gender</TableHead>
                          <TableHead className="font-bold text-indigo-700">Mobile</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                              <LoaderCircle className="mx-auto size-6 animate-spin text-indigo-300" />
                            </TableCell>
                          </TableRow>
                        ) : students.length ? (
                          students.map((student) => (
                            <TableRow
                              key={student.id}
                              className={selected.has(student.id) ? "bg-indigo-50/60" : ""}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${student.studentName}`}
                                  checked={selected.has(student.id)}
                                  onChange={() => toggle(student.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-slate-800">
                                {student.studentName}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-slate-500">
                                {student.enrollmentNo || "—"}
                              </TableCell>
                              <TableCell>{student.standardName || "—"}</TableCell>
                              <TableCell>
                                {student.divisionName ? (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                    {student.divisionName}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {student.gender ? (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${student.gender.toLowerCase() === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                                    {student.gender}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {student.mobile || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-36 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100">
                                  <Users className="size-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-600">No students found</p>
                                <p className="text-xs text-slate-400">Try a different standard, division or section.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </section>

            {/* Submit footer */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Layers className={`size-4 ${assignToAll ? "text-violet-500" : "text-indigo-500"}`} />
                <span className="text-sm text-slate-600">
                  {assignToAll
                    ? `${students.length} student${students.length !== 1 ? "s" : ""} in this class`
                    : `${selected.size} student${selected.size !== 1 ? "s" : ""} selected`}
                </span>
              </div>
              <Button
                type="submit"
                disabled={saving || (assignToAll ? students.length === 0 : false)}
                className={assignToAll ? "bg-violet-600 hover:bg-violet-700" : ""}
              >
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
          /* Pre-search empty state */
          <section className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-100">
              <ClipboardList className="size-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-700">
                No students loaded yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Select a section, standard, division and subject above to load
                students and assign homework.
              </p>
            </div>
          </section>
        )}
      </main>
    </RequireStaff>
  );
}
