"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, monthStartIso, todayIso } from "../_lib/dates";
import { complaintColumns } from "../_components/complaint-columns";
import { loadComplaints, type ComplaintRecord } from "../_lib/complaint";

export default function ComplaintReportPage() {
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [generated, setGenerated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError("");
    try {
      setComplaints(await loadComplaints({ fromDate: from, toDate: to }));
      setGenerated(true);
    } catch (value: unknown) {
      setComplaints([]);
      setGenerated(true);
      setError(errorMessage(value, "The complaint report could not be generated."));
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
    if (!fromDate || !toDate) {
      setError("Both the from date and the to date are required.");
      return;
    }
    if (fromDate > toDate) {
      setError("The from date cannot be after the to date.");
      return;
    }
    void run(fromDate, toDate);
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Complaint report"
        description="Complaints raised in a date range, with their current solution state."
        onRefresh={() => void run(fromDate, toDate)}
        refreshing={loading}
      />

      <ErpAlert tone="error">{error}</ErpAlert>

      <form onSubmit={submit}>
        <ErpSection
          title="Report filters"
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
              <Label htmlFor="complaint-from">From date *</Label>
              <Input
                id="complaint-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-to">To date *</Label>
              <Input
                id="complaint-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                required
              />
            </div>
          </div>
        </ErpSection>
      </form>

      <ErpSection title="Complaints" icon={<ClipboardList className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading complaints…" />
        ) : !generated ? (
          <ErpEmpty title="Choose a date range and search." />
        ) : (
          <RecordTable
            rows={complaints}
            columns={complaintColumns()}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search complaints…"
            exportFilename={`complaint-report-${fromDate}-to-${toDate}`}
            exportTitle="Complaint report"
            exportSubtitle={`${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            emptyTitle="No complaints in this date range."
            emptyHint="Widen the range and search again."
          />
        )}
      </ErpSection>
    </main>
  );
}
