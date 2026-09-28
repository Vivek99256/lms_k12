'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { List as ListIcon, Plus, Trash2 } from 'lucide-react';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import type {
  MobileHttpMethod,
  MobileListRowControl,
  MobileListSearchField,
  MobileListSubmitAction,
  MobileListSubmitKey,
} from '../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';
const labelClass = 'text-[11px] font-medium text-slate-500';
const sectionClass = 'flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3';
const METHODS: MobileHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * A search step + a repeating row per result -- a class roster to mark
 * attendance against, a student's due fee heads to collect against, or
 * anything else shaped "pick something, then act on a list of records that
 * come back." Unlike every other block, this one owns its own data fetch,
 * its own per-row form state, and its own submit -- see RenderList in
 * MobilePageRenderer.tsx for the runtime half; this file is only the editor
 * (a static mock of what the real thing will look like) and its settings.
 */
export const MobileListBlock = ({
  listTitle,
  searchFields,
  rowControl,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  listTitle?: string;
  searchFields?: MobileListSearchField[];
  rowControl?: MobileListRowControl;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  const fields = searchFields ?? [];
  const control = rowControl ?? { type: 'toggle', trueLabel: 'Present', trueValue: 'P', falseLabel: 'Absent', falseValue: 'A' };

  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <ListIcon className="size-3.5 text-[#0D6EFD]" />
          {listTitle || 'List'}
        </div>

        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fields.map((field) => (
              <span key={field.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                {field.label || field.key}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">No search fields configured yet.</p>
        )}

        <div className="flex flex-col gap-1.5">
          {['Sample row 1', 'Sample row 2'].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">
              <span>{label}</span>
              <RowControlPreview control={control} />
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-center text-[11px] font-semibold text-white">Save</div>
      </div>
    </OverlayWrapper>
  );
};

function RowControlPreview({ control }: { control: MobileListRowControl }) {
  if (control.type === 'toggle') {
    return (
      <span className="flex gap-1">
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">{control.trueLabel}</span>
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">{control.falseLabel}</span>
      </span>
    );
  }
  if (control.type === 'checkbox_amount') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-slate-400">
        <input type="checkbox" disabled className="size-3" /> amount
      </span>
    );
  }
  return <span className="text-[10px] text-slate-400">text</span>;
}

