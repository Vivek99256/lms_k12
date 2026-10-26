'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { AdminAvailabilityStatus } from '@/lib/live-chat/types';

interface AdminAvailabilityToggleProps {
  status: AdminAvailabilityStatus;
  onStatusChange: (status: AdminAvailabilityStatus) => void;
  size?: 'sm' | 'md';
}

export function AdminAvailabilityToggle({
  status,
  onStatusChange,
  size = 'sm',
}: AdminAvailabilityToggleProps) {
  const [open, setOpen] = useState(false);

  const options: Array<{
    label: string;
    sublabel: string;
    value: AdminAvailabilityStatus;
    color: string;
    bg: string;
    border: string;
  }> = [
    {
      label: 'Online',
      sublabel: 'Available to chat and accept calls',
      value: 'available',
      color: 'text-emerald-700',
      bg: 'bg-emerald-500',
      border: 'border-emerald-200 bg-emerald-50/80',
    },
    {
      label: 'Offline',
      sublabel: 'Away; students will see offline',
      value: 'offline',
      color: 'text-red-700',
      bg: 'bg-red-500',
      border: 'border-red-200 bg-red-50/80',
    },
    {
      label: 'Busy',
      sublabel: 'Currently in another meeting',
      value: 'busy',
      color: 'text-amber-700',
      bg: 'bg-amber-500',
      border: 'border-amber-200 bg-amber-50/80',
    },
  ];

  const current = options.find((o) => o.value === status) || options[0];

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all shadow-2xs hover:brightness-95 active:scale-95 ${
          current.border
        } ${current.color}`}
        title={`Status: ${current.label}. Click to switch between Online and Offline.`}
      >
        <span
          className={`size-2 rounded-full ${current.bg} ${
            status === 'available' ? 'animate-pulse ring-2 ring-emerald-400/40' : ''
          }`}
        />
        <span>{current.label}</span>
        <ChevronDown className="size-3 opacity-60 ml-0.5" />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Set Admin Status
            </div>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onStatusChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-start justify-between rounded-xl p-2 text-left transition-colors ${
                  opt.value === status
                    ? 'bg-gray-100 text-gray-900 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${opt.bg} ${
                      opt.value === 'available' ? 'animate-pulse' : ''
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-gray-400 leading-tight">
                      {opt.sublabel}
                    </div>
                  </div>
                </div>
                {opt.value === status ? (
                  <Check className="size-4 text-[#0D6EFD] shrink-0 mt-0.5" />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
