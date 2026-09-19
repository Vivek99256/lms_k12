"use client";

/**
 * The one "assign work to students" screen.
 *
 * Assignment, Worksheet and Project ask the teacher exactly the same thing —
 * pick a class, pick the paper, search the students, send it — and the row it
 * writes is the same `lms_assignment` row, submitted and graded by the same
 * screens. So this is the Assignment module's create flow, lifted out of
 * app/lms/lmsAssignment/page.tsx unchanged and given a work type, rather than
 * the same form copied twice with the noun swapped.
 *
 * `workType` picks two things and nothing else: which `question_paper.exam_type`
 * the paper dropdown lists, and what `work_type` the created rows carry. The
 * validation, the student search, the student-wise / all-students modes, the
 * upload switch and the submit are one implementation for all three.
 *
 * The page supplies its own heading — this renders the banners, the filter card
 * and the form, so it drops into all three pages without any of them growing a
 * second title.
 *
 * There is no search button: picking a standard and a subject is the search.
 * See runStudentSearch below.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  LoaderCircle,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  createAssignment,
  examPaperPdfUrl,
  listAssignmentStudents,
  listExamPapers,
  uploadHomeworkFile,
  type AssignmentStudentRow,
  type ExamPaperRow,
} from "@/app/lms/lmsAssignment/api";
import {
  StudentScopeToggle,
  type StudentScope,
} from "@/app/lms/_shared/StudentScopeToggle";

export type WorkType = "assignment" | "worksheet" | "project";

type WorkTypeCopy = {
  /** Capitalised noun, for labels. */
  Noun: string;
  /** Lowercase noun, for sentences. */
  noun: string;
  /** Prefix for this panel's DOM ids, so two panels could coexist on a page. */
  idPrefix: string;
  /**
   * The `question_paper.exam_type` whose papers this screen assigns. Undefined
   * for assignments, which leaves the request exactly as the Assignment screen
   * has always sent it and the endpoint defaulting to its offline pool.
   */
  examType?: string;
  /** Shown when the subject has no paper of this type. */
  noPaperText: string;
  /** Label over the file input behind the "send from system" switch. */
  uploadTitleLabel: string;
  uploadTitlePlaceholder: string;
  titlePlaceholder: string;
  missingFile: string;
  missingUploadTitle: string;
  missingPaper: string;
  missingTitle: string;
  emptyState: string;
  /**
   * Whether the paper and the picked upload get a PDF button that opens them
   * in a new tab. Off for Assignment, whose workflow is explicitly frozen.
   */
  showPdfPreview: boolean;
};

/**
 * The PDF button, in the question-paper grid's styling so the icon means the
 * same thing wherever it appears.
 *
 * It is a link, not a fetch: the browser's own viewer opens the file in a new
 * tab, which is what lets the teacher read, print or save it without a
 * download round-trip first. `rel="noreferrer"` because the tab it opens is
 * not ours to be reached back into.
 */
function PdfPreviewLink({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#CFD9E6] bg-white px-3 text-[12px] font-semibold text-[#5846EA] transition hover:border-[#5846EA] hover:bg-[#F5F4FF]"
    >
      <FileText size={14} />
      PDF
    </a>
  );
}

/**
 * Every string the three screens differ by, written out rather than derived, so
 * the Assignment column is verbatim what that screen showed before this module
 * existed — including the wordings inherited from homework.
 */
