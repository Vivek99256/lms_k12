'use client';

import React, { useRef, useState } from 'react';
import { FieldLabel } from '../ui';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

/**
 * Colour control: a swatch that opens the native picker, a hex field, and the
 * app palette as one-click presets.
 *
 * Uses `<input type="color">` rather than a JS colour-picker dependency — it is
 * keyboard accessible for free and keeps the bundle lean. Alpha is not offered
 * here because printed documents are opaque; a transparent fill is expressed by
 * clearing the value instead.
 */
export const ColorPicker = ({ color, onChange, label }: ColorPickerProps) => {
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState(color || '');

  // Re-sync the hex field when the selected block changes colour from
  // elsewhere (swatch, preset, a different block being selected). Adjusting
  // state during render — rather than in an effect — avoids rendering one frame
  // of the previous block's colour.
  const [lastColor, setLastColor] = useState(color);
  if (color !== lastColor) {
    setLastColor(color);
    setHexDraft(color || '');
  }

  // `<input type="color">` only accepts #rrggbb — anything else (rgba(), a
  // named colour, empty) falls back to black so the widget still opens.
  const nativeValue = /^#[0-9a-f]{6}$/i.test(color || '') ? (color as string) : '#000000';

  const commitHex = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) onChange(normalized);
    else setHexDraft(color || '');
  };

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => nativeInputRef.current?.click()}
          aria-label={`Choose ${label.toLowerCase()}`}
          className="size-9 shrink-0 rounded-lg border border-slate-200 shadow-sm transition hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
          style={
            color
              ? { backgroundColor: color }
              : {
                  // Checkerboard reads as "no fill" without needing a label.
                  backgroundImage:
                    'linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 4px 4px',
                  backgroundColor: '#fff',
                }
          }
        />
        <input
          ref={nativeInputRef}
          type="color"
          value={nativeValue}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
        <input
          type="text"
          value={hexDraft}
          onChange={(event) => setHexDraft(event.target.value)}
          onBlur={(event) => commitHex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitHex((event.target as HTMLInputElement).value);
          }}
          placeholder="None"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
        />
        {color ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Clear colour"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            title={preset}
            aria-label={preset}
            className="size-5 rounded border border-slate-200 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none"
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </div>
  );
};

/** Slate ramp + the app's action/feedback hues — the colours a school document actually needs. */
const PRESETS = [
  '#000000',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#ffffff',
  '#0D6EFD', // app primary
  '#7ED957', // app accent
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
];
