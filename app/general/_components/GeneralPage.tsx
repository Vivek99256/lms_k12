"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteGeneral, getGeneralSession, loadGeneral, loadTemplateTags, saveGeneral,
  type GeneralData, type GeneralModule, type GeneralOption, type GeneralRecord, type TemplateTag,
} from "../api";
import { TemplateHtmlEditor } from "./TemplateHtmlEditor";
import FormBuilderEditor, { parseFormJson } from "../form_builder/FormBuilderEditor";
import { AiFieldAssistant } from "@/components/ai/AiFieldAssistant";
import type { BuilderField } from "../form_builder/types";

type Source = keyof Pick<GeneralData, "profiles" | "grades" | "standards" | "subjects">;
export type GeneralField = {
  key: string; label: string; kind: "text" | "number" | "select" | "textarea" | "editor" | "checkbox";
  required?: boolean; source?: Source; dependsOn?: string; options?: string[]; rows?: number;
};
export type GeneralConfig = {
  module: GeneralModule; title: string; description: string; singular: string;
  fields: GeneralField[]; columns: Array<{ key: string; label: string }>;
};
const EMPTY: GeneralData = { records: [], profiles: [], grades: [], standards: [], subjects: [] };
const PAGE_SIZE = 10;
function text(value: unknown): string { return value == null ? "" : String(value); }

