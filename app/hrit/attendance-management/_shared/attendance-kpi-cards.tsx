'use client'

import { KPICard } from '@/app/hrit/_components/kpi-card'
import { Users, TrendingUp, TrendingDown, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttendanceKPICard {
  id: string
  label: string
  value: number
  unit?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

interface AttendanceKPICardsProps {
  cards: AttendanceKPICard[]
  className?: string
}

export function AttendanceKPICards({ cards, className }: AttendanceKPICardsProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {cards.map((card) => (
        <KPICard
          key={card.id}
          label={card.label}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.trendValue}
        />
      ))}
    </div>
  )
}

export function getEnhancedSummaryCards(data: {
  totalEmployees: number
  attendancePercentage: number
  latePercentage: number
  earlyGoingPercentage: number
  absentPercentage: number
}): AttendanceKPICard[] {
  // No "vs last period" delta is available from the API yet, so trend/
  // trendValue are omitted rather than showing a fabricated +2.5%-style
  // number that has no real data behind it.
  return [
    {
      id: 'total-employees',
      label: 'Total Employees',
      value: data.totalEmployees,
      icon: <Users className="size-4 text-foreground" />,
    },
    {
      id: 'attendance',
      label: 'Attendance %',
      value: data.attendancePercentage,
      unit: '%',
      icon: <TrendingUp className="size-4 text-success" />,
    },
    {
      id: 'late',
      label: 'Late %',
      value: data.latePercentage,
      unit: '%',
      icon: <Clock className="size-4 text-warning" />,
    },
    {
      id: 'early-going',
      label: 'Early Going %',
      value: data.earlyGoingPercentage,
      unit: '%',
      icon: <TrendingDown className="size-4 text-destructive" />,
    },
    {
      id: 'absent',
      label: 'Absent %',
      value: data.absentPercentage,
      unit: '%',
      icon: <XCircle className="size-4 text-destructive" />,
    },
  ]
}
