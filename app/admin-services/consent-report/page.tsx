"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { emptyClassSelection, type ClassSelection } from "@/components/erp/ClassFilters";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "@/lib/class-options";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate } from "../_lib/dates";
import { ConsentFilterForm } from "../_components/ConsentFilterForm";
import { loadConsentReport, type ConsentRecord } from "../_lib/consent";

const columns: Array<RecordColumn<ConsentRecord>> = [
  { key: "enrollment_no", label: "GR no.", value: (row) => row.enrollmentNo },
  { key: "student", label: "Student", value: (row) => row.studentName },
  { key: "syear", label: "Academic year", value: (row) => row.syear },
  { key: "standard", label: "Standard", value: (row) => row.standard },
  { key: "title", label: "Consent title", value: (row) => row.title },
  { key: "consent_date", label: "Consent date", value: (row) => formatDisplayDate(row.consentDate) },
  { key: "account_status", label: "Account status", value: (row) => row.accountStatus },
  { key: "amount", label: "Amount", align: "right", value: (row) => row.amount },
  { key: "parent_status", label: "Parent status", value: (row) => row.parentStatus },
  { key: "created_by", label: "Created by", value: (row) => row.createdBy },
];

export default function ConsentReportPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [searched, setSearched] = useState(false);

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
    setSearching(true);
    try {
      const rows = await loadConsentReport({
        gradeId: selection.gradeId,
        standardId: selection.standardId,
        divisionId: selection.divisionId,
        fromDate,
        toDate,
      });
      setConsents(rows);
      setSearched(true);
    } catch (value: unknown) {
      setConsents([]);
      setSearched(true);
      setError(errorMessage(value, "The consent report could not be generated."));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Consent report"
        description="Read-only view of every consent issued, with the parent's response state."
        onRefresh={() => void load()}
        refreshing={loading || searching}
      />

      <ErpAlert tone="error">{error}</ErpAlert>

      {loading ? (
        <ErpSection title="Filters">
          <ErpLoading label="Loading classes…" />
        </ErpSection>
      ) : (
        <ConsentFilterForm
          idPrefix="consent-report"
          classOptions={classOptions}
          selection={selection}
          onSelectionChange={setSelection}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onSubmit={submit}
          loading={searching}
        />
      )}

      <ErpSection title="Consents" icon={<FileSignature className="size-5" />}>
        {searching ? (
          <ErpLoading label="Loading consents…" />
        ) : !searched ? (
          <ErpEmpty title="Choose your filters and search." />
        ) : (
          <RecordTable
            rows={consents}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search consents…"
            exportFilename="consent-report"
            exportTitle="Consent report"
            exportSubtitle={
              fromDate && toDate
                ? `${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`
                : "All dates"
            }
            emptyTitle="No consents match these filters."
            emptyHint="Widen the class or date filters and search again."
          />
        )}
      </ErpSection>
    </main>
  );
}
