'use client';

import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { alumniApi } from '../_lib/alumni-api';
import { inputClass } from './alumni-ui';

export type Picked = { id: number; label: string; hint?: string };

/**
 * Type-to-search selector. The chosen record shows as a chip; clearing it brings the search box back.
 * `search` returns options for the text typed (it is only called after two characters, and debounced).
 */
function SearchPicker({ label, placeholder, value, onChange, search, error }: {
  label: string;
  placeholder: string;
  value: Picked | null;
  onChange: (value: Picked | null) => void;
  search: (text: string, signal: AbortSignal) => Promise<Picked[]>;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [options, setOptions] = useState<Picked[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (text.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      search(text.trim(), controller.signal)
        .then((found) => {
          setOptions(found);
          setFailed(false);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setFailed(true);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, search]);

  const shown = text.trim().length >= 2 ? options : [];

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      {value ? (
        <div className="flex h-9 items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 text-sm">
          <span className="truncate text-slate-900">{value.label}{value.hint ? <span className="text-slate-500"> · {value.hint}</span> : null}</span>
          <button type="button" aria-label={`Clear ${label}`} className="ml-2 text-slate-500 hover:text-slate-900" onClick={() => { onChange(null); setText(''); setOptions([]); }}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input id={id} className={inputClass} placeholder={placeholder} value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" aria-invalid={Boolean(error)} />
          {text.trim().length >= 2 ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="listbox" aria-label={`${label} results`}>
              {failed ? <li className="px-3 py-2 text-sm text-red-700">Couldn&apos;t search. Try again.</li> : null}
              {!failed && shown.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">No matches</li> : null}
              {shown.map((option) => (
                <li key={option.id} role="option" aria-selected={false}>
                  <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => { onChange(option); setText(''); setOptions([]); }}>
                    <span>{option.label}</span>
                    {option.hint ? <span className="text-xs text-slate-500">{option.hint}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

const searchAlumni = (text: string, signal: AbortSignal): Promise<Picked[]> =>
  alumniApi.list({ q: text, per_page: 8 }, signal).then((result) =>
    result.rows.map((row) => ({ id: row.id, label: row.full_name, hint: row.alumni_code })),
  );

const searchStudents = (text: string, signal: AbortSignal): Promise<Picked[]> =>
  alumniApi.searchStudents(text, signal).then((rows) =>
    rows.map((row) => ({ id: row.id, label: [row.first_name, row.last_name].filter(Boolean).join(' '), hint: row.enrollment_no ?? undefined })),
  );

export function AlumniPicker(props: { label?: string; value: Picked | null; onChange: (value: Picked | null) => void; error?: string }) {
  return <SearchPicker label={props.label ?? 'Alumnus'} placeholder="Type a name or Alumni ID" search={searchAlumni} value={props.value} onChange={props.onChange} error={props.error} />;
}

export function StudentPicker(props: { label?: string; value: Picked | null; onChange: (value: Picked | null) => void; error?: string }) {
  return <SearchPicker label={props.label ?? 'Student'} placeholder="Type a name or enrollment number" search={searchStudents} value={props.value} onChange={props.onChange} error={props.error} />;
}

const searchDonors = (text: string, signal: AbortSignal): Promise<Picked[]> =>
  alumniApi.searchDonors(text, signal).then((rows) => rows.map((row) => ({ id: row.id, label: row.full_name, hint: [row.alumni_code, row.batch].filter(Boolean).join(' · ') })));

/** Donor search for finance users (Accountant): the normal alumni search needs alumni-management rights, this returns name, code and batch only. */
export function DonorPicker(props: { label?: string; value: Picked | null; onChange: (value: Picked | null) => void; error?: string }) {
  return <SearchPicker label={props.label ?? 'Alumnus'} placeholder="Type a name or Alumni ID" search={searchDonors} value={props.value} onChange={props.onChange} error={props.error} />;
}
