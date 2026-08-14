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
  type TransportationData,
  type TransportationModule,
  type TransportOption,
  type TransportRecord,
} from "../api";

type Source = keyof Pick<TransportationData, "drivers" | "conductors" | "vehicles" | "vehicleTypes" | "routes" | "stops" | "shifts" | "students">;
type FieldKind = "text" | "number" | "time" | "select";
export type TransportField = { key: string; label: string; kind: FieldKind; required?: boolean; source?: Source; dependsOn?: string; options?: string[] };
export type TransportConfig = {
  module: TransportationModule;
  title: string;
  description: string;
  singular: string;
  fields: TransportField[];
  columns: Array<{ key: string; label: string }>;
  report?: boolean;
};

const EMPTY: TransportationData = {
  records: [], drivers: [], conductors: [], vehicles: [], vehicleTypes: [],
  routes: [], stops: [], shifts: [], students: [],
  grades: [], standards: [], divisions: [],
};
const PAGE_SIZE = 10;

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function TransportationPage({ config }: { config: TransportConfig }) {
  const [data, setData] = useState(EMPTY);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<TransportRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (filters?: Record<string, string>) => {
    setLoading(true);
    setError("");
    try {
      setData(await loadTransportation(config.module, getTransportationSession(), filters));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Transportation data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [config.module]);

  useEffect(() => {
    // The ERP session is stored in browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? data.records.filter((record) => Object.values(record.values).some((value) => text(value).toLowerCase().includes(query)))
      : data.records;
  }, [data.records, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function optionList(field: TransportField): TransportOption[] {
    if (!field.source) return [];
    const source = data[field.source];
    if (!field.dependsOn) return source;
    const parentId = Number(form[field.dependsOn]);
    return source.filter((option) => !option.parentId || option.parentId === parentId);
  }

  function reset() {
    setForm({});
    setEditing(null);
    setShowForm(false);
  }

  function edit(record: TransportRecord) {
    const next: Record<string, string> = {};
    config.fields.forEach((field) => {
      const aliases: Record<string, string> = { driver_type: "type", route_id: "route_id", bus_id: "bus_id" };
      next[field.key] = text(record.values[field.key] ?? record.values[aliases[field.key]]);
    });
    setForm(next);
    setEditing(record);
    setShowForm(true);
    setError("");
  }

  function validate(): string {
    for (const field of config.fields) {
      if (field.required && !form[field.key]?.trim()) return `${field.label} is required.`;
    }
    if (config.module === "routes" && form.from_time >= form.to_time) return "To time must be after from time.";
    if (config.module === "vehicles" && Number(form.sitting_capacity) < 1) return "Sitting capacity must be at least 1.";
    return "";
  }

  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setNotice(await saveTransportation(config.module, getTransportationSession(), form, editing?.id));
      reset();
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: TransportRecord) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    setBusy(true);
    setError("");
    try {
      setNotice(await deleteTransportation(config.module, getTransportationSession(), record.id));
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Record could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows: TableExportRow[] = filtered.map((record) =>
      Object.fromEntries(config.columns.map((column) => [column.key, text(record.values[column.key])]))
    );
    exportRowsAsCsv({
      filename: `${config.title.toLowerCase().replace(/\s+/g, "-")}.csv`,
      columns: config.columns.map((column) => ({ key: column.key, label: column.label })),
      rows,
    });
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-bold text-slate-950">{config.title}</h1><p className="mt-1 text-sm text-slate-500">{config.description}</p></div>
          {!config.report && <Button onClick={() => { reset(); setShowForm(true); }}><Plus className="size-4" /> Add {config.singular}</Button>}
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {(showForm || config.report) && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{config.report ? "Report Filters" : editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</CardTitle>{!config.report && <Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button>}</div></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {config.fields.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
                    {field.kind === "select" ? (
                      <select id={field.key} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        {optionList(field).map((option) => <option key={`${option.id}-${option.parentId || 0}`} value={option.id}>{option.label}</option>)}
                      </select>
                    ) : <Input id={field.key} type={field.kind} min={field.kind === "number" ? 0 : undefined} value={form[field.key] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1" />}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <Button onClick={() => config.report ? void load(form) : void save()} disabled={busy || loading}>{busy && <LoaderCircle className="size-4 animate-spin" />}{config.report ? "Generate Report" : "Save"}</Button>
                {!config.report && <Button variant="outline" onClick={reset}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9" /></div>
            <div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" /> CSV</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div>
          </div></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sr.</TableHead>{config.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}{!config.report && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
              <TableBody>{loading ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow>
                : visible.length === 0 ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center text-slate-500">No records found.</TableCell></TableRow>
                : visible.map((record, index) => <TableRow key={`${record.id}-${index}`}><TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>{config.columns.map((column) => <TableCell key={column.key}>{text(record.values[column.key]) || "—"}</TableCell>)}{!config.report && <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => edit(record)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => void remove(record)} disabled={busy}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell>}</TableRow>)}</TableBody>
            </Table></div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500"><span>{filtered.length} record(s)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>{currentPage} / {pages}</span><Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
