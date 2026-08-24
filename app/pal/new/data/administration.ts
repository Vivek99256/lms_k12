import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';

/**
 * New PAL → Administration — data layer.
 *
 * Mirrors the Laravel routes registered under `/api/pal/new/administration/*`
 * (App\Http\Controllers\api\PAL\PalArchitectureController), same
 * `{ success, data }` envelope and same `pal.auth` JWT as the rest of PAL.
 *
 * Administration is the control plane for the nine architecture subsystems in
 * the PAL V4 Master Blueprint. Two things arrive together for every subsystem
 * and the UI is built around the pairing:
 *
 *   settings  what this estate has decided — merged from the shipped blueprint
 *             default and the institute's own overrides
 *   health    what is actually running — measured on the server from class
 *             resolution, table presence and row counts, never asserted
 *
 * Nothing in this file describes a subsystem. The panels, their fields, the
 * option lists, the ranges and the labels are all served by the API from
 * config/pal_architecture.php, so adding a parameter to the blueprint is a
 * backend-only change.
 */

// --- helpers ---------------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  return toArray(value)
    .map((item) => readString(item))
    .filter(Boolean);
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

async function callApi(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const method = init.method ?? 'GET';

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
    signal: init.signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverMessage = readString(toRecord(payload).message);

    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to open the Administration workspace.');
    }
    if (response.status === 422) {
      // The server range-checks every parameter against the panel descriptor
      // and names the exact field it rejected, so surface it verbatim.
      throw new Error(serverMessage || 'The server rejected that value.');
    }
    if (response.status === 404) {
      throw new Error(
        serverMessage ||
          'The Administration API is not available on this server. It ships with the New PAL module — the backend may not be deployed yet.'
      );
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the Administration API is unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'Administration request failed.');
  }
  return 'data' in record ? record.data : payload;
}

// --- shared types ----------------------------------------------------------

export type HealthTone = 'good' | 'warn' | 'critical' | 'neutral';
export type SubsystemStatus = 'operational' | 'degraded' | 'inactive' | 'unknown';

export interface HealthMetric {
  label: string;
  value: string;
  tone: HealthTone;
  note: string | null;
}

export interface SubsystemHealth {
  status: SubsystemStatus;
  summary: string;
  metrics: HealthMetric[];
  /** Per-record status chips, keyed by the record's `key`. */
  rowStatus: Record<string, { tone: HealthTone; label: string }>;
}

function mapMetric(raw: unknown): HealthMetric {
  const record = toRecord(raw);
  return {
    label: readString(record.label),
    value: readString(record.value),
    tone: normaliseTone(readString(record.tone)),
    note: readNullableString(record.note),
  };
}

function normaliseTone(value: string): HealthTone {
  return value === 'good' || value === 'warn' || value === 'critical' ? value : 'neutral';
}

function normaliseStatus(value: string): SubsystemStatus {
  return value === 'operational' || value === 'degraded' || value === 'inactive' ? value : 'unknown';
}

function mapHealth(raw: unknown): SubsystemHealth {
  const record = toRecord(raw);

  const rowStatus: SubsystemHealth['rowStatus'] = {};
  Object.entries(toRecord(record.row_status)).forEach(([key, value]) => {
    const entry = toRecord(value);
    rowStatus[key] = {
      tone: normaliseTone(readString(entry.tone)),
      label: readString(entry.label),
    };
  });

  return {
    status: normaliseStatus(readString(record.status)),
    summary: readString(record.summary),
    metrics: toArray(record.metrics).map(mapMetric),
    rowStatus,
  };
}

// --- overview --------------------------------------------------------------

export interface SubsystemSummary {
  key: string;
  label: string;
  tagline: string;
  icon: string;
  sourceDocument: string | null;
  settingGroups: number;
  customisedGroups: number;
  requiresConfirmation: boolean;
  status: SubsystemStatus;
  summary: string;
  metrics: HealthMetric[];
}

export interface AdministrationOverview {
  subsystems: SubsystemSummary[];
  totals: {
    operational: number;
    degraded: number;
    inactive: number;
    unknown: number;
    total: number;
  };
  canWrite: boolean;
  scope: { subInstituteId: number | null; estateWide: boolean };
}

