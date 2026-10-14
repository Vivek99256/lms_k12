"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A multi-select with removable chips, over Base UI's Combobox -- the same primitive
 * family the project's `Select` (components/ui/select.tsx) is built on, with the same
 * popup surface, z-index and colour tokens.
 *
 * WHY NOT `Select multiple`. Base UI's Select does support `multiple`, but its trigger
 * is a <button>, and a chip's remove (x) control would be a button nested inside a
 * button: invalid HTML and unreachable by keyboard. A Combobox's chips live in a <div>,
 * so each chip's remove button is a real, focusable control, and the field is also
 * searchable.
 *
 * This file is generic (string-valued items, nothing about questions). The question
 * format picker that uses it is app/course-master/[courseId]/chapters/FormatMultiSelect.tsx.
 */

const Combobox = ComboboxPrimitive.Root

/** A ref to hang the popup off, so it opens under the whole chip field. */
function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips>) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-[50px] w-full flex-wrap items-center gap-1.5 rounded-[7px] border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-none transition-colors",
        "focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#4f46e5]/20",
        "has-aria-invalid:border-rose-400",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  removeLabel,
  ...props
}: ComboboxPrimitive.Chip.Props & { showRemove?: boolean; removeLabel?: string }) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "flex h-7 items-center gap-1 rounded-full border border-indigo-200 bg-[#eef2ff] pr-1 pl-2.5 text-[13px] font-medium whitespace-nowrap text-[#4338ca]",
        "has-disabled:pointer-events-none has-disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          aria-label={removeLabel ?? "Remove"}
          data-slot="combobox-chip-remove"
          className="inline-flex size-5 items-center justify-center rounded-full text-[#4338ca] opacity-70 transition-colors outline-none hover:bg-indigo-100 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[#4f46e5]/40"
        >
          <XIcon className="size-3.5" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn(
        "min-w-24 flex-1 bg-transparent px-1.5 py-1 text-[15px] text-slate-900 outline-none placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  )
}

/** The clear-all and open/close controls that sit at the end of the chip field. */
function ComboboxChipsActions({
  hasValue,
  clearLabel = "Clear all",
}: {
  hasValue: boolean
  clearLabel?: string
}) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
      {hasValue ? (
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          aria-label={clearLabel}
          title={clearLabel}
          className="inline-flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#4f46e5]/40"
        >
          <XIcon className="size-4" />
        </ComboboxPrimitive.Clear>
      ) : null}
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        aria-label="Show options"
        className="inline-flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#4f46e5]/40"
      >
        <ChevronDownIcon className="size-4" />
      </ComboboxPrimitive.Trigger>
    </span>
  )
}

function ComboboxContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        anchor={anchor}
        collisionPadding={8}
        className="isolate z-[120]"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            // The popup is a column with ONE height limit. Its children share that limit:
            // the list scrolls (min-h-0 + flex-1 + overflow-y-auto) in whatever room the
            // other children leave, so nothing can end up outside the popup's visible box.
            "relative z-[120] flex max-h-[min(22rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) min-w-60 origin-(--transform-origin) flex-col overflow-hidden",
            "rounded-xl border border-slate-200/80 bg-white text-slate-700",
            "shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-900/5",
            "duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "min-h-0 flex-1 scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-start gap-2 rounded-lg py-2 pr-9 pl-2.5 text-sm outline-hidden select-none",
        "transition-colors duration-150 data-highlighted:bg-blue-50 data-highlighted:text-blue-700",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
            <CheckIcon className="size-3" />
          </span>
        }
      />
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      // Padding only while it has something to say: the element stays mounted (Base UI needs
      // that for live-region announcements), and an always-padded empty div was 32px of
      // permanent height pushing the list's last row out of the popup.
      className={cn(
        "shrink-0 px-3 py-4 text-center text-[13px] text-slate-500 empty:p-0",
        className
      )}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsActions,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
}
