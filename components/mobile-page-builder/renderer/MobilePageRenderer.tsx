'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { appendCommonParams, buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import { backgroundStyle } from '../shared/backgroundStyle';
import {
  MOBILE_CANVAS_WIDTH,
  type MobileAction,
  type MobileListRowControl,
  type MobileListSearchField,
  type MobileListSubmitAction,
  type MobilePageComponentNode,
  type MobilePageLayout,
} from '../shared/layoutTypes';
import { resolveField, resolveTemplate } from './resolveField';

/**
 * The ONE thing that turns a Custom Mobile Page's JSON into pixels -- used
 * by both the builder's Preview and the production runtime page
 * (app/mobile/custom/[slug]/page.tsx), so they can never drift apart. Plain
 * props in, plain React out: no Craft.js hooks (`useNode`/`useEditor`) here,
 * since this also has to run outside any `<Editor>` context in production.
 *
 * Does not itself decide HOW a button's action executes -- it calls the
 * `onAction` callback the host page supplies with the action config and a
 * snapshot of every Input's current value, and the host (which knows whether
 * it is the live runtime, wired to /api/proxy, or a Preview that only
 * simulates) decides what actually happens. See MobileButtonBlock's own doc
 * for why no endpoint is ever called from inside this component.
 */

type FormContextValue = {
  values: Record<string, string>;
  setValue: (field: string, value: string) => void;
};

const FormContext = createContext<FormContextValue>({ values: {}, setValue: () => {} });

export type MobilePageRendererProps = {
  layout: MobilePageLayout;
  /** The page's fetched data-source response, if any -- resolved against each dataBinding.field. */
  data?: unknown;
  onAction?: (action: MobileAction, formValues: Record<string, string>) => void | Promise<void>;
  /** Scales the whole 375px-wide design to fit a narrower/wider real device viewport, preserving the design 1:1 -- see §16 of the spec. */
  scale?: number;
};

export function MobilePageRenderer({ layout, data, onAction, scale = 1 }: MobilePageRendererProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (field: string, value: string) => {
    if (!field) return;
    setValues((current) => ({ ...current, [field]: value }));
  };

  const formContext = useMemo(() => ({ values, setValue }), [values]);

  const width = layout.page.width || MOBILE_CANVAS_WIDTH;
  const height = layout.page.height;

  return (
    <FormContext.Provider value={formContext}>
      <div style={{ width: width * scale, height: height ? height * scale : undefined }}>
        {/*
          No fixed height/overflow-hidden here on purpose: a component placed
          below the design height (an imported form easily runs longer than
          one screen) must stay reachable. On the runtime page there is no
          phone-frame chrome around this, so the page itself grows and the
          real device/browser scrolls it natively -- the usual mobile
          pattern, and simpler than a scrollbar nested inside a WebView's own
          scroll. In Preview, the surrounding phone-frame chrome (see
          PreviewModal) is what scrolls instead, for the same reason
          MobileScreenRoot scrolls in the editor.
        */}
        <div
          className="relative"
          style={{
            width,
            minHeight: height,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            ...backgroundStyle(layout.page.background),
          }}
        >
          {layout.components.map((node) => (
            <RenderNode key={node.id} node={node} data={data} onAction={onAction} />
          ))}
        </div>
      </div>
    </FormContext.Provider>
  );
}

