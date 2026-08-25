'use client'

/**
 * Ported as-is from G2G's `components/domain/organization/components.tsx`
 * (org-specific wrappers) plus the Layer-2 primitives it re-exports from
 * `@/shared/business` (`components/shared/business/shared.tsx` in G2G -
 * `SectionCard`, `ReadField`, `FormField`, `Tabs`). G2G's tsconfig maps
 * `@/shared/*` -> `./components/shared/*`; this project has no such alias
 * (and no other module needed one yet), so both layers are folded into this
 * single local file instead of a two-file re-export chain.
 *
 * None of the ported Employee Directory screens (`employee-directory.tsx`,
 * `employee-directory-sheets.tsx`, the 7 `edit-employee/*` tabs) actually
 * import this module - they build their own inline markup - but the
 * migration brief calls it out explicitly as an org-domain dependency to
 * port, so it is kept available here for parity/future use, unchanged from
 * source.
 */

import * as React from 'react'
import { Lock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/g2g/card'
import { Input } from '@/components/ui/g2g/input'
import { Select } from '@/components/ui/g2g/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// SectionCard - wraps Card primitive for section grouping
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('rounded-xl', className)}>
      {(title || actions) && (
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              {title && (
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              )}
              {description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ReadField - simple key-value display
export function ReadField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

// FormField - wrapper with label and hint
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Tabs - custom implementation for tab navigation
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px h-10 px-4 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// TextInput - wrapper around Input primitive (org-specific)
export function TextInput({
  id,
  placeholder,
  defaultValue,
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  type?: string
  disabled?: boolean
}) {
  return (
    <Input
      id={id}
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

// SelectInput - wrapper around Select primitive (org-specific)
export function SelectInput({
  id,
  defaultValue,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  id?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      id={id}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className={className}
    />
  )
}

// TextArea - wrapper around Textarea primitive (org-specific)
export function TextArea({
  id,
  placeholder,
  defaultValue,
  value,
  onChange,
  rows = 3,
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
  rows?: number
  disabled?: boolean
}) {
  return (
    <Textarea
      id={id}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

// AccessDenied - uses Lock icon and custom layout (org-specific)
export function AccessDenied({ role }: { role: string }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-lg bg-danger/10 text-danger"
        aria-hidden="true"
      >
        <Lock className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        The <span className="font-semibold text-foreground">{role}</span> role does
        not have permission to view this page. Contact your administrator if you
        believe this is an error.
      </p>
    </div>
  )
}