export async function fetchAdministrationOverview(
  signal?: AbortSignal
): Promise<AdministrationOverview> {
  const data = toRecord(await callApi('api/pal/new/administration', { signal }));
  const totals = toRecord(data.totals);
  const scope = toRecord(data.scope);

  return {
    subsystems: toArray(data.subsystems).map((raw) => {
      const record = toRecord(raw);
      return {
        key: readString(record.key),
        label: readString(record.label),
        tagline: readString(record.tagline),
        icon: readString(record.icon),
        sourceDocument: readNullableString(record.source_document),
        settingGroups: readNumber(record.setting_groups),
        customisedGroups: readNumber(record.customised_groups),
        requiresConfirmation: readBoolean(record.requires_confirmation),
        status: normaliseStatus(readString(record.status)),
        summary: readString(record.summary),
        metrics: toArray(record.metrics).map(mapMetric),
      };
    }),
    totals: {
      operational: readNumber(totals.operational),
      degraded: readNumber(totals.degraded),
      inactive: readNumber(totals.inactive),
      unknown: readNumber(totals.unknown),
      total: readNumber(totals.total),
    },
    canWrite: readBoolean(data.can_write),
    scope: {
      subInstituteId: readNullableNumber(scope.sub_institute_id),
      estateWide: readBoolean(scope.estate_wide),
    },
  };
}

// --- panel descriptors -----------------------------------------------------

export type FieldType = 'text' | 'code' | 'number' | 'toggle' | 'select' | 'tags';

/** Shared shape of a params field and a records column — the server uses the same descriptor for both. */
export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  help: string | null;
  options: string[];
  min: number | null;
  max: number | null;
  step: number | null;
  editable: boolean;
  width: 'narrow' | 'wide' | 'auto';
}

function mapField(raw: unknown, defaultEditable: boolean): FieldDescriptor {
  const record = toRecord(raw);
  const width = readString(record.width);

  return {
    key: readString(record.key),
    label: readString(record.label),
    type: (readString(record.type) || 'text') as FieldType,
    help: readNullableString(record.help),
    options: toStringArray(record.options),
    min: readNullableNumber(record.min),
    max: readNullableNumber(record.max),
    step: readNullableNumber(record.step),
    editable: 'editable' in record ? readBoolean(record.editable) : defaultEditable,
    width: width === 'narrow' || width === 'wide' ? width : 'auto',
  };
}

export interface MatrixAxis {
  key: string;
  label: string;
  sublabel: string | null;
}

function mapAxis(raw: unknown): MatrixAxis {
  const record = toRecord(raw);
  return {
    key: readString(record.key),
    label: readString(record.label),
    sublabel: readNullableString(record.sublabel),
  };
}

export type PanelKind = 'live' | 'metrics' | 'params' | 'records' | 'matrix' | 'catalog';

export interface Panel {
  kind: PanelKind;
  key: string;
  title: string;
  help: string | null;
  /** params */
  fields: FieldDescriptor[];
  /** records */
  columns: FieldDescriptor[];
  /** matrix */
  rows: MatrixAxis[];
  matrixColumns: MatrixAxis[];
  rowLabel: string | null;
}

function mapPanel(raw: unknown): Panel {
  const record = toRecord(raw);
  const kind = readString(record.kind) as PanelKind;

  return {
    kind,
    key: readString(record.key),
    title: readString(record.title),
    help: readNullableString(record.help),
    // params fields are editable by definition; records columns declare it.
    fields: kind === 'params' ? toArray(record.fields).map((f) => mapField(f, true)) : [],
    columns: kind === 'records' ? toArray(record.columns).map((c) => mapField(c, false)) : [],
    rows: kind === 'matrix' ? toArray(record.rows).map(mapAxis) : [],
    matrixColumns: kind === 'matrix' ? toArray(record.columns).map(mapAxis) : [],
    rowLabel: readNullableString(record.row_label),
  };
}

// --- subsystem detail ------------------------------------------------------

/** A settings value: a params map, a records list, or a matrix of strings. */
export type SettingsValue = Record<string, unknown> | Record<string, unknown>[];

