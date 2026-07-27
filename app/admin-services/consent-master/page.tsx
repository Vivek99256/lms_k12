"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, LoaderCircle, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClassFilters,
  emptyClassSelection,
  type ClassSelection,
} from "@/components/erp/ClassFilters";
import {
  ErpAlert,
  ErpEmpty,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "@/lib/class-options";
import { errorMessage } from "@/lib/erp-legacy";
import { todayIso } from "../_lib/dates";
import {
  ACCOUNTABLE_STATUSES,
  createConsents,
  searchConsentStudents,
  type AccountableStatus,
  type ConsentStudent,
} from "../_lib/consent";

export default function ConsentMasterPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [students, setStudents] = useState<ConsentStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso);
  const [accountableStatus, setAccountableStatus] = useState<AccountableStatus>("Accountable");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSearching(true);
    try {
      const rows = await searchConsentStudents({
        gradeId: selection.gradeId,
        standardId: selection.standardId,
        divisionId: selection.divisionId,
      });
      setStudents(rows);
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
    if (!title.trim() || !date) {
      setError("Consent title and date are required.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one student.");
      return;
    }

    setSaving(true);
    try {
      const message = await createConsents({
        title: title.trim(),
        date,
        accountableStatus,
        standardId: selection.standardId,
        divisionId: selection.divisionId,
        studentIds: selectedIds,
      });
      setNotice(`${message} (${selectedIds.length} student(s))`);
      setSelectedIds([]);
      setTitle("");
    } catch (value: unknown) {
      setError(errorMessage(value, "The consent could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const allSelected = students.length > 0 && selectedIds.length === students.length;

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Consent master"
        description="Issue a consent to every selected student of a class."
        onRefresh={() => void load()}
        refreshing={loading || searching || saving}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading ? (
        <ErpSection title="Find students">
          <ErpLoading label="Loading classes…" />
        </ErpSection>
      ) : (
        <form onSubmit={runSearch}>
          <ErpSection
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
                idPrefix="consent"
                options={classOptions}
                value={selection}
                onChange={setSelection}
                required={false}
              />
            </div>
          </ErpSection>
        </form>
      )}

      {searched && !loading ? (
        <ErpSection
          title="Consent details"
          description="The same title, date and account status are written for every selected student."
          icon={<FileSignature className="size-5" />}
          footer={
            students.length > 0 ? (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={saving || selectedIds.length === 0}
              >
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : "Add consent"}
              </Button>
            ) : null
          }
        >
          {searching ? (
            <ErpLoading label="Loading students…" />
          ) : students.length === 0 ? (
            <ErpEmpty
              title="No students match these filters."
              hint="Change the academic section, standard or division and search again."
            />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="consent-title">Consent title *</Label>
                  <Input
                    id="consent-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consent-date">Date *</Label>
                  <Input
                    id="consent-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consent-status">Account status *</Label>
                  <select
                    id="consent-status"
                    className={erpSelectClass}
                    value={accountableStatus}
                    onChange={(event) =>
                      setAccountableStatus(event.target.value as AccountableStatus)
                    }
                    required
                  >
                    {ACCOUNTABLE_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all students"
                          className="size-4 accent-blue-600"
                          checked={allSelected}
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked ? students.map((student) => student.studentId) : []
                            )
                          }
                        />
                      </TableHead>
                      <TableHead className="w-14">Sr. no.</TableHead>
                      <TableHead>Student name</TableHead>
                      <TableHead>Enrollment code</TableHead>
                      <TableHead>Standard</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Mobile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, index) => (
                      <TableRow key={student.studentId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select ${student.name}`}
                            className="size-4 accent-blue-600"
                            checked={selectedIds.includes(student.studentId)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(student.studentId)
                                  ? current.filter((entry) => entry !== student.studentId)
                                  : [...current, student.studentId]
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">{student.name}</TableCell>
                        <TableCell className="font-mono text-xs">{student.enrollmentNo || "—"}</TableCell>
                        <TableCell>{student.standardName || "—"}</TableCell>
                        <TableCell>{student.divisionName || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{student.mobile || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-slate-500">
                {selectedIds.length} of {students.length} students selected.
              </p>
            </div>
          )}
        </ErpSection>
      ) : null}
    </main>
  );
}
