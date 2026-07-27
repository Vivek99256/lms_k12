import {
  isRecord,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
  utilityRequest,
  type UnknownRecord,
} from "../_lib/erp";

/**
 * Custom module — the low-code table designer.
 *
 * Laravel source of truth:
 * `App\Http\Controllers\custom_module\CustomModuleController`, routed under the
 * `custom-module` prefix in `routes/custom_module.php`.
 *   GET    custom-module/tables                              -> tables()
 *   GET    custom-module/table-create/{id?}                  -> tableCreate()
 *   POST   custom-module/table-store                         -> tableStore()
 *   DELETE custom-module/table-delete/{id}                   -> tableDelete()
 *   GET    custom-module/table-column-create/{id}[/column/{colId}] -> tableColumnCreate()
 *   POST   custom-module/table-column-store/{id}             -> tableColumnStore()
 *   DELETE custom-module/table-column-delete/{id}/column/{colId} -> tableColumnDelete()
 *   GET    custom-module/create-db-table/{id}                -> createDBTable()
 *   GET    custom-module/{id}                                -> crudIndex()
 *   DELETE custom-module/view-delete/{id}                    -> viewDelete()
 *   GET    menuLevel2?id={parentMenuId}                      -> menuLevel2()
 */

/** Value lists taken verbatim from the Blade selects — never hardcoded business data. */
export const MODULE_TYPES = ["MASTER", "ENTRY"] as const;

export const HELPER_FUNCTIONS = [
  "Grade,Standard,Division",
  "Grade,Standard",
  "Term,Grade,Standard,Division",
  "Department,Employee",
] as const;

export const COLUMN_TYPE_GROUPS: Array<{ label: string; options: string[] }> = [
  {
    label: "Numbers",
    options: [
      "bigint",
      "decimal",
      "double",
      "float",
      "integer",
      "mediumint",
      "smallint",
      "tinyint",
    ],
  },
  {
    label: "Strings",
    options: ["char", "longtext", "mediumtext", "text", "tinytext", "varchar"],
  },
  {
    label: "Date and time",
    options: ["date", "datetime", "time", "timestamp", "year"],
  },
];

export const COLUMN_INDEXES = ["", "INDEX", "UNIQUE", "PRIMARY"] as const;

export const FIELD_TYPES = [
  { value: "text-field", label: "Text field" },
  { value: "text-area", label: "Text area" },
  { value: "drop-down", label: "Drop down" },
  { value: "checkbox", label: "Check box" },
  { value: "radio-button", label: "Radio button" },
  { value: "File", label: "File" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "mobile", label: "Mobile" },
  { value: "email", label: "Email" },
] as const;

/** Field types whose values come from the comma separated `field_value` list. */
export const CHOICE_FIELD_TYPES = ["drop-down", "checkbox", "radio-button"];

export type CustomModuleSummary = {
  id: number;
  tableName: string;
  moduleName: string;
  moduleType: string;
  /** 1 when the physical MySQL table has been created. */
  tableExists: boolean;
};

export type MenuOption = {
  id: number;
  name: string;
};

export type CustomModuleForm = {
  id: number;
  moduleName: string;
  moduleType: string;
  displayUnder: string;
  level2: string;
  tableName: string;
  migration: string;
  seeder: string;
  model: string;
  controller: string;
  route: string;
  view: string;
  storage: string;
  validation: string;
  accessLink: string;
  helperFunction: string;
  syearWise: boolean;
  includeStudent: boolean;
  includeStaff: boolean;
  tableCreated: boolean;
  displayUnderOptions: MenuOption[];
};

export type CustomModuleColumn = {
  id: number;
  columnName: string;
  type: string;
  length: string;
  notNull: boolean;
  autoIncrement: boolean;
  index: string;
  defaultValue: string;
  fieldType: string;
  fieldValue: string;
};

export type CustomModuleColumnsView = {
  tableId: number;
  tableName: string;
  moduleName: string;
  helperFunction: string;
  syearWise: boolean;
  columns: CustomModuleColumn[];
};

