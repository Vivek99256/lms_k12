import type { MobileSourceFormPage, MobileSourceListPage, MobileSourcePageDetail } from '@/app/general/mobile_page_builder/api';
import { MOBILE_CANVAS_HEIGHT, MOBILE_CANVAS_WIDTH, type MobileAction, type MobilePageComponentNode, type MobilePageLayout } from './layoutTypes';

const HTTP_METHODS: MobileAction['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function asHttpMethod(value: string): NonNullable<MobileAction['method']> {
  const upper = value.toUpperCase();
  return (HTTP_METHODS.find((method) => method === upper) as NonNullable<MobileAction['method']>) ?? 'POST';
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

const FIELD_TOP_MARGIN = 20;
const HEADING_HEIGHT = 40;
const HEADING_GAP = 20;
const FIELD_HEIGHT = 56;
const FIELD_GAP = 10;
const BUTTON_GAP = 24;
const BUTTON_HEIGHT = 52;

/**
 * "Select Existing Page" -> a starting layout. Two shapes, matching the
 * registry entry's own `type` (see MobileFormFieldRegistry.php's class doc):
 * a fixed field list + one Save button (generateFormLayout), or a single
 * List block owning its own search/rows/save (generateListLayout) for a
 * page shaped "pick something, then act on many records that come back."
 * Either way this is a STARTING POINT, not a finished design -- the admin
 * removes what they don't want and restyles the rest with the builder's
 * normal tools, exactly like anything dragged in by hand.
 */
export function generateLayoutFromSourcePage(source: MobileSourcePageDetail): MobilePageLayout {
  return source.type === 'list' ? generateListLayout(source) : generateFormLayout(source);
}

function generateFormLayout(source: MobileSourceFormPage): MobilePageLayout {
  const components: MobilePageComponentNode[] = [];
  let y = FIELD_TOP_MARGIN;

  components.push({
    id: newId('text'),
    type: 'text',
    position: { x: 20, y },
    size: { width: 335, height: HEADING_HEIGHT },
    props: { content: source.label, variant: 'h1', fontWeight: 'bold' },
  });
  y += HEADING_HEIGHT + HEADING_GAP;

  for (const field of source.fields) {
    components.push({
      id: newId('input'),
      type: 'input',
      position: { x: 20, y },
      size: { width: 335, height: FIELD_HEIGHT },
      props: {
        label: field.label,
        placeholder: field.placeholder || '',
        field: field.key,
        inputType: field.inputType,
        required: field.required,
        options: field.options ?? [],
        optionsSource: field.optionsSource ?? null,
      },
    });
    y += FIELD_HEIGHT + FIELD_GAP;
  }

  // idField (an edit-style endpoint's record id) is still a real Input block
  // above -- its value has to come from somewhere -- but it's excluded from
  // the submit body: the traced real endpoints for every edit-style source
  // page take the id in the URL only, never duplicated into the body too.
  const body: Record<string, string> = {};
  for (const field of source.fields) {
    if (field.key === source.idField) continue;
    body[field.key] = `{{${field.key}}}`;
  }

  y += BUTTON_GAP - FIELD_GAP;
  components.push({
    id: newId('button'),
    type: 'button',
    position: { x: 20, y },
    size: { width: 335, height: BUTTON_HEIGHT },
    props: {
      label: `Save ${source.label}`,
      backgroundColor: '#0D6EFD',
      color: '#FFFFFF',
      borderRadius: 10,
      action: {
        type: 'api',
        method: asHttpMethod(source.submit.method),
        endpoint: source.submit.endpoint,
        body,
        successMessage: source.submit.successMessage || 'Saved.',
        onSuccess: { type: 'goBack' },
      },
    },
  });

  return {
    page: {
      name: source.label,
      width: MOBILE_CANVAS_WIDTH,
      height: MOBILE_CANVAS_HEIGHT,
      background: { type: 'color', color: '#FFFFFF', opacity: 1 },
      dataSource: null,
    },
    components,
  };
}

function generateListLayout(source: MobileSourceListPage): MobilePageLayout {
  const components: MobilePageComponentNode[] = [];
  let y = FIELD_TOP_MARGIN;

  components.push({
    id: newId('text'),
    type: 'text',
    position: { x: 20, y },
    size: { width: 335, height: HEADING_HEIGHT },
    props: { content: source.label, variant: 'h1', fontWeight: 'bold' },
  });
  y += HEADING_HEIGHT + HEADING_GAP;

  const listHeight = MOBILE_CANVAS_HEIGHT - y - FIELD_TOP_MARGIN;
  components.push({
    id: newId('list'),
    type: 'list',
    position: { x: 20, y },
    size: { width: 335, height: Math.max(listHeight, 400) },
    props: {
      listTitle: source.list.title || source.label,
      searchFields: source.list.searchFields.map((field) => ({
        key: field.key,
        label: field.label,
        // Search fields never include password -- fall back to text for
        // that one case since MobileSourceField's wider type is shared with
        // form fields, where it's a real option.
        inputType: field.inputType === 'password' ? 'text' : field.inputType,
        required: field.required,
        placeholder: field.placeholder,
        options: field.options ?? [],
        optionsSource: field.optionsSource ?? null,
      })),
      searchAction: source.list.searchAction,
      searchBody: source.list.searchBody ?? null,
      itemsPath: source.list.itemsPath || 'data',
      itemIdField: source.list.itemIdField,
      itemLabelField: source.list.itemLabelField,
      itemSubLabelField: source.list.itemSubLabelField || '',
      rowControl: source.list.rowControl,
      submitAction: {
        method: asHttpMethod(source.list.submitAction.method),
        endpoint: source.list.submitAction.endpoint,
        rowKeys: source.list.submitAction.rowKeys,
        extraBody: source.list.submitAction.extraBody ?? {},
        successMessage: source.list.submitAction.successMessage || 'Saved.',
        onSuccess: source.list.submitAction.onSuccess ?? { type: 'goBack' },
      },
    },
  });

  return {
    page: {
      name: source.label,
      width: MOBILE_CANVAS_WIDTH,
      height: MOBILE_CANVAS_HEIGHT,
      background: { type: 'color', color: '#FFFFFF', opacity: 1 },
      dataSource: null,
    },
    components,
  };
}
