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

export function ReportActions({
  onExportCsv,
  onExportExcel,
  onPrint,
  onExportPdf,
}: {
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onExportCsv}>
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onExportExcel}>
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onExportPdf}>
        <FileText className="h-4 w-4" />
        PDF
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onPrint}>
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
