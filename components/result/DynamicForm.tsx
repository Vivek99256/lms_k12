'use client';

/**
 * Config-driven form renderer (React Hook Form + Zod).
 *
 * Renders every field type used by the Result module Blade screens:
 * text, textarea, number, date, select, multiselect, radio, checkbox,
 * toggle, file, image (with preview), HTML editor (code + live preview)
 * and repeaters (dynamic row groups such as sub-activities / grade rows).
 *
 * Select options come from static lists, proxy API endpoints (with
 * `{placeholder}` params resolved against live form values) or the
 * standard academic chain (term / section / standard / division).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Code2, Eye, ImageIcon, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { resultGet, toOptions, readString, type SelectOption } from '@/lib/result/api';
import type { FieldDef } from '@/lib/result/types';
import { Checkbox, Switch } from './primitives';
import { cn } from '@/lib/utils';

export type FormValues = Record<string, unknown>;

/* ------------------------------------------------------------ zod schema */

function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === 'hidden') {
      shape[field.name] = z.any();
      continue;
    }
    if (field.type === 'multiselect') {
      shape[field.name] = field.required
        ? z.array(z.string()).min(1, `${field.label} is required`)
        : z.array(z.string()).optional();
      continue;
    }
    if (field.type === 'repeater') {
      shape[field.name] = z.array(z.record(z.string(), z.any())).optional();
      continue;
    }
    if (field.type === 'checkbox' || field.type === 'toggle') {
      shape[field.name] = z.boolean().optional();
      continue;
    }
    if (field.type === 'file' || field.type === 'image') {
      shape[field.name] = field.required
        ? z.custom<File | string>((value) => value instanceof File || (typeof value === 'string' && value.length > 0), `${field.label} is required`)
        : z.any().optional();
      continue;
    }
    let schema = z.string();
    if (field.maxLength) schema = schema.max(field.maxLength, `${field.label} must be at most ${field.maxLength} characters`);
    shape[field.name] = field.required ? schema.min(1, `${field.label} is required`) : schema.optional().or(z.literal(''));
  }
  return z.object(shape);
}

export function defaultsFor(fields: FieldDef[], seed?: FormValues): FormValues {
  const defaults: FormValues = {};
  for (const field of fields) {
    const seeded = seed?.[field.seedKey ?? field.name];
    if (field.type === 'multiselect') {
      defaults[field.name] = Array.isArray(seeded)
        ? seeded.map(readString)
        : readString(seeded) ? readString(seeded).split(',') : (field.defaultValue as string[] | undefined) ?? [];
    } else if (field.type === 'repeater') {
      defaults[field.name] = Array.isArray(seeded) ? seeded : [];
    } else if (field.type === 'checkbox' || field.type === 'toggle') {
      defaults[field.name] = seeded != null ? ['1', 'true', 'y', 'yes', 'on'].includes(readString(seeded).toLowerCase()) : field.defaultValue === '1';
    } else if (field.type === 'file' || field.type === 'image') {
      defaults[field.name] = readString(seeded);
    } else {
      defaults[field.name] = readString(seeded ?? field.defaultValue ?? '');
    }
  }
  return defaults;
}

/* ------------------------------------------------------- option loading */

