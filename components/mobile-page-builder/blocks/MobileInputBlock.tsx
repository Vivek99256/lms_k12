'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { DataBindingControl } from '../editor/settings/DataBindingControl';
import type { MobileDataBinding } from '../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

type InputType = 'text' | 'number' | 'email' | 'password' | 'date' | 'select';
type SelectOption = { value: string; label: string };

export const MobileInputBlock = ({
  label,
  placeholder,
  field,
  inputType = 'text',
  required,
  options,
  dataBinding,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  label?: string;
  placeholder?: string;
  field?: string;
  inputType?: InputType;
  required?: boolean;
  options?: SelectOption[];
  dataBinding?: MobileDataBinding | null;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  const placeholderText = dataBinding?.field
    ? `{{${dataBinding.field}}}`
    : inputType === 'select'
      ? options?.[0]?.label || placeholder || 'Select…'
      : placeholder || `field: ${field || '(unset)'}`;

  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <div className="flex h-full w-full flex-col gap-1">
        {label ? (
          <span className="text-xs font-medium text-slate-600">
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </span>
        ) : null}
        <div className="flex flex-1 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400">
          <span className="truncate">{placeholderText}</span>
          {inputType === 'select' ? <ChevronDown className="size-3.5 shrink-0" /> : null}
        </div>
      </div>
    </OverlayWrapper>
  );
};

const INPUT_TYPES: Array<{ value: InputType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
];

const MobileInputBlockSettings = ({ tab }: { tab: 'content' | 'design' | 'data' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  const options: SelectOption[] = Array.isArray(props.options) ? props.options : [];

  const setOption = (index: number, patch: Partial<SelectOption>) => {
    const next = options.map((option, i) => (i === index ? { ...option, ...patch } : option));
    setProp((p: Record<string, unknown>) => (p.options = next));
  };

  const removeOption = (index: number) => {
    setProp((p: Record<string, unknown>) => (p.options = options.filter((_, i) => i !== index)));
  };

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Label</label>
          <input
            type="text"
            value={props.label || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.label = event.target.value))}
            className={fieldClass}
          />
        </div>

        {props.inputType !== 'select' ? (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">Placeholder</label>
            <input
              type="text"
              value={props.placeholder || ''}
              onChange={(event) => setProp((p: Record<string, unknown>) => (p.placeholder = event.target.value))}
              className={fieldClass}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Field name</label>
          <input
            type="text"
            value={props.field || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.field = event.target.value))}
            placeholder="student_name"
            spellCheck={false}
            className={`${fieldClass} font-mono`}
          />
          <p className="text-[10px] text-slate-400">
            Referenced from a Button action&apos;s body as {'{{'}fieldName{'}}'}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">Type</label>
            <select
              value={props.inputType || 'text'}
              onChange={(event) => setProp((p: Record<string, unknown>) => (p.inputType = event.target.value))}
              className={fieldClass}
            >
              {INPUT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(props.required)}
              onChange={(event) => setProp((p: Record<string, unknown>) => (p.required = event.target.checked))}
            />
            Required
          </label>
        </div>

        {props.inputType === 'select' ? (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-500">Options</label>
              <button
                type="button"
                onClick={() => setProp((p: Record<string, unknown>) => (p.options = [...options, { value: '', label: '' }]))}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
              >
                <Plus className="size-3" /> Add
              </button>
            </div>
            {options.length === 0 ? (
              <p className="text-[10px] text-slate-400">No fixed options yet -- add one, or set an Options API below.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(event) => setOption(index, { label: event.target.value })}
                      placeholder="Label"
                      className={fieldClass}
                    />
                    <input
                      type="text"
                      value={option.value}
                      onChange={(event) => setOption(index, { value: event.target.value })}
                      placeholder="value"
                      spellCheck={false}
                      className={`${fieldClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-500">Options API (optional)</label>
              <input
                type="text"
                value={(props.optionsSource as { endpoint?: string; path?: string } | null | undefined)?.endpoint || ''}
                onChange={(event) => {
                  const endpoint = event.target.value.trim();
                  const path = (props.optionsSource as { path?: string } | null | undefined)?.path;
                  setProp((p: Record<string, unknown>) => (p.optionsSource = endpoint ? { endpoint, path } : null));
                }}
                placeholder="student-registration/metadata"
                spellCheck={false}
                className={`${fieldClass} font-mono`}
              />
              {props.optionsSource ? (
                <input
                  type="text"
                  value={(props.optionsSource as { path?: string } | null | undefined)?.path || ''}
                  onChange={(event) => {
                    const source = props.optionsSource as { endpoint: string } | null | undefined;
                    if (!source?.endpoint) return;
                    const path = event.target.value.trim();
                    setProp((p: Record<string, unknown>) => (p.optionsSource = { endpoint: source.endpoint, path: path || undefined }));
                  }}
                  placeholder="data (or e.g. data.quotas if nested)"
                  spellCheck={false}
                  className={`${fieldClass} mt-1 font-mono`}
                />
              ) : null}
              <p className="text-[10px] text-slate-400">
                A relative API returning options at runtime -- replaces the fixed list above once it loads.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === 'data') {
    return (
      <DataBindingControl
        dataBinding={props.dataBinding}
        onChange={(value) => setProp((p: Record<string, unknown>) => (p.dataBinding = value))}
        placeholder="student.name"
      />
    );
  }

  return (
    <PositionControl
      isOverlay={props.isOverlay}
      x={props.x}
      y={props.y}
      zIndex={props.zIndex}
      onChange={(prop, val) => setProp((p: Record<string, unknown>) => (p[prop] = val))}
    />
  );
};

MobileInputBlock.craft = {
  displayName: 'Input',
  props: {
    label: 'Label',
    placeholder: '',
    field: '',
    inputType: 'text',
    required: false,
    options: [],
    optionsSource: null,
    dataBinding: null,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 50,
    zIndex: 10,
  },
  related: {
    settings: MobileInputBlockSettings,
  },
};
