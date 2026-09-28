'use client'

/**
 * Compliance calendar view - Compliance Management, frontend-completion
 * pass. New component. No calendar library (react-big-calendar, FullCalendar,
 * ...) exists anywhere in this repo (confirmed by repo-wide search), so this
 * is a small self-built month grid rather than adding a new dependency for
 * one screen - consistent with the product brief's "use the existing
 * calendar library if one already exists ... do not introduce a new
 * dependency unnecessarily" (there is nothing existing to reuse here).
 *
 * Data comes from `GET .../compliance-library/calendar?year=&month=`
 * (`ComplianceLibraryController::calendar()`) - real due dates, never
 * hardcoded events.
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useComplianceCalendar } from '../../_lib/use-compliance-extras'
import type { ComplianceCalendarEvent } from '../../_lib/compliance-library-api'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildGridDays(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month - 1, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(year, month - 1, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return { date, inMonth: date.getMonth() === month - 1 }
  })
}

export function ComplianceCalendarView({ onSelectRecord }: { onSelectRecord: (id: string) => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const { events, loading } = useComplianceCalendar(year, month)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ComplianceCalendarEvent[]>()
    events.forEach((event) => {
      if (!event.due_date) return
      const list = map.get(event.due_date) ?? []
      list.push(event)
      map.set(event.due_date, list)
    })
    return map
  }, [events])

  const gridDays = useMemo(() => buildGridDays(year, month), [year, month])

  const goPrev = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) } else setMonth((m) => m - 1)
  }
  const goNext = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) } else setMonth((m) => m + 1)
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{monthLabel}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon-sm" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={goNext} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-96 animate-pulse rounded-xl bg-muted/20" />
        ) : (
          <div className="grid grid-cols-7 gap-1 text-xs">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {gridDays.map(({ date, inMonth }) => {
              const key = date.toISOString().slice(0, 10)
              const dayEvents = eventsByDay.get(key) ?? []
              const isToday = key === today.toISOString().slice(0, 10)

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[86px] rounded-lg border border-border/60 p-1.5',
                    !inMonth && 'bg-muted/10 opacity-50',
                    isToday && 'border-primary/60 ring-1 ring-primary/30',
                  )}
                >
                  <p className="text-right text-[11px] text-muted-foreground">{date.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelectRecord(String(event.id))}
                        className="block w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/20"
                        title={event.name}
                      >
                        {event.name}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {events.slice(0, 6).map((event) => (
              <StatusBadge key={event.id} status={event.status} size="sm" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
