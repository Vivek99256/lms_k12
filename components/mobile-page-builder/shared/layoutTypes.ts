/**
 * The Custom Mobile Page JSON schema -- what actually gets persisted
 * (mobile_page_versions.layout_json) and what the production runtime page
 * (app/mobile/custom/[slug]/page.tsx) and the builder's Preview both render
 * from. Validated server-side by MobilePageLayoutValidator.php, which this
 * must stay in lock-step with: a component `type` here that validator does
 * not recognise gets rejected on save, and a `type` it allows that no
 * renderer/block exists for is a silent gap -- so a new component type is
 * always a three-place change (this file, the block, the renderer).
 *
 * Deliberately NOT Craft.js's own serialized node-graph format (which is
 * keyed by generated node ids and carries editor-only concerns like
 * `isCanvas`/`custom`/`hidden`). The editor round-trips between the two via
 * layoutTransform.ts, so this schema stays a small, stable, Craft-independent
 * contract -- the thing a future non-Craft renderer (or a hand-authored page)
 * could also target.
 */

export const MOBILE_COMPONENT_TYPES = [
  'text',
  'image',
  'divider',
  'spacer',
  'input',
  'button',
  'container',
  'card',
  'list',
] as const;

export type MobileComponentType = (typeof MOBILE_COMPONENT_TYPES)[number];

export const CONTAINER_COMPONENT_TYPES: MobileComponentType[] = ['container', 'card'];

export type MobileBackgroundType = 'color' | 'image' | 'gradient';

export type MobileBackground = {
  type: MobileBackgroundType;
  color?: string;
  url?: string;
  size?: 'cover' | 'contain' | 'auto';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  opacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
};

export type MobileDataBinding = {
  /** Dotted path resolved against the page's fetched data object, e.g. "student.name". */
  field: string;
};

export type MobileHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type MobileActionType = 'none' | 'navigate' | 'api';

export type MobileNavigateTarget =
  | { kind: 'page'; slug: string }
  | { kind: 'back' };

export type MobileAction = {
  type: MobileActionType;
  navigate?: MobileNavigateTarget;
  method?: MobileHttpMethod;
  /** Relative API path, e.g. "student/update" -- resolved the same way every other lms_k12 page resolves one (see runtime page). */
  endpoint?: string;
  /** target field name -> a literal value or a {{componentField}} token resolved against sibling input values. */
  body?: Record<string, string>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: { type: 'reload' | 'navigate' | 'goBack'; target?: MobileNavigateTarget };
};

// -- list (a search step + a repeating row per result, e.g. a class roster
// to mark attendance for, or a student's due fee heads to collect against)
// -------------------------------------------------------------------------

/** Same shape as an Input block's own props -- the list's search step is just a small form rendered above the results. */
export type MobileListSearchField = {
  key: string;
  label: string;
  inputType: 'text' | 'number' | 'email' | 'date' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  optionsSource?: { endpoint: string; path?: string } | null;
};

export type MobileListRowControl =
  | { type: 'toggle'; trueLabel: string; trueValue: string; falseLabel: string; falseValue: string }
  | { type: 'checkbox_amount'; maxField?: string }
  | { type: 'text' };

/**
 * One entry submitted per row -- `key` may contain the literal placeholder
 * `{itemId}` (that row's id), producing a dynamic key like
 * `student[{itemId}]` -> `student[42]`. `source` picks what fills it:
 * `'value'` is the row's own current control value (what the user just set);
 * any other string is a dotted path read from that row's ORIGINAL item data
 * (e.g. "monthId" to also emit a sibling key scoped to the row's parent
 * month, not the row's own id) -- see the fees_collection registry entry
 * for why more than one of these is sometimes needed.
 */
export type MobileListSubmitKey = { key: string; source: 'value' | string };

export type MobileListSubmitAction = {
  method: MobileHttpMethod;
  endpoint: string;
  rowKeys: MobileListSubmitKey[];
  /** Fixed fields alongside the per-row ones -- {{field}} tokens resolve against the PAGE's own (non-list) form values, e.g. a Payment Mode Input placed above the list. */
  extraBody?: Record<string, string>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: { type: 'reload' | 'navigate' | 'goBack'; target?: MobileNavigateTarget };
};

export type MobilePageComponentProps = {
  // text
  content?: string;
  variant?: 'body' | 'h1' | 'h2';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  // image
  src?: string;
  objectFit?: 'cover' | 'contain';
  // divider
  thickness?: number;
  // input
  label?: string;
  placeholder?: string;
  field?: string;
  inputType?: 'text' | 'number' | 'email' | 'password' | 'date' | 'select';
  required?: boolean;
  // input (inputType = 'select' only) -- a fixed option list, an API to
  // fetch one from at runtime, or both (options shown immediately, then
  // replaced once optionsSource resolves).
  options?: Array<{ value: string; label: string }>;
  /** `path` is a dotted path into the response (e.g. "data.quotas") when the option list isn't the top-level `data` array -- resolved with the same resolveField() helper used for dataBinding. */
  optionsSource?: { endpoint: string; path?: string } | null;
  // button
  action?: MobileAction;
  // container / card
  direction?: 'column' | 'row';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  // list
  listTitle?: string;
  searchFields?: MobileListSearchField[];
  searchAction?: { method: MobileHttpMethod; endpoint: string } | null;
  /** How the search request body is built from searchFields' current values. Omitted -> one body key per search field, same name, raw value (the common case). Provided -> {{field}} tokens resolved against them instead, for a search API that wants a combined/renamed param (e.g. "standard_division": "{{standard}}||{{division}}"). */
  searchBody?: Record<string, string> | null;
  /** Dotted path into the search response where the row array lives (default "data"). */
  itemsPath?: string;
  /** Which key in each row item is its unique id -- becomes {itemId} in rowKeys/rowKeyTemplate. */
  itemIdField?: string;
  itemLabelField?: string;
  itemSubLabelField?: string;
  rowControl?: MobileListRowControl;
  submitAction?: MobileListSubmitAction | null;
  // shared
  dataBinding?: MobileDataBinding | null;
  [key: string]: unknown;
};

export type MobilePageComponentNode = {
  id: string;
  type: MobileComponentType;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
  props: MobilePageComponentProps;
  children?: MobilePageComponentNode[];
};

export type MobilePageMeta = {
  name: string;
  width: number;
  height: number;
  background: MobileBackground;
  dataSource?: { endpoint: string } | null;
};

export type MobilePageLayout = {
  page: MobilePageMeta;
  components: MobilePageComponentNode[];
};

export const MOBILE_CANVAS_WIDTH = 375;
export const MOBILE_CANVAS_HEIGHT = 812;

export function defaultMobileLayout(name: string): MobilePageLayout {
  return {
    page: {
      name,
      width: MOBILE_CANVAS_WIDTH,
      height: MOBILE_CANVAS_HEIGHT,
      background: { type: 'color', color: '#FFFFFF', opacity: 1 },
      dataSource: null,
    },
    components: [],
  };
}

export const COMPONENT_LABELS: Record<MobileComponentType, string> = {
  text: 'Text',
  image: 'Image',
  divider: 'Divider',
  spacer: 'Spacer',
  input: 'Input',
  button: 'Button',
  container: 'Container',
  card: 'Card',
  list: 'List',
};
