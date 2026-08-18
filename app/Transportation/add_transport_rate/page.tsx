"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportRowsAsCsv, type TableExportRow } from "@/lib/table-export";
import {
  deleteTransportation,
  getTransportationSession,
  loadTransportation,
  saveTransportation,
  type TransportRecord,
} from "../api";

/**
 * A rate slab prices one distance band for the academic year: a flat rickshaw
 * and van fare, kept as an "old" and a "new" figure so a revision can be rolled
 * out without losing the previous number.
 */
type RateForm = {
  distance_from_school: string;
  from_distance: string;
  to_distance: string;
  rick_old: string;
  rick_new: string;
  van_old: string;
  van_new: string;
};

const EMPTY_FORM: RateForm = {
  distance_from_school: "", from_distance: "", to_distance: "",
  rick_old: "", rick_new: "", van_old: "", van_new: "",
};

const FARE_FIELDS = [
  { key: "rick_old", label: "Rickshaw old rate" },
  { key: "rick_new", label: "Rickshaw new rate" },
  { key: "van_old", label: "Van old rate" },
  { key: "van_new", label: "Van new rate" },
] as const;

const COLUMNS = [
  { key: "distance_from_school", label: "Distance from school" },
  { key: "from_distance", label: "From" },
  { key: "to_distance", label: "To" },
  { key: "rick_old", label: "Rickshaw old" },
  { key: "rick_new", label: "Rickshaw new" },
  { key: "van_old", label: "Van old" },
  { key: "van_new", label: "Van new" },
];

const PAGE_SIZE = 10;

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export default function AddTransportRatePage() {
  const [records, setRecords] = useState<TransportRecord[]>([]);
  const [form, setForm] = useState<RateForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<TransportRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadTransportation("rates", getTransportationSession());
      setRecords(data.records);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Transport rates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? records.filter((record) => Object.values(record.values).some((value) => text(value).toLowerCase().includes(query)))
      : records;
  }, [records, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function reset() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
    setError("");
  }

  function edit(record: TransportRecord) {
    setForm({
      distance_from_school: text(record.values.distance_from_school),
      from_distance: text(record.values.from_distance),
      to_distance: text(record.values.to_distance),
      rick_old: text(record.values.rick_old),
      rick_new: text(record.values.rick_new),
      van_old: text(record.values.van_old),
      van_new: text(record.values.van_new),
    });
    setEditing(record);
    setShowForm(true);
    setError("");
  }

  /**
   * Mirrors the server rules so a bad slab never leaves the browser, including
   * the overlap check — two slabs covering the same distance would make the
   * fare for that distance ambiguous.
   */
  function validate(): string {
    if (!form.distance_from_school.trim()) return "Distance from school is required.";

    const from = Number(form.from_distance);
    const to = Number(form.to_distance);
    if (!form.from_distance.trim() || !Number.isFinite(from) || from < 0) return "From distance must be zero or more.";
    if (!form.to_distance.trim() || !Number.isFinite(to) || to < 0) return "To distance must be zero or more.";
    if (to < from) return "To distance must be greater than or equal to from distance.";

    for (const field of FARE_FIELDS) {
      const value = form[field.key];
      if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        return `${field.label} must be zero or more.`;
      }
    }

    const others = records.filter((record) => record.id !== editing?.id);
    const label = form.distance_from_school.trim().toLowerCase();
    if (others.some((record) => text(record.values.distance_from_school).trim().toLowerCase() === label)) {
      return "A rate with this distance from school already exists for the academic year.";
    }
    const overlap = others.find((record) => {
      const otherFrom = Number(record.values.from_distance);
      const otherTo = Number(record.values.to_distance);
      return Number.isFinite(otherFrom) && Number.isFinite(otherTo) && otherFrom <= to && otherTo >= from;
    });
    if (overlap) {
      return `Distance range ${from}-${to} overlaps the existing range ${text(overlap.values.from_distance)}-${text(overlap.values.to_distance)}.`;
    }

    return "";
  }

  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setNotice(await saveTransportation("rates", getTransportationSession(), form, editing?.id));
      reset();
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Transport rate could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: TransportRecord) {
    if (!window.confirm(`Delete the rate for "${text(record.values.distance_from_school)}"?`)) return;
    setBusy(true);
    setError("");
    try {
      setNotice(await deleteTransportation("rates", getTransportationSession(), record.id));
      if (editing?.id === record.id) reset();
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Transport rate could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows: TableExportRow[] = filtered.map((record) =>
      Object.fromEntries(COLUMNS.map((column) => [column.key, text(record.values[column.key])]))
    );
    exportRowsAsCsv({ filename: "transport-rates.csv", columns: COLUMNS, rows });
  }

  function field(key: keyof RateForm, label: string, required: boolean, numeric: boolean) {
    return (
      <div key={key}>
        <Label htmlFor={key}>{label}{required ? " *" : ""}</Label>
        <Input id={key} className="mt-1" type={numeric ? "number" : "text"} min={numeric ? 0 : undefined}
          step={numeric ? "0.01" : undefined} value={form[key]}
          onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Add transport rate</h1>
            <p className="mt-1 text-sm text-slate-500">
              Maintain distance-based rickshaw and van fares for the current academic year.
            </p>
          </div>
          <Button onClick={() => { reset(); setShowForm(true); }}><Plus className="size-4" /> Add transport rate</Button>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {showForm && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{editing ? "Edit transport rate" : "Add transport rate"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {field("distance_from_school", "Distance from school", true, false)}
                {field("from_distance", "From distance", true, true)}
                {field("to_distance", "To distance", true, true)}
                {FARE_FIELDS.map((fare) => field(fare.key, fare.label, false, true))}
              </div>
              <div className="mt-5 flex gap-2">
                <Button onClick={() => void save()} disabled={busy || loading}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />}{editing ? "Update" : "Save"}
                </Button>
                <Button variant="outline" onClick={reset}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Search transport rates..." className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" /> CSV</Button>
                <Button variant="outline" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr.</TableHead>
                    {COLUMNS.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={COLUMNS.length + 2} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow>
                  ) : !visible.length ? (
                    <TableRow><TableCell colSpan={COLUMNS.length + 2} className="h-32 text-center text-slate-500">No transport rate found.</TableCell></TableRow>
                  ) : (
                    visible.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                        {COLUMNS.map((column) => <TableCell key={column.key}>{text(record.values[column.key]) || "—"}</TableCell>)}
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => edit(record)} aria-label="Edit rate"><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => void remove(record)} disabled={busy} aria-label="Delete rate"><Trash2 className="size-4 text-red-600" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>{filtered.length} record(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <span>{currentPage} / {pages}</span>
                <Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
