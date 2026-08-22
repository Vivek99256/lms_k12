"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  Search,
  Send,
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
  listSubmissions,
  submitHomework,
  type SubmissionInput,
  type SubmissionRow,
} from "@/app/lms/homework/api";
import RequireStaff from "@/app/lms/_shared/RequireStaff";

const academicFields: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readValue(
  value: SearchDropdownValues[keyof SearchDropdownValues]
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type RowState = { remark: string; file: File | null };

export default function HomeworkSubmissionPage() {
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: "",
    standard: "",
    division: "",
    subject: "",
  });
  const [submissionDate, setSubmissionDate] = useState("");
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allChecked = rows.length > 0 && selected.size === rows.length;

  const load = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    setRowState({});
    try {
      const data = await listSubmissions({
        grade: readValue(filters.section ?? ""),
        standard: readValue(filters.standard ?? ""),
        division: readValue(filters.division ?? ""),
        subject: readValue(filters.subject ?? ""),
        submissionDate,
      });
      setRows(data);
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Homework could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, submissionDate]);

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
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map((row) => row.id))
    );
  }

  function updateRow(id: number, patch: Partial<RowState>) {
    setRowState((prev) => ({
      ...prev,
      [id]: {
        remark: prev[id]?.remark ?? "",
        file: prev[id]?.file ?? null,
        ...patch,
      },
    }));
  }

  const items = useMemo<SubmissionInput[]>(
    () =>
      Array.from(selected).map((homeworkId) => ({
        homeworkId,
        remark: rowState[homeworkId]?.remark ?? "",
        file: rowState[homeworkId]?.file ?? null,
      })),
    [selected, rowState]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (items.length === 0) {
      setError("Select at least one homework to submit.");
      return;
    }
    setSaving(true);
    try {
      const count = await submitHomework(items);
      setSuccess(`${count} submission(s) recorded successfully.`);
      await load();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Homework submission failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireStaff>
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Homework Submission
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Record student homework submissions and attach checked work.
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
          <div className="space-y-2">
            <Label htmlFor="submission-date">Submission date</Label>
            <Input
              id="submission-date"
              type="date"
              value={submissionDate}
              onChange={(event) => setSubmissionDate(event.target.value)}
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
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>GR No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>HW Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>HW File</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead>Submission File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="h-24 text-center text-slate-500"
                    >
                      <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.studentName}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                        />
                      </TableCell>
                      <TableCell>{row.enrollmentNo || "-"}</TableCell>
                      <TableCell>{row.studentName}</TableCell>
                      <TableCell>{row.standard || "-"}</TableCell>
                      <TableCell>{row.division || "-"}</TableCell>
                      <TableCell>{row.mobile || "-"}</TableCell>
                      <TableCell>{row.homeworkDate || "-"}</TableCell>
                      <TableCell>{row.title || "-"}</TableCell>
                      <TableCell className="max-w-40 truncate" title={row.description}>
                        {row.description || "-"}
                      </TableCell>
                      <TableCell>
                        {row.image ? (
                          <a
                            href={row.image}
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
                      <TableCell>{row.submissionDate || "-"}</TableCell>
                      <TableCell>
                        <Textarea
                          rows={2}
                          className="min-w-48"
                          value={rowState[row.id]?.remark ?? ""}
                          onChange={(event) =>
                            updateRow(row.id, { remark: event.target.value })
                          }
                          placeholder="Remark"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="min-w-44"
                          onChange={(event) =>
                            updateRow(row.id, {
                              file: event.target.files?.[0] ?? null,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="h-28 text-center text-slate-500"
                    >
                      <FileCheck2 className="mx-auto mb-2 size-8 text-slate-300" />
                      No pending homework found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {selected.size} selected
            </span>
            <Button type="submit" disabled={saving || rows.length === 0}>
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Submit
            </Button>
          </div>
        </form>
      ) : null}
    </main>
    </RequireStaff>
  );
}
