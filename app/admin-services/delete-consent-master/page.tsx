"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emptyClassSelection, type ClassSelection } from "@/components/erp/ClassFilters";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "@/lib/class-options";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate } from "../_lib/dates";
import { ConsentFilterForm } from "../_components/ConsentFilterForm";
import { deleteConsents, loadDeletableConsents, type ConsentRecord } from "../_lib/consent";

export default function DeleteConsentMasterPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const search = useCallback(async () => {
    setSearching(true);
    setError("");
    try {
      const rows = await loadDeletableConsents({
        gradeId: selection.gradeId,
        standardId: selection.standardId,
        divisionId: selection.divisionId,
        fromDate,
        toDate,
      });
      setConsents(rows);
      setSelectedIds([]);
      setSearched(true);
    } catch (value: unknown) {
      setConsents([]);
      setSearched(true);
      setError(errorMessage(value, "Consents could not be loaded."));
    } finally {
      setSearching(false);
    }
  }, [selection, fromDate, toDate]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    void search();
  }

  async function remove() {
    setError("");
    setNotice("");
    if (selectedIds.length === 0) {
      setError("Select at least one consent to delete.");
      return;
    }
    if (
      !window.confirm(
        `Delete ${selectedIds.length} consent record(s)? This cannot be undone from this screen.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      setNotice(await deleteConsents(selectedIds));
      setSelectedIds([]);
      await search();
    } catch (value: unknown) {
      setError(errorMessage(value, "The consents could not be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = consents.length > 0 && selectedIds.length === consents.length;

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Delete consent master"
        description="Find issued consents by class and date, then remove the ones no longer needed."
        onRefresh={() => void load()}
        refreshing={loading || searching || deleting}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading ? (
        <ErpSection title="Filters">
          <ErpLoading label="Loading classes…" />
        </ErpSection>
      ) : (
        <ConsentFilterForm
          idPrefix="delete-consent"
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

      {searched && !loading ? (
        <ErpSection
          title="Issued consents"
          icon={<Trash2 className="size-5" />}
          footer={
            consents.length > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void remove()}
                disabled={deleting || selectedIds.length === 0}
              >
                {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {deleting ? "Deleting…" : "Delete selected"}
              </Button>
            ) : null
          }
        >
          {searching ? (
            <ErpLoading label="Loading consents…" />
          ) : consents.length === 0 ? (
            <ErpEmpty
              title="No consents match these filters."
              hint="Widen the class or date filters and search again."
            />
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all consents"
                          className="size-4 accent-blue-600"
                          checked={allSelected}
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked ? consents.map((consent) => consent.id) : []
                            )
                          }
                        />
                      </TableHead>
                      <TableHead className="w-14">Sr. no.</TableHead>
                      <TableHead>GR no.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Academic year</TableHead>
                      <TableHead>Standard</TableHead>
                      <TableHead>Consent title</TableHead>
                      <TableHead>Consent date</TableHead>
                      <TableHead>Account status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Parent status</TableHead>
                      <TableHead>Created by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consents.map((consent, index) => (
                      <TableRow key={consent.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select consent ${consent.title}`}
                            className="size-4 accent-blue-600"
                            checked={selectedIds.includes(consent.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(consent.id)
                                  ? current.filter((entry) => entry !== consent.id)
                                  : [...current, consent.id]
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{consent.enrollmentNo || "—"}</TableCell>
                        <TableCell className="font-medium text-slate-900">{consent.studentName}</TableCell>
                        <TableCell>{consent.syear || "—"}</TableCell>
                        <TableCell>{consent.standard || "—"}</TableCell>
                        <TableCell>{consent.title || "—"}</TableCell>
                        <TableCell>{formatDisplayDate(consent.consentDate) || "—"}</TableCell>
                        <TableCell>{consent.accountStatus || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{consent.amount || "—"}</TableCell>
                        <TableCell>{consent.parentStatus}</TableCell>
                        <TableCell>{consent.createdBy || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-slate-500">
                {selectedIds.length} of {consents.length} consents selected.
              </p>
            </div>
          )}
        </ErpSection>
      ) : null}
    </main>
  );
}
