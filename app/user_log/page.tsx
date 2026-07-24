"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  loadUserLogUsers,
  searchUserLogs,
  type UserLogRecord,
  type UserOption,
} from "./api";

const PAGE_SIZE = 10;
const columns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "url", label: "URL" },
  { key: "module", label: "Module" },
  { key: "action", label: "Action" },
  { key: "date", label: "Date" },
  { key: "user", label: "User" },
];

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(date);
}

function exportRow(record: UserLogRecord, index: number): TableExportRow {
  return {
    serial: String(index + 1),
    url: record.url,
    module: record.module,
    action: record.action,
    date: formatDate(record.createdAt),
    user: record.userName,
  };
}

export default function UserLogPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(
    localIso(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [toDate, setToDate] = useState(localIso(today));
  const [selectedUserId, setSelectedUserId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [logs, setLogs] = useState<UserLogRecord[]>([]);
  const [generated, setGenerated] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await loadUserLogUsers());
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "User options could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the authenticated ERP context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return !search
      ? logs
      : logs.filter((record) =>
          [
            record.url,
            record.module,
            record.action,
            record.createdAt,
            record.userName,
          ].some((value) => value.toLowerCase().includes(search))
        );
  }, [logs, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const exportRows = filtered.map(exportRow);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!fromDate || !toDate) {
      setError("Select both dates.");
      return;
    }
    if (fromDate > toDate) {
      setError("The from date must be on or before the to date.");
      return;
    }
    setSearching(true);
    setQuery("");
    setPage(1);
    try {
      setLogs(
        await searchUserLogs({
          fromDate,
          toDate,
          selectedUserId: selectedUserId
            ? Number(selectedUserId)
            : null,
        })
      );
      setGenerated(true);
    } catch (searchError: unknown) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "User logs could not be loaded."
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          User Log Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review user activity by date and account.
        </p>
      </header>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      <form
        onSubmit={generate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="user-log-from">From date *</Label>
            <Input
              id="user-log-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => setFromDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-log-to">To date *</Label>
            <Input
              id="user-log-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => setToDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>User</Label>
            <SearchableUserSelect
              users={users}
              value={selectedUserId}
              onChange={setSelectedUserId}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={loading || searching}>
            {searching ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Generate report
          </Button>
        </div>
      </form>

      {generated ? (
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
                placeholder="Search user logs..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsCsv({
                    filename: "user-log-report.csv",
                    columns,
                    rows: exportRows,
                  })
                }
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  exportRowsAsExcel({
                    filename: "user-log-report.xls",
                    title: "User Log Report",
                    columns,
                    rows: exportRows,
                  })
                }
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                disabled={!exportRows.length}
                onClick={() =>
                  openPrintPreview({
                    title: "User Log Report",
                    subtitle: `${fromDate} to ${toDate}`,
                    columns,
                    rows: exportRows,
                  })
                }
              >
                <Printer className="size-4" />
                Print / PDF
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[950px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length ? (
                  visible.map((record, index) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal break-all">
                        {record.url}
                      </TableCell>
                      <TableCell>{record.module}</TableCell>
                      <TableCell>{record.action || "—"}</TableCell>
                      <TableCell>{formatDate(record.createdAt)}</TableCell>
                      <TableCell>{record.userName}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-slate-500"
                    >
                      No user logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            count={filtered.length}
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
          />
        </section>
      ) : null}
    </main>
  );
}

function SearchableUserSelect({
  users,
  value,
  onChange,
}: {
  users: UserOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = users.find((user) => String(user.id) === value);
  const filtered = users.filter((user) =>
    user.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  function choose(nextValue: string) {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between rounded-lg px-2.5 font-normal"
          >
            <span className="truncate">{selected?.name || "All users"}</span>
            <ChevronsUpDown className="size-4 text-slate-400" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-64 gap-2 p-2"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user..."
            className="h-8 pl-8"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          <OptionButton
            label="All users"
            selected={!value}
            onClick={() => choose("")}
          />
          {filtered.map((user) => (
            <OptionButton
              key={user.id}
              label={user.name}
              selected={String(user.id) === value}
              onClick={() => choose(String(user.id))}
            />
          ))}
          {!filtered.length ? (
            <p className="p-4 text-center text-sm text-slate-500">
              No users found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100"
    >
      <Check
        className={`size-4 ${selected ? "text-indigo-600" : "invisible"}`}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Pagination({
  count,
  page,
  pageCount,
  onChange,
}: {
  count: number;
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (!count) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {(page - 1) * PAGE_SIZE + 1}–
        {Math.min(page * PAGE_SIZE, count)} of {count}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
