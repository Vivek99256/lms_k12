'use client';

/**
 * Config-driven search/filter panel used by every Result screen.
 *
 * Handles the standard academic cascade (Term → Section → Standard →
 * Division) plus arbitrary API-backed, static, date and number filters.
 * API filters may reference other filter values via `{placeholders}` in
 * their params and reload automatically when those values change.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Calendar, ChevronDown, Filter, GraduationCap, Layers, Loader2, Search, Users, X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { resultGet, toOptions, readString, type SelectOption } from '@/lib/result/api';
import { Checkbox } from './primitives';
import { cn } from '@/lib/utils';

export type FilterValues = Record<string, string | string[]>;

export type FilterFieldDef =
  | { kind: 'term'; name?: string; label?: string; required?: boolean }
  | { kind: 'section'; name?: string; label?: string; required?: boolean; multi?: boolean }
  | { kind: 'standard'; name?: string; label?: string; required?: boolean; multi?: boolean }
  | { kind: 'division'; name?: string; label?: string; required?: boolean; multi?: boolean }
  | {
      kind: 'api';
      name: string;
      label: string;
      path: string;
      params?: Record<string, string>;
      required?: boolean;
      multi?: boolean;
      icon?: LucideIcon;
      showIf?: { field: string; equals: string[] };
    }
  | {
      kind: 'static';
      name: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      defaultValue?: string;
      icon?: LucideIcon;
      showIf?: { field: string; equals: string[] };
    }
  | { kind: 'date'; name: string; label: string; required?: boolean; showIf?: { field: string; equals: string[] } }
  | { kind: 'number'; name: string; label: string; required?: boolean; placeholder?: string; showIf?: { field: string; equals: string[] } };

const CHAIN_DEFAULTS: Record<string, { name: string; label: string; icon: LucideIcon }> = {
  term: { name: 'term', label: 'Select term', icon: Calendar },
  section: { name: 'grade', label: 'Search section', icon: Users },
  standard: { name: 'standard', label: 'Search standard', icon: GraduationCap },
  division: { name: 'division', label: 'Search division', icon: Layers },
};

function fieldName(field: FilterFieldDef): string {
  if ('name' in field && field.name) return field.name;
  return CHAIN_DEFAULTS[field.kind]?.name ?? field.kind;
}

function fieldLabel(field: FilterFieldDef): string {
  if ('label' in field && field.label) return field.label;
  return CHAIN_DEFAULTS[field.kind]?.label ?? fieldName(field);
}

function isVisible(field: FilterFieldDef, values: FilterValues): boolean {
  const condition = 'showIf' in field ? field.showIf : undefined;
  if (!condition) return true;
  return condition.equals.includes(readString(values[condition.field]));
}

/** Resolve `{placeholder}` params; returns null if any referenced value is empty. */
function resolveParams(params: Record<string, string> | undefined, values: FilterValues): Record<string, string> | null {
  const resolved: Record<string, string> = {};
  for (const [key, template] of Object.entries(params ?? {})) {
    const match = template.match(/^\{(.+)\}$/);
    if (match) {
      const value = values[match[1]];
      const flat = Array.isArray(value) ? value.join(',') : readString(value);
      if (!flat) return null;
      resolved[key] = flat;
    } else {
      resolved[key] = template;
    }
  }
  return resolved;
}