export interface Subsystem {
  key: string;
  label: string;
  tagline: string;
  icon: string;
  sourceDocument: string | null;
  requiresConfirmation: boolean;
  panels: Panel[];
  settings: Record<string, SettingsValue>;
  customisedGroups: string[];
}

export interface GraphSchemaNode {
  label: string;
  note: string;
  /** null when the graph could not be probed at all. */
  present: boolean | null;
}

export interface GraphSchemaRelationship {
  type: string;
  from: string;
  to: string;
  note: string;
}

export interface CareerVocabularyGroup {
  group: string;
  values: string[];
}

export interface SubsystemCatalog {
  graphNodes: GraphSchemaNode[];
  graphRelationships: GraphSchemaRelationship[];
  graphProbed: boolean;
  careerVocabulary: CareerVocabularyGroup[];
}

// --- live: what the configuration actually produces -------------------------

/**
 * Computed output for a subsystem, from App\Services\PAL\Runtime\SubsystemRuntime.
 *
 * This is the half that makes a subsystem live rather than declarative: the
 * engines are run against the estate's real learner evidence using the
 * administrator's own settings, so editing a parameter visibly moves these
 * numbers. When a subsystem cannot be computed, `available` is false and
 * `reason` says what is missing — it never falls back to a plausible number.
 */
export interface LiveColumn {
  key: string;
  label: string;
  numeric: boolean;
  emphasis: boolean;
}

export interface LiveTable {
  title: string;
  note: string | null;
  columns: LiveColumn[];
  rows: Record<string, string>[];
}

/** One concept in the projected prerequisite DAG. */
export interface LiveGraphNode {
  id: string;
  label: string;
  /** Longest path from a root — the column the node is drawn in. */
  layer: number;
  in: number;
  out: number;
  /** Sits on a prerequisite cycle: a genuine content error. */
  cyclic: boolean;
}

export interface LiveGraphEdge {
  from: string;
  to: string;
}

export interface LiveGraph {
  nodes: LiveGraphNode[];
  edges: LiveGraphEdge[];
  layers: number;
  components: number;
  truncated: boolean;
  hasCycle: boolean;
}

export interface LivePayload {
  available: boolean;
  reason: string | null;
  headline: HealthMetric[];
  tables: LiveTable[];
  /** Non-null only where the subsystem is better drawn than tabulated. */
  graph: LiveGraph | null;
  notes: string[];
}

function mapGraph(raw: unknown): LiveGraph | null {
  if (raw === null || raw === undefined) return null;
  const record = toRecord(raw);
  const nodes = toArray(record.nodes);
  if (nodes.length === 0) return null;

  return {
    nodes: nodes.map((node) => {
      const entry = toRecord(node);
      return {
        id: readString(entry.id),
        label: readString(entry.label),
        layer: readNumber(entry.layer),
        in: readNumber(entry.in),
        out: readNumber(entry.out),
        cyclic: readBoolean(entry.cyclic),
      };
    }),
    edges: toArray(record.edges).map((edge) => {
      const entry = toRecord(edge);
      return { from: readString(entry.from), to: readString(entry.to) };
    }),
    layers: readNumber(record.layers),
    components: readNumber(record.components),
    truncated: readBoolean(record.truncated),
    hasCycle: readBoolean(record.has_cycle),
  };
}

function mapLive(raw: unknown): LivePayload {
  const record = toRecord(raw);

  return {
    available: readBoolean(record.available),
    reason: readNullableString(record.reason),
    headline: toArray(record.headline).map(mapMetric),
    tables: toArray(record.tables).map((table) => {
      const entry = toRecord(table);
      const columns = toArray(entry.columns).map((column) => {
        const col = toRecord(column);
        return {
          key: readString(col.key),
          label: readString(col.label),
          numeric: readBoolean(col.numeric),
          emphasis: readBoolean(col.emphasis),
        };
      });

      return {
        title: readString(entry.title),
        note: readNullableString(entry.note),
        columns,
        // Cells are pre-formatted by the server so the client never re-rounds
        // a probability or re-formats a rate it did not compute.
        rows: toArray(entry.rows).map((row) => {
          const source = toRecord(row);
          const out: Record<string, string> = {};
          columns.forEach((column) => {
            out[column.key] = readString(source[column.key]);
          });
          return out;
        }),
      };
    }),
    graph: mapGraph(record.graph),
    notes: toStringArray(record.notes),
  };
}