const COPY: Record<WorkType, WorkTypeCopy> = {
  assignment: {
    Noun: "Assignment",
    noun: "assignment",
    idPrefix: "asg",
    examType: undefined,
    noPaperText: "No offline assignment paper found",
    uploadTitleLabel: "Homework Title",
    uploadTitlePlaceholder: "Homework title",
    titlePlaceholder: "Assignment title",
    missingFile: "Upload a homework file.",
    missingUploadTitle: "Enter a homework title.",
    missingPaper: "Select an assignment paper.",
    missingTitle: "Enter an assignment title.",
    emptyState: "Select a class and search students to create an assignment.",
    showPdfPreview: false,
  },
  worksheet: {
    Noun: "Worksheet",
    noun: "worksheet",
    idPrefix: "wks",
    examType: "worksheet",
    noPaperText: "No worksheet paper found",
    uploadTitleLabel: "Worksheet Title",
    uploadTitlePlaceholder: "Worksheet title",
    titlePlaceholder: "Worksheet title",
    missingFile: "Upload a worksheet file.",
    missingUploadTitle: "Enter a worksheet title.",
    missingPaper: "Select a worksheet paper.",
    missingTitle: "Enter a worksheet title.",
    emptyState: "Select a class and search students to assign a worksheet.",
    showPdfPreview: true,
  },
  project: {
    Noun: "Project",
    noun: "project",
    idPrefix: "prj",
    examType: "project",
    noPaperText: "No project paper found",
    uploadTitleLabel: "Project Title",
    uploadTitlePlaceholder: "Project title",
    titlePlaceholder: "Project title",
    missingFile: "Upload a project file.",
    missingUploadTitle: "Enter a project title.",
    missingPaper: "Select a project paper.",
    missingTitle: "Enter a project title.",
    emptyState: "Select a class and search students to assign a project.",
    showPdfPreview: true,
  },
};

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

