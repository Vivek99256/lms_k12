'use client';

import type { ReactNode } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import type { PaginatedResult } from '@/app/fees/_lib/fees-report-utils';
import { logFeesOperation, type FeesOperationKey } from '@/lib/fees/fees-ai-stack';

/**
 * What a report screen tells the AI Stack when somebody takes a document out of it.
 *
 * Optional on `ReportActions`, and that is deliberate: thirteen report screens already
 * call that component with four callbacks, and making this required would have been a
 * breaking change to all of them for no gain. A screen opts in by passing it.
 */
export interface ReportActivity {
  /** Which Fees operation this report is. Decides the template the ledger cites. */
  operation: Extract<FeesOperationKey, 'fee_report' | 'defaulter_report'>;
  /** The report's own name, as the screen calls it. */
  label: string;
  /** How many rows left the building. Counted, never estimated. */
  rowCount: number;
  /** The filters that produced it, so the entry can be reproduced. */
  filters?: Record<string, unknown>;
}

export function ReportActions({
  onExportCsv,
  onExportExcel,
  onPrint,
  onExportPdf,
  activity,
}: {
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  /** Supply to record each export in the Fees AI Stack ledger. */
  activity?: ReportActivity;
}) {
  /**
   * Run the screen's own action first, then record.
   *
   * Order matters: the export is what the user asked for, and a ledger write must never
   * be able to delay or prevent it. `logFeesOperation` returns nothing to await.
   */
  const withRecord = (format: string, action: () => void) => () => {
    action();

    if (!activity) return;

    logFeesOperation(activity.operation, {
      status: 'completed',
      message: `${activity.label} exported as ${format} (${activity.rowCount} row${activity.rowCount === 1 ? '' : 's'}).`,
      reference: activity.label,
      result: {
        format,
        row_count: activity.rowCount,
        ...(activity.filters ? { filters: activity.filters } : {}),
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={withRecord('CSV', onExportCsv)}>
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={withRecord('Excel', onExportExcel)}>
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={withRecord('PDF', onExportPdf)}>
        <FileText className="h-4 w-4" />
        PDF
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={withRecord('Print', onPrint)}>
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  );
}

export function ReportSummaryBar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
      {children}
    </div>
  );
}

export function SummaryChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function PaginationFooter<T>({
  pagination,
  onPageChange,
}: {
  pagination: PaginatedResult<T>;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalItems === 0) {
    return null;
  }

  const pageItems = Array.from({ length: pagination.totalPages }, (_, index) => {
    const page = index + 1;
    return (
      <PaginationItem key={page}>
        <PaginationLink
          href="#"
          isActive={page === pagination.page}
          onClick={(event) => {
            event.preventDefault();
            onPageChange(page);
          }}
        >
          {page}
        </PaginationLink>
      </PaginationItem>
    );
  });

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
      <p>
        Showing {pagination.startIndex}-{pagination.endIndex} of {pagination.totalItems}
      </p>
      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault();
                if (pagination.page > 1) onPageChange(pagination.page - 1);
              }}
            />
          </PaginationItem>
          {pageItems}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault();
                if (pagination.page < pagination.totalPages) onPageChange(pagination.page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
