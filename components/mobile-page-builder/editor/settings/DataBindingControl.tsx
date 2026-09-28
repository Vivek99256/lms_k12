'use client';

import React from 'react';
import type { MobileDataBinding } from '../../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

/**
 * Binds a block's content to a dotted field path resolved against the
 * page's data source response at runtime (see MobilePageRenderer). Shared
 * by every block that can show live data (Text, Image, Input) rather than
 * duplicated per block.
 */
export const DataBindingControl = ({
  dataBinding,
  onChange,
  placeholder = 'student.name',
}: {
  dataBinding?: MobileDataBinding | null;
  onChange: (next: MobileDataBinding | null) => void;
  placeholder?: string;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-500">Data field</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={dataBinding?.field ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onChange(value.trim() === '' ? null : { field: value });
          }}
          placeholder={placeholder}
          spellCheck={false}
          className={fieldClass}
        />
        {dataBinding ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-lg px-1.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="text-[10px] text-slate-400">
        Resolved against the page&apos;s Data Source response when published. Leave empty to use the static value above.
      </p>
    </div>
  );
};
