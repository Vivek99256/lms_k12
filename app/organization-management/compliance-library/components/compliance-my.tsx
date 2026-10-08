'use client'

/**
 * "My Compliance" tab - Compliance Management, frontend-completion pass. New
 * component. Shows only the compliance items assigned to the logged-in user
 * (`GET .../compliance-library/my`, scoped server-side to `assigned_to =
 * session user_id` AND the session's tenant - see
 * `ComplianceLibraryController::my()`), so RBAC/tenant isolation is enforced
 * by the backend, not by hiding rows client-side.
 */

import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Eye, ListChecks, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { useMyCompliance } from '../../_lib/use-compliance-extras'
import { displayDate, TableSkeleton } from './compliance-library-management-shared'
import { PriorityPill, StatTile, StatusPill, TABLE_HEADER_CLASS, ToneBadge, type Tone } from './compliance-theme'

export function MyCompliance({ onSelectRecord }: { onSelectRecord: (id: string) => void }) {
  const { records, summary, loading } = useMyCompliance()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          { label: 'Total', value: summary?.total ?? 0, tone: 'brand', icon: ListChecks },
          { label: 'Upcoming', value: summary?.upcoming ?? 0, tone: 'info', icon: CalendarClock },
          { label: 'Due soon', value: summary?.due_soon ?? 0, tone: 'warning', icon: Clock },
          { label: 'Overdue', value: summary?.overdue ?? 0, tone: 'error', icon: AlertTriangle },
          { label: 'Completed', value: summary?.completed ?? 0, tone: 'success', icon: CheckCircle2 },
        ] as { label: string; value: number; tone: Tone; icon: typeof Clock }[]).map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} icon={<stat.icon className="size-4" />} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">My compliance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className={TABLE_HEADER_CLASS}>
                <TableRow>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead className="w-16 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nothing is currently assigned to you.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium text-foreground">{record.name}</TableCell>
                      <TableCell>{displayDate(record.due_date)}</TableCell>
                      <TableCell>
                        <PriorityPill priority={record.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={record.derived_status ?? record.status} />
                      </TableCell>
                      <TableCell>
                        {record.evidence_count ? (
                          <ToneBadge tone="info">
                            <Paperclip className="size-3" /> {record.evidence_count}
                          </ToneBadge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" className="text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label={`View ${record.name}`} onClick={() => onSelectRecord(String(record.id))}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
