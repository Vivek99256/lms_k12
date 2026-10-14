'use client';

import { friendlyError } from '@/lib/user-messages';

import { useId, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { roundTrips, toHtml, toPlain } from '@/lib/h5p/branching-text';

/**
 * Two fields the scenario editor needs that the shared H5P fields do not have:
 * a body that is HTML underneath but reads as plain text, and a picture with the
 * description a screen reader needs.
 */

/**
 * The body of a screen, a question or an ending.
 *
 * Stored as HTML, because that is what H5P stores and what the generator writes;
 * shown as ordinary text, because a teacher should not have to read `<p>` to fix
 * a sentence. A blank line is a new paragraph, a leading dash a bullet, a leading
 * number a step, and **double stars** bold. When the HTML holds something the text
 * form cannot show (a table, a link, a subscript) the field shows the HTML
 * itself and says so, rather than flattening it.
 *
 * KEYED BY THE CALLER (one per step), because the text being typed is held here
 * between keystrokes: re-deriving it from the HTML on every change would trim a
 * trailing space the moment it was typed.
 */
export function BodyField({
  label,
  value,
  onChange,
  hint,
  rows = 6,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  hint?: string;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const startsAsText = roundTrips(value);
  const [mode, setMode] = useState<'text' | 'html'>(startsAsText ? 'text' : 'html');
  const [text, setText] = useState(() => toPlain(value) ?? '');

  // The text being typed is held here between keystrokes, so a change that did
  // NOT come from typing -- a choice moved up, a step swapped -- has to replace
  // it, or the box would keep showing the previous occupant's words. A change
  // that did come from typing is recognised because the text already produces
  // exactly this HTML, and is left alone (which is what keeps a trailing space).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (toHtml(text) !== value) setText(toPlain(value) ?? '');
  }

  const switchTo = (next: 'text' | 'html') => {
    if (next === mode) return;

    if (next === 'text') {
      const lossless = roundTrips(value);
      if (!lossless && !window.confirm('Some of this formatting cannot be shown as plain text and would be lost. Switch anyway?')) {
        return;
      }
      // What the text form can say: the grammar's reading, or the bare words.
      const plain = toPlain(value) ?? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      setText(plain);
      if (!lossless) onChange(toHtml(plain));
    }
    setMode(next);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-[11px]" role="group" aria-label={`${label} format`}>
          {(['text', 'html'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchTo(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-2 py-0.5 font-medium ${mode === m ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {m === 'text' ? 'Text' : 'HTML'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'text' ? (
        <Textarea
          id={id}
          value={text}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            onChange(toHtml(e.target.value));
          }}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          disabled={disabled}
          className="font-mono text-xs"
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <p className="text-[11px] text-slate-500">
        {hint ??
          (mode === 'text'
            ? 'A blank line starts a new paragraph. Start a line with - for a bullet or 1. for a numbered step. **Bold** and *italic* work too.'
            : 'Paragraphs, lists, bold, italic, simple tables and links.')}
      </p>
    </div>
  );
}

/**
 * A picture and its description.
 *
 * The description is not optional decoration: a learner using a screen reader
 * gets the picture only through it, and publishing refuses a picture without
 * one. So the field asks for it the moment there is a picture.
 */
export function PictureField({
  label,
  url,
  alt,
  onChange,
  upload,
  disabled,
}: {
  label: string;
  url: string;
  alt: string;
  onChange: (next: { url: string; alt: string }) => void;
  upload: (file: File) => Promise<string>;
  disabled?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      onChange({ url: await upload(file), alt });
    } catch (err: unknown) {
      setError(friendlyError(err, 'We couldn’t upload that picture. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-700">{label}</p>

      {url ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="h-20 w-28 rounded-lg border border-slate-200 object-cover" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor={`${id}-alt`} className="block text-[11px] font-medium text-slate-600">
              Describe the picture <span className="text-red-500">*</span>
            </label>
            <Input
              id={`${id}-alt`}
              value={alt}
              disabled={disabled}
              maxLength={255}
              placeholder="A lake at dusk with a bucket on the shore"
              aria-invalid={alt.trim() === ''}
              onChange={(e) => onChange({ url, alt: e.target.value })}
            />
            {alt.trim() === '' ? <p className="text-[11px] text-amber-700">A description is needed before this can be published.</p> : null}
            <button
              type="button"
              onClick={() => onChange({ url: '', alt: '' })}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Remove picture
            </button>
          </div>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
          Add a picture
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void pick(file);
            }}
          />
        </label>
      )}

      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
