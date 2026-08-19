"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, LoaderCircle, Pencil, Plus, Printer, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { readNumber } from "@/lib/erp-client";
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from "@/lib/table-export";
import { hostelConfigs, type HostelFieldConfig } from "../configs";
import { deleteHostelModule, getHostelSetupSession, loadHostelModule, saveHostelModule, type HostelCustomField, type HostelModule, type HostelModuleData, type HostelOption, type HostelRecord } from "../setup-api";

const PAGE_SIZE = 10;

const EMPTY_DATA: HostelModuleData = {
  records: [],
  permissions: { view: false, add: false, edit: false, delete: false, admin: false },
  hostelTypes: [],
  roomTypes: [],
  admissionCategories: [],
  hostels: [],
  buildings: [],
  floors: [],
  rooms: [],
  profiles: [],
  grades: [],
  standards: [],
  divisions: [],
  students: [],
  customFields: [],
  availableRooms: [],
  selectedProfile: "",
};

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function optionLabel(option: HostelOption, field: HostelFieldConfig) {
  if (field.key === "gender") {
    return option.label === "M" ? "Male" : option.label === "F" ? "Female" : option.label;
  }
  return option.label;
}

export function HostelModulePage({ module }: { module: HostelModule }) {
  const config = hostelConfigs[module];
  const [data, setData] = useState<HostelModuleData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(config.kind === "master");
  const [editing, setEditing] = useState<HostelRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async (nextFilters?: Record<string, string>) => {
    setLoading(true);
    setError("");
    try {
      const session = getHostelSetupSession();
      const payload = await loadHostelModule(module, session, nextFilters ?? filters);
      setData(payload);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Hostel data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, module]);

  useEffect(() => {
    // Session values are browser-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visibleRecords = useMemo(() => {
    const filtered = search.trim()
      ? data.records.filter((record) =>
          Object.values(record.values).some((value) => text(value).toLowerCase().includes(search.trim().toLowerCase()))
        )
      : data.records;
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    return {
      filtered,
      currentPage,
      pages,
      rows: filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    };
  }, [data.records, page, search]);

  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: "sr_no", label: "Sr No", width: "60px" },
    ...config.columns.map((column) => ({ key: column.key, label: column.label })),
  ], [config.columns]);

  const exportRows = useMemo<TableExportRow[]>(() => visibleRecords.filtered.map((record, index) => {
    const row: TableExportRow = { sr_no: String(index + 1) };
    config.columns.forEach((column) => {
      row[column.key] = text(record.values[column.key]) || "-";
    });
    return row;
  }), [config.columns, visibleRecords.filtered]);

  function resetForm() {
    setEditing(null);
    setForm({});
    setShowForm(config.kind === "master");
  }

  function updateField(key: string, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "hostel_type_id") {
        next.hostel_id = "";
        next.building_id = "";
        next.floor_id = "";
        next.room_id = "";
      }
      if (key === "hostel_id") {
        next.building_id = "";
        next.floor_id = "";
        next.room_id = "";
      }
      if (key === "building_id") {
        next.floor_id = "";
        next.room_id = "";
      }
      if (key === "floor_id") {
        next.room_id = "";
      }
      if (key === "grade_id") {
        next.standard_id = "";
      }
      return next;
    });
  }

  function updateFilter(key: string, value: string) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "hostel_id") {
        next.building_id = "";
        next.floor_id = "";
        next.room_id = "";
      }
      if (key === "building_id") {
        next.floor_id = "";
        next.room_id = "";
      }
      if (key === "floor_id") {
        next.room_id = "";
      }
      if (key === "grade_id") {
        next.standard_id = "";
      }
      return next;
    });
  }

  function optionsFor(field: HostelFieldConfig, sourceForm: Record<string, string>) {
    const source = field.source ? data[field.source] : [];
    if (!field.dependsOn) return source;
    const parent = sourceForm[field.dependsOn];
    if (!parent) return source;
    return source.filter((option) => String(option.parentId ?? option.extra?.hostel_type_id ?? option.extra?.hostel_id ?? option.extra?.building_id ?? option.extra?.floor_id ?? option.extra?.grade_id) === parent);
  }

  function customFieldValue(record: HostelRecord, field: HostelCustomField) {
    return text(record.values[field.field_name]);
  }

  function allocationUserGroupId(record: HostelRecord): string {
    if (text(record.values.profile_name).toLowerCase() === "student") return "8";
    const profileName = text(record.values.profile_name).toLowerCase();
    const matched = data.profiles.find((option) => option.label.toLowerCase() === profileName);
    return matched ? String(matched.id) : text(record.values.user_group_id || "");
  }

  function editRecord(record: HostelRecord) {
    const next: Record<string, string> = {};
    const fields = config.fields ?? [];
    fields.forEach((field) => {
      next[field.key] = text(record.values[field.key]);
    });
    if (module === "hostel-master") {
      data.customFields.forEach((field) => {
        next[field.field_name] = customFieldValue(record, field);
      });
    }
    if (module === "hostel-room-allocation") {
      next.user_id = text(record.values.id);
      next.user_group_id = allocationUserGroupId(record);
      next.admission_category_id = text(record.values.admission_category_id);
      next.hostel_id = text(record.values.hostel_id);
      next.room_id = text(record.values.room_id);
      next.bed_no = text(record.values.bed_no);
      next.locker_no = text(record.values.locker_no);
      next.table_no = text(record.values.table_no);
      next.bedsheet_no = text(record.values.bedsheet_no);
    }
    setEditing(record);
    setForm(next);
    setShowForm(true);
    setError("");
  }

  function validateMaster() {
    for (const field of config.fields ?? []) {
      if (field.required && !text(form[field.key]).trim()) return `${field.label} is required.`;
    }
    if (module === "hostel-master") {
      for (const field of data.customFields) {
        if (field.required && !text(form[field.field_name]).trim()) return `${field.field_label} is required.`;
      }
    }
    return "";
  }

  async function handleSave() {
    const validation = module === "hostel-room-allocation" ? "" : validateMaster();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = getHostelSetupSession();
      const values: Record<string, string> = { ...form };
      if (module === "hostel-room-allocation") {
        // OldERP keys the allocation on (user_id, user_group_id, syear,
        // sub_institute_id) and never rewrites those identity columns on update,
        // so we send them from the edited row rather than an allocation id.
        const editingRecord = editing;
        values.user_id = form.user_id || (editingRecord ? text(editingRecord.values.id) : "");
        values.user_group_id = form.user_group_id || (editingRecord ? allocationUserGroupId(editingRecord) : "");
      }
      // Hostel room allocation is an upsert keyed by user identity, so it always
      // goes through the store endpoint regardless of whether we are editing.
      const saveId = module === "hostel-room-allocation" ? undefined : editing?.id;
      const message = await saveHostelModule(module, session, values, saveId);
      setNotice(message);
      resetForm();
      await load(filters);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(record: HostelRecord) {
    const targetId = module === "hostel-room-allocation" ? readNumber(record.values.allocation_id) : record.id;
    if (!targetId) {
      setError("This record cannot be deleted because its identifier is missing.");
      return;
    }
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    setBusy(true);
    setError("");
    try {
      const message = await deleteHostelModule(module, getHostelSetupSession(), targetId);
      setNotice(message);
      await load(filters);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    setPage(1);
    await load(filters);
  }

  function renderField(field: HostelFieldConfig, sourceForm: Record<string, string>, onChange: (key: string, value: string) => void) {
    const value = text(sourceForm[field.key]);
    if (field.kind === "textarea") {
      return <Textarea id={field.key} value={value} onChange={(event) => onChange(field.key, event.target.value)} className="mt-1" rows={4} />;
    }
    if (field.kind === "select") {
      const options = field.options?.map((option) => ({ id: option, label: option })) ?? optionsFor(field, sourceForm).map((option) => ({ id: String(option.id), label: optionLabel(option, field) }));
      return (
        <select
          id={field.key}
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Select {field.label}</option>
          {options.map((option) => (
            <option key={`${field.key}-${option.id}`} value={option.id}>
              {field.key === "gender" ? (option.label === "M" ? "Male" : option.label === "F" ? "Female" : option.label) : option.label}
            </option>
          ))}
        </select>
      );
    }
    return <Input id={field.key} type={field.kind} value={value} onChange={(event) => onChange(field.key, event.target.value)} className="mt-1" />;
  }

  function renderCustomField(field: HostelCustomField) {
    const value = text(form[field.field_name]);
    if (field.field_type === "textarea") {
      return <Textarea id={field.field_name} value={value} onChange={(event) => updateField(field.field_name, event.target.value)} className="mt-1" rows={4} />;
    }
    if (field.field_type === "dropdown" || field.field_type === "checkbox") {
      return (
        <select
          id={field.field_name}
          value={value}
          onChange={(event) => updateField(field.field_name, event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Select {field.field_label}</option>
          {field.options.map((option) => (
            <option key={`${field.field_name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    return <Input id={field.field_name} value={value} onChange={(event) => updateField(field.field_name, event.target.value)} className="mt-1" placeholder={field.field_message || field.field_label} />;
  }

  function exportSubtitle() {
    return `Showing ${visibleRecords.filtered.length} record(s) for ${config.title}`;
  }

  function renderMasterForm() {
    const fields = config.fields ?? [];
    return (
      <Card className="bg-white shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>{editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}><X className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <div key={field.key} className={field.kind === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
                {renderField(field, form, updateField)}
              </div>
            ))}
            {module === "hostel-master" && data.customFields.map((field) => (
              <div key={field.id} className={field.field_type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                <Label htmlFor={field.field_name}>{field.field_label}{field.required ? " *" : ""}</Label>
                {renderCustomField(field)}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderAllocationForm() {
    return (
      <Card className="bg-white shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>{editing ? `Update ${text(editing.values.name)}` : "Select a row to allocate room details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="admission_category_id">Admission Category</Label>
              {renderField({ key: "admission_category_id", label: "Admission Category", kind: "select", source: "admissionCategories" }, form, updateField)}
            </div>
            <div>
              <Label htmlFor="hostel_id">Hostel *</Label>
              {renderField({ key: "hostel_id", label: "Hostel", kind: "select", source: "hostels", required: true }, form, updateField)}
            </div>
            <div>
              <Label htmlFor="room_id">Available Room *</Label>
              <select
                id="room_id"
                value={text(form.room_id)}
                onChange={(event) => updateField("room_id", event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Room</option>
                {data.availableRooms
                  .filter((room) => !form.hostel_id || text(room.values.hostel_id) === form.hostel_id)
                  .filter((room) => !filters.building_id || text(room.values.building_id) === filters.building_id)
                  .filter((room) => !filters.floor_id || text(room.values.floor_id) === filters.floor_id)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {text(room.values.room_name)} ({text(room.values.allocated_count)} occupied)
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="bed_no">Bed No</Label>
              <Input id="bed_no" value={text(form.bed_no)} onChange={(event) => updateField("bed_no", event.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="locker_no">Locker No</Label>
              <Input id="locker_no" value={text(form.locker_no)} onChange={(event) => updateField("locker_no", event.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="table_no">Table No</Label>
              <Input id="table_no" value={text(form.table_no)} onChange={(event) => updateField("table_no", event.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bedsheet_no">Bedsheet No</Label>
              <Input id="bedsheet_no" value={text(form.bedsheet_no)} onChange={(event) => updateField("bedsheet_no", event.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={busy || !editing}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Allocation
            </Button>
            <Button variant="outline" onClick={resetForm}>Clear</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderFilters() {
    if (!config.filters?.length) return null;
    return (
      <Card className="bg-white shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Search And Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {config.filters.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`filter-${field.key}`}>{field.label}</Label>
                {renderField({ ...field, key: field.key }, filters, updateFilter)}
              </div>
            ))}
            <div>
              <Label htmlFor="search">Search</Label>
              <Input id="search" value={text(filters.search)} onChange={(event) => updateFilter("search", event.target.value)} className="mt-1" placeholder="Search by name, mobile, or code" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runSearch()} disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
              Search
            </Button>
            <Button variant="outline" onClick={() => { setFilters({}); void load({}); }}>
              <RefreshCw className="size-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{config.description}</p>
          </div>
          {config.kind === "master" && data.permissions.add && (
            <Button onClick={() => { setShowForm(true); setEditing(null); setForm({}); }}>
              <Plus className="size-4" />
              Add {config.singular}
            </Button>
          )}
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {renderFilters()}
        {showForm && config.kind === "master" && renderMasterForm()}
        {config.kind === "allocation" && renderAllocationForm()}

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}...`} className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void load(filters)} disabled={loading}>
                  <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
                  Refresh
                </Button>
                {config.kind === "report" && (
                  <>
                    <Button variant="outline" onClick={() => exportRowsAsCsv({ filename: `${module}.csv`, columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
                      <Download className="size-4" />
                      CSV
                    </Button>
                    <Button variant="outline" onClick={() => exportRowsAsExcel({ filename: `${module}.xls`, title: config.title, columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
                      <FileSpreadsheet className="size-4" />
                      Excel
                    </Button>
                    <Button variant="outline" onClick={() => exportRowsAsPdf({ filename: `${module}.pdf`, title: config.title, subtitle: exportSubtitle(), columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
                      <FileText className="size-4" />
                      PDF
                    </Button>
                    <Button variant="outline" onClick={() => openPrintPreview({ title: config.title, subtitle: exportSubtitle(), columns: exportColumns, rows: exportRows })} disabled={exportRows.length === 0}>
                      <Printer className="size-4" />
                      Print
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr No</TableHead>
                    {config.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                    {config.kind !== "report" && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={config.columns.length + (config.kind !== "report" ? 2 : 1)} className="h-32 text-center">
                        <LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" />
                      </TableCell>
                    </TableRow>
                  ) : visibleRecords.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={config.columns.length + (config.kind !== "report" ? 2 : 1)} className="h-32 text-center text-slate-500">
                        No records found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRecords.rows.map((record, index) => (
                      <TableRow key={`${record.id}-${index}`}>
                        <TableCell>{(visibleRecords.currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                        {config.columns.map((column) => (
                          <TableCell key={column.key} className="max-w-xs truncate">
                            {text(record.values[column.key]) || "-"}
                          </TableCell>
                        ))}
                        {config.kind !== "report" && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {data.permissions.edit && (
                                <Button variant="ghost" size="icon" onClick={() => editRecord(record)}>
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              {data.permissions.delete && (
                                <Button variant="ghost" size="icon" onClick={() => void handleDelete(record)}>
                                  <Trash2 className="size-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>{visibleRecords.filtered.length} record(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={visibleRecords.currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <span>{visibleRecords.currentPage} / {visibleRecords.pages}</span>
                <Button variant="outline" size="sm" disabled={visibleRecords.currentPage >= visibleRecords.pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
