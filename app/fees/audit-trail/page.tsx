'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { PaginationFooter, ReportActions } from '@/app/fees/_components/fees-report-shared';
import {
  paginateRows,
  type PaginatedResult,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  loadUserLogUsers,
  searchUserLogs,
  type UserLogRecord,
  type UserOption,
} from '@/app/user_log/api';

/**
 * Fees -> Audit trail.
 *
 * The same access log the standalone User Log report reads, narrowed to this
 * one module: every row here is an `access_log_route` row whose `module` is
 * `fees`. It reuses app/user_log/api.ts rather than adding a second client --
 * same two endpoints (`user-logs/bootstrap`, `user-logs/search`), same session
 * handling, same tenant scoping -- so the two screens cannot drift apart.
 *
 * The module filter is applied here rather than upstream because the search
 * endpoint takes no module parameter. `module` is written as the literal
 * `fees`, so the match is exact after trimming and lower-casing; the query
 * string a few malformed rows carry (`fees?_token=...`) is stripped first.
 *
 * The Module column the User Log report shows is dropped: it would read "fees"
 * on every row. Everything else -- URL, action, timestamp, user -- is unchanged.
 */

const FEES_MODULE = 'fees';

const COLUMNS: TableExportColumn[] = [
  { key: 'serial', label: 'Sr. No.' },
  { key: 'date', label: 'Date & time' },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'url', label: 'URL' },
];

/** `module` is the literal "fees"; a handful of legacy rows append a token. */
function isFeesLog(record: UserLogRecord) {
  const [module] = record.module.split('?');
  return module.trim().toLowerCase() === FEES_MODULE;
}

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** An audit trail needs the time of day, which formatDateDisplay drops. */
function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()} ${hours}:${minutes}:${seconds}`;
}

export default function FeesAuditTrailPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(() =>
    localIso(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [toDate, setToDate] = useState(() => localIso(today));
  const [selectedUserId, setSelectedUserId] = useState('');

  const [users, setUsers] = useState<UserOption[]>([]);
  const [rows, setRows] = useState<UserLogRecord[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<ReportMessage | null>(null);

  const search = useCallback(async (input: {
    fromDate: string;
    toDate: string;
    selectedUserId: string;
  }) => {
    if (!input.fromDate || !input.toDate) {
      setMessage({ type: 'error', text: 'Select both dates.' });
      return;
    }
    if (input.fromDate > input.toDate) {
      setMessage({ type: 'error', text: 'The from date must be on or before the to date.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setQuery('');
    setPage(1);
    try {
      const logs = await searchUserLogs({
        fromDate: input.fromDate,
        toDate: input.toDate,
        selectedUserId: input.selectedUserId ? Number(input.selectedUserId) : null,
      });
      const feesLogs = logs.filter(isFeesLog);

      setRows(feesLogs);
      setMessage({
        type: feesLogs.length > 0 ? 'success' : 'info',
        text: feesLogs.length > 0
          ? `Loaded ${feesLogs.length} Fees activity ${feesLogs.length === 1 ? 'entry' : 'entries'}.`
          : 'No Fees activity was recorded for these filters.',
      });
    } catch (error) {
      setRows([]);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load the Fees audit trail.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Session and the user list both live in browser storage, so this can only
  // run after mount.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const options = await loadUserLogUsers();
        if (!cancelled) setUsers(options);
      } catch {
        // The user filter is optional -- the trail still loads without it.
        if (!cancelled) setUsers([]);
      }
      if (!cancelled) {
        await search({ fromDate, toDate, selectedUserId: '' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((record) =>
      [record.url, record.action, record.createdAt, record.userName].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [rows, query]);

  const pagination: PaginatedResult<UserLogRecord> = useMemo(
    () => paginateRows(filtered, page),
    [filtered, page]
  );

  const exportRows = useMemo<TableExportRow[]>(
    () =>
      filtered.map((record, index) => ({
        serial: String(index + 1),
        date: formatTimestamp(record.createdAt),
        user: record.userName || '-',
        action: record.action || '-',
        url: record.url,
      })),
    [filtered]
  );

  const subtitle = `Fees activity from ${fromDate} to ${toDate}`;

  return (
    <PageFrame>
      <PageHeader
        title="Fees audit trail"
        description="Every Fees screen this institute's users opened, with who opened it and when. Read-only, drawn from the same access log as the User Log report and narrowed to the Fees module."
        action={
          <ReportActions
            onExportCsv={() =>
              exportRowsAsCsv({ filename: 'fees-audit-trail.csv', columns: COLUMNS, rows: exportRows })
            }
            onExportExcel={() =>
              exportRowsAsExcel({
                filename: 'fees-audit-trail.xls',
                title: 'Fees Audit Trail',
                columns: COLUMNS,
                rows: exportRows,
              })
            }
            onExportPdf={() =>
              exportRowsAsPdf({
                filename: 'fees-audit-trail.pdf',
                title: 'Fees Audit Trail',
                subtitle,
                columns: COLUMNS,
                rows: exportRows,
              })
            }
            onPrint={() =>
              openPrintPreview({
                title: 'Fees Audit Trail',
                subtitle,
                columns: COLUMNS,
                rows: exportRows,
              })
            }
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <Field label="From date">
            <Input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </Field>
          <Field label="To date">
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </Field>
          <Field label="User">
            <NativeSelect value={selectedUserId} onChange={setSelectedUserId}>
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-10 w-full"
              disabled={loading}
              onClick={() => void search({ fromDate, toDate, selectedUserId })}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel footer={<PaginationFooter pagination={pagination} onPageChange={setPage} />}>
        <div className="mb-3 max-w-md">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search this trail..."
            aria-label="Search the Fees audit trail"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead className="w-20">Sr. No.</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={5} label="Loading Fees audit trail" />
            ) : pagination.rows.length > 0 ? (
              pagination.rows.map((record, index) => (
                <TableRow key={record.id} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>{pagination.startIndex + index}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatTimestamp(record.createdAt)}
                  </TableCell>
                  <TableCell>{record.userName || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{record.action || '-'}</TableCell>
                  <TableCell className="max-w-80 break-all text-xs text-slate-600">
                    {record.url}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow
                colSpan={5}
                label={
                  rows.length > 0
                    ? 'No entries match this search.'
                    : 'No Fees activity was recorded for these filters.'
                }
              />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}
