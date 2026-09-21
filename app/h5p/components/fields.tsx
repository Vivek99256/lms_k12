'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * Form primitives for the H5P authoring editors.
 *
 * Thin wrappers over the design system's Input / Textarea that add the two
 * things every field in these editors needs and nothing else: a label that is
 * actually associated with its control, and a hint line underneath.
 *
 * WHY A LABEL WRAPPER AND NOT JUST `<Label htmlFor>`. These editors render
 * dozens of fields inside repeated rows — hotspot 3's tooltip, pair 7's back
 * text — so every id has to be unique per row or the labels point at the wrong
 * controls and a screen reader reads the form as nonsense. Generating the id
 * here, from the label and a caller-supplied key, makes that structural rather
 * than a thing each editor has to remember.
 */

let sequence = 0;
function useFieldId(explicit?: string): string {
  // Not useId(): these ids appear in `htmlFor` and in `aria-describedby`, and a
  // caller often wants to address one from outside (to focus the first invalid
  // field, say). A caller-supplied id wins; otherwise a stable-enough counter.
  if (explicit) return explicit;
  sequence += 1;
  return `h5p-field-${sequence}`;
}

export function Field({
  label,
  hint,
  htmlFor,
  required,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  required,
  disabled,
  id,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  maxLength?: number;
}) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} htmlFor={fieldId} required={required}>
      <Input
        id={fieldId}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  rows = 3,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
}) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} htmlFor={fieldId}>
      <Textarea
        id={fieldId}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  suffix,
  disabled,
  id,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  id?: string;
}) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} htmlFor={fieldId}>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          type="number"
          value={String(value)}
          min={min}
          max={max}
          disabled={disabled}
          className="tabular-nums"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            // An empty box is not zero — it is mid-edit. Clamping to `min`
            // here would fight the author's backspace; the save path clamps.
            const next = Number(e.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
        {suffix ? <span className="shrink-0 text-xs text-slate-500">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
  id,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
  id?: string;
}) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} htmlFor={fieldId}>
      <select
        id={fieldId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * A checkbox with its label to the right.
 *
 * Deliberately a real `<input type="checkbox">` rather than a styled div: it
 * is the control a screen reader, a keyboard and a switch all already know,
 * and nothing about these settings needs a custom one.
 */
export function CheckField({
  label,
  hint,
  checked,
  onChange,
  disabled,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const fieldId = useFieldId(id);
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor={fieldId} className="min-w-0 text-xs text-slate-700">
        <span className="font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span> : null}
      </label>
    </div>
  );
}

/** A colour, as a swatch plus the hex. The hex is the value that is stored. */
export function ColorField({
  label,
  value,
  onChange,
  hint,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
  id?: string;
}) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} htmlFor={fieldId}>
      <div className="flex items-center gap-2">
        <input
          id={fieldId}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4f46e5'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:opacity-50"
        />
        <Input
          value={value}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder="#4f46e5"
          className="font-mono text-xs"
          aria-label={`${label} hex value`}
        />
      </div>
    </Field>
  );
}

/** A titled group of settings, so an editor reads as sections not a wall. */
export function FieldGroup({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const grid = columns === 1 ? 'sm:grid-cols-1' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      <div className={`mt-4 grid grid-cols-1 gap-4 ${grid}`}>{children}</div>
    </section>
  );
}
