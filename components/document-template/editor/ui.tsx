'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

/**
 * Self-contained UI primitives for the template designer.
 *
 * The designer is a dense, specialised surface (toolbox rails, settings
 * inspectors, floating toolbars) whose controls have no equivalent in
 * components/ui. Keeping them local also avoids coupling the ported editor to
 * the Base UI `render`-prop API, which differs from the Radix `asChild` API the
 * upstream HR editor was written against.
 *
 * Visual language matches the rest of the app: slate neutrals, indigo action,
 * hairline borders, soft radii, flat fills — no gradients.
 */

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ToolButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
};

const TOOL_BUTTON_VARIANTS: Record<NonNullable<ToolButtonProps['variant']>, string> = {
  default: 'bg-[#0D6EFD] text-white hover:bg-blue-600 active:bg-blue-700 border-transparent',
  outline: 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-200',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 border-transparent',
  danger: 'bg-white text-red-600 hover:bg-red-50 active:bg-red-100 border-slate-200 hover:border-red-200',
};

const TOOL_BUTTON_SIZES: Record<NonNullable<ToolButtonProps['size']>, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3 text-sm',
  icon: 'h-8 w-8 justify-center',
};

export function ToolButton({
  variant = 'outline',
  size = 'sm',
  className = '',
  ...props
}: ToolButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex shrink-0 items-center rounded-lg border font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 ${TOOL_BUTTON_VARIANTS[variant]} ${TOOL_BUTTON_SIZES[size]} ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{children}</label>;
}

export function TextField({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <input {...props} className={`${fieldClass} ${className}`} />
    </div>
  );
}

/** Small segmented switcher — the Tabs stand-in used by the settings inspector. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-semibold tracking-wide uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
              active
                ? 'border-[#0D6EFD] text-[#0D6EFD]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'error';

type ToastMessage = { id: number; title: string; description?: string; tone: ToastTone };

let pushToast: ((message: Omit<ToastMessage, 'id'>) => void) | null = null;
let toastId = 0;

/** Fire a toast from anywhere in the editor (no provider wiring at call sites). */
export function toast(message: { title: string; description?: string; tone?: ToastTone }) {
  pushToast?.({ title: message.title, description: message.description, tone: message.tone ?? 'success' });
}

export function ToastViewport() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    pushToast = (message) => {
      const id = ++toastId;
      setMessages((current) => [...current, { ...message, id }]);
      window.setTimeout(() => {
        setMessages((current) => current.filter((entry) => entry.id !== id));
      }, 4000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[300] flex flex-col gap-2">
      {messages.map((message) => (
        <div
          key={message.id}
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-80 items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            message.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.tone === 'error' ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{message.title}</p>
            {message.description ? <p className="mt-0.5 text-xs opacity-80">{message.description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setMessages((current) => current.filter((entry) => entry.id !== message.id))}
            className="rounded p-0.5 opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/** Lightweight dropdown: click to open, click-away or Escape to close. */
export function Menu({
  trigger,
  children,
  align = 'end',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open ? (
        <div
          className={`absolute top-full z-[200] mt-1.5 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 ${className}`}
    />
  );
}
