"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CustomFieldOption = {
  id: number;
  display_text: string;
  display_value: string;
};

type CustomField = {
  id: number;
  table_name: string;
  table_alias: string;
  tab_sort_order: number | null;
  field_name: string;
  column_header: string;
  field_label: string;
  user_type: string;
  field_type: string;
  field_message: string;
  file_size_max: string;
  sort_order: number;
  required: number;
  common_to_all: number;
  is_deleted: string;
  sub_institute_id: number;
  options: CustomFieldOption[];
};

type FieldForm = {
  table_name: string;
  table_alias: string;
  tab_sort_order: string;
  field_name: string;
  column_header: string;
  field_label: string;
  user_type: string;
  field_type: string;
  field_message: string;
  file_size_max: string;
  sort_order: string;
  required: boolean;
  common_to_all: boolean;
  options: CustomFieldOption[];
};

const emptyForm: FieldForm = {
  table_name: "",
  table_alias: "",
  tab_sort_order: "1",
  field_name: "",
  column_header: "",
  field_label: "",
  user_type: "student",
  field_type: "textbox",
  field_message: "",
  file_size_max: "",
  sort_order: "1",
  required: false,
  common_to_all: false,
  options: [],
};

const fieldTypeOptions = [
  { value: "textbox", label: "Textbox" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "dropdown", label: "Dropdown" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function normalizeStatus(value: unknown): string {
  const raw = text(value).trim().toLowerCase();
  if (!raw || raw === "0") return "Inactive";
  if (raw === "1" || raw === "y" || raw === "yes" || raw === "active") return "Active";
  return text(value);
}

function mapRecord(row: CustomField): CustomField & { searchText: string } {
  return {
    ...row,
    searchText: [
      row.table_name,
      row.field_name,
      row.column_header,
      row.field_label,
      row.field_type,
      row.user_type,
      row.field_message,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function normalizeList(payload: unknown): CustomField[] {
  const source = isRecord(payload) && isRecord(payload.data) ? payload.data : isRecord(payload) ? payload : null;
  if (!source) return [];
  const list = source.data ?? source.records ?? source;
  if (!Array.isArray(list)) return [];
  return list.map((item: unknown) => {
    const record = isRecord(item) ? item : {};
    const optionsSource = isRecord(record.options) && Array.isArray((record.options as Record<string, unknown>).data)
      ? ((record.options as Record<string, unknown>).data as unknown[])
      : Array.isArray(record.options)
        ? (record.options as unknown[])
        : [];
    const options: CustomFieldOption[] = optionsSource.map((opt: unknown) => {
      const obj = isRecord(opt) ? opt : {};
      return {
        id: readNumber(obj.id ?? 0),
        display_text: readString(obj.display_text ?? obj.displayValue ?? obj.value ?? ""),
        display_value: readString(obj.display_value ?? obj.displayValue ?? obj.value ?? ""),
      };
    });
    return {
      id: readNumber(record.id ?? 0),
      table_name: readString(record.table_name ?? ""),
      table_alias: readString(record.table_alias ?? ""),
      tab_sort_order: readNumber(record.tab_sort_order ?? null),
      field_name: readString(record.field_name ?? ""),
      column_header: readString(record.column_header ?? ""),
      field_label: readString(record.field_label ?? ""),
      user_type: readString(record.user_type ?? ""),
      field_type: readString(record.field_type ?? "textbox"),
      field_message: readString(record.field_message ?? ""),
      file_size_max: readString(record.file_size_max ?? ""),
      sort_order: readNumber(record.sort_order ?? 0),
      required: readNumber(record.required ?? 0),
      common_to_all: readNumber(record.common_to_all ?? 0),
      is_deleted: readString(record.is_deleted ?? "N"),
      sub_institute_id: readNumber(record.sub_institute_id ?? 0),
      options,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;

export default function FieldsConfigurationPage() {
  const [session] = useState(buildSessionContext);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FieldForm>(emptyForm);

  const resolvedSubInstituteId =
    session.subInstituteId ||
    readStoredValue("sub_institute_id", "userData", "menuContext");
  const resolvedAcademicYear = session.syear
    ? String(session.syear)
    : readStoredValue("selectedAcademicYear", "userData", "menuContext") ||
      readStoredValue("syear", "userData", "menuContext");
  const resolvedUserId =
    session.userId ||
    readStoredValue("user_id", "userData", "menuContext") ||
    readStoredValue("userId", "userData", "menuContext");

  const baseUrl = text(session.baseUrl).trim();

  const apiUrl = useMemo(() => {
    if (!baseUrl) return "";
    const url = new URL(`${baseUrl}/api/fields-configuration`);
    const params = new URLSearchParams();
    params.set("type", "API");
    if (resolvedSubInstituteId) params.set("sub_institute_id", resolvedSubInstituteId);
    if (resolvedUserId) params.set("user_id", resolvedUserId);
    if (resolvedAcademicYear) params.set("syear", resolvedAcademicYear);
    url.search = params.toString();
    return url.toString();
  }, [baseUrl, resolvedAcademicYear, resolvedSubInstituteId, resolvedUserId]);

  const loadRecords = useCallback(async () => {
    if (!apiUrl) {
      setError("Session is missing the ERP host name.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl, {
        headers: createAuthHeaders(session),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load fields (${response.status})`);
      }
      const payload = (await response.json()) as ApiEnvelope;
      const status = normalizeApiStatus(payload);
      if (status === "2") {
        throw new Error(readString(payload.message) || "Authentication failed.");
      }
      const mapped = normalizeList(payload).map(mapRecord);
      setFields(mapped);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load fields.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadRecords]);

  useEffect(() => {
    if (success) {
      const timeout = window.setTimeout(() => setSuccess(""), 3000);
      return () => window.clearTimeout(timeout);
    }
  }, [success]);

  const filteredFields = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => field.searchText.includes(query));
  }, [fields, searchTerm]);

  const visibleFields = useMemo(() => {
    const sorted = filteredFields.slice().sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [filteredFields]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setIsCreating(false);
  }

  function openCreate() {
    resetForm();
    setIsCreating(true);
  }

  function openEdit(record: CustomField) {
    setForm({
      table_name: record.table_name,
      table_alias: record.table_alias,
      tab_sort_order: record.tab_sort_order != null ? String(record.tab_sort_order) : "1",
      field_name: record.field_name,
      column_header: record.column_header,
      field_label: record.field_label,
      user_type: record.user_type || "student",
      field_type: record.field_type || "textbox",
      field_message: record.field_message || "",
      file_size_max: record.file_size_max || "",
      sort_order: record.sort_order != null ? String(record.sort_order) : "1",
      required: record.required === 1,
      common_to_all: record.common_to_all === 1,
      options: record.options?.length
        ? record.options.map((opt) => ({ ...opt }))
        : [],
    });
    setEditingId(record.id);
    setIsCreating(false);
  }

  function closeForm() {
    resetForm();
  }

  function updateForm<K extends keyof FieldForm>(key: K, value: FieldForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function appendOption() {
    setForm((current) => ({
      ...current,
      options: [...current.options, { id: 0, display_text: "", display_value: "" }],
    }));
  }

  function updateOption(index: number, key: "display_text" | "display_value", value: string) {
    setForm((current) => {
      const options = [...current.options];
      options[index] = { ...options[index], [key]: value };
      return { ...current, options };
    });
  }

  function removeOption(index: number) {
    setForm((current) => {
      const options = current.options.filter((_, i) => i !== index);
      return { ...current, options };
    });
  }

  function validateForm(): string {
    if (!form.table_name.trim()) return "Table name is required.";
    if (!form.field_name.trim()) return "Field name is required.";
    if (!form.field_label.trim()) return "Field label is required.";
    if (!form.sort_order || Number(form.sort_order) <= 0) return "Sort order must be a positive number.";
    const needsOptions = form.field_type === "checkbox" || form.field_type === "dropdown";
    if (needsOptions && form.options.length === 0) return "Options are required for checkbox and dropdown fields.";
    for (let i = 0; i < form.options.length; i += 1) {
      if (!form.options[i].display_text.trim() || !form.options[i].display_value.trim()) {
        return `Option ${i + 1} must have both display name and value.`;
      }
    }
    return "";
  }

  async function submitForm() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!apiUrl && editingId) {
      setError("Session is missing the ERP host name.");
      return;
    }

    const isEdit = editingId != null && editingId > 0;
    const body: Record<string, unknown> = {
      table_name: form.table_name.trim(),
      table_alias: form.table_alias.trim(),
      tab_sort_order: Number(form.tab_sort_order) || 1,
      field_name: form.field_name.trim(),
      column_header: form.column_header.trim(),
      field_label: form.field_label.trim(),
      user_type: form.user_type.trim(),
      field_type: form.field_type,
      field_message: form.field_message.trim(),
      file_size_max: form.file_size_max.trim(),
      sort_order: Number(form.sort_order) || 0,
      required: form.required,
      common_to_all: form.common_to_all,
      sub_institute_id: resolvedSubInstituteId,
      user_id: resolvedUserId,
      syear: resolvedAcademicYear,
      type: "API",
    };

    if (form.field_type === "checkbox" || form.field_type === "dropdown") {
      body.display_name = form.options.map((opt) => opt.display_text.trim());
      body.f_value = form.options.map((opt) => opt.display_value.trim());
    }

    setSubmitting(true);
    setError("");

    try {
      let response: Response;
      if (isEdit) {
        response = await fetch(`${apiUrl.replace(/\/$/, "")}/${editingId}`, {
          method: "POST",
          headers: createAuthHeaders(session, "application/json"),
          body: JSON.stringify(body),
          cache: "no-store",
        });
      } else {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: createAuthHeaders(session, "application/json"),
          body: JSON.stringify(body),
          cache: "no-store",
        });
      }

      const payload = (await response.json()) as ApiEnvelope;
      const status = normalizeApiStatus(payload);

      if (status === "2") {
        throw new Error(readString(payload.message) || "Authentication failed.");
      }
      if (!response.ok || status !== "1") {
        throw new Error(readString(payload.message) || `Request failed (${response.status}).`);
      }

      setSuccess(readString(payload.message) || (isEdit ? "Record updated." : "Record created."));
      resetForm();
      await loadRecords();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to save field.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeField(record: CustomField) {
    if (!window.confirm(`Delete field "${record.field_label}"?`)) return;
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/${record.id}/delete`, {
        method: "POST",
        headers: createAuthHeaders(session, "application/json"),
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope;
      const status = normalizeApiStatus(payload);
      if (status === "2") {
        throw new Error(readString(payload.message) || "Authentication failed.");
      }
      if (!response.ok || status !== "1") {
        throw new Error(readString(payload.message) || `Delete failed (${response.status}).`);
      }
      setSuccess(readString(payload.message) || "Field deleted.");
      await loadRecords();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to delete field.");
    }
  }

  async function updateSortOrder(updated: CustomField[]) {
    try {
      const order = updated.map((record) => record.id);
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/update-sort`, {
        method: "POST",
        headers: createAuthHeaders(session, "application/json"),
        body: JSON.stringify({ order }),
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope;
      const status = normalizeApiStatus(payload);
      if (status === "2") {
        throw new Error(readString(payload.message) || "Authentication failed.");
      }
      if (!response.ok || status !== "1") {
        throw new Error(readString(payload.message) || `Sort update failed (${response.status}).`);
      }
      setSuccess("Sort order updated.");
      await loadRecords();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to update sort order.");
    }
  }

  const showForm = isCreating || editingId != null;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Fields Configuration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure custom fields, dropdown options, and sort order per database table.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Field
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {showForm && (
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{editingId ? `Edit Field` : "Add Field"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={closeForm}>
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="table_name">Table Name *</Label>
                  <Input
                    id="table_name"
                    value={form.table_name}
                    onChange={(e) => updateForm("table_name", e.target.value)}
                    placeholder="tblstudent"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="field_name">Field Name *</Label>
                  <Input
                    id="field_name"
                    value={form.field_name}
                    onChange={(e) => updateForm("field_name", e.target.value)}
                    placeholder="blood_group"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="field_label">Field Label *</Label>
                  <Input
                    id="field_label"
                    value={form.field_label}
                    onChange={(e) => updateForm("field_label", e.target.value)}
                    placeholder="Blood Group"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="field_type">Field Type *</Label>
                  <Select
                    value={form.field_type}
                    onValueChange={(value) => updateForm("field_type", value)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="field_type">
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="column_header">Column Header</Label>
                  <Input
                    id="column_header"
                    value={form.column_header}
                    onChange={(e) => updateForm("column_header", e.target.value)}
                    placeholder="Blood Group"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="user_type">User Type</Label>
                  <Select
                    value={form.user_type}
                    onValueChange={(value) => updateForm("user_type", value)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="user_type">
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min={1}
                    value={form.sort_order}
                    onChange={(e) => updateForm("sort_order", e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tab_sort_order">Tab Sort Order</Label>
                  <Input
                    id="tab_sort_order"
                    type="number"
                    min={1}
                    value={form.tab_sort_order}
                    onChange={(e) => updateForm("tab_sort_order", e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="field_message">Field Message</Label>
                  <Input
                    id="field_message"
                    value={form.field_message}
                    onChange={(e) => updateForm("field_message", e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="file_size_max">File Size Max</Label>
                  <Input
                    id="file_size_max"
                    value={form.file_size_max}
                    onChange={(e) => updateForm("file_size_max", e.target.value)}
                    placeholder="2MB"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="table_alias">Table Alias</Label>
                  <Input
                    id="table_alias"
                    value={form.table_alias}
                    onChange={(e) => updateForm("table_alias", e.target.value)}
                    placeholder="TS"
                    disabled={submitting}
                  />
                </div>

                <div className="flex flex-wrap items-end gap-4 sm:col-span-2 lg:col-span-3">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.required}
                      onCheckedChange={(checked) => updateForm("required", Boolean(checked))}
                      disabled={submitting}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.common_to_all}
                      onCheckedChange={(checked) => updateForm("common_to_all", Boolean(checked))}
                      disabled={submitting}
                    />
                    Common To All
                  </label>
                </div>
              </div>

              {(form.field_type === "checkbox" || form.field_type === "dropdown") && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Options{" "}
                        <span className="font-normal text-slate-500">
                          (Display Name / Value pairs)
                        </span>
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={appendOption} disabled={submitting}>
                      <Plus className="size-4" />
                      Add Option
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {form.options.map((option, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <div className="space-y-1">
                          <Label htmlFor={`option-text-${index}`}>Display Name</Label>
                          <Input
                            id={`option-text-${index}`}
                            value={option.display_text}
                            onChange={(e) =>
                              updateOption(index, "display_text", e.target.value)
                            }
                            disabled={submitting}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`option-value-${index}`}>Field Value</Label>
                          <Input
                            id={`option-value-${index}`}
                            value={option.display_value}
                            onChange={(e) =>
                              updateOption(index, "display_value", e.target.value)
                            }
                            disabled={submitting}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => removeOption(index)}
                            disabled={submitting}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {form.options.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No options added. Click &quot;Add Option&quot; to create dropdown or
                        checkbox values.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <Button onClick={() => void submitForm()} disabled={submitting}>
                  {submitting && <LoaderCircle className="size-4 animate-spin" />}
                  {editingId ? "Update Field" : "Save Field"}
                </Button>
                <Button variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                  }}
                  placeholder="Search fields..."
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void loadRecords()}
                disabled={loading}
              >
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr.</TableHead>
                    <TableHead>Sort</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" />
                      </TableCell>
                    </TableRow>
                  ) : visibleFields.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleFields.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>{(index + 1).toString().padStart(2, "0")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GripVertical className="size-4 text-slate-400" />
                            {record.sort_order}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{record.table_name}</TableCell>
                        <TableCell className="font-mono text-xs">{record.field_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {record.field_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{record.field_label}</TableCell>
                        <TableCell>{record.required === 1 ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              record.is_deleted === "N"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {normalizeStatus(record.is_deleted)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void removeField(record)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>{visibleFields.length} record(s)</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function readStoredValue(
  storageKey: string,
  ...jsonSources: string[]
): string {
  if (typeof window === "undefined") return "";

  const directValue = readString(localStorage.getItem(storageKey));
  if (directValue) return directValue;

  for (const sourceKey of jsonSources) {
    try {
      const source = JSON.parse(localStorage.getItem(sourceKey) || "{}") as Record<
        string,
        unknown
      >;
      const nestedValue = readString(source[storageKey]);
      if (nestedValue) return nestedValue;
    } catch {
      continue;
    }
  }

  return "";
}
