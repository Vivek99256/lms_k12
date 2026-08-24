"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteInventory, loadInventory, saveInventory, type InventoryData, type InventoryRecord } from "../api";

export type InventoryField = {
  key: string; label: string; kind?: "text" | "number" | "date" | "textarea" | "select" | "file";
  required?: boolean; source?: string; options?: string[]; filter?: boolean;
};
export type InventoryConfig = {
  module: string; title: string; description: string; singular: string;
  mode?: "master" | "workflow" | "report"; fields: InventoryField[];
  columns: Array<{ key: string; label: string }>;
};
const EMPTY: InventoryData = { records: [], options: {} };
const PAGE_SIZE = 10;
const text = (value: unknown) => value == null ? "" : String(value);

export function InventoryPage({ config }: { config: InventoryConfig }) {
  const [data, setData] = useState(EMPTY);
  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [open, setOpen] = useState(config.mode !== "master");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filters = useMemo(() => Object.fromEntries(config.fields.filter((field) => field.filter && form[field.key]).map((field) => [field.key, form[field.key]])), [config.fields, form]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadInventory(config.module, filters)); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Inventory data could not be loaded."); }
    finally { setLoading(false); }
  }, [config.module, filters]);
  useEffect(() => {
    // Inventory data is loaded after the authenticated browser session is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((row) => Object.values(row.values).some((value) => text(value).toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  function reset() { setForm({}); setFiles({}); setEditing(null); setOpen(config.mode !== "master"); }
  function edit(row: InventoryRecord) {
    setForm(Object.fromEntries(config.fields.map((field) => [field.key, text(row.values[field.key])])));
    setEditing(row); setOpen(true);
  }
  async function save() {
    const missing = config.fields.find((field) => field.required && !form[field.key]?.trim());
    if (missing) { setError(`${missing.label} is required.`); return; }
    setBusy(true); setError("");
    try { setNotice(await saveInventory(config.module, form, editing?.id, files)); reset(); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Record could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(row: InventoryRecord) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    setBusy(true);
    try { setNotice(await deleteInventory(config.module, row.id)); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Record could not be deleted."); }
    finally { setBusy(false); }
  }
  function exportCsv() {
    const headers = config.columns.map((column) => column.label);
    const body = filtered.map((row) => config.columns.map((column) => `"${text(row.values[column.key]).replaceAll("\"", "\"\"")}"`).join(","));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" }));
    link.download = `${config.module}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-slate-500">{config.description}</p></div>
      {config.mode === "master" && <Button onClick={() => { reset(); setOpen(true); }}><Plus className="size-4" /> Add {config.singular}</Button>}</div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {open && <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{config.mode === "report" ? "Report Filters" : editing ? `Edit ${config.singular}` : config.title}</CardTitle>{config.mode === "master" && <Button size="icon" variant="ghost" onClick={reset}><X className="size-4" /></Button>}</div></CardHeader><CardContent>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{config.fields.map((field) => <div key={field.key} className={field.kind === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}><Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
        {field.kind === "textarea" ? <Textarea id={field.key} className="mt-1" value={form[field.key] || ""} onChange={(event) => setForm((value) => ({ ...value, [field.key]: event.target.value }))} />
          : field.kind === "file" ? <Input id={field.key} type="file" className="mt-1" onChange={(event) => { const file = event.target.files?.[0]; setFiles((value) => { const next = { ...value }; if (file) next[field.key] = file; else delete next[field.key]; return next; }); }} />
          : field.kind === "select" ? <select id={field.key} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={form[field.key] || ""} onChange={(event) => setForm((value) => ({ ...value, [field.key]: event.target.value, ...(field.key === "category_id" ? { sub_category_id: "" } : {}) }))}><option value="">All / Select {field.label}</option>{field.options?.map((item) => <option key={item} value={item}>{item}</option>)}{(data.options[field.source || ""] || []).filter((item) => field.source !== "sub_categories" || !form.category_id || item.parentId === Number(form.category_id)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          : <Input id={field.key} type={field.kind || "text"} min={field.kind === "number" ? 0 : undefined} className="mt-1" value={form[field.key] || ""} onChange={(event) => setForm((value) => ({ ...value, [field.key]: event.target.value }))} />}</div>)}</div>
      <div className="mt-5"><Button onClick={() => config.mode === "report" ? void load() : void save()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}{config.mode === "report" ? "Generate Report" : "Save"}</Button></div>
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder={`Search ${config.title.toLowerCase()}...`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv}><Download className="size-4" /> CSV</Button><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sr.</TableHead>{config.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}{config.mode === "master" && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : visible.length === 0 ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center text-slate-500">No records found.</TableCell></TableRow> : visible.map((row, index) => <TableRow key={`${row.id}-${index}`}><TableCell>{(current - 1) * PAGE_SIZE + index + 1}</TableCell>{config.columns.map((column) => <TableCell key={column.key}>{text(row.values[column.key]) || "—"}</TableCell>)}{config.mode === "master" && <TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => edit(row)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(row)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell>}</TableRow>)}
      </TableBody></Table></div><div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500"><span>{filtered.length} record(s)</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>{current} / {pages}</span><Button size="sm" variant="outline" disabled={current >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></CardContent>
    </Card>
  </div></main>;
}
