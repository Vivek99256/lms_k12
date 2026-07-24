"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import {
  getProxySession,
  listProxies,
  type ProxyRecord,
} from "@/app/proxy_master/api";

const PAGE_SIZE = 10;
const columns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "date", label: "Date" },
  { key: "standard", label: "Standard" },
  { key: "division", label: "Division" },
  { key: "absentTeacher", label: "Absent Teacher" },
  { key: "proxyTeacher", label: "Proxy Teacher" },
  { key: "period", label: "Period" },
  { key: "subject", label: "Subject" },
];

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function exportRow(record: ProxyRecord, index: number): TableExportRow {
  return {
    serial: String(index + 1),
    date: record.proxyDate,
    standard: record.standardName,
    division: record.divisionName,
    absentTeacher: record.teacherName,
    proxyTeacher: record.proxyTeacherName,
    period: record.periodName,
    subject: record.subjectName,
  };
}

export default function TodaysProxyReportPage() {
  const reportDate = todayIso();
  const [records, setRecords] = useState<ProxyRecord[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await listProxies(getProxySession()));
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Today's proxy report could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage provides the authenticated ERP session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter(
      (record) =>
        record.proxyDate === reportDate &&
        (!search ||
          [
            record.standardName,
            record.divisionName,
            record.teacherName,
            record.proxyTeacherName,
            record.periodName,
            record.subjectName,
          ].some((value) => value.toLowerCase().includes(search)))
    );
  }, [query, records, reportDate]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const rows = filtered.map(exportRow);

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Today&apos;s Proxy Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Proxy assignments scheduled for {reportDate}.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <CalendarDays className="size-4" />
          )}
          Refresh today
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search today's proxy report..."
              className="h-8 pl-8"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() =>
                exportRowsAsCsv({
                  filename: "todays-proxy-report.csv",
                  columns,
                  rows,
                })
              }
            >
              <Download className="size-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() =>
                exportRowsAsExcel({
                  filename: "todays-proxy-report.xls",
                  title: "Today's Proxy Report",
                  columns,
                  rows,
                })
              }
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() =>
                openPrintPreview({
                  title: "Today's Proxy Report",
                  subtitle: reportDate,
                  columns,
                  rows,
                })
              }
            >
              <Printer className="size-4" />
              Print / PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading today&apos;s proxy assignments...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Absent Teacher</TableHead>
                  <TableHead>Proxy Teacher</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length ? (
                  visible.map((record, index) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>{record.proxyDate}</TableCell>
                      <TableCell>{record.standardName}</TableCell>
                      <TableCell>{record.divisionName}</TableCell>
                      <TableCell>{record.teacherName}</TableCell>
                      <TableCell>{record.proxyTeacherName}</TableCell>
                      <TableCell>{record.periodName}</TableCell>
                      <TableCell>{record.subjectName}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-40 text-center text-slate-500"
                    >
                      No proxy assignments found for today.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && filtered.length ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
              >
                Previous
              </Button>
              <span className="px-2">
                Page {currentPage} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === pageCount}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pageCount, current + 1)
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
