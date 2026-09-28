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

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--destructive)']

const KPI_CONFIG: { key: keyof ComplianceDashboardResponse['kpis']; label: string; icon: typeof TrendingUp }[] = [
  { key: 'total', label: 'Total Compliance', icon: TrendingUp },
  { key: 'due_this_month', label: 'Due This Month', icon: CalendarClock },
  { key: 'due_soon', label: 'Due Soon', icon: Clock },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'critical', label: 'Critical', icon: ShieldAlert },
  { key: 'pending_verification', label: 'Pending Verification', icon: FileWarning },
  { key: 'pending_evidence_verification', label: 'Evidence Awaiting Review', icon: Timer },
]

export function ComplianceDashboard({ data, loading }: { data: ComplianceDashboardResponse | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/20" />
        ))}
      </div>
    )
  }

  const statusData = Object.entries(data.status_distribution).map(([label, value]) => ({ label, value }))

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CONFIG.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{data.kpis[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>Where every compliance record currently sits in its lifecycle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusData.map((entry, index) => (
                      <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Distribution</CardTitle>
            <CardDescription>Compliance obligations by owning department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.department_distribution} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-20} textAnchor="end" height={50} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Bar dataKey="value" name="Records" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Distribution</CardTitle>
            <CardDescription>Compliance obligations by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.category_distribution} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-20} textAnchor="end" height={50} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Bar dataKey="value" name="Records" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