const MobileListBlockSettings = ({ tab }: { tab: 'content' | 'design' | 'list' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  const searchFields: MobileListSearchField[] = Array.isArray(props.searchFields) ? props.searchFields : [];
  const rowControl: MobileListRowControl = props.rowControl ?? { type: 'toggle', trueLabel: 'Present', trueValue: 'P', falseLabel: 'Absent', falseValue: 'A' };
  const submitAction: MobileListSubmitAction = props.submitAction ?? { method: 'POST', endpoint: '', rowKeys: [] };

  const setSearchFields = (next: MobileListSearchField[]) => setProp((p: Record<string, unknown>) => (p.searchFields = next));
  const setRowControl = (next: MobileListRowControl) => setProp((p: Record<string, unknown>) => (p.rowControl = next));
  const setSubmitAction = (patch: Partial<MobileListSubmitAction>) =>
    setProp((p: Record<string, unknown>) => (p.submitAction = { ...submitAction, ...patch }));

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Title</label>
        <input
          type="text"
          value={props.listTitle || ''}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.listTitle = event.target.value))}
          placeholder="Mark Attendance"
          className={fieldClass}
        />
      </div>
    );
  }

  if (tab === 'design') {
    return (
      <PositionControl
        isOverlay={props.isOverlay}
        x={props.x}
        y={props.y}
        zIndex={props.zIndex}
        onChange={(prop, val) => setProp((p: Record<string, unknown>) => (p[prop] = val))}
      />
    );
  }

  // tab === 'list'
  return (
    <div className="flex flex-col gap-5">
      <SearchFieldsSection fields={searchFields} onChange={setSearchFields} />

      <div className={sectionClass}>
        <div className={labelClass}>Search API</div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <select
            value={(props.searchAction as { method?: string })?.method || 'POST'}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.searchAction = { ...(p.searchAction as object), method: event.target.value }))}
            className={fieldClass}
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <input
            type="text"
            value={(props.searchAction as { endpoint?: string })?.endpoint || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.searchAction = { ...(p.searchAction as object), endpoint: event.target.value }))}
            placeholder="student/show_student_attendance"
            spellCheck={false}
            className={`${fieldClass} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Items path in response</label>
          <input
            type="text"
            value={(props.itemsPath as string) || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.itemsPath = event.target.value))}
            placeholder="data"
            spellCheck={false}
            className={`${fieldClass} mt-1 font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Search request body (optional)</label>
          <p className="mb-1 text-[10px] text-slate-400">
            Leave empty to send each search field as-is. Set this to rename/combine them -- e.g. key{' '}
            <code>standard_division</code> = value {'{{standard}}||{{division}}'}.
          </p>
          <ExtraBodyEditor
            value={(props.searchBody as Record<string, string>) ?? {}}
            onChange={(searchBody) => setProp((p: Record<string, unknown>) => (p.searchBody = Object.keys(searchBody).length ? searchBody : null))}
          />
        </div>
      </div>

      <div className={sectionClass}>
        <div className={labelClass}>Row identity</div>
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Id field" value={props.itemIdField as string} onChange={(v) => setProp((p: Record<string, unknown>) => (p.itemIdField = v))} placeholder="id" />
          <LabeledInput label="Label field" value={props.itemLabelField as string} onChange={(v) => setProp((p: Record<string, unknown>) => (p.itemLabelField = v))} placeholder="name" />
          <LabeledInput label="Sub-label field" value={props.itemSubLabelField as string} onChange={(v) => setProp((p: Record<string, unknown>) => (p.itemSubLabelField = v))} placeholder="rollNo" />
        </div>
      </div>

      <RowControlSection control={rowControl} onChange={setRowControl} />

      <div className={sectionClass}>
        <div className={labelClass}>Save API</div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <select value={submitAction.method} onChange={(event) => setSubmitAction({ method: event.target.value as MobileHttpMethod })} className={fieldClass}>
            {METHODS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <input
            type="text"
            value={submitAction.endpoint}
            onChange={(event) => setSubmitAction({ endpoint: event.target.value })}
            placeholder="student/save_student_attendance"
            spellCheck={false}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <RowKeysEditor rowKeys={submitAction.rowKeys} onChange={(rowKeys) => setSubmitAction({ rowKeys })} />

        <div>
          <label className={labelClass}>Extra fixed fields (from the page&apos;s other inputs)</label>
          <ExtraBodyEditor value={submitAction.extraBody ?? {}} onChange={(extraBody) => setSubmitAction({ extraBody })} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Success message" value={submitAction.successMessage} onChange={(v) => setSubmitAction({ successMessage: v })} placeholder="Attendance saved." />
          <LabeledInput label="Error message" value={submitAction.errorMessage} onChange={(v) => setSubmitAction({ errorMessage: v })} placeholder="Could not save." />
        </div>
      </div>
    </div>
  );
};

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      <input type="text" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} spellCheck={false} className={`${fieldClass} font-mono`} />
    </div>
  );
}