export function GeneralPage({ config }: { config: GeneralConfig }) {
  const [data, setData] = useState(EMPTY);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [editing, setEditing] = useState<GeneralRecord | null>(null);
  const [showForm, setShowForm] = useState(config.module === "implementations" || config.module === "bulk-upload");
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderFields, setBuilderFields] = useState<BuilderField[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [templateTags, setTemplateTags] = useState<TemplateTag[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadGeneral(config.module, getGeneralSession())); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "General data could not be loaded."); }
    finally { setLoading(false); }
  }, [config.module]);
  useEffect(() => {
    // The authenticated ERP session is available after the browser render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (config.module !== "templates") return;
    let active = true;
    void loadTemplateTags(getGeneralSession()).then((tags) => { if (active) setTemplateTags(tags); }).catch(() => { if (active) setTemplateTags([]); });
    return () => { active = false; };
  }, [config.module]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((record) => Object.values(record.values).some((value) => text(value).toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function fieldOptions(field: GeneralField): GeneralOption[] {
    if (!field.source) return [];
    const list = data[field.source];
    if (!field.dependsOn) return list;
    const parentId = Number(form[field.dependsOn]);
    return list.filter((option) => !option.parentId || option.parentId === parentId);
  }
  const reset = useCallback(() => {
    setForm({}); setEditing(null);
    setShowForm(config.module === "implementations" || config.module === "bulk-upload");
    setShowBuilder(false);
    setBuilderFields([]);
  }, [config.module]);
  function edit(record: GeneralRecord) {
    if (config.module === "forms") {
      const rawJson = text(record.values.form_json);
      const initialFields = parseFormJson(rawJson);
      setBuilderFields(initialFields);
      setForm({ form_name: text(record.values.form_name) });
      setEditing(record);
      setShowBuilder(true);
      setError("");
      return;
    }
    const next: Record<string, string | boolean> = {};
    config.fields.forEach((field) => {
      const aliases: Record<string, string> = {
        profile_name: "name",
        profile_description: "description",
      };
      const value = record.values[field.key] ?? record.values[aliases[field.key]];
      next[field.key] = field.kind === "checkbox" ? value === true || value === 1 || value === "1" : text(value);
    });
    setForm(next); setEditing(record); setShowForm(true); setError("");
  }
  function validation(): string {
    for (const field of config.fields) {
      const value = form[field.key];
      if (field.required && (value === undefined || value === "")) return `${field.label} is required.`;
    }
    return "";
  }
  function validateForm(module: string, form: Record<string, string | boolean>): string {
    if (module === "implementations") {
      const boys = Number(form.total_boys || 0);
      const girls = Number(form.total_girls || 0);
      const strength = Number(form.total_strenght || 0);
      if (!Number.isFinite(boys) || !Number.isFinite(girls) || !Number.isFinite(strength)) {
        return "Please enter valid numeric values for totals.";
      }
      if (strength !== boys + girls) {
        return "Total strength must equal total boys plus total girls.";
      }
      const raw = String(form.standard_totals || "").trim();
      if (!raw) return "Standard-wise totals are required.";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return "Standard-wise totals must be valid JSON.";
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return "Standard-wise totals must contain at least one row.";
      }
    }
    return "";
  }
  async function save() {
    const validationError = validation();
    if (validationError) { setError(validationError); return; }
    const customError = validateForm(config.module, form);
    if (customError) { setError(customError); return; }
    setBusy(true); setError("");
    try {
      setNotice(await saveGeneral(config.module, getGeneralSession(), form, editing?.id));
      reset(); await load();
    } catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "Record could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(record: GeneralRecord) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    setBusy(true); setError("");
    try { setNotice(await deleteGeneral(config.module, getGeneralSession(), record.id)); await load(); }
    catch (deleteError: unknown) { setError(deleteError instanceof Error ? deleteError.message : "Record could not be deleted."); }
    finally { setBusy(false); }
  }

  async function handleBuilderSave(data: { form_name: string; form_json: string; form_xml: string; form_active: boolean }) {
    setBusy(true);
    setError("");
    try {
      setNotice(await saveGeneral(config.module, getGeneralSession(), {
        form_name: data.form_name,
        form_json: data.form_json,
        form_xml: data.form_xml,
        form_active: data.form_active,
      }, editing?.id));
      reset();
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function handleBuilderCancel() {
    reset();
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-bold text-slate-950">{config.title}</h1><p className="mt-1 text-sm text-slate-500">{config.description}</p></div>
      {!["implementations", "bulk-upload"].includes(config.module) && (
        <Button onClick={() => {
          reset();
          if (config.module === "forms") {
            setShowBuilder(true);
          } else {
            setShowForm(true);
          }
        }}>
          <Plus className="size-4" /> Add {config.singular}
        </Button>
      )}
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {showBuilder && config.module === "forms" ? (
      <FormBuilderEditor
        initialFormName={text(form.form_name)}
        initialFields={builderFields}
        recordId={editing?.id as number | undefined}
        onSave={handleBuilderSave}
        onCancel={handleBuilderCancel}
      />
    ) : showForm && (
      <Card className="bg-white shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>{editing ? `Edit ${config.singular}` : config.module === "implementations" ? "Implementation Details" : `Add ${config.singular}`}</CardTitle>
            {!["implementations", "bulk-upload"].includes(config.module) && <Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{config.fields.map((field) => <div key={field.key} className={(field.kind === "textarea" || field.kind === "editor") ? "sm:col-span-2 lg:col-span-3" : ""}>
            <div className="flex items-center justify-between">
              <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
              {/* Offered on the long-form kinds only. A code, a date or a number is not
                  something an assistant should be rewriting. */}
              {(field.kind === "textarea" || field.kind === "editor") ? (
                <AiFieldAssistant
                  value={text(form[field.key])}
                  onApply={(next) => setForm((current) => ({ ...current, [field.key]: next }))}
                  fieldType={field.kind === "editor" ? "announcement" : "description"}
                  label={field.label}
                  module="general"
                  page={config.module}
                  entityType={config.module}
                />
              ) : null}
            </div>
            {field.kind === "select" ? <select id={field.key} value={text(form[field.key])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select {field.label}</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}{fieldOptions(field).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select> : field.kind === "editor" ? <TemplateHtmlEditor value={text(form[field.key])} onChange={(html) => setForm((current) => ({ ...current, [field.key]: html }))} tags={templateTags} disabled={busy} />
              : field.kind === "textarea" ? <Textarea id={field.key} rows={field.rows || 5} value={text(form[field.key])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 font-mono" />
              : field.kind === "checkbox" ? <label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))} className="size-4 accent-blue-600" /> Active</label>
              : <Input id={field.key} type={field.kind} min={field.kind === "number" ? 0 : undefined} value={text(form[field.key])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1" />}
          </div>)}</div>
          <div className="mt-5 flex gap-2"><Button onClick={() => void save()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button>{!["implementations", "bulk-upload"].includes(config.module) && <Button variant="outline" onClick={reset}>Cancel</Button>}</div>
        </CardContent>
      </Card>
    )}
    <Card className="bg-white shadow-sm"><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9" /></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sr.</TableHead>{config.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}{config.module !== "implementations" && config.module !== "bulk-upload" && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow>
          : visible.length === 0 ? <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center text-slate-500">No records found.</TableCell></TableRow>
          : visible.map((record, index) => <TableRow key={record.id}><TableCell>{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>{config.columns.map((column) => <TableCell key={column.key} className="max-w-md truncate">{text(record.values[column.key]) || "—"}</TableCell>)}{config.module !== "implementations" && config.module !== "bulk-upload" && <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => edit(record)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => void remove(record)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell>}</TableRow>)}
      </TableBody></Table></div><div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500"><span>{filtered.length} record(s)</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>{currentPage} / {pages}</span><Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></CardContent>
    </Card>
  </div></main>;
}
