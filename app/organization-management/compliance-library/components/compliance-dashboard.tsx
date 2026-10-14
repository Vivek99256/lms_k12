'use client'

/**
 * Compliance Management dashboard - Compliance Management, frontend-completion
 * pass. New component; the register previously computed 3 client-side stats
 * from the already-loaded page of records (see the old `stats` useMemo this
 * replaces). All numbers here come from
 * `GET .../compliance-library/dashboard` (`ComplianceLibraryController::dashboard()`),
 * which counts across the WHOLE tenant, not just the current page.
 *
 * Charts reuse `recharts` (already a project dependency, see
 * `app/hrit/leave-management/leave-dashboard/components/DepartmentChart.tsx`
 * for the established styling convention followed here) rather than adding a
 * new charting library.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, FileWarning, ShieldAlert, TrendingUp, Timer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import type { ComplianceDashboardResponse } from '../../_lib/compliance-library-api'
import { StatTile, STATUS_TONE, TONE_HEX, type Tone } from './compliance-theme'

const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(15,23,42,.10)' }

const KPI_CONFIG: { key: keyof ComplianceDashboardResponse['kpis']; label: string; icon: typeof TrendingUp; tone: Tone }[] = [
  { key: 'total', label: 'Total compliance', icon: TrendingUp, tone: 'brand' },
  { key: 'due_this_month', label: 'Due this month', icon: CalendarClock, tone: 'info' },
  { key: 'due_soon', label: 'Due soon', icon: Clock, tone: 'warning' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'error' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'success' },
  { key: 'critical', label: 'Critical', icon: ShieldAlert, tone: 'error' },
  { key: 'pending_verification', label: 'Pending verification', icon: FileWarning, tone: 'brand' },
  { key: 'pending_evidence_verification', label: 'Evidence awaiting review', icon: Timer, tone: 'neutral' },
]

export function ComplianceDashboard({ data, loading }: { data: ComplianceDashboardResponse | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg border border-border/70 bg-muted/20" />
        ))}
      </div>
    )
  }

  const statusData = Object.entries(data.status_distribution).map(([label, value]) => ({ label, value }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {KPI_CONFIG.map(({ key, label, icon: Icon, tone }) => (
          <StatTile key={key} label={label} tone={tone} value={data.kpis[key] ?? 0} icon={<Icon className="size-4" />} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status distribution</CardTitle>
            <CardDescription>Where every compliance record currently sits in its lifecycle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={6}>
                    {statusData.map((entry) => (
                      <Cell key={entry.label} fill={TONE_HEX[STATUS_TONE[entry.label] ?? 'neutral']} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department distribution</CardTitle>
            <CardDescription>Compliance obligations by owning department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.department_distribution} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-20} textAnchor="end" height={50} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(79,70,229,.06)' }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Records" fill={TONE_HEX.brand} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category distribution</CardTitle>
            <CardDescription>Compliance obligations by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.category_distribution} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-20} textAnchor="end" height={50} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(79,70,229,.06)' }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Records" fill={TONE_HEX.success} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
