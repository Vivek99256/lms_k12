"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ErpAlert,
  ErpEmpty,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, monthStartIso, todayIso } from "../_lib/dates";
import {
  loadPettyCashHeads,
  loadPettyCashReport,
  type PettyCashEntry,
  type PettyCashHead,
} from "../_lib/pettyCash";

const columns: Array<RecordColumn<PettyCashEntry>> = [
  { key: "bill_date", label: "Date", value: (row) => formatDisplayDate(row.billDate) },
  { key: "user", label: "User", value: (row) => row.userName },
  { key: "title", label: "Title", value: (row) => row.titleName },
  { key: "amount", label: "Amount", align: "right", value: (row) => row.amount },
  { key: "description", label: "Description", value: (row) => row.description },
];

export default function PettyCashReportPage() {
  const [heads, setHeads] = useState<PettyCashHead[]>([]);
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [titleId, setTitleId] = useState("");
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [generated, setGenerated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHeads(await loadPettyCashHeads());
    } catch (value: unknown) {
      setError(errorMessage(value, "Petty cash heads could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!fromDate || !toDate) {
      setError("Both the from date and the to date are required.");
      return;
    }
    if (fromDate > toDate) {
      setError("The from date cannot be after the to date.");
      return;
    }

    setSearching(true);
    try {
      const report = await loadPettyCashReport({ fromDate, toDate, titleId });
      setEntries(report.entries);
      setTotal(report.total);
      setGenerated(true);
    } catch (value: unknown) {
      setEntries([]);
      setTotal(0);
      setGenerated(true);
      setError(errorMessage(value, "The petty cash report could not be generated."));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Petty cash report"
        description="Petty cash spend by date range and expense head."
        onRefresh={() => void load()}
        refreshing={loading || searching}
      />

      <ErpAlert tone="error">{error}</ErpAlert>

      {loading ? (
        <ErpSection title="Report filters">
          <ErpLoading label="Loading petty cash heads…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title="Report filters"
            description="Leave the title blank to include every expense head."
            icon={<Search className="size-5" />}
            footer={
              <Button type="submit" disabled={searching}>
                {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                {searching ? "Searching…" : "Search"}
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pcr-from">From date *</Label>
                <Input
                  id="pcr-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pcr-to">To date *</Label>
                <Input
                  id="pcr-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pcr-title">Title</Label>
                <select
                  id="pcr-title"
                  className={erpSelectClass}
                  value={titleId}
                  onChange={(event) => setTitleId(event.target.value)}
                >
                  <option value="">All titles</option>
                  {heads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection
        title="Petty cash spend"
        description={generated && entries.length > 0 ? `Total: ${total.toLocaleString("en-IN")}` : undefined}
        icon={<Wallet className="size-5" />}
      >
        {searching ? (
          <ErpLoading label="Loading entries…" />
        ) : !generated ? (
          <ErpEmpty title="Choose a date range and search." />
        ) : (
          <RecordTable
            rows={entries}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search entries…"
            exportFilename={`petty-cash-report-${fromDate}-to-${toDate}`}
            exportTitle="Petty cash report"
            exportSubtitle={`${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            emptyTitle="No petty cash entries in this range."
            emptyHint="Widen the date range or clear the title filter."
          />
        )}
      </ErpSection>
    </main>
  );
}
