import type { LucideIcon } from 'lucide-react';

/** ---------------------------------------------------------------- fields */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'file'
  | 'image'
  | 'editor'
  | 'hidden'
  | 'repeater';

export type StaticOption = { value: string; label: string };

/** Where a select/multiselect gets its options from. */
export type OptionSource =
  | { kind: 'static'; options: StaticOption[] }
  /**
   * Proxy GET. `params` may reference other form/filter values with
   * `{fieldName}` placeholders (e.g. `{ standard_id: '{standard}' }`);
   * the control reloads whenever a referenced field changes.
   */
  | { kind: 'api'; path: string; params?: Record<string, string>; dataKey?: string }
  /** One of the standard academic dropdowns handled by FilterBar. */
  | { kind: 'chain'; chain: 'term' | 'section' | 'standard' | 'division' };

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  helper?: string;
  /** Form section heading this field is grouped under. */
  section?: string;
  options?: OptionSource;
  defaultValue?: string | string[];
  /** 1–2 columns of the form grid (default 1; textarea/editor default 2). */
  colSpan?: 1 | 2;
  /** Only render when another field has one of these values. */
  showIf?: { field: string; equals: string[] };
  readOnly?: boolean;
  /** For type 'repeater': the row template + labels. */
  repeater?: {
    addLabel: string;
    fields: FieldDef[];
    minRows?: number;
    maxRows?: number;
  };
  /** For file/image inputs. */
  accept?: string;
  /** Original Laravel field name if it differs (e.g. `grade[]`). */
  apiName?: string;
  /** Key to read this field's value from when prefilling an edit form, if it differs from `name` (e.g. list rows expose `standard_id` but the field is named `standard`). */
  seedKey?: string;
};

/** ---------------------------------------------------------------- tables */

export type ColumnDef = {
  key: string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  hidden?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Render value in mono (IDs, codes, marks). */
  mono?: boolean;
  /** Map raw value to a badge tone, e.g. status columns. */
  badge?: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;
};

/** ---------------------------------------------------------------- screens */

export type MasterScreenDef = {
  slug: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Laravel resource endpoints, relative to the API base. */
  api: {
    /** GET list */ index: string;
    /** POST create */ store: string;
    /** POST + _method=PUT, `/{id}` appended */ update?: string;
    /** POST + _method=DELETE, `/{id}` appended */ destroy?: string;
    /**
     * GET `/{id}` for a full record to prefill the edit drawer, when the list
     * payload omits fields the form needs (e.g. only display names, not the
     * underlying option ids). Falls back to the list row when unset.
     */
    show?: string;
  };
  /** Key inside the index payload holding rows (defaults to `data`). */
  listKey?: string;
  columns: ColumnDef[];
  /** Every editable field of the add/edit form, in render order. */
  fields: FieldDef[];
  /** Ordered section headings (sections not listed render last). */
  sectionOrder?: string[];
  /** Uses multipart submit (image/file fields present). */
  multipart?: boolean;
  /** Friendly noun for toasts/dialogs, e.g. "grade scale". */
  entityName: string;
  /** Extra note rendered under the page header. */
  note?: string;
  /**
   * Override the generic bracket-array payload serialization for this screen,
   * for cases where create and update expect different shapes (e.g. arrays
   * on create, scalars with different field names on update).
   */
  serialize?: (
    fields: FieldDef[],
    values: Record<string, unknown>,
    isEdit: boolean,
  ) => { data: Record<string, unknown>; hasFile: boolean };
  /** Shape a fetched `api.show` record into form values before prefilling the edit drawer. */
  deserialize?: (record: Record<string, unknown>) => Record<string, unknown>;
};

export type ScreenLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  category: 'Entry' | 'Master' | 'Report';
};