function MultiSelect({
  options, value, onChange, placeholder, disabled,
}: {
  options: SelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const summary = value.length === 0
    ? placeholder
    : value.length <= 2
      ? value.map((id) => options.find((option) => option.id === id)?.label ?? id).join(', ')
      : `${value.length} selected`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50',
          value.length === 0 && 'text-slate-400',
        )}
      >
        <span className="truncate">{summary}</span>
        <span className="flex items-center gap-1">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={(event) => { event.stopPropagation(); onChange([]); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onChange([]); } }}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </span>
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">No options available</p>}
          {options.map((option) => (
            <div key={option.id} className="rounded-md px-2 py-1.5 hover:bg-slate-50">
              <Checkbox
                checked={value.includes(option.id)}
                onChange={(checked) =>
                  onChange(checked ? [...value, option.id] : value.filter((id) => id !== option.id))
                }
                label={option.label}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldShell({ label, icon: Icon, required, children }: { label: string; icon?: LucideIcon; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {Icon && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Icon className="h-3 w-3" />
          </span>
        )}
        {label}
        {required && <span aria-hidden="true" className="text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function FilterBar({
  fields,
  onSearch,
  loading = false,
  searchLabel = 'Search',
  title = 'Search criteria',
  initialValues,
  children,
}: {
  fields: FilterFieldDef[];
  onSearch: (values: FilterValues) => void;
  loading?: boolean;
  searchLabel?: string;
  title?: string;
  initialValues?: FilterValues;
  /** Extra custom controls rendered inside the grid. */
  children?: React.ReactNode;
}) {
  const { academicTerms } = useAuth();
  const [values, setValues] = useState<FilterValues>(() => {
    const seed: FilterValues = { ...(initialValues ?? {}) };
    for (const field of fields) {
      if (field.kind === 'static' && field.defaultValue != null && seed[field.name] == null) {
        seed[field.name] = field.defaultValue;
      }
    }
    return seed;
  });
  const [optionsMap, setOptionsMap] = useState<Record<string, SelectOption[]>>({});

  const names = useMemo(() => fields.map(fieldName), [fields]);

  const termOptions = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return toOptions(
      academicTerms.filter((item) => {
        const year = readString((item as Record<string, unknown>).syear);
        return !selectedAcademicYear || !year || year === selectedAcademicYear;
      }),
    );
  }, [academicTerms]);

  const setValue = useCallback((name: string, value: string | string[]) => {
    setValues((current) => {
      const next: FilterValues = { ...current, [name]: value };
      // Reset downstream chain values when an upstream one changes.
      const chainOrder = ['term', 'grade', 'standard', 'division'];
      const chainIndex = chainOrder.indexOf(name);
      if (chainIndex >= 0) {
        for (const downstream of chainOrder.slice(chainIndex + 1)) {
          if (downstream in next) next[downstream] = Array.isArray(next[downstream]) ? [] : '';
        }
      }
      return next;
    });
  }, []);

  /* ------------------------------------------------ chained option loading */
  const hasTerm = names.includes('term');
  const termValue = readString(values.term);
  const sectionValue = Array.isArray(values.grade) ? values.grade.join(',') : readString(values.grade);
  const standardValue = Array.isArray(values.standard) ? values.standard.join(',') : readString(values.standard);

  useEffect(() => {
    if (!names.some((name) => name === 'grade')) return;
    if (hasTerm && !termValue) { setOptionsMap((current) => ({ ...current, grade: [] })); return; }
    let cancelled = false;
    void resultGet('api/get-grade-list', {})
      .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, grade: toOptions(payload.data ?? payload) })); })
      .catch(() => { if (!cancelled) setOptionsMap((current) => ({ ...current, grade: [] })); });
    return () => { cancelled = true; };
  }, [names, hasTerm, termValue]);

  useEffect(() => {
    if (!names.includes('standard')) return;
    if (!sectionValue) { setOptionsMap((current) => ({ ...current, standard: [] })); return; }
    let cancelled = false;
    void resultGet('api/get-standard-list', { grade_id: sectionValue, type: 'webForm' })
      .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, standard: toOptions(payload.data ?? payload) })); })
      .catch(() => { if (!cancelled) setOptionsMap((current) => ({ ...current, standard: [] })); });
    return () => { cancelled = true; };
  }, [names, sectionValue]);

  useEffect(() => {
    if (!names.includes('division')) return;
    if (!standardValue) { setOptionsMap((current) => ({ ...current, division: [] })); return; }
    let cancelled = false;
    void resultGet('api/get-division-list', { standard_id: standardValue, type: 'webForm' })
      .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, division: toOptions(payload.data ?? payload) })); })
      .catch(() => { if (!cancelled) setOptionsMap((current) => ({ ...current, division: [] })); });
    return () => { cancelled = true; };
  }, [names, standardValue]);

  /* -------------------------------------------------- api option loading */
  const apiFields = useMemo(() => fields.filter((field): field is Extract<FilterFieldDef, { kind: 'api' }> => field.kind === 'api'), [fields]);
  const apiDepsKey = apiFields
    .map((field) => {
      const resolved = resolveParams(field.params, values);
      return `${field.name}:${resolved ? JSON.stringify(resolved) : 'null'}`;
    })
    .join('|');

  useEffect(() => {
    let cancelled = false;
    for (const field of apiFields) {
      const resolved = resolveParams(field.params, values);
      if (!resolved) {
        setOptionsMap((current) => (current[field.name]?.length ? { ...current, [field.name]: [] } : current));
        continue;
      }
      void resultGet(field.path, resolved)
        .then((payload) => { if (!cancelled) setOptionsMap((current) => ({ ...current, [field.name]: toOptions(payload.data ?? payload) })); })
        .catch(() => { if (!cancelled) setOptionsMap((current) => ({ ...current, [field.name]: [] })); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiDepsKey]);

  /* ---------------------------------------------------------- validation */
  const missingRequired = fields.some((field) => {
    if (!isVisible(field, values)) return false;
    const required = 'required' in field ? field.required : false;
    if (!required) return false;
    const value = values[fieldName(field)];
    return Array.isArray(value) ? value.length === 0 : !readString(value);
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (missingRequired) return;
    const visibleValues: FilterValues = {};
    for (const field of fields) {
      if (!isVisible(field, values)) continue;
      const name = fieldName(field);
      visibleValues[name] = values[name] ?? (('multi' in field && field.multi) ? [] : '');
    }
    onSearch(visibleValues);
  };

  const renderField = (field: FilterFieldDef) => {
    if (!isVisible(field, values)) return null;
    const name = fieldName(field);
    const label = fieldLabel(field);
    const required = 'required' in field ? field.required : false;

    if (field.kind === 'date') {
      return (
        <FieldShell key={name} label={label} icon={Calendar} required={required}>
          <Input type="date" value={readString(values[name])} onChange={(event) => setValue(name, event.target.value)} className="h-9" />
        </FieldShell>
      );
    }

    if (field.kind === 'number') {
      return (
        <FieldShell key={name} label={label} icon={BookOpen} required={required}>
          <Input
            type="number"
            value={readString(values[name])}
            placeholder={field.placeholder}
            onChange={(event) => setValue(name, event.target.value)}
            className="h-9"
          />
        </FieldShell>
      );
    }

    let options: SelectOption[] = [];
    let icon: LucideIcon | undefined;
    let disabled = false;

    if (field.kind === 'term') {
      options = termOptions;
      icon = Calendar;
    } else if (field.kind === 'section') {
      options = optionsMap.grade ?? [];
      icon = Users;
      disabled = hasTerm && !termValue;
    } else if (field.kind === 'standard') {
      options = optionsMap.standard ?? [];
      icon = GraduationCap;
      disabled = !sectionValue;
    } else if (field.kind === 'division') {
      options = optionsMap.division ?? [];
      icon = Layers;
      disabled = !standardValue;
    } else if (field.kind === 'api') {
      options = optionsMap[field.name] ?? [];
      icon = field.icon ?? BookOpen;
      disabled = resolveParams(field.params, values) === null;
    } else {
      options = field.options.map((option) => ({ id: option.value, label: option.label }));
      icon = field.icon ?? Filter;
    }

    const multi = 'multi' in field && field.multi;

    if (multi) {
      const current = Array.isArray(values[name]) ? (values[name] as string[]) : [];
      return (
        <FieldShell key={name} label={label} icon={icon} required={required}>
          <MultiSelect options={options} value={current} onChange={(next) => setValue(name, next)} placeholder="Select" disabled={disabled} />
        </FieldShell>
      );
    }

    return (
      <FieldShell key={name} label={label} icon={icon} required={required}>
        <Select value={readString(values[name])} onValueChange={(value) => setValue(name, value ?? '')} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
    );
  };

  return (
    <Card className="border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 px-6 py-5">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Search className="h-4 w-4" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fields.map(renderField)}
            {children}
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={missingRequired || loading}
              className="h-10 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {searchLabel}
                </span>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
