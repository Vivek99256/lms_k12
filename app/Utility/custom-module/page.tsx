"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Columns3,
  Database,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
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
  UtilityAlert,
  UtilityEmpty,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
  utilitySelectClass,
} from "../_components/utility-ui";
import { errorMessage, readString } from "../_lib/erp";
import {
  CHOICE_FIELD_TYPES,
  COLUMN_INDEXES,
  COLUMN_TYPE_GROUPS,
  FIELD_TYPES,
  HELPER_FUNCTIONS,
  MODULE_TYPES,
  applyCustomModuleSchema,
  deleteCustomModule,
  deleteCustomModuleColumn,
  deleteCustomModuleRecord,
  emptyColumn,
  loadCustomModuleColumns,
  loadCustomModuleForm,
  loadCustomModuleRecords,
  loadCustomModules,
  loadLevel2Menus,
  saveCustomModule,
  saveCustomModuleColumn,
  type CustomModuleColumn,
  type CustomModuleColumnsView,
  type CustomModuleForm,
  type CustomModuleRecords,
  type CustomModuleSummary,
  type MenuOption,
} from "./api";

type View = "list" | "form" | "columns" | "records";

const TEXT_FIELDS: Array<{ key: keyof CustomModuleForm; label: string; hint?: string }> = [
  { key: "migration", label: "Migration" },
  { key: "seeder", label: "Seeder" },
  { key: "model", label: "Model" },
  { key: "controller", label: "Controller" },
  { key: "route", label: "Route" },
  { key: "view", label: "View" },
  { key: "storage", label: "Storage" },
  { key: "validation", label: "Validation" },
  { key: "accessLink", label: "Access link", hint: "Example: menuName.index" },
];