function PositionedBox({
  node,
  children,
  display = 'block',
}: {
  node: MobilePageComponentNode;
  children: React.ReactNode;
  display?: 'block' | 'flex';
}) {
  const isOverlay = node.props.isOverlay !== false;

  if (!isOverlay) {
    return <div className={display === 'flex' ? 'relative flex' : 'relative w-full'}>{children}</div>;
  }

  const zIndex = typeof node.props.zIndex === 'number' ? node.props.zIndex : 10;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex,
        width: node.size.width,
        height: node.size.height,
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

function RenderNode({
  node,
  data,
  onAction,
}: {
  node: MobilePageComponentNode;
  data: unknown;
  onAction?: MobilePageRendererProps['onAction'];
}) {
  switch (node.type) {
    case 'text':
      return (
        <PositionedBox node={node}>
          <RenderText node={node} data={data} />
        </PositionedBox>
      );
    case 'image':
      return (
        <PositionedBox node={node}>
          <RenderImage node={node} data={data} />
        </PositionedBox>
      );
    case 'divider':
      return (
        <PositionedBox node={node}>
          <div style={{ backgroundColor: (node.props.color as string) || '#E5E7EB', height: (node.props.thickness as number) || 1, width: '100%' }} />
        </PositionedBox>
      );
    case 'spacer':
      return <PositionedBox node={node}>{null}</PositionedBox>;
    case 'input':
      return (
        <PositionedBox node={node}>
          <RenderInput node={node} data={data} />
        </PositionedBox>
      );
    case 'button':
      return (
        <PositionedBox node={node}>
          <RenderButton node={node} onAction={onAction} />
        </PositionedBox>
      );
    case 'container':
    case 'card':
      return (
        <PositionedBox node={node}>
          <RenderContainer node={node} data={data} onAction={onAction} />
        </PositionedBox>
      );
    case 'list':
      return (
        <PositionedBox node={node}>
          <RenderList node={node} onAction={onAction} />
        </PositionedBox>
      );
    default:
      return null;
  }
}

function RenderText({ node, data }: { node: MobilePageComponentNode; data: unknown }) {
  const binding = node.props.dataBinding as { field: string } | null | undefined;
  const bound = binding?.field ? resolveField(data, binding.field) : undefined;
  const text = bound !== undefined && bound !== null ? String(bound) : (node.props.content as string) || '';
  const variant = (node.props.variant as string) || 'body';
  const fontSize = Number(node.props.fontSize) || 16;

  return (
    <div
      className="w-full break-words"
      style={{
        fontSize: variant === 'h1' ? Math.max(fontSize, 28) : variant === 'h2' ? Math.max(fontSize, 20) : fontSize,
        fontWeight: variant !== 'body' || node.props.fontWeight === 'bold' ? 700 : 400,
        color: (node.props.color as string) || '#111827',
        textAlign: (node.props.alignment as React.CSSProperties['textAlign']) || 'left',
      }}
    >
      {text}
    </div>
  );
}

function RenderImage({ node, data }: { node: MobilePageComponentNode; data: unknown }) {
  const binding = node.props.dataBinding as { field: string } | null | undefined;
  const bound = binding?.field ? resolveField(data, binding.field) : undefined;
  const src = (bound !== undefined && bound !== null ? String(bound) : (node.props.src as string)) || '';

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-slate-100" style={{ borderRadius: (node.props.borderRadius as number) || 0 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full" style={{ objectFit: (node.props.objectFit as React.CSSProperties['objectFit']) || 'cover' }} />
      ) : (
        <ImageIcon className="size-6 text-slate-300" />
      )}
    </div>
  );
}

type SelectOption = { value: string; label: string };

/**
 * The one place this renderer calls a live API directly rather than through
 * the host's onAction/data props -- an <Input inputType="select"> whose
 * options come from an existing ERP endpoint (e.g. a dropdown list) needs to
 * load them itself. Same auth as everything else here: the viewer's own
 * bearer token via /api/proxy, so a dropdown can only ever see what that
 * endpoint already lets this viewer see.
 */
async function fetchOptionsFromApi(endpoint: string, path?: string): Promise<SelectOption[]> {
  const session = buildSessionContext();
  if (!session.token) return [];

  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${endpoint}`)}&${params.toString()}`, {
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });
  if (!response.ok) return [];

  const payload: unknown = await response.json();
  const rows = resolveField(payload, path || 'data');
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): SelectOption | null => {
      if (!row || typeof row !== 'object') return null;
      const record = row as Record<string, unknown>;
      const value = record.value ?? record.id;
      const label = record.label ?? record.name;
      return value !== undefined && label !== undefined ? { value: String(value), label: String(label) } : null;
    })
    .filter((option): option is SelectOption => option !== null);
}

/** Same auth/proxy path as fetchOptionsFromApi, generalized to any method+body -- what a List block's search step calls. */
async function fetchJsonFromApi(endpoint: string, method: string, body?: Record<string, string>): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.token) return null;

  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${endpoint}`)}&${params.toString()}`, {
    cache: 'no-store',
    method,
    headers: createAuthHeaders(session, body ? 'application/json' : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) return null;
  return response.json();
}

function useSelectOptions(staticOptions: SelectOption[] | undefined, optionsSource: { endpoint: string; path?: string } | null | undefined): SelectOption[] {
  const [fetched, setFetched] = useState<SelectOption[] | null>(null);

  useEffect(() => {
    // Clears a previous endpoint's options immediately when the source
    // changes, so a switched dropdown never briefly shows the wrong list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetched(null);
    if (!optionsSource?.endpoint) return;
    let cancelled = false;
    fetchOptionsFromApi(optionsSource.endpoint, optionsSource.path).then((options) => {
      if (!cancelled && options.length > 0) setFetched(options);
    });
    return () => {
      cancelled = true;
    };
  }, [optionsSource?.endpoint, optionsSource?.path]);

  return fetched ?? staticOptions ?? [];
}