function SearchFieldsSection({ fields, onChange }: { fields: MobileListSearchField[]; onChange: (fields: MobileListSearchField[]) => void }) {
  const update = (index: number, patch: Partial<MobileListSearchField>) =>
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));
  const add = () => onChange([...fields, { key: '', label: '', inputType: 'select', required: true }]);

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between">
        <span className={labelClass}>Search fields</span>
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50">
          <Plus className="size-3" /> Add
        </button>
      </div>
      {fields.map((field, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input type="text" value={field.key} onChange={(event) => update(index, { key: event.target.value })} placeholder="key" spellCheck={false} className={`${fieldClass} font-mono`} />
          <input type="text" value={field.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Label" className={fieldClass} />
          <select value={field.inputType} onChange={(event) => update(index, { inputType: event.target.value as MobileListSearchField['inputType'] })} className={fieldClass}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Dropdown</option>
          </select>
          <button type="button" onClick={() => remove(index)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function RowControlSection({ control, onChange }: { control: MobileListRowControl; onChange: (control: MobileListRowControl) => void }) {
  return (
    <div className={sectionClass}>
      <div className={labelClass}>Per-row control</div>
      <select
        value={control.type}
        onChange={(event) => {
          const type = event.target.value as MobileListRowControl['type'];
          if (type === 'toggle') onChange({ type: 'toggle', trueLabel: 'Present', trueValue: 'P', falseLabel: 'Absent', falseValue: 'A' });
          else if (type === 'checkbox_amount') onChange({ type: 'checkbox_amount' });
          else onChange({ type: 'text' });
        }}
        className={fieldClass}
      >
        <option value="toggle">Two-way toggle (e.g. Present / Absent)</option>
        <option value="checkbox_amount">Checkbox + amount (e.g. fee collection)</option>
        <option value="text">Free text per row</option>
      </select>

      {control.type === 'toggle' ? (
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="“True” label" value={control.trueLabel} onChange={(v) => onChange({ ...control, trueLabel: v })} />
          <LabeledInput label="“True” value sent" value={control.trueValue} onChange={(v) => onChange({ ...control, trueValue: v })} />
          <LabeledInput label="“False” label" value={control.falseLabel} onChange={(v) => onChange({ ...control, falseLabel: v })} />
          <LabeledInput label="“False” value sent" value={control.falseValue} onChange={(v) => onChange({ ...control, falseValue: v })} />
        </div>
      ) : null}

      {control.type === 'checkbox_amount' ? (
        <LabeledInput label="Max-amount field (from item data)" value={control.maxField} onChange={(v) => onChange({ ...control, maxField: v })} placeholder="due" />
      ) : null}
    </div>
  );
}

function RowKeysEditor({ rowKeys, onChange }: { rowKeys: MobileListSubmitKey[]; onChange: (rowKeys: MobileListSubmitKey[]) => void }) {
  const update = (index: number, patch: Partial<MobileListSubmitKey>) => onChange(rowKeys.map((k, i) => (i === index ? { ...k, ...patch } : k)));
  const remove = (index: number) => onChange(rowKeys.filter((_, i) => i !== index));
  const add = () => onChange([...rowKeys, { key: '', source: 'value' }]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className={labelClass}>Per-row body keys</label>
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50">
          <Plus className="size-3" /> Add
        </button>
      </div>
      <p className="text-[10px] text-slate-400">
        {'{itemId}'} in the key is replaced with each row&apos;s id. &quot;value&quot; source is what the user set on that row; any other name reads that field from the row&apos;s own data.
      </p>
      {rowKeys.map((rowKey, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            type="text"
            value={rowKey.key}
            onChange={(event) => update(index, { key: event.target.value })}
            placeholder="student[{itemId}]"
            spellCheck={false}
            className={`${fieldClass} font-mono`}
          />
          <input
            type="text"
            value={rowKey.source}
            onChange={(event) => update(index, { source: event.target.value })}
            placeholder="value"
            spellCheck={false}
            className={`${fieldClass} w-24 font-mono`}
          />
          <button type="button" onClick={() => remove(index)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ExtraBodyEditor({ value, onChange }: { value: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
  const entries = Object.entries(value);
  const setEntry = (index: number, key: string, val: string) => {
    const next = [...entries];
    next[index] = [key, val];
    onChange(Object.fromEntries(next));
  };
  const removeEntry = (index: number) => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)));

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {entries.map(([key, val], index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input type="text" value={key} onChange={(event) => setEntry(index, event.target.value, val)} placeholder="payment_mode" className={`${fieldClass} font-mono`} />
          <span className="text-slate-300">=</span>
          <input type="text" value={val} onChange={(event) => setEntry(index, key, event.target.value)} placeholder="{{payment_mode}}" className={`${fieldClass} font-mono`} />
          <button type="button" onClick={() => removeEntry(index)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...value, '': '' })}
        className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
      >
        <Plus className="size-3" /> Add field
      </button>
    </div>
  );
}

MobileListBlock.craft = {
  displayName: 'List',
  props: {
    listTitle: 'List',
    searchFields: [] as MobileListSearchField[],
    searchAction: null,
    searchBody: null,
    itemsPath: 'data',
    itemIdField: 'id',
    itemLabelField: 'name',
    itemSubLabelField: '',
    rowControl: { type: 'toggle', trueLabel: 'Present', trueValue: 'P', falseLabel: 'Absent', falseValue: 'A' } as MobileListRowControl,
    submitAction: { method: 'POST', endpoint: '', rowKeys: [] } as MobileListSubmitAction,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 300,
    zIndex: 5,
  },
  related: {
    settings: MobileListBlockSettings,
  },
};
