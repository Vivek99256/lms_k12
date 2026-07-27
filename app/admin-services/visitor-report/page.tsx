"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, monthStartIso, todayIso } from "../_lib/dates";
import { loadVisitorReport, type VisitorRecord } from "../_lib/visitor";

export default function VisitorReportPage() {
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [generated, setGenerated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError("");
    try {
      setVisitors(await loadVisitorReport(from, to));
      setGenerated(true);
    } catch (value: unknown) {
      setVisitors([]);
      setGenerated(true);
      setError(errorMessage(value, "The visitor report could not be generated."));
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

  const columns: Array<RecordColumn<VisitorRecord>> = [
    { key: "appointment_type", label: "Appointment type", value: (row) => row.appointmentType },
    { key: "visitor_type", label: "Visitor type", value: (row) => row.visitorTypeName },
    { key: "name", label: "Visitor name", value: (row) => row.name },
    { key: "contact", label: "Contact", value: (row) => row.contact },
    { key: "email", label: "Email", value: (row) => row.email },
    { key: "visitor_idcard", label: "ID card", value: (row) => row.visitorIdCard },
    { key: "coming_from", label: "Coming from", value: (row) => row.comingFrom },
    { key: "to_meet", label: "To meet", value: (row) => row.staffName },
    { key: "relation", label: "Relation", value: (row) => row.relation },
    { key: "purpose", label: "Purpose", value: (row) => row.purpose },
    { key: "date", label: "Date", value: (row) => formatDisplayDate(row.meetDate) },
    { key: "in_time", label: "Check in", value: (row) => row.inTime },
    { key: "out_time", label: "Check out", value: (row) => row.outTime || "—" },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Visitor report"
        description="Every gate visit in a date range, with check-in and check-out times."
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
              <Label htmlFor="visitor-from">From date *</Label>
              <Input
                id="visitor-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-to">To date *</Label>
              <Input
                id="visitor-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                required
              />
            </div>
          </div>
        </ErpSection>
      </form>

      <ErpSection title="Visitors" icon={<Users className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading visitors…" />
        ) : !generated ? (
          <ErpEmpty title="Choose a date range and search." />
        ) : (
          <RecordTable
            rows={visitors}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search visitors…"
            exportFilename={`visitor-report-${fromDate}-to-${toDate}`}
            exportTitle="Visitor report"
            exportSubtitle={`${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            emptyTitle="No visitors in this date range."
            emptyHint="Widen the range and search again."
          />
        )}
      </ErpSection>
    </main>
  );
}