function useFieldOptions(fields: FieldDef[], values: FormValues) {
  const { academicTerms } = useAuth();
  const [optionsMap, setOptionsMap] = useState<Record<string, SelectOption[]>>({});

  const termOptions = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return toOptions(
      academicTerms.filter((item) => {
        const year = readString((item as Record<string, unknown>).syear);
        return !selectedAcademicYear || !year || year === selectedAcademicYear;
      }),
    );
  }, [academicTerms]);

  const selectFields = useMemo(
    () => fields.filter((field) => (field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && field.options),
    [fields],
  );

  const depsKey = selectFields
    .map((field) => {
      const source = field.options!;
      if (source.kind === 'chain' && source.chain === 'standard') return `${field.name}:chain:${readString(values.grade)}`;
      if (source.kind === 'chain' && source.chain === 'division') return `${field.name}:chain:${readString(values.standard)}`;
      if (source.kind !== 'api') return `${field.name}:${source.kind}`;
      const resolved: string[] = [];
      for (const template of Object.values(source.params ?? {})) {
        const match = template.match(/^\{(.+)\}$/);
        resolved.push(match ? readString(values[match[1]]) : template);
      }
      return `${field.name}:${resolved.join(',')}`;
    })
    .join('|');

  useEffect(() => {
    let cancelled = false;
    for (const field of selectFields) {
      const source = field.options!;
      if (source.kind === 'static') {
        setOptionsMap((current) =>
          current[field.name] ? current : { ...current, [field.name]: source.options.map((option) => ({ id: option.value, label: option.label })) },
        );
        continue;
      }
      if (source.kind === 'chain') {
        if (source.chain === 'term') {
          setOptionsMap((current) => ({ ...current, [field.name]: termOptions }));
          continue;
        }
        const chainCalls: Record<string, { path: string; params: Record<string, string> }> = {
          section: { path: 'api/get-grade-list', params: {} },
          standard: { path: 'api/get-standard-list', params: { type: 'webForm', grade_id: readString(values.grade) } },
          division: { path: 'api/get-division-list', params: { type: 'webForm', standard_id: readString(values.standard) } },
        };
        const call = chainCalls[source.chain];
        if (source.chain === 'standard' && !readString(values.grade)) {
          setOptionsMap((current) => ({ ...current, [field.name]: [] }));
          continue;
        }
        if (source.chain === 'division' && !readString(values.standard)) {
          setOptionsMap((current) => ({ ...current, [field.name]: [] }));
          continue;
        }
        void resultGet(call.path, call.params)
          .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, [field.name]: toOptions(payload.data ?? payload) })); })
          .catch(() => { if (!cancelled) setOptionsMap((current) => (current[field.name]?.length ? current : { ...current, [field.name]: [] })); });
        continue;
      }
      // api source
      const resolved: Record<string, string> = {};
      let ready = true;
      for (const [key, template] of Object.entries(source.params ?? {})) {
        const match = template.match(/^\{(.+)\}$/);
        if (match) {
          const value = values[match[1]];
          const flat = Array.isArray(value) ? value.join(',') : readString(value);
          if (!flat) { ready = false; break; }
          resolved[key] = flat;
        } else {
          resolved[key] = template;
        }
      }
      if (!ready) {
        setOptionsMap((current) => (current[field.name]?.length ? current : { ...current, [field.name]: [] }));
        continue;
      }
      void resultGet(source.path, resolved)
        .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, [field.name]: toOptions(payload.data ?? payload) })); })
        .catch(() => { if (!cancelled) setOptionsMap((current) => (current[field.name]?.length ? current : { ...current, [field.name]: [] })); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, termOptions]);

  return optionsMap;
}

/* ------------------------------------------------------------ components */

function FieldLabel({ field }: { field: FieldDef }) {
  return (
    <Label htmlFor={`field-${field.name}`} className="text-sm font-medium text-slate-700">
      {field.label}
      {field.required && <span aria-hidden="true" className="ml-0.5 text-rose-500">*</span>}
    </Label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-xs text-rose-600">{message}</p>;
}

function HtmlEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [mode, setMode] = useState<'code' | 'preview'>('code');
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <Button type="button" variant={mode === 'code' ? 'secondary' : 'ghost'} size="xs" onClick={() => setMode('code')}>
          <Code2 className="h-3 w-3" /> HTML
        </Button>
        <Button type="button" variant={mode === 'preview' ? 'secondary' : 'ghost'} size="xs" onClick={() => setMode('preview')}>
          <Eye className="h-3 w-3" /> Preview
        </Button>
      </div>
      {mode === 'code' ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none"
        />
      ) : (
        <div className="max-h-96 overflow-auto bg-white p-4" dangerouslySetInnerHTML={{ __html: value || '<p class="text-slate-400">Nothing to preview yet.</p>' }} />
      )}
    </div>
  );
}

