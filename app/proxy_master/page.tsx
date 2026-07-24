"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
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
  exportRowsAsCsv,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import {
  createProxies,
  deleteProxy,
  findAvailableLectures,
  getProxySession,
  listProxies,
  listTeachers,
  updateProxy,
  type AvailableLecture,
  type ProxyRecord,
  type TeacherOption,
} from "./api";

const PAGE_SIZE = 10;
const exportColumns: TableExportColumn[] = [
  { key: "date", label: "Date" },
  { key: "standard", label: "Standard" },
  { key: "division", label: "Division" },
  { key: "absentTeacher", label: "Absent teacher" },
  { key: "proxyTeacher", label: "Proxy teacher" },
  { key: "period", label: "Period" },
  { key: "subject", label: "Subject" },
];

type SortDirection = "asc" | "desc";

function teacherSelectClass() {
  return "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";
}

function toExportRow(record: ProxyRecord): TableExportRow {
  return {
    date: record.proxyDate,
    standard: record.standardName,
    division: record.divisionName,
    absentTeacher: record.teacherName,
    proxyTeacher: record.proxyTeacherName,
    period: record.periodName,
    subject: record.subjectName,
  };
}

export default function ProxyManagementPage() {
  const [records, setRecords] = useState<ProxyRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAdd, setShowAdd] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [absentTeacherId, setAbsentTeacherId] = useState("");
  const [lectures, setLectures] = useState<AvailableLecture[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [replacementTeachers, setReplacementTeachers] = useState<
    Record<string, string>
  >({});
  const [editing, setEditing] = useState<ProxyRecord | null>(null);
  const [editTeacherId, setEditTeacherId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = getProxySession();
      const [proxyRecords, teacherOptions] = await Promise.all([
        listProxies(session),
        listTeachers(session),
      ]);
      setRecords(proxyRecords);
      setTeachers(teacherOptions);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Proxy assignments could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The first client render is the point at which the stored ERP session is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = query
      ? records.filter((record) =>
          [
            record.proxyDate,
            record.standardName,
            record.divisionName,
            record.teacherName,
            record.proxyTeacherName,
            record.periodName,
            record.subjectName,
          ].some((value) => value.toLowerCase().includes(query))
        )
      : records;
    return [...result].sort((left, right) => {
      const comparison = left.proxyDate.localeCompare(right.proxyDate);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [records, search, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetAddForm() {
    setFromDate("");
    setToDate("");
    setAbsentTeacherId("");
    setLectures([]);
    setSelected({});
    setReplacementTeachers({});
  }

  async function handleFindLectures() {
    setError("");
    setNotice("");
    if (!fromDate || !toDate || !absentTeacherId) {
      setError("Select both dates and the absent teacher.");
      return;
    }
    if (fromDate > toDate) {
      setError("The from date must be on or before the to date.");
      return;
    }
    setBusy(true);
    try {
      const session = getProxySession();
      const result = await findAvailableLectures(session, {
        fromDate,
        toDate,
        absentTeacherId: Number(absentTeacherId),
      });
      setLectures(result);
      setSelected({});
      setReplacementTeachers({});
      if (result.length === 0) {
        const teacherName =
          teachers.find((teacher) => teacher.id === Number(absentTeacherId))
            ?.teacherName || "the selected teacher";
        setNotice(
          `No timetable lectures were found for ${teacherName} from ${fromDate} to ${toDate} in academic year ${session.syear}.`
        );
      }
    } catch (findError: unknown) {
      setError(
        findError instanceof Error
          ? findError.message
          : "Available lectures could not be loaded."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const selectedLectures = lectures.filter((lecture) => selected[lecture.key]);
    if (selectedLectures.length === 0) {
      setError("Select at least one lecture.");
      return;
    }
    const incomplete = selectedLectures.find(
      (lecture) => !replacementTeachers[lecture.key]
    );
    if (incomplete) {
      setError(`Select a proxy teacher for ${incomplete.date}, ${incomplete.periodName}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const message = await createProxies(
        getProxySession(),
        selectedLectures.map((lecture) => ({
          key: lecture.key,
          teacherId: Number(replacementTeachers[lecture.key]),
        }))
      );
      setNotice(message);
      setShowAdd(false);
      resetAddForm();
      await load();
    } catch (createError: unknown) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Proxy assignments could not be added."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    if (!editing || !editTeacherId) {
      setError("Select a proxy teacher.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const message = await updateProxy(
        getProxySession(),
        editing.id,
        Number(editTeacherId)
      );
      setNotice(message);
      setEditing(null);
      await load();
    } catch (updateError: unknown) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The proxy assignment could not be updated."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(record: ProxyRecord) {
    if (
      !window.confirm(
        `Delete the proxy assignment for ${record.proxyDate}, ${record.periodName}?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const message = await deleteProxy(getProxySession(), record.id);
      setNotice(message);
      await load();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The proxy assignment could not be deleted."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 [&_button:not([data-table-action])]:!border-blue-600 [&_button:not([data-table-action])]:!bg-blue-600 [&_button:not([data-table-action])]:!text-white [&_button:not([data-table-action]):hover]:!bg-blue-700 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proxy management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign available teachers to cover timetable periods.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv({
                filename: "proxy-assignments.csv",
                columns: exportColumns,
                rows: filtered.map(toExportRow),
              })
            }
            disabled={filtered.length === 0}
          >
            <Download className="size-4" />
            Export
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="size-4" />
            Add proxy
          </Button>
        </div>
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search assignments..."
              className="pl-9"
            />
          </label>
          <Button
            variant="outline"
            onClick={() =>
              setSortDirection((current) => {
                setPage(1);
                return current === "asc" ? "desc" : "asc";
              })
            }
          >
            {sortDirection === "asc" ? (
              <ArrowDownAZ className="size-4" />
            ) : (
              <ArrowUpAZ className="size-4" />
            )}
            Date {sortDirection === "asc" ? "oldest first" : "newest first"}
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading proxy assignments...
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <UserRoundCheck className="mb-3 size-9 text-slate-300" />
            <p className="font-medium text-slate-700">No proxy assignments found</p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different search." : "Add a proxy assignment to get started."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                {["Date", "Standard", "Division", "Absent teacher", "Proxy teacher", "Period", "Subject", "Actions"].map(
                  (heading) => <TableHead key={heading}>{heading}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.proxyDate}</TableCell>
                  <TableCell>{record.standardName || "—"}</TableCell>
                  <TableCell>{record.divisionName || "—"}</TableCell>
                  <TableCell>{record.teacherName || "—"}</TableCell>
                  <TableCell>{record.proxyTeacherName || "—"}</TableCell>
                  <TableCell>{record.periodName || "—"}</TableCell>
                  <TableCell>{record.subjectName || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        data-table-action
                        size="icon"
                        variant="ghost"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-700"
                        aria-label={`Edit proxy assignment ${record.id}`}
                        onClick={() => {
                          setEditing(record);
                          setEditTeacherId(String(record.proxyTeacherId || ""));
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        data-table-action
                        size="icon"
                        variant="ghost"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-700"
                        aria-label={`Delete proxy assignment ${record.id}`}
                        onClick={() => void handleDelete(record)}
                        disabled={busy}
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
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <span className="px-2">Page {currentPage} of {pageCount}</span>
              <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="add-proxy-title">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-t-xl border border-slate-200 bg-white shadow-xl sm:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 id="add-proxy-title" className="text-lg font-semibold text-slate-900">Add proxy assignments</h2>
                <p className="text-sm text-slate-500">Find the absent teacher’s lectures, then assign available teachers.</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close add proxy dialog" onClick={() => setShowAdd(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="space-y-5 p-5">
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                  {notice}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="from-date">From date</Label>
                  <Input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-date">To date</Label>
                  <Input id="to-date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absent-teacher">Absent teacher</Label>
                  <select id="absent-teacher" className={teacherSelectClass()} value={absentTeacherId} onChange={(event) => setAbsentTeacherId(event.target.value)}>
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.teacherName}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => void handleFindLectures()} disabled={busy}>
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
                    Find lectures
                  </Button>
                </div>
              </div>

              {lectures.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="min-w-60">Proxy teacher</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lectures.map((lecture) => (
                        <TableRow key={lecture.key} data-state={selected[lecture.key] ? "selected" : undefined}>
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select lecture on ${lecture.date}, ${lecture.periodName}`}
                              checked={Boolean(selected[lecture.key])}
                              onChange={(event) => setSelected((current) => ({ ...current, [lecture.key]: event.target.checked }))}
                              className="size-4 rounded border-slate-300"
                            />
                          </TableCell>
                          <TableCell>{lecture.date}</TableCell>
                          <TableCell>{lecture.weekDay}</TableCell>
                          <TableCell>{lecture.standardName} / {lecture.divisionName}</TableCell>
                          <TableCell>{lecture.batchName || "—"}</TableCell>
                          <TableCell>{lecture.periodName}</TableCell>
                          <TableCell>{lecture.subjectName}</TableCell>
                          <TableCell>
                            <select
                              className={teacherSelectClass()}
                              aria-label={`Proxy teacher for ${lecture.date}, ${lecture.periodName}`}
                              value={replacementTeachers[lecture.key] || ""}
                              disabled={!selected[lecture.key]}
                              onChange={(event) => setReplacementTeachers((current) => ({ ...current, [lecture.key]: event.target.value }))}
                            >
                              <option value="">Select available teacher</option>
                              {lecture.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.teacherName}</option>)}
                            </select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={busy || lectures.length === 0}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add selected
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-proxy-title">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="edit-proxy-title" className="text-lg font-semibold text-slate-900">Change proxy teacher</h2>
              <Button variant="ghost" size="icon" aria-label="Close edit dialog" onClick={() => setEditing(null)}>
                <X className="size-5" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {editing.proxyDate} · {editing.standardName} {editing.divisionName} · {editing.periodName}
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="edit-proxy-teacher">Proxy teacher</Label>
              <select id="edit-proxy-teacher" className={teacherSelectClass()} value={editTeacherId} onChange={(event) => setEditTeacherId(event.target.value)}>
                <option value="">Select teacher</option>
                {teachers
                  .filter((teacher) => teacher.teacherName !== editing.teacherName)
                  .map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.teacherName}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => void handleUpdate()} disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
