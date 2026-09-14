import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayMs?: number
  /**
   * Make the wrapper itself focusable.
   *
   * Needed when the thing being explained cannot take focus on its own — a
   * disabled switch is the case that matters here. A `disabled` control is
   * skipped by the tab order entirely, so without this the tooltip explaining
   * why it is locked is unreachable by keyboard.
   */
  focusable?: boolean
  children: React.ReactNode
}

/**
 * Hover- and focus-triggered tooltip.
 *
 * Opens on pointer hover and on keyboard focus, and closes on Escape, so it
 * meets WCAG 2.2 "content on hover or focus" rather than being mouse-only.
 */
const Tooltip = ({ content, side = 'top', delayMs = 200, focusable = false, children }: TooltipProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = React.useId()

  const clearPendingOpen = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Without this the pending open fires after unmount and sets state on a gone
  // component.
  React.useEffect(() => clearPendingOpen, [clearPendingOpen])

  const openAfterDelay = () => {
    clearPendingOpen()
    timeoutRef.current = setTimeout(() => setIsOpen(true), delayMs)
  }

  const close = () => {
    clearPendingOpen()
    setIsOpen(false)
  }

  // Focus should not wait — a keyboard user has already committed to the
  // control, so the delay that stops hover flicker only gets in their way.
  const openNow = () => {
    clearPendingOpen()
    setIsOpen(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      // Dismissible without moving the pointer or focus (WCAG 2.2, 1.4.13).
      event.stopPropagation()
      close()
    }
  }

  const sideClass = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
  }[side]

  const arrowClass = {
    top: 'top-full -translate-y-0.5 border-t-card border-x-transparent border-b-transparent',
    right: 'right-full translate-x-0.5 border-r-card border-y-transparent border-l-transparent',
    bottom: 'bottom-full translate-y-0.5 border-b-card border-x-transparent border-t-transparent',
    left: 'left-full -translate-x-0.5 border-l-card border-y-transparent border-r-transparent',
  }[side]

  return (
    <div
      className="relative inline-block"
      onMouseEnter={openAfterDelay}
      onMouseLeave={close}
      onFocus={openNow}
      onBlur={close}
      onKeyDown={handleKeyDown}
      aria-describedby={isOpen ? tooltipId : undefined}
      {...(focusable ? { tabIndex: 0 } : {})}
    >
      {children}
      {isOpen && (
        <div
          id={tooltipId}
          className={cn(
            'absolute z-50 w-max max-w-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg',
            sideClass,
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute border-4',
              arrowClass,
            )}
          />
        </div>
      )}
    </div>
  )
}
Tooltip.displayName = 'Tooltip'

export { Tooltip }