const selectClassName =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function AssignWorkPanel({ workType }: { workType: WorkType }) {
  const copy = COPY[workType];

  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [students, setStudents] = useState<AssignmentStudentRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /**
   * Student-wise is the default, and everything under it is this screen's
   * original flow, untouched. All-students only ever removes the picker: the
   * class is still searched, so the teacher can see how many it will reach,
   * but the roster that is actually written comes from the backend.
   */
  const [scope, setScope] = useState<StudentScope>("student_wise");
  const [examPapers, setExamPapers] = useState<ExamPaperRow[]>([]);
  const [examPaper, setExamPaper] = useState(""); // packed "<pdfName>####<id>"
  const [sendHomework, setSendHomework] = useState(false);
  const [homeworkFile, setHomeworkFile] = useState<File | null>(null);
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const section = readValue(filters.section ?? "");
  const standard = readValue(filters.standard ?? "");
  const division = readValue(filters.division ?? "");
  const subject = readValue(filters.subject ?? "");

  const allChecked = students.length > 0 && selected.size === students.length;
  const assignToAll = scope === "all_students";

  const examType = copy.examType;

  /**
   * The selected paper's PDF, straight from storage. The dropdown packs
   * "<pdfName>####<id>" into its value, and the pdfName half is the file the
   * assign flow will record on every student's row — so this previews exactly
   * what they will receive.
   */
  const selectedPaperPdfUrl = useMemo(
    () => (copy.showPdfPreview ? examPaperPdfUrl(examPaper.split("####")[0] ?? "") : ""),
    [copy.showPdfPreview, examPaper]
  );

  /**
   * A blob URL for the file the teacher just picked, so it can be checked
   * before it is uploaded. It exists only in this tab and is revoked below
   * when the picked file changes or the panel unmounts.
   */
  const pickedFileUrl = useMemo(
    () =>
      copy.showPdfPreview && homeworkFile ? URL.createObjectURL(homeworkFile) : "",
    [copy.showPdfPreview, homeworkFile]
  );

  useEffect(
    () => () => {
      if (pickedFileUrl) URL.revokeObjectURL(pickedFileUrl);
    },
    [pickedFileUrl]
  );

  // Load the question papers of this work type whenever the subject changes.
  useEffect(() => {
    let active = true;
    if (!subject) {
      setExamPapers([]);
      setExamPaper("");
      return;
    }
    setLoadingExams(true);
    listExamPapers(subject, examType)
      .then((rows) => {
        if (active) setExamPapers(rows);
      })
      .catch(() => {
        if (active) setExamPapers([]);
      })
      .finally(() => {
        if (active) setLoadingExams(false);
      });
    return () => {
      active = false;
    };
  }, [subject, examType]);

  // Switching modes drops whatever was ticked, so a stale selection can never
  // leak back into a later submit.
  function changeScope(next: StudentScope) {
    setScope(next);
    setSelected(new Set());
    setError("");
    setSuccess("");
  }

  /**
   * Load the class the filters now describe.
   *
   * Called from the dropdown's own onChange rather than from an effect,
   * because this is a reaction to the teacher picking something, not state
   * that needs synchronising — and the handler is handed the complete next
   * values, so there is no render to wait for.
   *
   * Two guards, both about not calling the endpoint twice for one class:
   * `lastSearchKey` skips a change that leaves the class the same (re-picking
   * the subject already selected), and `requestId` means a slow answer that
   * arrives after a newer search is dropped instead of overwriting it.
   */
  const lastSearchKeyRef = useRef("");
  const searchRequestRef = useRef(0);

  const runStudentSearch = useCallback(
    async (values: Partial<SearchDropdownValues>) => {
      const nextSection = readValue(values.section ?? "");
      const nextStandard = readValue(values.standard ?? "");
      const nextDivision = readValue(values.division ?? "");
      const nextSubject = readValue(values.subject ?? "");

      // Standard and subject are what make a class searchable, and subject is
      // the last of the four the teacher picks — so this is the moment the
      // filters describe something to look up. Division is optional in the
      // dropdown, but a change to it still re-runs the search through the key
      // below.
      if (!nextStandard || !nextSubject) {
        lastSearchKeyRef.current = "";
        // Abandon anything in flight: its answer is for a class the teacher
        // has since moved away from.
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
        const rows = await listAssignmentStudents({
          grade: nextSection,
          standard: nextStandard,
          division: nextDivision,
        });
        if (searchRequestRef.current !== requestId) return;
        setStudents(rows);
      } catch (loadError: unknown) {
        if (searchRequestRef.current !== requestId) return;
        // Forget the key so the same selection can be retried by re-picking
        // it, rather than being stuck on a failed load.
        lastSearchKeyRef.current = "";
        setStudents([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Students could not be loaded."
        );
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
    if (sendHomework) {
      if (!homeworkFile) return copy.missingFile;
      if (!homeworkTitle.trim()) return copy.missingUploadTitle;
    } else {
      if (!examPaper) return copy.missingPaper;
      if (!title.trim()) return copy.missingTitle;
    }
    if (!assignToAll && selected.size === 0) return "Select at least one student.";
    if (assignToAll && students.length === 0) {
      return "No students found for the selected class.";
    }
    return "";
  }, [
    standard,
    subject,
    sendHomework,
    examPaper,
    homeworkFile,
    homeworkTitle,
    title,
    selected.size,
    assignToAll,
    students.length,
    copy,
  ]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      let homeworkFilePath: string | undefined;
      if (sendHomework && homeworkFile) {
        homeworkFilePath = await uploadHomeworkFile(homeworkFile);
      }
      const [pdfName, examId] = examPaper.split("####");
      const count = await createAssignment({
        // All-students sends no ids at all — the backend resolves the class
        // from the three filters below.
        studentIds: assignToAll ? [] : Array.from(selected),
        assignMode: assignToAll ? "all" : "selected",
        grade: section,
        standardId: standard,
        divisionId: division,
        workType,
        title: sendHomework ? homeworkTitle.trim() : title.trim(),
        description: description.trim(),
        submissionDate,
        subjectId: subject,
        examId: examId ?? "",
        examPdf: pdfName ?? "",
        assignmentSourceType: sendHomework ? "uploaded_homework" : "exam_paper",
        homeworkFile: homeworkFilePath,
      });
      setSuccess(`${copy.Noun} created for ${count} student(s) successfully.`);
      setTitle("");
      setHomeworkTitle("");
      setDescription("");
      setSubmissionDate("");
      setExamPaper("");
      setHomeworkFile(null);
      setSendHomework(false);
      setSelected(new Set());
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `${copy.Noun} could not be created.`
      );
    } finally {
      setSaving(false);
    }
  }

  const id = (suffix: string) => `${copy.idPrefix}-${suffix}`;

  return (
    <>
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
        <div className="mb-5 border-b border-slate-100 pb-4">
          <StudentScopeToggle
            value={scope}
            onChange={changeScope}
            name={id("scope")}
          />
        </div>
        <SearchDropdown
          fields={academicFields}
          values={filters}
          onChange={(values) => {
            setFilters(values);
            void runStudentSearch(values);
          }}
        />
        <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
          {loading ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Loading students…
            </>
          ) : (
            "Students load automatically once a standard and subject are selected."
          )}
        </p>
      </section>

      {searched ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={id("source")}>
                  Send {copy.Noun} from system
                </Label>
                <Switch
                  id={id("source")}
                  checked={sendHomework}
                  onChange={(event) => {
                    setSendHomework(event.target.checked);
                    if (!event.target.checked) {
                      setHomeworkFile(null);
                    }
                  }}
                />
              </div>
              {sendHomework ? (
                <div className="space-y-2">
                  <Label htmlFor={id("homework-file")}>
                    {copy.Noun} Upload <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={id("homework-file")}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    onChange={(event) => setHomeworkFile(event.target.files?.[0] ?? null)}
                  />
                  {homeworkFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-slate-500">
                        {homeworkFile.name}
                      </p>
                      {pickedFileUrl ? (
                        <PdfPreviewLink
                          href={pickedFileUrl}
                          title={`Open ${homeworkFile.name} in a new tab`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={id("exam")}>
                    {copy.Noun} paper <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <select
                      id={id("exam")}
                      value={examPaper}
                      onChange={(event) => setExamPaper(event.target.value)}
                      disabled={loadingExams || !subject}
                      className={selectClassName}
                    >
                      <option value="">
                        {loadingExams
                          ? `Loading ${copy.noun} papers...`
                          : !subject
                            ? "Select a subject first"
                            : examPapers.length
                              ? `Select ${copy.Noun} Paper`
                              : copy.noPaperText}
                      </option>
                      {examPapers.map((paper) => (
                        <option
                          key={paper.id}
                          value={`${paper.pdfName}####${paper.id}`}
                        >
                          {paper.paperName}
                          {paper.totalMarks ? ` (${paper.totalMarks} marks)` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedPaperPdfUrl ? (
                      <PdfPreviewLink
                        href={selectedPaperPdfUrl}
                        title={`Open this ${copy.noun} paper in a new tab`}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("title")}>
                {sendHomework ? copy.uploadTitleLabel : "Title"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id={id("title")}
                value={sendHomework ? homeworkTitle : title}
                onChange={(event) => sendHomework ? setHomeworkTitle(event.target.value) : setTitle(event.target.value)}
                placeholder={sendHomework ? copy.uploadTitlePlaceholder : copy.titlePlaceholder}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("date")}>Submission date</Label>
              <Input
                id={id("date")}
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={id("desc")}>Description</Label>
                <AiFieldAssistant
                  value={description}
                  onApply={setDescription}
                  fieldType="description"
                  label={`${copy.Noun} description`}
                  module="lms"
                  page={copy.Noun}
                  entityType={copy.noun}
                  related={{
                    [`${copy.Noun} title`]: sendHomework ? homeworkTitle : title,
                  }}
                  maxLength={50}
                />
              </div>
              <Textarea
                id={id("desc")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={`${copy.Noun} description`}
                rows={3}
                maxLength={50}
              />
            </div>
          </div>

          {assignToAll ? (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Users className="mt-0.5 size-5 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {loading
                    ? "Counting students in this class…"
                    : `All ${students.length} student(s) in the selected class`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  The {copy.noun} goes to every student enrolled in the selected
                  section, standard and division. No individual selection is
                  needed.
                </p>
              </div>
            </div>
          ) : (
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
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Mobile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-slate-500"
                    >
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
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-slate-500"
                    >
                      <Users className="mx-auto mb-2 size-8 text-slate-300" />
                      No students found for the selected class.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {assignToAll
                ? `${students.length} student(s) in this class`
                : `${selected.size} student(s) selected`}
            </span>
            <Button type="submit" disabled={saving || students.length === 0}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Create {copy.noun}
            </Button>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
          {copy.emptyState}
        </section>
      )}
    </>
  );
}

export default AssignWorkPanel;
