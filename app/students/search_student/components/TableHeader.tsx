'use client';

import React from 'react';

export interface TableHeaderProps {
  label: string;
  sortable?: boolean;
  sortKey?: string;
  currentSort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
}

export function TableHeader({ label, sortable, sortKey, currentSort, onSort }: TableHeaderProps) {
  if (!sortable || !sortKey) return <span className="font-semibold text-gray-700">{label}</span>;

  const isActive = currentSort?.key === sortKey;

  return (
    <button
      onClick={() => onSort?.(sortKey, isActive && currentSort?.dir === 'asc' ? 'desc' : 'asc')}
      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-[#0D6EFD] transition-colors group"
    >
      {label}
      <span className="opacity-40 group-hover:opacity-100 transition-opacity">
        {isActive ? (
          currentSort?.dir === 'asc' ? <span>↑</span> : <span>↓</span>
        ) : (
          <span>↕</span>
        )}
      </span>
    </button>
  );
}
