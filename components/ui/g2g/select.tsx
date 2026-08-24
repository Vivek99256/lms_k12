'use client'

/**
 * Ported as-is from G2G's `components/ui/select.tsx` — a flat, single-file
 * combobox-style Select (`value`/`onChange`/`options`/`placeholder`/`size`).
 *
 * Decision (this vs `components/ui/select.tsx`): NOT reused. That native
 * select is a *different*, incompatible API — a composable
 * `@base-ui/react/select` family (`Select`/`SelectTrigger`/`SelectContent`/
 * `SelectItem`/...). Every G2G-ported screen (HRIT payroll, Talent
 * Management's Performance & Rewards, Recruitment, Onboarding, Offboarding,
 * Mobility & Succession) calls the flat
 * `<Select value onChange options placeholder aria-label />` shape directly,
 * so overwriting the native select.tsx would break every other consumer of
 * that primitive across the app. This is the single shared copy for every
 * ported G2G module - it replaces what used to be separate per-module copies
 * (`app/hrit/_components/select.tsx`, `app/talent-management/_components/
 * select.tsx`, `app/talent-management/_components/ui/select.tsx`); do not
 * fork another one per module. Only the `cn` import path was checked
 * (already `@/lib/utils` in G2G, unchanged); behavior, classes and props are
 * unchanged.
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options?: SelectOption[]
  className?: string
  size?: 'sm' | 'default' | 'lg'
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
  /** Floor for the dropdown panel's width, for options with long labels (default: trigger width). Clamped to fit the viewport. Opt-in, other consumers unaffected. */
  minPanelWidthPx?: number
  /** Extra classes merged onto the dropdown panel, e.g. to raise `max-h-60` for a taller scroll area. Opt-in, other consumers unaffected. */
  panelClassName?: string
  /**
   * Allow option labels to wrap onto multiple lines instead of a single
   * `whitespace-nowrap` line, and hide the panel's horizontal scrollbar
   * (only vertical scrolling remains). Use for options whose labels can be
   * far longer than any reasonable panel width (e.g. "General Manager /
   * Managing Director / Vice President (...)") - default false keeps every
   * other consumer's current single-line behavior.
   */
  wrapOptionLabels?: boolean
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ id, className, size = 'default', value, onChange, options = [], placeholder = 'Select...', disabled, 'aria-label': ariaLabel, minPanelWidthPx, panelClassName, wrapOptionLabels }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const [isMounted, setIsMounted] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()
    const typeaheadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const typeaheadBufferRef = React.useRef('')
    const listboxId = React.useId()

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    React.useEffect(() => {
      if (open) {
        setIsMounted(true)
        const currentIndex = options.findIndex((o) => String(o.value) === String(value))
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
      } else {
        const timer = setTimeout(() => setIsMounted(false), 150)
        return () => clearTimeout(timer)
      }
    }, [open, value, options])

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useLayoutEffect(() => {
      if (!open) return

      const positionPopover = () => {
        const trigger = containerRef.current?.getBoundingClientRect()
        if (!trigger) return
        const viewportMargin = 16
        const maxWidth = window.innerWidth - viewportMargin * 2
        const width = Math.min(Math.max(trigger.width, minPanelWidthPx ?? 0, 128), maxWidth)
        const left = Math.min(trigger.left, window.innerWidth - width - viewportMargin)
        setPopoverStyle({
          top: trigger.bottom + 4,
          left: Math.max(left, viewportMargin),
          width,
        })
      }

      positionPopover()
      window.addEventListener('resize', positionPopover)
      window.addEventListener('scroll', positionPopover, true)
      return () => {
        window.removeEventListener('resize', positionPopover)
        window.removeEventListener('scroll', positionPopover, true)
      }
    }, [open, minPanelWidthPx])

    React.useEffect(() => {
      if (!open || !listRef.current) return

      const items = listRef.current.querySelectorAll('[role="option"]')
      items.forEach((item, index) => {
        if (index === highlightedIndex) {
          item.scrollIntoView({ block: 'nearest' })
        }
      })
    }, [highlightedIndex, open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (open && highlightedIndex >= 0) {
            onChange?.(options[highlightedIndex].value)
            setOpen(false)
          } else {
            setOpen(true)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
          }
          break
        case 'Home':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(0)
          }
          break
        case 'End':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(options.length - 1)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
        case 'Tab':
          setOpen(false)
          break
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            typeaheadBufferRef.current += e.key.toLowerCase()

            if (typeaheadTimeoutRef.current) {
              clearTimeout(typeaheadTimeoutRef.current)
            }

            typeaheadTimeoutRef.current = setTimeout(() => {
              typeaheadBufferRef.current = ''
            }, 500)

            const matchIndex = options.findIndex((opt) => opt.label.toLowerCase().startsWith(typeaheadBufferRef.current))

            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex)
            }
          }
      }
    }

    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    const selectedLabel = options.find((o) => String(o.value) === String(value))?.label || placeholder
    const portalContainer =
      containerRef.current?.closest('[data-slot="sheet-content"]') ?? (typeof document !== 'undefined' ? document.body : null)

    return (
      <div ref={containerRef} id={id} className="relative inline-block w-full" onKeyDown={handleKeyDown}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-input bg-transparent py-1.5 text-foreground transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 appearance-none cursor-pointer active:scale-95',
            sizeClass,
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className="truncate" title={selectedLabel}>{selectedLabel}</span>
          <ChevronDown className={cn('size-4 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {(isMounted || open) &&
          portalContainer &&
          createPortal(
            <div
              ref={listRef}
              style={popoverStyle}
              role="listbox"
              aria-label={ariaLabel || 'Select options'}
              className={cn(
                'pointer-events-auto fixed z-[100] max-h-60 min-w-[8rem] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-border/50 bg-card/98 backdrop-blur-xl p-1 shadow-xl ring-1 ring-black/5',
                'origin-top transition-all duration-150 ease-out',
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none',
                panelClassName,
              )}
            >
              <div className="flex flex-col gap-0.5">
                {options.map((opt, index) => (
                  <div
                    key={`${opt.value}-${index}`}
                    role="option"
                    aria-selected={String(value) === String(opt.value)}
                    data-disabled={opt.value === value}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      onChange?.(opt.value)
                      setOpen(false)
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground',
                      highlightedIndex === index && 'bg-accent text-accent-foreground',
                      String(value) === String(opt.value) && 'bg-primary/15 text-primary font-medium',
                    )}
                  >
                    <span className={cn('flex-1', wrapOptionLabels ? 'whitespace-normal break-words' : 'truncate')}>
                      {opt.label}
                    </span>
                    {String(value) === String(opt.value) && <Check className="size-4 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>,
            portalContainer,
          )}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select, type SelectOption }
