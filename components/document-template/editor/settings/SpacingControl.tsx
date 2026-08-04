'use client';

import React from 'react';
import { FieldLabel, fieldClass } from '../ui';

interface SpacingControlProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export const SpacingControl = ({ value, onChange, label }: SpacingControlProps) => {
  // Values round-trip as CSS pixel strings ("16px"); the field edits the number.
  const numValue = value ? value.replace('px', '') : '';

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={numValue}
          onChange={(event) => onChange(event.target.value ? `${event.target.value}px` : '')}
          className={fieldClass}
          placeholder="0"
        />
        <span className="text-xs font-medium text-slate-400">px</span>
      </div>
    </div>
  );
};
