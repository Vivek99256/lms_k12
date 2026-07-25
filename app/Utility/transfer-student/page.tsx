"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "../_components/ClassFilters";
import { StudentSelectionTable } from "../_components/StudentSelectionTable";
import {
  UtilityAlert,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
} from "../_components/utility-ui";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "../_lib/classOptions";
import { errorMessage } from "../_lib/erp";
import { selectableIds, toggleId, type UtilityStudent } from "../_lib/students";
import { buildSessionContext } from "@/lib/erp-client";
import { promoteStudents, searchPendingStudents, type TransferStudentSearch } from "./api";

export default function TransferStudentPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [students, setStudents] = useState<UtilityStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);
  const [currentSyear, setCurrentSyear] = useState("");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const nextSyear = currentSyear ? String(Number(currentSyear) + 1) : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCurrentSyear(buildSessionContext().syear);
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

  const search: TransferStudentSearch = useMemo(
    () => ({
      gradeId: selection.gradeId,
      standardId: selection.standardId,
      divisionId: selection.divisionId,
    }),
    [selection]
  );

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSearching(true);
    try {
      const result = await searchPendingStudents(search);
      setStudents(result);
      setSelectedIds([]);
      setSearched(true);
    } catch (value: unknown) {
      setStudents([]);
      setSearched(true);
      setError(errorMessage(value, "Students could not be loaded."));
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setError("");
    setNotice("");
    if (selectedIds.length === 0) {
      setError("Select at least one student to transfer.");
      return;
    }
    if (
      !window.confirm(
        `Transfer ${selectedIds.length} student(s) into ${nextSyear || "the next academic year"} using the mapped next standard?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const message = await promoteStudents(search, selectedIds);
      setNotice(message);
      setSelectedIds([]);
      setStudents(await searchPendingStudents(search));
    } catch (value: unknown) {
      setError(errorMessage(value, "The students could not be transferred."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Transfer student"
        description={`Promote students from ${currentSyear || "the current year"} into ${nextSyear || "the next year"} using each standard's mapped next standard.`}
        onRefresh={() => void load()}
        refreshing={loading || searching || saving}
      />

      <UtilityAlert tone="info">
        Only active students who do not yet have a {nextSyear || "next year"} enrolment are listed.
        The next standard comes from the standard&apos;s rollover mapping — map it first, or the
        transfer is skipped.
      </UtilityAlert>
      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      {loading ? (
        <UtilitySection title="Find students">
          <UtilityLoading label="Loading classes…" />
        </UtilitySection>
      ) : (
        <form onSubmit={runSearch}>
          <UtilitySection
            title="Find students"
            description="Leave a filter blank to widen the search."
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
                idPrefix="transfer-student"
                options={classOptions}
                value={selection}
                onChange={setSelection}
                required={false}
              />
            </div>
          </UtilitySection>
        </form>
      )}

      {searched && !loading ? (
        <UtilitySection
          title="Students pending transfer"
          icon={<ArrowUpRight className="size-5" />}
          footer={
            students.length > 0 ? (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={saving || selectedIds.length === 0}
              >
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                {saving ? "Transferring…" : "Transfer student"}
              </Button>
            ) : null
          }
        >
          {searching ? (
            <UtilityLoading label="Loading students…" />
          ) : (
            <StudentSelectionTable
              students={students}
              selectedIds={selectedIds}
              onToggle={(studentId) => setSelectedIds((current) => toggleId(current, studentId))}
              onToggleAll={(checked) => setSelectedIds(checked ? selectableIds(students) : [])}
              showGender
              emptyTitle="No students are pending transfer."
              emptyHint={`Every student in this class already has a ${nextSyear || "next year"} enrolment, or no student matches the filters.`}
            />
          )}
        </UtilitySection>
      ) : null}
    </main>
  );
}
