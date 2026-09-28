'use client'

/**
 * "My Compliance" tab - Compliance Management, frontend-completion pass. New
 * component. Shows only the compliance items assigned to the logged-in user
 * (`GET .../compliance-library/my`, scoped server-side to `assigned_to =
 * session user_id` AND the session's tenant - see
 * `ComplianceLibraryController::my()`), so RBAC/tenant isolation is enforced
 * by the backend, not by hiding rows client-side.
 */

import { Eye, Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/g2g/badge'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/g2g/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { useMyCompliance } from '../../_lib/use-compliance-extras'
import { displayDate, TableSkeleton } from './compliance-library-management-shared'

const PRIORITY_VARIANT: Record<string, 'default' | 'navy' | 'warning' | 'destructive'> = {
  Low: 'default',
  Medium: 'navy',
  High: 'warning',
  Critical: 'destructive',
}

export function MyCompliance({ onSelectRecord }: { onSelectRecord: (id: string) => void }) {
  const { records, summary, loading } = useMyCompliance()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: summary?.total ?? 0 },
          { label: 'Upcoming', value: summary?.upcoming ?? 0 },
          { label: 'Due Soon', value: summary?.due_soon ?? 0 },
          { label: 'Overdue', value: summary?.overdue ?? 0 },
          { label: 'Completed', value: summary?.completed ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">My Compliance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
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
                        <Badge variant={PRIORITY_VARIANT[record.priority ?? ''] ?? 'default'}>{record.priority ?? '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={record.derived_status ?? record.status ?? undefined} size="sm" />
                      </TableCell>
                      <TableCell>
                        {record.evidence_count ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Paperclip className="size-3.5" /> {record.evidence_count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={`View ${record.name}`} onClick={() => onSelectRecord(String(record.id))}>
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
