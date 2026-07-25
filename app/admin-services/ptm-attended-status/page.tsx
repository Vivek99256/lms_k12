"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, LoaderCircle, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "@/components/erp/ClassFilters";
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
import { formatDisplayDate } from "../_lib/dates";
import {
  PTM_ATTENDED_STATUSES,
  loadPtmTimeSlots,
  savePtmAttendance,
  searchPtmStudents,
  type PtmAttendanceEntry,
  type PtmAttendedStatus,
  type PtmStudentSlot,
  type PtmTimeSlot,
} from "../_lib/ptm";

export default function PtmAttendedStatusPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [selection, setSelection] = useState<ClassSelection>(emptyClassSelection);
  const [slots, setSlots] = useState<PtmTimeSlot[]>([]);
  const [ptmTitleId, setPtmTitleId] = useState("");
  const [date, setDate] = useState("");

  const [rows, setRows] = useState<PtmStudentSlot[]>([]);
  const [entries, setEntries] = useState<Record<number, PtmAttendanceEntry>>({});
  const [searched, setSearched] = useState(false);

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

  // The title dropdown lists the slots already defined for the chosen class.
  useEffect(() => {
    if (!selection.standardId || !selection.divisionId) return;
    let active = true;
    void (async () => {
      try {
        const slotRows = await loadPtmTimeSlots({
          standardId: selection.standardId,
          divisionId: selection.divisionId,
        });
        if (active) setSlots(slotRows);
      } catch {
        if (active) setSlots([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [selection.standardId, selection.divisionId]);

  const titleOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const slot of slots) {
      seen.set(slot.id, `${slot.title} — ${slot.fromTime} to ${slot.toTime}`);
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [slots]);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!selection.standardId || !selection.divisionId) {
      setError("Select a standard and a division.");
      return;
    }

    setSearching(true);
    try {
      const students = await searchPtmStudents({
        gradeId: selection.gradeId,
        standardId: selection.standardId,
        divisionId: selection.divisionId,
        ptmTitleId,
        date,
      });
      setRows(students);
      setEntries(
        Object.fromEntries(
          students.map((student) => [
            student.studentId,
            { studentId: student.studentId, status: "", remarks: "" } as PtmAttendanceEntry,
          ])
        )
      );
      setSearched(true);
    } catch (value: unknown) {
      setRows([]);
      setSearched(true);
      setError(errorMessage(value, "Students could not be loaded."));
    } finally {
      setSearching(false);
    }
  }

  function updateEntry(studentId: number, patch: Partial<PtmAttendanceEntry>) {
    setEntries((current) => ({
      ...current,
      [studentId]: { ...current[studentId], studentId, ...patch },
    }));
  }

  async function submit() {
    setError("");
    setNotice("");
    const chosen = Object.values(entries).filter((entry) => entry.status !== "");
    if (chosen.length === 0) {
      setError("Set the attended status for at least one student.");
      return;
    }

    setSaving(true);
    try {
      const message = await savePtmAttendance(rows, chosen);
      setNotice(`${message} (${chosen.length} student(s))`);
    } catch (value: unknown) {
      setError(errorMessage(value, "The PTM attendance could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const markedCount = Object.values(entries).filter((entry) => entry.status !== "").length;

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="PTM attended status"
        description="Record which parents attended their booked parent-teacher meeting."
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
            description="Students appear once per matching time slot for the class."
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
                idPrefix="ptm-status"
                options={classOptions}
                value={selection}
                onChange={(next) => {
                  setSelection(next);
                  setPtmTitleId("");
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="ptm-status-title">PTM title</Label>
                <select
                  id="ptm-status-title"
                  className={erpSelectClass}
                  value={ptmTitleId}
                  disabled={!selection.divisionId}
                  onChange={(event) => setPtmTitleId(event.target.value)}
                >
                  <option value="">All titles</option>
                  {titleOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ptm-status-date">PTM date</Label>
                <Input
                  id="ptm-status-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      {searched && !loading ? (
        <ErpSection
          title="Attendance"
          description="Only rows with a status set are saved."
          icon={<CalendarCheck className="size-5" />}
          footer={
            rows.length > 0 ? (
              <Button type="button" onClick={() => void submit()} disabled={saving || markedCount === 0}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : `Save ${markedCount || ""} record(s)`.replace("  ", " ")}
              </Button>
            ) : null
          }
        >
          {searching ? (
            <ErpLoading label="Loading students…" />
          ) : rows.length === 0 ? (
            <ErpEmpty
              title="No students found for this class and slot."
              hint="Define a PTM time slot for the class first, or clear the title and date filters."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sr. no.</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Standard</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>PTM title</TableHead>
                    <TableHead>PTM date</TableHead>
                    <TableHead>PTM time</TableHead>
                    <TableHead className="w-40">Attended status</TableHead>
                    <TableHead className="w-64">Attended remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.studentId}-${row.timeSlotId}`}>
                      <TableCell className="text-slate-500">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900">{row.studentName}</TableCell>
                      <TableCell>{row.stdDiv}</TableCell>
                      <TableCell className="font-mono text-xs">{row.mobile || "—"}</TableCell>
                      <TableCell>{row.title}</TableCell>
                      <TableCell>{formatDisplayDate(row.ptmDate)}</TableCell>
                      <TableCell>{row.timeSlot}</TableCell>
                      <TableCell>
                        <select
                          aria-label={`Attended status for ${row.studentName}`}
                          className={erpSelectClass}
                          value={entries[row.studentId]?.status ?? ""}
                          onChange={(event) =>
                            updateEntry(row.studentId, {
                              status: event.target.value as PtmAttendedStatus | "",
                            })
                          }
                        >
                          <option value="">Select status</option>
                          {PTM_ATTENDED_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          aria-label={`Attended remarks for ${row.studentName}`}
                          rows={2}
                          value={entries[row.studentId]?.remarks ?? ""}
                          onChange={(event) =>
                            updateEntry(row.studentId, { remarks: event.target.value })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ErpSection>
      ) : null}
    </main>
  );
}
