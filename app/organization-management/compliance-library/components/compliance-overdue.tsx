'use client'

/**
 * "Overdue Compliance" tab - Compliance Management, frontend-completion
 * pass. New component. Backed by `GET .../compliance-library/overdue`
 * (`ComplianceLibraryController::overdue()`), which already excludes
 * Completed/Not Applicable records and computes `days_overdue` server-side.
 */

import { AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/g2g/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { useOverdueCompliance } from '../../_lib/use-compliance-extras'
import { displayDate, TableSkeleton } from './compliance-library-management-shared'
import { IconTile, PriorityPill, TABLE_HEADER_CLASS, ToneBadge } from './compliance-theme'

export function OverdueCompliance({ onSelectRecord }: { onSelectRecord: (id: string) => void }) {
  const { records, loading } = useOverdueCompliance()

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <IconTile tone="error">
            <AlertTriangle className="size-5" />
          </IconTile>
          Overdue compliance
        </CardTitle>
        <CardDescription>Compliance whose due date has passed without being completed or marked Not Applicable.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton />
        ) : (
          <Table>
            <TableHeader className={TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead>Compliance</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-16 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nothing is overdue right now.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <TableCell className="font-medium text-foreground">{record.name}</TableCell>
                    <TableCell>{record.department ?? '-'}</TableCell>
                    <TableCell>{record.assigned_user ?? '-'}</TableCell>
                    <TableCell>{displayDate(record.due_date)}</TableCell>
                    <TableCell>
                      <ToneBadge tone="error" dot>{record.days_overdue ?? '-'} days</ToneBadge>
                    </TableCell>
                    <TableCell>
                      <PriorityPill priority={record.priority} />
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
  )
}
