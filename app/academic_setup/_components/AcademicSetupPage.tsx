"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  deleteAcademicSetup,
  getAcademicSetupSession,
  loadAcademicSetup,
  saveAcademicSetup,
  type AcademicOption,
  type AcademicRecord,
  type AcademicSetupData,
  type AcademicSetupModule,
} from "../api";

type FieldKind = "text" | "number" | "time" | "select" | "checkbox" | "multiselect";
type OptionSource = keyof Pick<
  AcademicSetupData,
  "grades" | "standards" | "divisions" | "subjects" | "academicYears" | "categories"
>;

export type AcademicField = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  source?: OptionSource;
  dependsOn?: string;
  placeholder?: string;
};

export type AcademicColumn = { key: string; label: string };

export type AcademicSetupConfig = {
  module: AcademicSetupModule;
  title: string;
  description: string;
  singular: string;
  fields: AcademicField[];
  columns: AcademicColumn[];
  mapping?: boolean;
};

const EMPTY_DATA: AcademicSetupData = {
  records: [],
  grades: [],
  standards: [],
  divisions: [],
  subjects: [],
  academicYears: [],
  categories: [],
  mappings: {},
};

function valueText(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value == null ? "" : String(value);
}

function optionLabel(options: AcademicOption[], value: unknown): string {
  return options.find((option) => option.id === Number(value))?.label || valueText(value);
}

