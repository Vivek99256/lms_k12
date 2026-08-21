'use client'

/**
 * Ported as-is from G2G's `components/ui/data-table.tsx`. Table primitives
 * repointed to `@/components/ui/g2g/table` (same reasoning as button/input/
 * select - see `components/ui/g2g/button.tsx`); `Checkbox` is the native
 * `@/components/ui/checkbox`, which is already a compatible G2G-identical
 * primitive so no fork was needed there. Behavior, props and classes are
 * otherwise unchanged.
 */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/g2g/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/g2g/button'
import { cn } from '@/lib/utils'

const tableVariants = cva('w-full', {
  variants: {
    density: {
      compact: '[&_td]:p-2 [&_th]:p-2',
      normal: '[&_td]:p-3 [&_th]:p-3',
      comfortable: '[&_td]:p-4 [&_th]:p-4',
    },
    striped: {
      true: '[&_tbody_tr:nth-child(odd)]:bg-surface-muted',
      false: '',
    },
  },
  defaultVariants: {
    density: 'normal',
    striped: true,
  },
})

interface Column<T> {
  id: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

export interface DataTableProps<T extends Record<string, any>>
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tableVariants> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  selectable?: boolean
  selectedIds?: string[]
  onSelectChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    /** Noun used in the "Showing X-Y of Z ..." range text, e.g. "employees". Defaults to "results". */
    entityLabel?: string
  }
}

/**
 * Compact page-number list with ellipses, e.g. for page 7 of 20:
 * [1, '...', 5, 6, 7, 8, 9, '...', 20]. Always keeps the first/last page and
 * a window of `siblings` pages around the current one visible.
 */
function getPageNumbers(current: number, totalPages: number, siblings = 1): Array<number | 'ellipsis'> {
  const totalNumbers = siblings * 2 + 5 // first + last + current + 2 ellipses + siblings on each side
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSibling = Math.max(current - siblings, 1)
  const rightSibling = Math.min(current + siblings, totalPages)
  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < totalPages - 1

  const pages: Array<number | 'ellipsis'> = [1]
  if (showLeftEllipsis) pages.push('ellipsis')
  for (let p = leftSibling; p <= rightSibling; p++) {
    if (p !== 1 && p !== totalPages) pages.push(p)
  }
  if (showRightEllipsis) pages.push('ellipsis')
  if (totalPages !== 1) pages.push(totalPages)
  return pages
}

export const DataTable = React.forwardRef<
  HTMLDivElement,
  DataTableProps<any>
>(
  (
    {
      columns,
      data,
      isLoading,
      selectable,
      selectedIds = [],
      onSelectChange,
      onRowClick,
      emptyState,
      density,
      striped,
      pagination,
      className,
      ...props
    },
    ref,
  ) => {
    const handleSelectAll = () => {
      const allIds = data.map((row, i) => String(i))
      onSelectChange?.(selectedIds.length === data.length ? [] : allIds)
    }

    const handleSelectRow = (index: number) => {
      const id = String(index)
      const newSelected = selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
      onSelectChange?.(newSelected)
    }

    return (
      <div ref={ref} className={cn('rounded-lg border border-border', className)} {...props}>
        <Table className={tableVariants({ density, striped })}>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === data.length && data.length > 0}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < data.length}
                    onChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={String(column.id)}
                  className={cn(
                    'font-semibold',
                    column.width && `w-${column.width}`,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-8"
                >
                  <p className="text-muted-foreground">Loading...</p>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-8"
                >
                  {emptyState || <p className="text-muted-foreground">No data available</p>}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  )}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(String(index))}
                        onChange={() => handleSelectRow(index)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={String(column.id)}>
                      {column.render
                        ? column.render(row[column.id], row)
                        : String(row[column.id])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pagination && pagination.total > 0 && (() => {
          const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
          const page = Math.min(Math.max(pagination.page, 1), totalPages)
          const rangeStart = (page - 1) * pagination.pageSize + 1
          const rangeEnd = Math.min(page * pagination.pageSize, pagination.total)
          const entityLabel = pagination.entityLabel ?? 'results'

          return (
            <div className="flex flex-col items-center justify-between gap-3 p-4 border-t border-border sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {pagination.total} {entityLabel}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                {getPageNumbers(page, totalPages).map((p, index) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                      &hellip;
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      className="min-w-9"
                      aria-current={p === page ? 'page' : undefined}
                      onClick={() => pagination.onPageChange(p)}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )
        })()}
      </div>
    )
  },
)
DataTable.displayName = 'DataTable'

export { type Column }