export type CustomModuleRecords = {
  tableId: number;
  tableName: string;
  moduleName: string;
  columns: CustomModuleColumn[];
  rows: UnknownRecord[];
};

const TABLES_PATH = "custom-module/tables";

function bool(value: unknown): boolean {
  const normalized = readString(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

/** `field_value` is stored as a JSON array; the form edits it as a comma list. */
function fieldValueToText(value: unknown): string {
  const raw = readString(value).trim();
  if (!raw) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => readString(entry)).filter(Boolean).join(",");
    }
  } catch {
    // Already a plain comma separated list.
  }
  return raw;
}

export function fieldValueOptions(column: CustomModuleColumn): string[] {
  return column.fieldValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mapColumn(record: UnknownRecord): CustomModuleColumn {
  return {
    id: readNumber(record.id),
    columnName: readString(record.column_name),
    type: readString(record.type),
    length: readString(record.length),
    notNull: bool(record.not_null),
    autoIncrement: bool(record.auto_increment),
    index: readString(record.index),
    defaultValue: readString(record.default),
    fieldType: readString(record.field_type) || "text-field",
    fieldValue: fieldValueToText(record.field_value),
  };
}

export const emptyColumn: CustomModuleColumn = {
  id: 0,
  columnName: "",
  type: "varchar",
  length: "255",
  notNull: false,
  autoIncrement: false,
  index: "",
  defaultValue: "",
  fieldType: "text-field",
  fieldValue: "",
};

export async function loadCustomModules(): Promise<CustomModuleSummary[]> {
  const payload = await utilityRequest(TABLES_PATH);
  return recordArray(payload.data)
    .map((record) => ({
      id: readNumber(record.id),
      tableName: readString(record.table_name),
      moduleName: readString(record.module_name),
      moduleType: readString(record.module_type),
      tableExists: readNumber(record.is_exists) > 0,
    }))
    .filter((entry) => entry.id > 0);
}

export async function loadCustomModuleForm(id = 0): Promise<CustomModuleForm> {
  const payload = await utilityRequest(`custom-module/table-create/${id || ""}`);
  const whereColumns = recordArray(payload.whereColumns).map((record) =>
    readString(record.column_name)
  );

  return {
    id: readNumber(payload.id) || id,
    moduleName: readString(payload.module_name),
    moduleType: readString(payload.module_type) || "MASTER",
    displayUnder: readString(payload.display_under),
    level2: readString(payload.level_2),
    tableName: readString(payload.table_name),
    migration: readString(payload.migration),
    seeder: readString(payload.seeder),
    model: readString(payload.model),
    controller: readString(payload.controller),
    route: readString(payload.route),
    view: readString(payload.view),
    storage: readString(payload.storage),
    validation: readString(payload.validation),
    accessLink: readString(payload.access_link),
    helperFunction: readString(payload.helper_function),
    syearWise: bool(payload.syear_wise),
    // The Blade form derives these two flags from the generated columns.
    includeStudent: whereColumns.includes("Division"),
    includeStaff: whereColumns.includes("staff_mobile"),
    tableCreated: readNumber(payload.tableCreated) > 0,
    displayUnderOptions: recordArray(payload.DisplayUnder)
      .map((record) => ({ id: readNumber(record.id), name: readString(record.name) }))
      .filter((option) => option.id > 0),
  };
}

export async function loadLevel2Menus(parentMenuId: string): Promise<MenuOption[]> {
  if (!parentMenuId) return [];
  const session = requireSession();
  const payload = await utilityRequest("menuLevel2", {
    session,
    query: { id: parentMenuId },
  });
  // menuLevel2() returns a bare array, so the envelope helper unwraps the root.
  const rows = Array.isArray(payload) ? payload : recordArray(payload);
  return recordArray(rows)
    .map((record) => ({ id: readNumber(record.id), name: readString(record.name) }))
    .filter((option) => option.id > 0);
}

export async function saveCustomModule(form: CustomModuleForm): Promise<string> {
  const payload = await utilityRequest("custom-module/table-store", {
    method: "POST",
    body: {
      id: form.id || 0,
      module_name: form.moduleName,
      module_type: form.moduleType,
      display_under: form.displayUnder,
      level_2: form.level2 || null,
      table_name: form.tableName,
      migration: form.migration,
      seeder: form.seeder,
      model: form.model,
      controller: form.controller,
      route: form.route,
      view: form.view,
      storage: form.storage,
      validation: form.validation,
      access_link: form.accessLink,
      helper_function: form.helperFunction || null,
      // `isset()` checks on the controller side: only send when enabled.
      ...(form.syearWise ? { syear_wise: 1 } : {}),
      ...(form.includeStudent ? { student: 1 } : {}),
      ...(form.includeStaff ? { staff: 1 } : {}),
    },
  });
  return messageFrom(payload, "Module saved.");
}

export async function deleteCustomModule(id: number): Promise<string> {
  const payload = await utilityRequest(`custom-module/table-delete/${id}`, {
    method: "POST",
    // Laravel's method override reads `_method` from the query string.
    query: { _method: "DELETE" },
    body: { _method: "DELETE" },
  });
  return messageFrom(payload, "Module deleted.");
}

export async function loadCustomModuleColumns(id: number): Promise<CustomModuleColumnsView> {
  const payload = await utilityRequest(`custom-module/table-column-create/${id}`);
  const table = isRecord(payload.data) ? payload.data : {};
  return {
    tableId: readNumber(table.id) || id,
    tableName: readString(table.table_name),
    moduleName: readString(table.module_name),
    helperFunction: readString(table.helper_function),
    syearWise: bool(table.syear_wise),
    columns: recordArray(table.columns).map(mapColumn),
  };
}

export async function saveCustomModuleColumn(
  tableId: number,
  column: CustomModuleColumn
): Promise<string> {
  const payload = await utilityRequest(`custom-module/table-column-store/${tableId}`, {
    method: "POST",
    body: {
      col_id: column.id || "",
      column_name: column.columnName,
      column_type: column.type,
      column_length: column.length || 0,
      column_index: column.index,
      column_default: column.defaultValue,
      field_type: column.fieldType,
      field_value: column.fieldValue,
      // The controller uses has() for these two, so omit them when unchecked.
      ...(column.notNull ? { column_not_null: 1 } : {}),
      ...(column.autoIncrement ? { column_auto_increment: 1 } : {}),
    },
  });
  return messageFrom(payload, "Column saved.");
}

export async function deleteCustomModuleColumn(
  tableId: number,
  columnId: number
): Promise<string> {
  const payload = await utilityRequest(
    `custom-module/table-column-delete/${tableId}/column/${columnId}`,
    {
      method: "POST",
      query: { _method: "DELETE" },
      body: { _method: "DELETE" },
    }
  );
  return messageFrom(payload, "Column deleted.");
}

/**
 * Creates the physical table (or ALTERs it to match the column list) and
 * registers the module in the menu master with rights for every profile.
 */
export async function applyCustomModuleSchema(tableId: number): Promise<string> {
  const payload = await utilityRequest(`custom-module/create-db-table/${tableId}`);
  return messageFrom(payload, "Table schema applied.");
}

export async function loadCustomModuleRecords(tableId: number): Promise<CustomModuleRecords> {
  const payload = await utilityRequest(`custom-module/${tableId}`, { query: { id: tableId } });
  const table = isRecord(payload.data) ? payload.data : {};
  return {
    tableId: readNumber(table.id) || tableId,
    tableName: readString(table.table_name),
    moduleName: readString(table.module_name),
    columns: recordArray(table.columns).map(mapColumn),
    rows: recordArray(table.view),
  };
}

export async function deleteCustomModuleRecord(
  tableId: number,
  recordId: number,
  tableName: string
): Promise<string> {
  const payload = await utilityRequest(`custom-module/view-delete/${recordId}`, {
    method: "POST",
    query: { _method: "DELETE", table_name: tableName, view_id: String(tableId) },
    body: { _method: "DELETE", table_name: tableName, view_id: tableId },
  });
  return messageFrom(payload, "Record deleted.");
}