function FileInput({
  field, value, onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (next: File | string) => void;
}) {
  const isImage = field.type === 'image';
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (value instanceof File && isImage) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(typeof value === 'string' && value ? value : null);
  }, [value, isImage]);

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3 transition-colors hover:border-blue-400 hover:bg-blue-50/40 focus-within:ring-2 focus-within:ring-blue-500/30"
    >
      <input
        type="file"
        accept={field.accept ?? (isImage ? 'image/*' : undefined)}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
      />
      {isImage && preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={`${field.label} preview`} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
          {isImage ? <ImageIcon className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-700">
          {value instanceof File ? value.name : typeof value === 'string' && value ? value.split('/').pop() : `Upload ${field.label.toLowerCase()}`}
        </span>
        <span className="block text-xs text-slate-400">{isImage ? 'PNG, JPG up to 2 MB' : 'Click to browse files'}</span>
      </span>
    </label>
  );
}

function RepeaterInput({
  field, value, onChange, optionsMap,
}: {
  field: FieldDef;
  value: Record<string, string>[];
  onChange: (next: Record<string, string>[]) => void;
  optionsMap: Record<string, SelectOption[]>;
}) {
  const config = field.repeater!;
  const visibleFields = config.fields.filter((rowField) => rowField.type !== 'hidden');

  const addRow = () => {
    const blank: Record<string, string> = {};
    for (const rowField of config.fields) blank[rowField.name] = readString(rowField.defaultValue ?? '');
    onChange([...value, blank]);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
          No rows added yet.
        </p>
      )}
      {value.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <span className="pb-2 text-xs font-semibold text-slate-400">{rowIndex + 1}.</span>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            {visibleFields.map((rowField) => (
              <div key={rowField.name} className="space-y-1">
                <Label className="text-xs font-medium text-slate-500">{rowField.label}</Label>
                {rowField.type === 'select' ? (
                  <Select
                    value={row[rowField.name] ?? ''}
                    onValueChange={(next) => {
                      const updated = value.map((existing, index) => (index === rowIndex ? { ...existing, [rowField.name]: next ?? '' } : existing));
                      onChange(updated);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(rowField.options?.kind === 'static'
                        ? rowField.options.options.map((option) => ({ id: option.value, label: option.label }))
                        : optionsMap[`${field.name}.${rowField.name}`] ?? []
                      ).map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={rowField.type === 'number' ? 'number' : rowField.type === 'date' ? 'date' : 'text'}
                    value={row[rowField.name] ?? ''}
                    onChange={(event) => {
                      const updated = value.map((existing, index) => (index === rowIndex ? { ...existing, [rowField.name]: event.target.value } : existing));
                      onChange(updated);
                    }}
                    className="h-8 bg-white"
                  />
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove row"
            disabled={value.length <= (config.minRows ?? 0)}
            onClick={() => onChange(value.filter((_, index) => index !== rowIndex))}
            className="mb-0.5 text-slate-400 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={config.maxRows != null && value.length >= config.maxRows}
      >
        <Plus className="h-3.5 w-3.5" />
        {config.addLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------- main form */

export default function DynamicForm({
  fields,
  sectionOrder,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  busy = false,
  formId,
}: {
  fields: FieldDef[];
  sectionOrder?: string[];
  initialValues?: FormValues;
  onSubmit: (values: FormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  busy?: boolean;
  formId?: string;
}) {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const { control, handleSubmit, watch, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaultsFor(fields, initialValues),
    mode: 'onBlur',
  });

  useEffect(() => {
    reset(defaultsFor(fields, initialValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const values = watch();
  const optionsMap = useFieldOptions(fields, values);

  const visible = (field: FieldDef) => {
    if (field.type === 'hidden') return false;
    if (!field.showIf) return true;
    return field.showIf.equals.includes(readString(values[field.showIf.field]));
  };

  /* group fields into sections preserving declaration order */
  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const field of fields) {
      if (field.type === 'hidden') continue;
      const section = field.section ?? '';
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(field);
    }
    const ordered = sectionOrder ?? Array.from(map.keys());
    const remaining = Array.from(map.keys()).filter((key) => !ordered.includes(key));
    return [...ordered, ...remaining]
      .filter((key) => map.has(key))
      .map((key) => ({ title: key, fields: map.get(key)! }));
  }, [fields, sectionOrder]);

  const errorFor = (name: string) => {
    const error = formState.errors[name];
    return error && typeof error.message === 'string' ? error.message : undefined;
  };

  const renderControl = (field: FieldDef, controlProps: { value: unknown; onChange: (next: unknown) => void }) => {
    const { value, onChange } = controlProps;
    const options = optionsMap[field.name] ?? [];

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={`field-${field.name}`}
            value={readString(value)}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
            rows={3}
          />
        );
      case 'editor':
        return <HtmlEditor value={readString(value)} onChange={onChange} />;
      case 'select':
        return (
          <Select value={readString(value)} onValueChange={(next) => onChange(next ?? '')} disabled={field.readOnly}>
            <SelectTrigger id={`field-${field.name}`} className="w-full">
              <SelectValue placeholder={field.placeholder ?? 'Select'}>
                {(fieldValue: string | null) => (fieldValue ? options.find((option) => option.id === fieldValue)?.label ?? 'Select' : 'Select')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect': {
        const current = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {options.length === 0 && <p className="px-1 py-1 text-sm text-slate-400">No options available</p>}
            {options.map((option) => (
              <div key={option.id} className="rounded-md px-1.5 py-1 hover:bg-slate-50">
                <Checkbox
                  checked={current.includes(option.id)}
                  onChange={(checked) => onChange(checked ? [...current, option.id] : current.filter((id) => id !== option.id))}
                  label={option.label}
                />
              </div>
            ))}
          </div>
        );
      }
      case 'radio':
        return (
          <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = readString(value) === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(option.id)}
                  className={cn(
                    'rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      case 'checkbox':
        return <Checkbox checked={Boolean(value)} onChange={onChange} label={field.helper ?? field.label} />;
      case 'toggle':
        return <Switch checked={Boolean(value)} onChange={onChange} label={field.helper} />;
      case 'date':
        return (
          <Input
            id={`field-${field.name}`}
            type="date"
            value={readString(value)}
            onChange={(event) => onChange(event.target.value)}
            readOnly={field.readOnly}
          />
        );
      case 'number':
        return (
          <Input
            id={`field-${field.name}`}
            type="number"
            value={readString(value)}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            readOnly={field.readOnly}
          />
        );
      case 'file':
      case 'image':
        return <FileInput field={field} value={value} onChange={onChange} />;
      case 'repeater':
        return (
          <RepeaterInput
            field={field}
            value={Array.isArray(value) ? (value as Record<string, string>[]) : []}
            onChange={onChange}
            optionsMap={optionsMap}
          />
        );
      default:
        return (
          <Input
            id={`field-${field.name}`}
            value={readString(value)}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            readOnly={field.readOnly}
          />
        );
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit((formValues) => onSubmit(formValues))} className="space-y-6" noValidate>
      {sections.map((section) => (
        <fieldset key={section.title || 'default'} className="space-y-4">
          {section.title && (
            <legend className="mb-1 flex w-full items-center gap-2 border-b border-slate-100 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {section.title}
            </legend>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              if (!visible(field)) return null;
              const span2 =
                field.colSpan === 2 ||
                ['textarea', 'editor', 'repeater', 'multiselect'].includes(field.type);
              return (
                <div key={field.name} className={cn('space-y-1.5', span2 && 'sm:col-span-2')}>
                  {field.type !== 'checkbox' && <FieldLabel field={field} />}
                  <Controller
                    name={field.name}
                    control={control as Control<FormValues>}
                    render={({ field: rhf }) => <>{renderControl(field, { value: rhf.value, onChange: rhf.onChange })}</>}
                  />
                  {field.helper && field.type !== 'checkbox' && field.type !== 'toggle' && (
                    <p className="text-xs text-slate-400">{field.helper}</p>
                  )}
                  <FieldError message={errorFor(field.name)} />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy} className="bg-blue-600 text-white hover:bg-blue-700">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
