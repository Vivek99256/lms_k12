"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
  Trash2,
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
  SearchDropdown,
  type DropdownField,
  type SearchDropdownValues,
} from "@/components/search-dropdown";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import {
  bulkDeleteAssignments,
  listAssignments,
  type AnnotateRow,
} from "@/app/lms/lmsAnnotate_assignment/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];
const PAGE_SIZE = 10;
const exportColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "standard", label: "Standard" },
  { key: "subject", label: "Subject" },
  { key: "date", label: "Date" },
];

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function StudentHomeworkReportPage() {
  return (
    <RequireStaff>
      <Suspense fallback={null}>
        <StudentHomeworkReport />
      </Suspense>
    </RequireStaff>
  );
}

function StudentHomeworkReport() {
  // The conversational assistant hands off a resolved homework record through
  // these query parameters (see buildRecordNavigation in the shared AI core).
  const searchParams = useSearchParams();
  const selectedHomeworkId = searchParams?.get("homework_id") ?? "";
  const handoffFilters = useMemo(
    () => ({
      standard: searchParams?.get("standard_id") ?? "",
      division: searchParams?.get("division_id") ?? "",
      subject: searchParams?.get("subject_id") ?? "",
      fromDate: searchParams?.get("from_date") ?? "",
      toDate: searchParams?.get("to_date") ?? "",
      query: searchParams?.get("q") ?? "",
    }),
    [searchParams]
  );
  const hasAssistantHandoff =
    Boolean(selectedHomeworkId) ||
    Object.values(handoffFilters).some((value) => Boolean(value));
  const assistantSelection = useCallback(() => {
    const id = Number(selectedHomeworkId);
    return Number.isFinite(id) && id > 0 ? new Set([id]) : new Set<number>();
  }, [selectedHomeworkId]);
  const autoLoadedRef = useRef(false);

  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>(() => ({
    section: "",
    standard: handoffFilters.standard,
    division: handoffFilters.division,
    subject: handoffFilters.subject,
  }));
  const [fromDate, setFromDate] = useState(handoffFilters.fromDate);
  const [toDate, setToDate] = useState(handoffFilters.toDate);
  const [rows, setRows] = useState<AnnotateRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(assistantSelection);
  const [query, setQuery] = useState(handoffFilters.query);
  const [page, setPage] = useState(1);

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setNotice("");
    setLoading(true);
    setSearched(true);
    // Keep the record the assistant handed over selected across reloads.
    setSelected(assistantSelection());
    setPage(1);
    try {
      const data = await listAssignments({
        grade: readValue(filters.section ?? ""),
        standardId: readValue(filters.standard ?? ""),
        divisionId: readValue(filters.division ?? ""),
        subjectId: readValue(filters.subject ?? ""),
        fromDate,
        toDate,
      });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Report could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [assistantSelection, filters, fromDate, toDate]);

  // The filters are already seeded from the handoff parameters, so the report
  // only has to run the same search the user would have run by hand.
  useEffect(() => {
    if (autoLoadedRef.current || !hasAssistantHandoff) return;
    autoLoadedRef.current = true;
    void load();
  }, [hasAssistantHandoff, load]);

  const handoffRow = useMemo(
    () => rows.find((row) => String(row.id) === selectedHomeworkId),
    [rows, selectedHomeworkId]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      [row.studentName, row.title, row.description, row.standardName, row.subjectName]
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const allChecked = visible.length > 0 && visible.every((row) => selected.has(row.id));

  const exportRows: TableExportRow[] = filtered.map((row, index) => ({
    serial: String(index + 1),
    name: row.studentName,
    title: row.title,
    description: row.description,
    standard: [row.standardName, row.divisionName].filter(Boolean).join(" - "),
    subject: row.subjectName,
    date: row.assignedOn,
  }));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      const shouldSelect = !allChecked;
      visible.forEach((row) => {
        if (shouldSelect) next.add(row.id);
        else next.delete(row.id);
      });
      return next;
    });
  }

  async function handleDelete() {
    if (selected.size === 0) {
      setError("Select at least one homework to delete.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete ${selected.size} homework record(s)? This cannot be undone.`)
    ) {
      return;
    }
    setError("");
    setNotice("");
    setDeleting(true);
    try {
      const count = await bulkDeleteAssignments(Array.from(selected));
      setNotice(`${count} homework record(s) deleted successfully.`);
      await load();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Homework could not be deleted."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Student Homework Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review assigned homework by class, subject and date.
        </p>
      </header>

      {handoffRow ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          Opened from the assistant:{" "}
          <span className="font-semibold">
            {handoffRow.title || handoffRow.studentName || `homework #${handoffRow.id}`}
          </span>
          {[handoffRow.standardName, handoffRow.divisionName, handoffRow.subjectName]
            .filter(Boolean)
            .join(" · ")
            ? ` — ${[handoffRow.standardName, handoffRow.divisionName, handoffRow.subjectName].filter(Boolean).join(" · ")}`
            : ""}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SearchDropdown
            fields={academicFields}
            values={filters}
            onChange={(values) => setFilters(values)}
            className="contents"
          />
          <div className="space-y-2">
            <Label htmlFor="from-date">From date</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date">To date</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search
          </Button>
        </div>
      </section>

      {searched ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search homework report..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: "student-homework-report.csv",
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsExcel({
                    filename: "student-homework-report.xls",
                    title: "Student Homework Report",
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  openPrintPreview({
                    title: "Student Homework Report",
                    subtitle: "Assigned homework",
                    columns: exportColumns,
                    rows: exportRows,
                  })
                }
              >
                <Printer className="size-4" />
                Print / PDF
              </Button>
              <Button
                variant="destructive"
                disabled={deleting || selected.size === 0}
                onClick={handleDelete}
              >
                {deleting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allChecked}
                      onChange={toggleAllVisible}
                    />
                  </TableHead>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : visible.length ? (
                  visible.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={
                        String(row.id) === selectedHomeworkId
                          ? "bg-amber-50"
                          : undefined
                      }
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.title}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>{row.studentName}</TableCell>
                      <TableCell>{row.title || "-"}</TableCell>
                      <TableCell className="max-w-56 truncate" title={row.description}>
                        {row.description || "-"}
                      </TableCell>
                      <TableCell>
                        {row.examPdfUrl ? (
                          <a
                            href={row.examPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {[row.standardName, row.divisionName].filter(Boolean).join(" - ") || "-"}
                      </TableCell>
                      <TableCell>{row.subjectName || "-"}</TableCell>
                      <TableCell>{row.assignedOn || "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-slate-500">
                      <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                      No homework found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                >
                  Previous
                </Button>
                <span className="px-2">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
