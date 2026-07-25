"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "@/components/erp/ClassFilters";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "@/lib/class-options";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, monthStartIso, todayIso } from "../_lib/dates";
import { loadPtmReport, type PtmReportRow } from "../_lib/ptm";

const columns: Array<RecordColumn<PtmReportRow>> = [
  { key: "student", label: "Student name", value: (row) => row.studentName },
  {
    key: "std_div",
    label: "Standard / division",
    value: (row) => [row.standard, row.division].filter(Boolean).join(" / "),
  },
  { key: "mobile", label: "Mobile", value: (row) => row.mobile },
  { key: "slot_title", label: "PTM title", value: (row) => row.slotTitle },
  { key: "ptm_date", label: "PTM date", value: (row) => formatDisplayDate(row.ptmDate) },
  {
    key: "ptm_time",
    label: "PTM time",
    value: (row) => [row.fromTime, row.toTime].filter(Boolean).join(" - "),
  },
  {
    key: "attended_status",
    label: "Attend status",
    value: (row) => row.attendedStatus || "—",
    render: (row) =>
      row.attendedStatus ? (
        <Badge variant={row.attendedStatus === "Yes" ? "default" : "secondary"}>
          {row.attendedStatus}
        </Badge>
      ) : (
        "—"
      ),
  },
  { key: "attended_remarks", label: "Attend remarks", value: (row) => row.attendedRemarks },
];

export default function PtmReportPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [rows, setRows] = useState<PtmReportRow[]>([]);
  const [generated, setGenerated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setClassOptions(await loadClassOptions());
    } catch (value: unknown) {
      setError(errorMessage(value, "The class list could not be loaded."));
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
      setRows(
        await loadPtmReport({
          fromDate,
          toDate,
          gradeId: selection.gradeId,
          standardId: selection.standardId,
          divisionId: selection.divisionId,
        })
      );
      setGenerated(true);
    } catch (value: unknown) {
      setRows([]);
      setGenerated(true);
      setError(errorMessage(value, "The PTM report could not be generated."));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="PTM report"
        description="Booked parent-teacher meetings and whether the parent attended."
        onRefresh={() => void load()}
        refreshing={loading || searching}
      />

      <ErpAlert tone="error">{error}</ErpAlert>

      {loading ? (
        <ErpSection title="Report filters">
          <ErpLoading label="Loading classes…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title="Report filters"
            description="Leave a class filter blank to include every class."
            icon={<Search className="size-5" />}
            footer={
              <Button type="submit" disabled={searching}>
                {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                {searching ? "Searching…" : "Search"}
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <ClassFilters
                idPrefix="ptm-report"
                options={classOptions}
                value={selection}
                onChange={setSelection}
                required={false}
              />
              <div className="space-y-2">
                <Label htmlFor="ptm-report-from">From date *</Label>
                <Input
                  id="ptm-report-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ptm-report-to">To date *</Label>
                <Input
                  id="ptm-report-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  required
                />
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection title="PTM bookings" icon={<CalendarCheck className="size-5" />}>
        {searching ? (
          <ErpLoading label="Loading bookings…" />
        ) : !generated ? (
          <ErpEmpty title="Choose your filters and search." />
        ) : (
          <RecordTable
            rows={rows}
            columns={columns}
            getRowKey={(row, index) => `${row.id}-${index}`}
            searchPlaceholder="Search bookings…"
            exportFilename={`ptm-report-${fromDate}-to-${toDate}`}
            exportTitle="PTM report"
            exportSubtitle={`${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            emptyTitle="No PTM bookings in this range."
            emptyHint="Widen the date range or clear the class filters."
          />
        )}
      </ErpSection>
    </main>
  );
}