export default function CustomModulePage() {
  const [view, setView] = useState<View>("list");
  const [modules, setModules] = useState<CustomModuleSummary[]>([]);
  const [form, setForm] = useState<CustomModuleForm | null>(null);
  const [level2Options, setLevel2Options] = useState<MenuOption[]>([]);
  const [columnsView, setColumnsView] = useState<CustomModuleColumnsView | null>(null);
  const [columnDraft, setColumnDraft] = useState<CustomModuleColumn>(emptyColumn);
  const [records, setRecords] = useState<CustomModuleRecords | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setModules(await loadCustomModules());
    } catch (value: unknown) {
      setError(errorMessage(value, "Custom modules could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadList();
  }, [loadList]);

  async function openForm(id: number) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await loadCustomModuleForm(id);
      setForm(data);
      setLevel2Options(data.displayUnder ? await loadLevel2Menus(data.displayUnder) : []);
      setView("form");
    } catch (value: unknown) {
      setError(errorMessage(value, "The module form could not be loaded."));
    } finally {
      setBusy(false);
    }
  }

  async function openColumns(id: number) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      setColumnsView(await loadCustomModuleColumns(id));
      setColumnDraft(emptyColumn);
      setView("columns");
    } catch (value: unknown) {
      setError(errorMessage(value, "The column list could not be loaded."));
    } finally {
      setBusy(false);
    }
  }

  async function openRecords(id: number) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      setRecords(await loadCustomModuleRecords(id));
      setView("records");
    } catch (value: unknown) {
      setError(errorMessage(value, "The records could not be loaded."));
    } finally {
      setBusy(false);
    }
  }

  function updateForm(patch: Partial<CustomModuleForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError("");
    setNotice("");

    if (!form.moduleName.trim() || !form.moduleType || !form.displayUnder || !form.tableName.trim()) {
      setError("Module name, module type, display under and table name are required.");
      return;
    }

    setBusy(true);
    try {
      setNotice(await saveCustomModule(form));
      await loadList();
      setView("list");
    } catch (value: unknown) {
      setError(errorMessage(value, "The module could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function removeModule(module: CustomModuleSummary) {
    setError("");
    setNotice("");
    if (
      !window.confirm(
        `Delete "${module.moduleName || module.tableName}"? The physical table ${module.tableName}, its menu entry and all of its access rights are dropped.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      setNotice(await deleteCustomModule(module.id));
      await loadList();
    } catch (value: unknown) {
      setError(errorMessage(value, "The module could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  async function submitColumn(event: React.FormEvent) {
    event.preventDefault();
    if (!columnsView) return;
    setError("");
    setNotice("");
    if (!columnDraft.columnName.trim()) {
      setError("Column name is required.");
      return;
    }

    setBusy(true);
    try {
      setNotice(await saveCustomModuleColumn(columnsView.tableId, columnDraft));
      setColumnsView(await loadCustomModuleColumns(columnsView.tableId));
      setColumnDraft(emptyColumn);
    } catch (value: unknown) {
      setError(errorMessage(value, "The column could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function removeColumn(column: CustomModuleColumn) {
    if (!columnsView) return;
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the column "${column.columnName}"?`)) return;

    setBusy(true);
    try {
      setNotice(await deleteCustomModuleColumn(columnsView.tableId, column.id));
      setColumnsView(await loadCustomModuleColumns(columnsView.tableId));
      if (columnDraft.id === column.id) setColumnDraft(emptyColumn);
    } catch (value: unknown) {
      setError(errorMessage(value, "The column could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  async function applySchema() {
    if (!columnsView) return;
    setError("");
    setNotice("");
    if (columnsView.columns.length === 0) {
      setError("Add at least one column before saving the table.");
      return;
    }
    if (
      !window.confirm(
        `Create or update the table ${columnsView.tableName}? Columns removed here are dropped from the database.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      setNotice(await applyCustomModuleSchema(columnsView.tableId));
      setColumnsView(await loadCustomModuleColumns(columnsView.tableId));
      await loadList();
    } catch (value: unknown) {
      setError(errorMessage(value, "The table schema could not be applied."));
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(recordId: number) {
    if (!records) return;
    setError("");
    setNotice("");
    if (!window.confirm("Delete this record?")) return;

    setBusy(true);
    try {
      setNotice(await deleteCustomModuleRecord(records.tableId, recordId, records.tableName));
      setRecords(await loadCustomModuleRecords(records.tableId));
    } catch (value: unknown) {
      setError(errorMessage(value, "The record could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  const backButton = (
    <Button
      variant="outline"
      onClick={() => {
        setView("list");
        setError("");
        setNotice("");
      }}
    >
      <ArrowLeft className="size-4" />
      Back to modules
    </Button>
  );

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Custom module"
        description="Design institute-specific tables, their columns and their menu entry."
        onRefresh={view === "list" ? () => void loadList() : undefined}
        refreshing={loading || busy}
        actions={
          view === "list" ? (
            <Button onClick={() => void openForm(0)} disabled={busy}>
              <Plus className="size-4" />
              Add module
            </Button>
          ) : (
            backButton
          )
        }
      />

      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      {view === "list" ? (
        <UtilitySection title="Modules" icon={<Database className="size-5" />}>
          {loading ? (
            <UtilityLoading label="Loading custom modules…" />
          ) : modules.length === 0 ? (
            <UtilityEmpty
              title="No custom modules yet."
              hint="Use “Add module” to define a table, then add its columns and create it."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sr. no.</TableHead>
                    <TableHead>Module name</TableHead>
                    <TableHead>Table name</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-28">Created</TableHead>
                    <TableHead className="w-56">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module, index) => (
                    <TableRow key={module.id}>
                      <TableCell className="text-slate-500">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {module.moduleName || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{module.tableName}</TableCell>
                      <TableCell>{module.moduleType || "—"}</TableCell>
                      <TableCell>
                        {module.tableExists ? (
                          <span className="text-emerald-600">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openColumns(module.id)}
                            disabled={busy}
                          >
                            <Columns3 className="size-3.5" />
                            Columns
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openForm(module.id)}
                            disabled={busy}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          {module.tableExists ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void openRecords(module.id)}
                              disabled={busy}
                            >
                              <Eye className="size-3.5" />
                              Records
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void removeModule(module)}
                            disabled={busy}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </UtilitySection>
      ) : null}

      {view === "form" && form ? (
        <form onSubmit={submitForm}>
          <UtilitySection
            title={form.id ? "Edit module" : "Add module"}
            description="The table name is automatically prefixed with Z_ and cannot be changed once the table exists."
            icon={<Database className="size-5" />}
            footer={
              <Button type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save module
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="module-name">Module name *</Label>
                <Input
                  id="module-name"
                  value={form.moduleName}
                  onChange={(event) => updateForm({ moduleName: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-type">Module type *</Label>
                <select
                  id="module-type"
                  className={utilitySelectClass}
                  value={form.moduleType}
                  onChange={(event) => updateForm({ moduleType: event.target.value })}
                  required
                >
                  {MODULE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-under">Display under *</Label>
                <select
                  id="display-under"
                  className={utilitySelectClass}
                  value={form.displayUnder}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateForm({ displayUnder: value, level2: "" });
                    void loadLevel2Menus(value)
                      .then(setLevel2Options)
                      .catch(() => setLevel2Options([]));
                  }}
                  required
                >
                  <option value="">Select any one</option>
                  {form.displayUnderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level-2">Level 2</Label>
                <select
                  id="level-2"
                  className={utilitySelectClass}
                  value={form.level2}
                  disabled={!form.displayUnder}
                  onChange={(event) => updateForm({ level2: event.target.value })}
                >
                  <option value="">Select any one</option>
                  {level2Options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-name">Table name *</Label>
                <Input
                  id="table-name"
                  value={form.tableName}
                  readOnly={form.tableCreated}
                  onChange={(event) => updateForm({ tableName: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="helper-function">Helper function</Label>
                <select
                  id="helper-function"
                  className={utilitySelectClass}
                  value={form.helperFunction}
                  onChange={(event) => updateForm({ helperFunction: event.target.value })}
                >
                  <option value="">Select function</option>
                  {HELPER_FUNCTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
                    value={readString(form[field.key])}
                    onChange={(event) => updateForm({ [field.key]: event.target.value })}
                  />
                  {field.hint ? <p className="text-xs text-emerald-600">{field.hint}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={form.syearWise}
                  onChange={(event) => updateForm({ syearWise: event.target.checked })}
                />
                Include academic year (syear) column
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={form.includeStudent}
                  disabled={form.tableCreated}
                  onChange={(event) => updateForm({ includeStudent: event.target.checked })}
                />
                Include student columns
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={form.includeStaff}
                  disabled={form.tableCreated}
                  onChange={(event) => updateForm({ includeStaff: event.target.checked })}
                />
                Include staff columns
              </label>
            </div>
          </UtilitySection>
        </form>
      ) : null}

      {view === "columns" && columnsView ? (
        <>
          <form onSubmit={submitColumn}>
            <UtilitySection
              title={`Columns — ${columnsView.tableName}`}
              description={columnDraft.id ? "Editing an existing column." : "Add a new column."}
              icon={<Columns3 className="size-5" />}
              footer={
                <>
                  {columnDraft.id ? (
                    <Button type="button" variant="outline" onClick={() => setColumnDraft(emptyColumn)}>
                      Cancel edit
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {columnDraft.id ? "Update column" : "Add column"}
                  </Button>
                </>
              }
            >
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="column-name">Name *</Label>
                  <Input
                    id="column-name"
                    value={columnDraft.columnName}
                    onChange={(event) =>
                      setColumnDraft({ ...columnDraft, columnName: event.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-slate-500">Saved in snake_case.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-type">Type</Label>
                  <select
                    id="column-type"
                    className={utilitySelectClass}
                    value={columnDraft.type}
                    onChange={(event) => setColumnDraft({ ...columnDraft, type: event.target.value })}
                  >
                    {COLUMN_TYPE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-length">Length</Label>
                  <Input
                    id="column-length"
                    type="number"
                    min={0}
                    value={columnDraft.length}
                    onChange={(event) => setColumnDraft({ ...columnDraft, length: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-index">Index</Label>
                  <select
                    id="column-index"
                    className={utilitySelectClass}
                    value={columnDraft.index}
                    onChange={(event) => setColumnDraft({ ...columnDraft, index: event.target.value })}
                  >
                    {COLUMN_INDEXES.map((option) => (
                      <option key={option || "none"} value={option}>
                        {option || "None"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-default">Default</Label>
                  <Input
                    id="column-default"
                    value={columnDraft.defaultValue}
                    onChange={(event) =>
                      setColumnDraft({ ...columnDraft, defaultValue: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-field-type">Field type</Label>
                  <select
                    id="column-field-type"
                    className={utilitySelectClass}
                    value={columnDraft.fieldType}
                    onChange={(event) =>
                      setColumnDraft({ ...columnDraft, fieldType: event.target.value })
                    }
                  >
                    {FIELD_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="column-field-value">Field values</Label>
                  <Input
                    id="column-field-value"
                    value={columnDraft.fieldValue}
                    placeholder="Comma separated, e.g. Yes,No"
                    disabled={!CHOICE_FIELD_TYPES.includes(columnDraft.fieldType)}
                    onChange={(event) =>
                      setColumnDraft({ ...columnDraft, fieldValue: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-end gap-4 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-600"
                      checked={columnDraft.notNull}
                      onChange={(event) =>
                        setColumnDraft({ ...columnDraft, notNull: event.target.checked })
                      }
                    />
                    Not null
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-600"
                      checked={columnDraft.autoIncrement}
                      onChange={(event) =>
                        setColumnDraft({ ...columnDraft, autoIncrement: event.target.checked })
                      }
                    />
                    Auto increment (primary key)
                  </label>
                </div>
              </div>
            </UtilitySection>
          </form>

          <UtilitySection
            title="Defined columns"
            description="id, sub_institute_id, created_at and updated_at are managed by the ERP."
            icon={<Columns3 className="size-5" />}
            footer={
              <Button type="button" onClick={() => void applySchema()} disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Database className="size-4" />}
                Save changes to database
              </Button>
            }
          >
            {columnsView.columns.length === 0 ? (
              <UtilityEmpty title="No columns defined yet." hint="Add at least one column above." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Length</TableHead>
                      <TableHead>Field type</TableHead>
                      <TableHead>Field values</TableHead>
                      <TableHead>Not null</TableHead>
                      <TableHead>Auto inc.</TableHead>
                      <TableHead>Index</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="w-28">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columnsView.columns.map((column) => (
                      <TableRow key={column.id}>
                        <TableCell className="font-mono text-xs">{column.columnName}</TableCell>
                        <TableCell>{column.type}</TableCell>
                        <TableCell>{column.length || "—"}</TableCell>
                        <TableCell>{column.fieldType}</TableCell>
                        <TableCell>{column.fieldValue || "—"}</TableCell>
                        <TableCell>{column.notNull ? "Yes" : "No"}</TableCell>
                        <TableCell>{column.autoIncrement ? "Yes" : "No"}</TableCell>
                        <TableCell>{column.index || "—"}</TableCell>
                        <TableCell>{column.defaultValue || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setColumnDraft(column)}
                              disabled={busy}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void removeColumn(column)}
                              disabled={busy}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </UtilitySection>
        </>
      ) : null}

      {view === "records" && records ? (
        <UtilitySection
          title={`Records — ${records.moduleName || records.tableName}`}
          icon={<Eye className="size-5" />}
        >
          <UtilityAlert tone="info">
            Records can be viewed and deleted here. Adding or editing a record is not available from
            the new frontend yet — the ERP&apos;s record endpoint writes every posted field straight
            into the custom table, so it cannot accept the API context parameters.
          </UtilityAlert>

          {records.rows.length === 0 ? (
            <div className="mt-4">
              <UtilityEmpty title="No records yet." />
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sr. no.</TableHead>
                    {records.columns.map((column) => (
                      <TableHead key={column.id}>
                        {column.columnName.replace(/_/g, " ")}
                      </TableHead>
                    ))}
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.rows.map((row, index) => {
                    const recordId = Number(row.id);
                    return (
                      <TableRow key={recordId || index}>
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        {records.columns.map((column) => (
                          <TableCell key={column.id}>
                            {readString(row[column.columnName]) || "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void removeRecord(recordId)}
                            disabled={busy || !recordId}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </UtilitySection>
      ) : null}
    </main>
  );
}