export function AcademicSetupPage({ config }: { config: AcademicSetupConfig }) {
  const [data, setData] = useState<AcademicSetupData>(EMPTY_DATA);
  const [form, setForm] = useState<Record<string, string | boolean | number[]>>({});
  const [editing, setEditing] = useState<AcademicRecord | null>(null);
  const [showForm, setShowForm] = useState(Boolean(config.mapping));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadAcademicSetup(config.module, getAcademicSetupSession());
      setData(result);
      if (config.mapping) {
        const mapped: Record<string, number[]> = {};
        result.standards.forEach((standard) => {
          mapped[String(standard.id)] = result.mappings[String(standard.id)] || [];
        });
        setForm(mapped);
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [config.mapping, config.module]);

  useEffect(() => {
    // Browser storage contains the authenticated ERP session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.records;
    return data.records.filter((record) =>
      Object.values(record.values).some((value) => valueText(value).toLowerCase().includes(query))
    );
  }, [data.records, search]);

  function sourceOptions(field: AcademicField): AcademicOption[] {
    const options = field.source ? data[field.source] : [];
    if (!field.dependsOn) return options;
    const parentId = Number(form[field.dependsOn]);
    return options.filter((option) => !option.parentId || option.parentId === parentId);
  }

  function resetForm() {
    setEditing(null);
    setForm({});
    setShowForm(Boolean(config.mapping));
  }

  function startEdit(record: AcademicRecord) {
    const next: Record<string, string | boolean | number[]> = {};
    config.fields.forEach((field) => {
      const value = record.values[field.key];
      next[field.key] =
        field.kind === "checkbox"
          ? value === true || value === "Yes" || value === 1
          : field.kind === "multiselect"
            ? [Number(value)].filter(Boolean)
          : value == null
            ? ""
            : String(value);
    });
    setEditing(record);
    setForm(next);
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function validate(): string {
    for (const field of config.fields) {
      const value = form[field.key];
      if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
        return `${field.label} is required.`;
      }
    }
    if (config.module === "periods") {
      const start = valueText(form.start_time);
      const end = valueText(form.end_time);
      if (start && end && start >= end) return "End time must be after start time.";
    }
    if (config.module === "division-capacities" && Number(form.capacity) < 1) {
      return "Capacity must be at least 1.";
    }
    return "";
  }

  async function handleSave() {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, unknown> = config.mapping
        ? { division_id: form }
        : { ...form };
      const message = await saveAcademicSetup(
        config.module,
        getAcademicSetupSession(),
        payload,
        editing?.id
      );
      setNotice(message);
      resetForm();
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(record: AcademicRecord) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    setBusy(true);
    setError("");
    try {
      setNotice(
        await deleteAcademicSetup(config.module, getAcademicSetupSession(), record.id)
      );
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Record could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function displayValue(record: AcademicRecord, key: string): string {
    const field = config.fields.find((item) => item.key === key);
    const value = record.values[key];
    if (!field?.source) return valueText(value) || "—";
    return optionLabel(data[field.source], value) || "—";
  }

  return (
    <main className="min-h-scree p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{config.description}</p>
          </div>
          {!config.mapping && (
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="size-4" /> Add {config.singular}
            </Button>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {showForm && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{config.mapping ? config.title : editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</CardTitle>
                {!config.mapping && (
                  <Button variant="ghost" size="icon" onClick={resetForm} aria-label="Close form">
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {config.mapping ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-44">Standard</TableHead>
                        <TableHead>Divisions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.standards.map((standard) => (
                        <TableRow key={standard.id}>
                          <TableCell className="font-medium">{standard.label}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-4">
                              {data.divisions
                                .filter((division, index, divisions) =>
                                  divisions.findIndex((item) => item.id === division.id) === index
                                )
                                .map((division) => {
                                const key = String(standard.id);
                                const selected = Array.isArray(form[key]) ? form[key] as number[] : [];
                                return (
                                  <label key={division.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(division.id)}
                                      onChange={(event) =>
                                        setForm((current) => ({
                                          ...current,
                                          [key]: event.target.checked
                                            ? [...selected, division.id]
                                            : selected.filter((id) => id !== division.id),
                                        }))
                                      }
                                      className="size-4 rounded border-slate-300 accent-blue-600"
                                    />
                                    {division.label}
                                  </label>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {config.fields.map((field) => (
                    <div key={field.key} className={field.kind === "multiselect" ? "sm:col-span-2" : ""}>
                      <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
                      {field.kind === "select" ? (
                        <select
                          id={field.key}
                          value={valueText(form[field.key])}
                          onChange={(event) => setForm((current) => {
                            // OldERP SearchChain resets dependent dropdowns when a
                            // parent changes; replicate that during Add and Update.
                            const next: Record<string, string | boolean | number[]> = {
                              ...current,
                              [field.key]: event.target.value,
                            };
                            const dependents = new Set<string>();
                            const collect = (parentKey: string) => {
                              config.fields.forEach((item) => {
                                if (item.dependsOn === parentKey) {
                                  dependents.add(item.key);
                                  collect(item.key);
                                }
                              });
                            };
                            collect(field.key);
                            dependents.forEach((key) => { next[key] = ""; });
                            return next;
                          })}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select {field.label}</option>
                          {sourceOptions(field).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      ) : field.kind === "multiselect" ? (
                        <select
                          id={field.key}
                          multiple
                          value={Array.isArray(form[field.key]) ? (form[field.key] as number[]).map(String) : []}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            [field.key]: [...event.target.selectedOptions].map((option) => Number(option.value)),
                          }))}
                          className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          {sourceOptions(field).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      ) : field.kind === "checkbox" ? (
                        <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm">
                          <input
                            id={field.key}
                            type="checkbox"
                            checked={Boolean(form[field.key])}
                            onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))}
                            className="size-4 accent-blue-600"
                          />
                          Yes
                        </label>
                      ) : (
                        <Input
                          id={field.key}
                          type={field.kind}
                          min={field.kind === "number" ? 0 : undefined}
                          value={valueText(form[field.key])}
                          placeholder={field.placeholder}
                          onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                          className="mt-1"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex gap-2">
                <Button onClick={() => void handleSave()} disabled={busy || loading}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />} Save
                </Button>
                {!config.mapping && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>
        )}

        {!config.mapping && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Sr.</TableHead>
                      {config.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={config.columns.length + 2} className="h-32 text-center text-slate-500">No {config.title.toLowerCase()} found.</TableCell></TableRow>
                    ) : filtered.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>{index + 1}</TableCell>
                        {config.columns.map((column) => <TableCell key={column.key}>{displayValue(record, column.key)}</TableCell>)}
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(record)} aria-label={`Edit ${config.singular}`}><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => void handleDelete(record)} disabled={busy} aria-label={`Delete ${config.singular}`}><Trash2 className="size-4 text-red-600" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