export interface SubsystemDetail {
  subsystem: Subsystem;
  health: SubsystemHealth;
  catalog: SubsystemCatalog;
  live: LivePayload;
  canWrite: boolean;
}

function mapDetail(raw: unknown): SubsystemDetail {
  const data = toRecord(raw);
  const subsystem = toRecord(data.subsystem);
  const catalog = toRecord(data.catalog);
  const schema = toRecord(catalog.schema);

  const settings: Record<string, SettingsValue> = {};
  Object.entries(toRecord(subsystem.settings)).forEach(([group, value]) => {
    settings[group] = Array.isArray(value)
      ? (value as Record<string, unknown>[])
      : toRecord(value);
  });

  return {
    subsystem: {
      key: readString(subsystem.key),
      label: readString(subsystem.label),
      tagline: readString(subsystem.tagline),
      icon: readString(subsystem.icon),
      sourceDocument: readNullableString(subsystem.source_document),
      requiresConfirmation: readBoolean(subsystem.requires_confirmation),
      panels: toArray(subsystem.panels).map(mapPanel),
      settings,
      customisedGroups: toStringArray(subsystem.customised_groups),
    },
    health: mapHealth(data.health),
    catalog: {
      graphNodes: toArray(schema.nodes).map((node) => {
        const record = toRecord(node);
        return {
          label: readString(record.label),
          note: readString(record.note),
          present: record.present === null || record.present === undefined
            ? null
            : readBoolean(record.present),
        };
      }),
      graphRelationships: toArray(schema.relationships).map((rel) => {
        const record = toRecord(rel);
        return {
          type: readString(record.type),
          from: readString(record.from),
          to: readString(record.to),
          note: readString(record.note),
        };
      }),
      graphProbed: readBoolean(schema.probed),
      careerVocabulary: toArray(catalog.vocabulary).map((group) => {
        const record = toRecord(group);
        return { group: readString(record.group), values: toStringArray(record.values) };
      }),
    },
    live: mapLive(data.live),
    canWrite: readBoolean(data.can_write),
  };
}

export async function fetchSubsystem(key: string, signal?: AbortSignal): Promise<SubsystemDetail> {
  return mapDetail(await callApi(`api/pal/new/administration/${encodeURIComponent(key)}`, { signal }));
}

/**
 * Save one settings group. The server sanitises before storing — non-editable
 * fields are dropped and unknown records rejected — so the caller may send the
 * whole group back without curating it first.
 */
export async function saveSubsystemGroup(
  key: string,
  group: string,
  value: SettingsValue,
  signal?: AbortSignal
): Promise<SubsystemDetail> {
  return mapDetail(
    await callApi(`api/pal/new/administration/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: { group, value },
      signal,
    })
  );
}

/** Drop the override so the group tracks the shipped blueprint default again. */
export async function resetSubsystemGroup(
  key: string,
  group: string | null,
  signal?: AbortSignal
): Promise<SubsystemDetail> {
  return mapDetail(
    await callApi(`api/pal/new/administration/${encodeURIComponent(key)}/reset`, {
      method: 'POST',
      body: group ? { group } : {},
      signal,
    })
  );
}

// --- presentation helpers --------------------------------------------------

/** Tailwind classes for a health tone. Kept here so every panel agrees. */
export function toneClasses(tone: HealthTone): string {
  switch (tone) {
    case 'good':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warn':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

export function statusTone(status: SubsystemStatus): HealthTone {
  switch (status) {
    case 'operational':
      return 'good';
    case 'degraded':
      return 'warn';
    case 'inactive':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: SubsystemStatus): string {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'degraded':
      return 'Partial';
    case 'inactive':
      return 'Not running';
    default:
      return 'Unknown';
  }
}

/** `self_awareness` → `Self awareness`. Matches the Content Model's humanise(). */
export function humanise(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}
