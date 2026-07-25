"use client";

import { useCallback, useEffect, useState } from "react";
import { ConciergeBell, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, monthStartIso, todayIso } from "../_lib/dates";
import { loadFrontDeskReport, type FrontDeskRecord } from "../_lib/frontdesk";

const columns: Array<RecordColumn<FrontDeskRecord>> = [
  { key: "title", label: "Title", value: (row) => row.title },
  { key: "description", label: "Description", value: (row) => row.description },
  { key: "student", label: "Student name", value: (row) => row.studentName },
  { key: "visitor_type", label: "Visitor type", value: (row) => row.visitorType },
  { key: "to_whom_meet", label: "To whom meet", value: (row) => row.userName },
  {
    key: "date_time",
    label: "Date-time",
    value: (row) => `${formatDisplayDate(row.date)} ${row.inTime}`.trim(),
  },
];

export default function FrontDeskReportPage() {
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [entries, setEntries] = useState<FrontDeskRecord[]>([]);
  const [generated, setGenerated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError("");
    try {
      setEntries(await loadFrontDeskReport(from, to));
      setGenerated(true);
    } catch (value: unknown) {
      setEntries([]);
      setGenerated(true);
      setError(errorMessage(value, "The front desk report could not be generated."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(monthStartIso(), todayIso());
  }, [run]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (fromDate && toDate && fromDate > toDate) {
      setError("The from date cannot be after the to date.");
      return;
    }
    void run(fromDate, toDate);
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Front desk report"
        description="Front desk visits for the current academic year, filtered by date."
        onRefresh={() => void run(fromDate, toDate)}
        refreshing={loading}
      />

      <ErpAlert tone="error">{error}</ErpAlert>

      <form onSubmit={submit}>
        <ErpSection
          title="Report filters"
          description="Each bound is optional — the ERP applies whichever one is set."
          icon={<Search className="size-5" />}
          footer={
            <Button type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
              {loading ? "Searching…" : "Search"}
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fd-report-from">From date</Label>
              <Input
                id="fd-report-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fd-report-to">To date</Label>
              <Input
                id="fd-report-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>
        </ErpSection>
      </form>

      <ErpSection title="Front desk visits" icon={<ConciergeBell className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading visits…" />
        ) : !generated ? (
          <ErpEmpty title="Choose a date range and search." />
        ) : (
          <RecordTable
            rows={entries}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search visits…"
            exportFilename={`front-desk-report-${fromDate}-to-${toDate}`}
            exportTitle="Front desk report"
            exportSubtitle={`${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            emptyTitle="No front desk visits in this date range."
            emptyHint="Widen the range and search again."
          />
        )}
      </ErpSection>
    </main>
  );
}
