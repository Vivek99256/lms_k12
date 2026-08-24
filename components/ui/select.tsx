"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

const VARIANT_CLASSES = {
  default: "rounded-xl border-slate-200 bg-white hover:border-slate-300 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-sm hover:shadow transition-all duration-200",
  soft: "rounded-xl border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 hover:shadow-sm focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all duration-200",
  filled: "rounded-xl border-slate-200 bg-slate-100/60 hover:bg-slate-100 hover:border-slate-300 focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all duration-200",
}

const TRIGGER_SIZE_CLASSES = {
  default: "h-10 text-sm",
  sm: "h-9 text-[13px]",
  lg: "h-11 text-base",
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("p-1.5", className)}
      {...props}
    />
  )
}

export const selectVariants = {
  default: VARIANT_CLASSES.default,
  soft: VARIANT_CLASSES.soft,
  filled: VARIANT_CLASSES.filled,
}

export type SelectVariant = keyof typeof VARIANT_CLASSES
export type SelectSize = keyof typeof TRIGGER_SIZE_CLASSES

type ExtendedTriggerProps = SelectPrimitive.Trigger.Props & {
  size?: SelectSize
  variant?: SelectVariant
  icon?: React.ReactNode
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  icon,
  children,
  ...props
}: ExtendedTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl border bg-transparent py-2.5 pr-3 pl-3.5 text-sm whitespace-nowrap transition-all duration-200 outline-none select-none",
        "data-placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        TRIGGER_SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {icon && <span className="text-slate-400 [&_svg]:size-4 [&_svg]:shrink-0">{icon}</span>}
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-slate-400 transition-transform duration-200" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[120]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative z-[120] max-h-(--available-height) min-w-36 w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto",
            "rounded-xl border border-slate-200/80 bg-white text-slate-700",
            "shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-900/5",
            "duration-150",
            "data-[align-trigger=true]:animate-none",
            "data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3 data-[side=left]:slide-in-from-right-3 data-[side=right]:slide-in-from-left-3",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-lg py-2 pr-8 pl-2.5 text-sm outline-hidden select-none",
        "transition-all duration-150",
        "focus:bg-blue-50 focus:text-blue-700",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        "not-data-[variant=destructive]:focus:**:text-accent-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white [&_svg]:size-3 [&_svg]:text-white">
            <CheckIcon className="pointer-events-none" />
          </span>
        }
      />
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-slate-100", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-gradient-to-b from-white to-transparent py-2 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="text-slate-400" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-gradient-to-t from-white to-transparent py-2 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="text-slate-400" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
