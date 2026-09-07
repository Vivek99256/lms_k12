'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function SelectInput({
  value,
  onChange,
  options,
  disabled,
  className,
  id,
}: {
  id?: string
  value?: string
  onChange?: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      className={cn(
        'h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
