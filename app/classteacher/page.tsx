"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createClassTeacher,
  deleteClassTeacher,
  loadClassTeachers,
  updateClassTeacher,
  type ClassTeacherAssignment,
  type ClassTeacherBootstrap,
  type ClassTeacherInput,
} from "./api";

const EMPTY_DATA: ClassTeacherBootstrap = {
  assignments: [],
  academicSections: [],
  standards: [],
  divisions: [],
  teachers: [],
};
const EMPTY_FORM = {
  gradeId: "",
  standardId: "",
  divisionId: "",
  teacherId: "",
};
const PAGE_SIZE = 10;

function selectClass() {
  return "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";
}

export default function AssignClassTeacherPage() {
  const [data, setData] = useState<ClassTeacherBootstrap>(EMPTY_DATA);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<ClassTeacherAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadClassTeachers());
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Class-teacher assignments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage provides the authenticated ERP session used by the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const standards = useMemo(
    () =>
      data.standards.filter(
        (standard) => standard.gradeId === Number(form.gradeId)
      ),
    [data.standards, form.gradeId]
  );
  const divisions = useMemo(
    () =>
      data.divisions.filter(
        (division) => division.standardId === Number(form.standardId)
      ),
    [data.divisions, form.standardId]
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.assignments;
    return data.assignments.filter((assignment) =>
      [
        assignment.academicSectionName,
        assignment.standardName,
        assignment.divisionName,
        assignment.teacherName,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [data.assignments, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
  }

  function input(): ClassTeacherInput | null {
    if (
      !form.gradeId ||
      !form.standardId ||
      !form.divisionId ||
      !form.teacherId
    ) {
      setError("Academic section, standard, division, and teacher are required.");
      return null;
    }
    return {
      gradeId: Number(form.gradeId),
      standardId: Number(form.standardId),
      divisionId: Number(form.divisionId),
      teacherId: Number(form.teacherId),
    };
  }

  async function handleSave() {
    const values = input();
    if (!values) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const message = editing
        ? await updateClassTeacher(editing.id, values)
        : await createClassTeacher(values);
      setNotice(message);
      resetForm();
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The class-teacher assignment could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(assignment: ClassTeacherAssignment) {
    if (
      !window.confirm(
        `Delete ${assignment.teacherName} as class teacher for ${assignment.standardName} ${assignment.divisionName}?`
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      setNotice(await deleteClassTeacher(assignment.id));
      if (editing?.id === assignment.id) resetForm();
      await load();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The class-teacher assignment could not be deleted."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 [&_button:not([data-table-action])]:!border-blue-600 [&_button:not([data-table-action])]:!bg-blue-600 [&_button:not([data-table-action])]:!text-white [&_button:not([data-table-action]):hover]:!bg-blue-700 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assign class teacher</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign one active teacher to each class and division.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {editing ? "Update assignment" : "New assignment"}
            </h2>
            <p className="text-sm text-slate-500">All fields are required.</p>
          </div>
          {editing ? (
            <Button variant="ghost" size="icon" aria-label="Cancel editing" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="academic-section">Academic section</Label>
            <select
              id="academic-section"
              className={selectClass()}
              value={form.gradeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  gradeId: event.target.value,
                  standardId: "",
                  divisionId: "",
                }))
              }
            >
              <option value="">Select section</option>
              {data.academicSections.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="standard">Standard</Label>
            <select
              id="standard"
              className={selectClass()}
              value={form.standardId}
              disabled={!form.gradeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  standardId: event.target.value,
                  divisionId: "",
                }))
              }
            >
              <option value="">Select standard</option>
              {standards.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="division">Division</Label>
            <select
              id="division"
              className={selectClass()}
              value={form.divisionId}
              disabled={!form.standardId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  divisionId: event.target.value,
                }))
              }
            >
              <option value="">Select division</option>
              {divisions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacher">Class teacher</Label>
            <select
              id="teacher"
              className={selectClass()}
              value={form.teacherId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  teacherId: event.target.value,
                }))
              }
            >
              <option value="">Select teacher</option>
              {data.teachers.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editing ? "Update assignment" : "Assign teacher"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search class teachers..."
              className="pl-9"
            />
          </label>
        </div>
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading assignments...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
            <UserRoundCheck className="mb-3 size-9 text-slate-300" />
            <p className="font-medium text-slate-700">No class teachers found</p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different search." : "Use the form above to assign a teacher."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Academic section</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Class teacher</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>{assignment.academicSectionName}</TableCell>
                  <TableCell>{assignment.standardName}</TableCell>
                  <TableCell>{assignment.divisionName}</TableCell>
                  <TableCell className="font-medium">{assignment.teacherName}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        data-table-action
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-700"
                        aria-label={`Edit ${assignment.teacherName}`}
                        onClick={() => {
                          setEditing(assignment);
                          setForm({
                            gradeId: String(assignment.gradeId),
                            standardId: String(assignment.standardId),
                            divisionId: String(assignment.divisionId),
                            teacherId: String(assignment.teacherId),
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        data-table-action
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-700"
                        aria-label={`Delete ${assignment.teacherName}`}
                        onClick={() => void handleDelete(assignment)}
                        disabled={saving}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <span>Page {currentPage} of {pageCount}</span>
              <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