function RenderInput({ node, data }: { node: MobilePageComponentNode; data: unknown }) {
  const { values, setValue } = useContext(FormContext);
  const field = (node.props.field as string) || '';
  const binding = node.props.dataBinding as { field: string } | null | undefined;
  const inputType = (node.props.inputType as string) || 'text';
  const options = useSelectOptions(node.props.options as SelectOption[] | undefined, node.props.optionsSource as { endpoint: string; path?: string } | null | undefined);

  const initial = useMemo(() => {
    if (values[field] !== undefined) return values[field];
    const bound = binding?.field ? resolveField(data, binding.field) : undefined;
    return bound !== undefined && bound !== null ? String(bound) : '';
    // Seed once from data; further edits live in the form context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (field && values[field] === undefined && initial !== '') setValue(field, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);

  const currentValue = values[field] ?? initial;
  const fieldClass = 'h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400';

  return (
    <div className="flex h-full w-full flex-col gap-1">
      {node.props.label ? (
        <span className="text-xs font-medium text-slate-600">
          {node.props.label as string}
          {node.props.required ? <span className="text-red-500"> *</span> : null}
        </span>
      ) : null}
      {inputType === 'select' ? (
        <select value={currentValue} onChange={(event) => setValue(field, event.target.value)} className={fieldClass}>
          <option value="" disabled>
            {(node.props.placeholder as string) || 'Select…'}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={inputType}
          value={currentValue}
          onChange={(event) => setValue(field, event.target.value)}
          placeholder={(node.props.placeholder as string) || ''}
          className={fieldClass}
        />
      )}
    </div>
  );
}

function RenderButton({ node, onAction }: { node: MobilePageComponentNode; onAction?: MobilePageRendererProps['onAction'] }) {
  const { values } = useContext(FormContext);
  const action = (node.props.action as MobileAction) || { type: 'none' };

  return (
    <button
      type="button"
      onClick={() => {
        if (action.type === 'none' || !onAction) return;
        void onAction(action, values);
      }}
      style={{
        backgroundColor: (node.props.backgroundColor as string) || '#0D6EFD',
        color: (node.props.color as string) || '#FFFFFF',
        borderRadius: (node.props.borderRadius as number) ?? 10,
      }}
      className="flex h-full w-full items-center justify-center text-sm font-semibold"
    >
      {(node.props.label as string) || 'Button'}
    </button>
  );
}

function RenderContainer({
  node,
  data,
  onAction,
}: {
  node: MobilePageComponentNode;
  data: unknown;
  onAction?: MobilePageRendererProps['onAction'];
}) {
  const direction = (node.props.direction as string) === 'row' ? 'row' : 'column';

  return (
    <div
      className="relative flex h-full w-full"
      style={{
        flexDirection: direction as React.CSSProperties['flexDirection'],
        backgroundColor: node.props.backgroundColor as string,
        borderColor: node.props.borderColor as string,
        borderWidth: (node.props.borderWidth as number) || undefined,
        borderStyle: node.props.borderWidth ? 'solid' : undefined,
        borderRadius: node.props.borderRadius as number,
        padding: node.props.padding as number,
        gap: node.props.gap as number,
      }}
    >
      {(node.children ?? []).map((child) => (
        <RenderNode key={child.id} node={child} data={data} onAction={onAction} />
      ))}
    </div>
  );
}

/**
 * Search step + repeating rows + a Save that sends every row's current
 * state in one request -- a class roster to mark attendance for, a
 * student's due fee heads to collect against. Owns its own fetch for the
 * search (a read, safe to run live even in Preview -- same reasoning as
 * useSelectOptions), but hands the actual Save off to the host's `onAction`
 * exactly like a Button does, so Preview can simulate it the same way.
 *
 * Search-field values and per-row values both live in the SAME shared
 * FormContext every other Input already uses -- search fields under their
 * own key (so a Save action's extraBody can reference "{{date}}" the same
 * way it references any other field), row values namespaced
 * `${this list's node id}.${itemId}` so two lists on one page can never
 * collide.
 */

/** `fieldSpec` is usually one key ("name"); a space-separated list ("first_name last_name") joins several fields into one label, for a row source with no single combined name field. */
function readItemLabel(item: Record<string, unknown>, fieldSpec: string): string {
  return fieldSpec
    .split(/\s+/)
    .filter(Boolean)
    .map((key) => item[key])
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(' ');
}

function RenderList({ node, onAction }: { node: MobilePageComponentNode; onAction?: MobilePageRendererProps['onAction'] }) {
  const { values, setValue } = useContext(FormContext);
  const searchFields = (node.props.searchFields as MobileListSearchField[]) ?? [];
  const searchAction = node.props.searchAction as { method: string; endpoint: string } | null | undefined;
  const itemsPath = (node.props.itemsPath as string) || 'data';
  const itemIdField = (node.props.itemIdField as string) || 'id';
  const itemLabelField = (node.props.itemLabelField as string) || 'name';
  const itemSubLabelField = node.props.itemSubLabelField as string | undefined;
  const rowControl: MobileListRowControl =
    (node.props.rowControl as MobileListRowControl) || { type: 'toggle', trueLabel: 'Yes', trueValue: '1', falseLabel: 'No', falseValue: '0' };
  const submitAction = node.props.submitAction as MobileListSubmitAction | null | undefined;

  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rowFormKey = (itemId: string, suffix?: string) => `${node.id}.${itemId}${suffix ? `.${suffix}` : ''}`;

  const runSearch = async () => {
    if (!searchAction?.endpoint) return;
    setSearching(true);
    setError('');
    try {
      const searchBody = node.props.searchBody as Record<string, string> | null | undefined;
      const body: Record<string, string> = searchBody
        ? Object.fromEntries(Object.entries(searchBody).map(([key, template]) => [key, resolveTemplate(template, values)]))
        : Object.fromEntries(searchFields.map((field) => [field.key, values[field.key] ?? '']));

      // {{field}} tokens in the endpoint itself -- e.g. "fees/collect/{{student_id}}/edit" -- for a
      // lookup-by-id search rather than a search that returns many candidates.
      const endpoint = resolveTemplate(searchAction.endpoint, values);
      const payload = await fetchJsonFromApi(endpoint, searchAction.method || 'POST', body);
      const rows = resolveField(payload, itemsPath);
      const list = Array.isArray(rows) ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : [];
      setItems(list);
      setSearched(true);

      for (const item of list) {
        const itemId = String(item[itemIdField] ?? '');
        if (!itemId) continue;
        if (rowControl.type === 'toggle' && values[rowFormKey(itemId)] === undefined) {
          setValue(rowFormKey(itemId), rowControl.trueValue);
        } else if (rowControl.type === 'checkbox_amount' && values[rowFormKey(itemId, 'amount')] === undefined) {
          const max = rowControl.maxField ? item[rowControl.maxField] : undefined;
          setValue(rowFormKey(itemId, 'amount'), max !== undefined ? String(max) : '0');
        }
      }
    } catch {
      setError('The search could not be completed.');
    } finally {
      setSearching(false);
    }
  };

  const runSave = async () => {
    if (!submitAction?.endpoint || !onAction) return;
    setSaving(true);
    try {
      const rowBody: Record<string, string> = {};
      for (const item of items) {
        const itemId = String(item[itemIdField] ?? '');
        if (!itemId) continue;

        // checkbox_amount rows the admin left unchecked contribute nothing
        // -- the same as a real HTML checkbox never submitting its key.
        const included = rowControl.type !== 'checkbox_amount' || values[rowFormKey(itemId, 'checked')] === '1';
        if (!included) continue;

        for (const rowKey of submitAction.rowKeys) {
          const key = rowKey.key.replace('{itemId}', itemId);
          let value: string;
          if (rowKey.source === 'value') value = values[rowFormKey(itemId)] ?? '';
          else if (rowKey.source === 'checked') value = 'on';
          else if (rowKey.source === 'amount') value = values[rowFormKey(itemId, 'amount')] ?? '';
          else value = String(item[rowKey.source] ?? '');
          rowBody[key] = value;
        }
      }

      const action: MobileAction = {
        type: 'api',
        method: submitAction.method,
        endpoint: submitAction.endpoint,
        body: { ...rowBody, ...(submitAction.extraBody ?? {}) },
        successMessage: submitAction.successMessage,
        errorMessage: submitAction.errorMessage,
        onSuccess: submitAction.onSuccess,
      };
      await onAction(action, values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
      {node.props.listTitle ? <div className="text-sm font-semibold text-slate-800">{node.props.listTitle as string}</div> : null}

      {searchFields.length > 0 ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-2">
          {searchFields.map((field) => (
            <SearchFieldControl key={field.key} field={field} value={values[field.key] ?? ''} onChange={(next) => setValue(field.key, next)} />
          ))}
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {!searched ? (
          <p className="text-xs text-slate-400">Search to load records.</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400">No records found.</p>
        ) : (
          items.map((item) => {
            const itemId = String(item[itemIdField] ?? '');
            return (
              <RowView
                key={itemId}
                label={readItemLabel(item, itemLabelField) || itemId}
                subLabel={itemSubLabelField ? readItemLabel(item, itemSubLabelField) : undefined}
                control={rowControl}
                value={values[rowFormKey(itemId)] ?? ''}
                checked={values[rowFormKey(itemId, 'checked')] === '1'}
                amount={values[rowFormKey(itemId, 'amount')] ?? ''}
                max={rowControl.type === 'checkbox_amount' && rowControl.maxField ? String(item[rowControl.maxField] ?? '') : undefined}
                onValueChange={(next) => setValue(rowFormKey(itemId), next)}
                onCheckedChange={(next) => setValue(rowFormKey(itemId, 'checked'), next ? '1' : '')}
                onAmountChange={(next) => setValue(rowFormKey(itemId, 'amount'), next)}
              />
            );
          })
        )}
      </div>

      {submitAction?.endpoint && items.length > 0 ? (
        <button
          type="button"
          onClick={() => void runSave()}
          disabled={saving}
          className="mt-1 rounded-lg bg-[#0D6EFD] py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      ) : null}
    </div>
  );
}

function SearchFieldControl({ field, value, onChange }: { field: MobileListSearchField; value: string; onChange: (value: string) => void }) {
  const options = useSelectOptions(field.options, field.optionsSource);
  const controlClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-400';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-500">{field.label}</label>
      {field.inputType === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
          <option value="" disabled>
            {field.placeholder || 'Select…'}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input type={field.inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={controlClass} />
      )}
    </div>
  );
}

function RowView({
  label,
  subLabel,
  control,
  value,
  checked,
  amount,
  max,
  onValueChange,
  onCheckedChange,
  onAmountChange,
}: {
  label: string;
  subLabel?: string;
  control: MobileListRowControl;
  value: string;
  checked: boolean;
  amount: string;
  max?: string;
  onValueChange: (value: string) => void;
  onCheckedChange: (checked: boolean) => void;
  onAmountChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-700">{label}</div>
        {subLabel ? <div className="truncate text-[10px] text-slate-400">{subLabel}</div> : null}
      </div>

      {control.type === 'toggle' ? (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onValueChange(control.trueValue)}
            className={`rounded-lg px-2 py-1 text-[11px] font-medium ${value === control.trueValue ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {control.trueLabel}
          </button>
          <button
            type="button"
            onClick={() => onValueChange(control.falseValue)}
            className={`rounded-lg px-2 py-1 text-[11px] font-medium ${value === control.falseValue ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {control.falseLabel}
          </button>
        </div>
      ) : control.type === 'checkbox_amount' ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="size-3.5" />
          <input
            type="number"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            disabled={!checked}
            max={max}
            min={0}
            className="h-8 w-20 rounded-lg border border-slate-200 px-1.5 text-xs disabled:opacity-50"
          />
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-8 w-28 shrink-0 rounded-lg border border-slate-200 px-1.5 text-xs"
        />
      )}
    </div>
  );
}

/** Resolved once per action call so callers don't each reimplement {{token}} substitution. */
export function resolveActionBody(action: MobileAction, formValues: Record<string, string>): Record<string, string> {
  const body = action.body ?? {};
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, resolveTemplate(value, formValues)]));
}

/**
 * Same {{token}} substitution, applied to the endpoint PATH -- an edit/update
 * action almost always targets one specific record
 * ("get_adminStudentSearch/{{id}}"), not a fixed URL the way a create action
 * does. `id` (or whatever field holds it) is typically a hidden/pre-filled
 * Input bound via dataBinding to the page's own data source, resolved the
 * same as any other form value by the time this runs.
 */
export function resolveActionEndpoint(action: MobileAction, formValues: Record<string, string>): string {
  return resolveTemplate(action.endpoint ?? '', formValues);
}
