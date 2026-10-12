'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type AlumniDetail, type DuplicateMatch } from '../_lib/alumni-api';
import { Banner, FormField, Panel, humanize, inputClass } from './alumni-ui';

type Values = Record<string, string>;

const TEXT_FIELDS = [
  'first_name', 'middle_name', 'last_name', 'gender', 'dob', 'blood_group', 'email', 'mobile', 'alt_mobile',
  'current_address', 'permanent_address', 'city', 'state', 'country', 'pincode',
  'gr_no', 'enrollment_no', 'student_id', 'campus', 'department', 'course', 'last_class', 'division',
  'academic_year', 'admission_year', 'passing_year', 'batch', 'leaving_date', 'employment_status', 'linkedin_url',
] as const;

const CONSENTS = [
  ['consent_email', 'Email'], ['consent_sms', 'SMS'], ['consent_whatsapp', 'WhatsApp'], ['consent_push', 'App notifications'],
] as const;

const EMPLOYMENT = ['student', 'job_seeking', 'employed', 'self_employed', 'entrepreneur', 'freelancer', 'government_employee', 'retired', 'other'];

function initialValues(initial?: AlumniDetail): Values {
  const values: Values = {};
  TEXT_FIELDS.forEach((key) => {
    const raw = initial?.[key];
    values[key] = raw === null || raw === undefined ? '' : String(raw).slice(0, key === 'dob' || key === 'leaving_date' ? 10 : undefined);
  });
  CONSENTS.forEach(([key]) => {
    values[key] = initial && Number(initial[key]) === 1 ? '1' : '';
  });
  return values;
}

export function AlumniForm({ initial }: { initial?: AlumniDetail }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [values, setValues] = useState<Values>(() => initialValues(initial));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const error = (key: string) => errors[key]?.[0];

  // Only a name + date-of-birth match can be overridden; an ID/email/mobile match never can.
  const overridable = matches.length > 0 && matches.every((match) => match.matched_on.every((field) => field === 'name_dob'));

  const field = (key: string, label: string, opts: { type?: string; required?: boolean; hint?: string } = {}) => (
    <FormField label={label} error={error(key)} hint={opts.hint} required={opts.required}>
      <input
        className={inputClass}
        type={opts.type ?? 'text'}
        value={values[key] ?? ''}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={Boolean(error(key))}
        required={opts.required}
      />
    </FormField>
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    setMatches([]);

    const body: Record<string, unknown> = {};
    TEXT_FIELDS.forEach((key) => {
      const value = values[key].trim();
      if (value !== '' || editing) body[key] = value === '' ? null : value;
    });
    CONSENTS.forEach(([key]) => {
      body[key] = values[key] === '1';
    });
    if (allowDuplicate) body.allow_duplicate = true;

    try {
      const result = editing ? await alumniApi.update(initial!.id, body) : await alumniApi.create(body);
      router.push(`/alumni/profile/${result.data.id}`);
    } catch (reason) {
      if (reason instanceof AlumniApiError) {
        setErrors(reason.fieldErrors);
        setMatches(reason.matches);
        setMessage(reason.message);
      } else {
        setMessage("Couldn't save the alumni record. Try again.");
      }
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {message ? (
        <Banner>
          <p>{message}</p>
          {matches.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {matches.map((match) => (
                <li key={match.id}>
                  <Link href={`/alumni/profile/${match.id}`} className="font-medium underline">
                    {match.full_name} ({match.alumni_code})
                  </Link>{' '}
                  — matched on {match.matched_on.map((m) => (m === 'name_dob' ? 'name and date of birth' : humanize(m).toLowerCase())).join(', ')}
                </li>
              ))}
            </ul>
          ) : null}
          {overridable ? (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} />
              This is a different person with the same name and date of birth. Add anyway.
            </label>
          ) : null}
        </Banner>
      ) : null}

      <Panel title="Personal details">
        <div className="grid gap-4 md:grid-cols-3">
          {field('first_name', 'First name', { required: true })}
          {field('middle_name', 'Middle name')}
          {field('last_name', 'Last name')}
          <FormField label="Gender" error={error('gender')}>
            <select className={inputClass} value={values.gender} onChange={(event) => set('gender', event.target.value)}>
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </FormField>
          {field('dob', 'Date of birth', { type: 'date' })}
          {field('blood_group', 'Blood group')}
        </div>
      </Panel>

      <Panel title="Contact and address">
        <div className="grid gap-4 md:grid-cols-3">
          {field('email', 'Email', { type: 'email' })}
          {field('mobile', 'Mobile number')}
          {field('alt_mobile', 'Alternate mobile number')}
          <FormField label="Current address" error={error('current_address')}>
            <textarea className={inputClass + ' h-20 py-2'} value={values.current_address} onChange={(event) => set('current_address', event.target.value)} />
          </FormField>
          <FormField label="Permanent address" error={error('permanent_address')}>
            <textarea className={inputClass + ' h-20 py-2'} value={values.permanent_address} onChange={(event) => set('permanent_address', event.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            {field('city', 'City')}
            {field('state', 'State')}
            {field('country', 'Country')}
            {field('pincode', 'Pincode')}
          </div>
        </div>
      </Panel>

      <Panel title="Institute details">
        <div className="grid gap-4 md:grid-cols-3">
          {field('student_id', 'Student ID', { type: 'number', hint: 'Links this record to the student master. Leave empty for alumni who were never in the ERP.' })}
          {field('gr_no', 'GR number')}
          {field('enrollment_no', 'Enrollment number')}
          {field('campus', 'Campus')}
          {field('department', 'Department')}
          {field('course', 'Course or program')}
          {field('last_class', 'Last class or grade')}
          {field('division', 'Division')}
          {field('academic_year', 'Academic year', { hint: 'For example 2021-22' })}
          {field('admission_year', 'Admission year', { type: 'number' })}
          {field('passing_year', 'Passing year', { type: 'number' })}
          {field('batch', 'Batch', { hint: 'Leave empty to use the passing year, for example 2021-22.' })}
          {field('leaving_date', 'Leaving date', { type: 'date' })}
        </div>
      </Panel>

      <Panel title="Work and contact preferences">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Employment status" error={error('employment_status')}>
            <select className={inputClass} value={values.employment_status} onChange={(event) => set('employment_status', event.target.value)}>
              <option value="">Select</option>
              {EMPLOYMENT.map((option) => (
                <option key={option} value={option}>{humanize(option)}</option>
              ))}
            </select>
          </FormField>
          {field('linkedin_url', 'LinkedIn profile', { type: 'url' })}
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Contact consent</legend>
          <p className="text-xs text-slate-500">Only record consent the alumnus has given. Nobody is contacted on a channel without it.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {CONSENTS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={values[key] === '1'} onChange={(event) => set(key, event.target.checked ? '1' : '')} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={() => router.back()} disabled={saving}>Cancel</Button>
        <Button type="submit" className="h-9" disabled={saving || (matches.length > 0 && overridable && !allowDuplicate)}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {editing ? 'Save changes' : 'Add alumni'}
        </Button>
      </div>
    </form>
  );
}
