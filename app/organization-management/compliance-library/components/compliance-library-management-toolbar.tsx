'use client'

/**
 * Ported as-is from G2G's `compliance-library-management-toolbar.tsx`.
 * Only the import paths were adapted to this project's ported G2G UI
 * primitives (`@/components/ui/g2g/*`); classes and behavior unchanged.
 */

import { FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'

interface ComplianceLibraryToolbarProps {
  visibleCount: number
  totalCount: number
  onPrint: () => void
  onExcelExport: () => void
  onPdfExport: () => void
}

export function ComplianceLibraryToolbar({
  visibleCount,
  totalCount,
  onPrint,
  onExcelExport,
  onPdfExport,
}: ComplianceLibraryToolbarProps) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-indigo-400/20 dark:bg-indigo-500/10">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-foreground">Compliance library</h1>
        <p className="text-sm font-medium text-muted-foreground">
          Create, assign, track, and maintain recurring compliance obligations with evidence ownership and export-ready records.
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          {visibleCount} visible of {totalCount} total
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2 border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={onPrint}>
          <Printer className="size-4" />
          Print
        </Button>
        <Button variant="outline" className="gap-2 border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={onExcelExport}>
          <FileSpreadsheet className="size-4" />
          Excel export
        </Button>
        <Button variant="outline" className="gap-2 border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={onPdfExport}>
          <FileText className="size-4" />
          PDF export
        </Button>
      </div>
    </header>
  )
}
