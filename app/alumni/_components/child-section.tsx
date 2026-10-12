'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type ChildKind } from '../_lib/alumni-api';
import { Banner, EmptyState, FormField, Panel, humanize, inputClass } from './alumni-ui';

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'url' | 'select' | 'textarea' | 'checkbox';
  options?: string[];
  required?: boolean;
};

type Row = Record<string, string | number | null>;

export type ChildConfig = {
  kind: ChildKind;
  title: string;
  addLabel: string;
  emptyTitle: string;
  emptyHint: string;
  fields: FieldDef[];
  /** One-line summary of a saved row. */
  heading: (row: Row) => string;
  detail: (row: Row) => string;
};

const text = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));

export function ChildSection({ alumniId, config, rows, onChanged, renderExtra }: {
  alumniId: number; config: ChildConfig; rows: Row[]; onChanged: () => void;
  /** Optional per-row actions (for example Verify on an achievement). */
  renderExtra?: (row: Row) => ReactNode;
}) {
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function open(row: Row | 'new') {
    const next: Record<string, string> = {};
    config.fields.forEach((field) => {
      const raw = row === 'new' ? '' : text(row[field.key]);
      next[field.key] = field.type === 'date' ? raw.slice(0, 10) : raw;
    });
    setValues(next);
    setErrors({});
    setMessage('');
    setEditing(row);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    const body: Record<string, unknown> = {};
    config.fields.forEach((field) => {
      const value = (values[field.key] ?? '').trim();
      body[field.key] = field.type === 'checkbox' ? value === '1' : value === '' ? null : value;
    });
    try {
      await alumniApi.childSave(alumniId, config.kind, body, editing !== 'new' && editing ? Number(editing.id) : undefined);
      setEditing(null);
      onChanged();
    } catch (reason) {
      if (reason instanceof AlumniApiError) {
        setErrors(reason.fieldErrors);
        setMessage(reason.message);
      } else {
        setMessage("Couldn't save. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(`Remove “${config.heading(row)}”? This can't be undone.`)) return;
    setBusy(true);
    try {
      await alumniApi.childDelete(alumniId, config.kind, Number(row.id));
      onChanged();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Couldn't remove the record. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={config.title}
      actions={editing ? null : (
        <Button variant="outline" size="sm" onClick={() => open('new')}><Plus className="size-3.5" aria-hidden /> {config.addLabel}</Button>
      )}
    >
      {message && !editing ? <div className="mb-3"><Banner>{message}</Banner></div> : null}

      {editing ? (
        <form onSubmit={save} className="space-y-4" noValidate>
          {message ? <Banner>{message}</Banner> : null}
          <div className="grid gap-4 md:grid-cols-3">
            {config.fields.map((field) => (
              <FormField key={field.key} label={field.label} required={field.required} error={errors[field.key]?.[0]}>
                {field.type === 'select' ? (
                  <select className={inputClass} value={values[field.key]} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}>
                    <option value="">Select</option>
                    {field.options?.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea className={inputClass + ' h-20 py-2'} value={values[field.key]} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })} />
                ) : field.type === 'checkbox' ? (
                  <input type="checkbox" checked={values[field.key] === '1' || values[field.key] === 'true'} onChange={(e) => setValues({ ...values, [field.key]: e.target.checked ? '1' : '' })} />
                ) : (
                  <input className={inputClass} type={field.type ?? 'text'} value={values[field.key]} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })} aria-invalid={Boolean(errors[field.key])} />
                )}
              </FormField>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" className="h-9" disabled={busy}>Save</Button>
          </div>
        </form>
      ) : rows.length === 0 ? (
        <EmptyState title={config.emptyTitle} hint={config.emptyHint} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={String(row.id)} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{config.heading(row)}</p>
                <p className="text-sm text-slate-500">{config.detail(row)}</p>
                {renderExtra ? renderExtra(row) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${config.heading(row)}`} onClick={() => open(row)}><Pencil className="size-4" aria-hidden /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${config.heading(row)}`} onClick={() => remove(row)} disabled={busy}><Trash2 className="size-4" aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const year = (row: Row, a: string, b: string) => [text(row[a]).slice(0, 4), text(row[b]).slice(0, 4)].filter(Boolean).join(' – ');

export const EMPLOYMENT_OPTIONS = ['student', 'job_seeking', 'employed', 'self_employed', 'entrepreneur', 'freelancer', 'government_employee', 'retired', 'other'];

export const CHILD_CONFIGS: ChildConfig[] = [
  {
    kind: 'education', title: 'Higher education', addLabel: 'Add education', emptyTitle: 'No higher education recorded',
    emptyHint: 'Add degrees, diplomas or courses completed after school.',
    fields: [
      { key: 'qualification', label: 'Qualification', required: true }, { key: 'course', label: 'Course' }, { key: 'specialization', label: 'Specialization' },
      { key: 'institution', label: 'College or university' }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' },
      { key: 'admission_year', label: 'Admission year', type: 'number' }, { key: 'passing_year', label: 'Passing year', type: 'number' },
      { key: 'current_status', label: 'Status', type: 'select', options: ['ongoing', 'completed', 'discontinued'] },
      { key: 'score', label: 'CGPA or percentage' }, { key: 'scholarship', label: 'Scholarship' }, { key: 'awards', label: 'Awards' },
    ],
    heading: (r) => [text(r.qualification), text(r.course)].filter(Boolean).join(', '),
    detail: (r) => [text(r.institution), year(r, 'admission_year', 'passing_year'), r.score ? `Score ${r.score}` : ''].filter(Boolean).join(' · '),
  },
  {
    kind: 'career', title: 'Career history', addLabel: 'Add job', emptyTitle: 'No career history recorded',
    emptyHint: 'Add current and past jobs to build the career timeline.',
    fields: [
      { key: 'company_name', label: 'Company', required: true }, { key: 'job_title', label: 'Job title' }, { key: 'industry', label: 'Industry' },
      { key: 'employment_status', label: 'Employment status', type: 'select', options: EMPLOYMENT_OPTIONS },
      { key: 'employment_type', label: 'Employment type' }, { key: 'department', label: 'Department' },
      { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
      { key: 'location', label: 'Location' }, { key: 'country', label: 'Country' }, { key: 'website', label: 'Website', type: 'url' },
      { key: 'is_current', label: 'Current job', type: 'checkbox' },
    ],
    heading: (r) => [text(r.job_title), text(r.company_name)].filter(Boolean).join(' at '),
    detail: (r) => [text(r.industry), `${text(r.start_date).slice(0, 4) || '—'} – ${Number(r.is_current) === 1 ? 'Present' : text(r.end_date).slice(0, 4) || '—'}`, text(r.location)].filter(Boolean).join(' · '),
  },
  {
    kind: 'business', title: 'Business', addLabel: 'Add business', emptyTitle: 'No business recorded',
    emptyHint: 'For alumni who founded or co-founded a business.',
    fields: [
      { key: 'business_name', label: 'Business name', required: true }, { key: 'business_type', label: 'Business type' }, { key: 'industry', label: 'Industry' },
      { key: 'role', label: 'Role', type: 'select', options: ['founder', 'co_founder'] }, { key: 'established_year', label: 'Established', type: 'number' },
      { key: 'employee_count', label: 'Employees', type: 'number' }, { key: 'website', label: 'Website', type: 'url' }, { key: 'location', label: 'Location' },
      { key: 'contact_details', label: 'Contact details' }, { key: 'description', label: 'Description', type: 'textarea' },
    ],
    heading: (r) => text(r.business_name),
    detail: (r) => [text(r.industry), humanize(text(r.role)), text(r.established_year) ? `Since ${r.established_year}` : '', text(r.location)].filter(Boolean).join(' · '),
  },
  {
    kind: 'skills', title: 'Skills and expertise', addLabel: 'Add skill', emptyTitle: 'No skills added',
    emptyHint: 'Add any skill, including your own.',
    fields: [{ key: 'skill', label: 'Skill', required: true }, { key: 'level', label: 'Level', type: 'select', options: ['beginner', 'intermediate', 'advanced', 'expert'] }],
    heading: (r) => text(r.skill), detail: (r) => humanize(text(r.level)),
  },
  {
    kind: 'achievements', title: 'Achievements and certifications', addLabel: 'Add achievement', emptyTitle: 'No achievements recorded',
    emptyHint: 'Awards, certifications, publications, patents and other recognition.',
    fields: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['award', 'certification', 'academic', 'professional', 'sports', 'social_service', 'entrepreneurship', 'government_recognition', 'publication', 'patent', 'other'] },
      { key: 'title', label: 'Title', required: true }, { key: 'organization', label: 'Organization' }, { key: 'achieved_on', label: 'Date', type: 'date' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    heading: (r) => text(r.title),
    detail: (r) => [humanize(text(r.category)), text(r.organization), text(r.achieved_on).slice(0, 4), humanize(text(r.verification_status))].filter(Boolean).join(' · '),
  },
];
