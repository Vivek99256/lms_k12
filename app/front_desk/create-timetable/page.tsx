<<<<<<< HEAD
import ModuleWorkbench from '../_components/ModuleWorkbench';
import { reportModules } from '../_lib/reports';

export default function Page() {
  return <ModuleWorkbench module={reportModules.createTimetable} />;
}

=======
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  deleteTimetableEntry,
  getTimetableGrid,
  getTimetableSession,
  listDivisions,
  listSections,
  listStandards,
  saveTimetableEntry,
  type BatchOption,
  type DivisionOption,
  type PeriodOption,
  type SectionOption,
  type StandardOption,
  type SubjectOption,
  type TeacherOption,
  type TimetableEntry,
  type WeekdayOption,
} from "./api";

function selectClass() {
  return "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";
}

type Slot = {
  entryId: number | null;
  subjectId: string;
  teacherId: string;
  batchId: string;
  deletable?: boolean;
};

function cellKey(weekDay: string, periodId: number) {
  return `${weekDay}__${periodId}`;
}

function blankSlot(): Slot {
  return { entryId: null, subjectId: "", teacherId: "", batchId: "", deletable: false };
}

function buildCells(
  weekdays: WeekdayOption[],
  periods: PeriodOption[],
  entries: TimetableEntry[]
): Record<string, Slot[]> {
  const cells: Record<string, Slot[]> = {};
  for (const weekday of weekdays) {
    for (const period of periods) {
      cells[cellKey(weekday.key, period.id)] = [];
    }
  }
  for (const entry of entries) {
    const key = cellKey(entry.weekDay, entry.periodId);
    if (!cells[key]) cells[key] = [];
    cells[key].push({
      entryId: entry.id,
      subjectId: String(entry.subjectId),
      teacherId: String(entry.teacherId),
      batchId: entry.batchId ? String(entry.batchId) : "",
    });
  }
  for (const key of Object.keys(cells)) {
    if (cells[key].length === 0) cells[key] = [blankSlot()];
  }
  return cells;
}

export default function CreateTimetablePage() {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);

  const [sectionId, setSectionId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [divisionId, setDivisionId] = useState("");

  const [weekdays, setWeekdays] = useState<WeekdayOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [cells, setCells] = useState<Record<string, Slot[]>>({});
  const [searched, setSearched] = useState(false);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // The first client render is the point at which the stored ERP session is available.
    (async () => {
      setLoadingClasses(true);
      setError("");
      try {
        const session = getTimetableSession();
        setSections(await listSections(session));
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Academic sections could not be loaded."
        );
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  async function handleSectionChange(value: string) {
    setSectionId(value);
    setStandardId("");
    setDivisionId("");
    setStandards([]);
    setDivisions([]);
    setSearched(false);
    setCells({});
    if (!value) return;
    setLoadingStandards(true);
    setError("");
    try {
      const session = getTimetableSession();
      setStandards(await listStandards(session, Number(value)));
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : "Standards could not be loaded."
      );
    } finally {
      setLoadingStandards(false);
    }
  }

  async function handleStandardChange(value: string) {
    setStandardId(value);
    setDivisionId("");
    setDivisions([]);
    setSearched(false);
    setCells({});
    if (!value) return;
    setLoadingDivisions(true);
    setError("");
    try {
      const session = getTimetableSession();
      setDivisions(await listDivisions(session, Number(value)));
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : "Divisions could not be loaded."
      );
    } finally {
      setLoadingDivisions(false);
    }
  }

  const loadGrid = useCallback(async () => {
    if (!sectionId || !standardId || !divisionId) {
      setError("Select section, standard and division first.");
      return;
    }
    setLoadingGrid(true);
    setError("");
    setNotice("");
    try {
      const session = getTimetableSession();
      const grid = await getTimetableGrid(session, {
        academicSectionId: Number(sectionId),
        standardId: Number(standardId),
        divisionId: Number(divisionId),
      });
      setWeekdays(grid.weekdays);
      setPeriods(grid.periods);
      setSubjects(grid.subjects);
      setTeachers(grid.teachers);
      setBatches(grid.batches);
      setCells(buildCells(grid.weekdays, grid.periods, grid.entries));
      setSearched(true);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : "Timetable could not be loaded."
      );
    } finally {
      setLoadingGrid(false);
    }
  }, [sectionId, standardId, divisionId]);

  const hasAnyPeriod = useMemo(() => periods.length > 0, [periods]);

  function updateSlot(key: string, index: number, patch: Partial<Slot>) {
    setCells((current) => {
      const slots = current[key] ? [...current[key]] : [blankSlot()];
      slots[index] = { ...slots[index], ...patch };
      return { ...current, [key]: slots };
    });
  }

  function addSlot(key: string) {
    setCells((current) => {
      const slots = current[key] ? [...current[key]] : [];
      const last = slots[slots.length - 1];
      if (last && !last.deletable && last.entryId === null && !last.subjectId && !last.teacherId) {
        return current;
      }
      return { ...current, [key]: [...slots, { ...blankSlot(), deletable: true }] };
    });
  }

  function removeSlot(key: string, index: number) {
    setCells((current) => {
      const slots = current[key] ? [...current[key]] : [];
      slots.splice(index, 1);
      if (slots.length === 0) {
        slots.push(blankSlot());
      }
      return { ...current, [key]: slots };
    });
  }

  async function handleDeleteSlot(key: string, index: number) {
    const slot = cells[key]?.[index];
    if (!slot || slot.entryId === null) return;
    if (!window.confirm("Remove this period entry?")) return;
    setBusy(true);
    setError("");
    try {
      const session = getTimetableSession();
      const message = await deleteTimetableEntry(session, slot.entryId);
      setNotice(message);
      await loadGrid();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Timetable entry could not be deleted."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    const pending: Array<{ weekDay: string; periodId: number; slot: Slot }> = [];
    for (const [key, slots] of Object.entries(cells)) {
      const [weekDay, periodIdRaw] = key.split("__");
      const periodId = Number(periodIdRaw);
      for (const slot of slots) {
        if (slot.subjectId && slot.teacherId) {
          pending.push({ weekDay, periodId, slot });
        }
      }
    }
    if (pending.length === 0) {
      setError("Assign at least one subject and teacher before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = getTimetableSession();
      const results = await Promise.allSettled(
        pending.map(({ weekDay, periodId, slot }) =>
          saveTimetableEntry(session, {
            academicSectionId: Number(sectionId),
            standardId: Number(standardId),
            divisionId: Number(divisionId),
            periodId,
            weekDay,
            subjectId: Number(slot.subjectId),
            teacherId: Number(slot.teacherId),
            batchId: slot.batchId ? Number(slot.batchId) : null,
          })
        )
      );
      const failed = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (failed.length > 0) {
        setError(
          `${failed.length} of ${pending.length} periods could not be saved: ${
            failed[0].reason instanceof Error ? failed[0].reason.message : "Unknown error"
          }`
        );
      } else {
        setNotice("Timetable saved successfully.");
      }
      await loadGrid();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : "Timetable could not be saved."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 [&_button:not([data-table-action])]:!border-blue-600 [&_button:not([data-table-action])]:!bg-blue-600 [&_button:not([data-table-action])]:!text-white [&_button:not([data-table-action]):hover]:!bg-blue-700 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Create timetable</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select a section, standard and division, assign subjects and teachers to each
          period, then submit.
        </p>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="section">Section</Label>
            <select
              id="section"
              className={selectClass()}
              value={sectionId}
              disabled={loadingClasses}
              onChange={(event) => void handleSectionChange(event.target.value)}
            >
              <option value="">Select academic section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="standard">Standard</Label>
            <select
              id="standard"
              className={selectClass()}
              value={standardId}
              disabled={!sectionId || loadingStandards}
              onChange={(event) => void handleStandardChange(event.target.value)}
            >
              <option value="">Select standard</option>
              {standards.map((standard) => (
                <option key={standard.id} value={standard.id}>
                  {standard.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="division">Division</Label>
            <select
              id="division"
              className={selectClass()}
              value={divisionId}
              disabled={!standardId || loadingDivisions}
              onChange={(event) => setDivisionId(event.target.value)}
            >
              <option value="">Select division</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => void loadGrid()}
              disabled={!sectionId || !standardId || !divisionId || loadingGrid}
            >
              {loadingGrid ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </div>
        </div>
      </section>

      {searched && hasAnyPeriod ? (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="!rounded-full !bg-teal-500 px-8 !text-white hover:!bg-teal-600"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Submit
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loadingGrid ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" />
            Loading timetable...
          </div>
        ) : !searched ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <CalendarClock className="mb-3 size-9 text-slate-300" />
            <p className="font-medium text-slate-700">No data found.</p>
            <p className="mt-1 text-sm text-slate-500">
              Choose a section, standard and division, then search to load the timetable.
            </p>
          </div>
        ) : !hasAnyPeriod ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <CalendarClock className="mb-3 size-9 text-slate-300" />
            <p className="font-medium text-red-600">
              Please create periods before creating the timetable.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-white p-2 text-left align-middle">
                    <span className="inline-block rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white">
                      Days/Lectures
                    </span>
                  </th>
                  {periods.map((period) => (
                    <th
                      key={period.id}
                      className="min-w-[220px] border border-slate-200 bg-white p-2 text-left align-middle"
                    >
                      <span className="inline-block rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white">
                        {period.title}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekdays.map((weekday) => (
                  <tr key={weekday.key}>
                    <td className="border border-slate-200 p-2 align-top">
                      <span className="inline-block rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white">
                        {weekday.label}
                      </span>
                    </td>
                    {periods.map((period) => {
                      const key = cellKey(weekday.key, period.id);
                      const slots = cells[key] || [blankSlot()];
                      return (
                        <td key={key} className="border border-slate-200 p-2 align-top">
                          <div className="space-y-3">
                            {slots.map((slot, index) => (
                              <div key={slot.entryId ?? `new-${index}`} className="flex items-start gap-1">
                                <div className="flex-1 space-y-1">
                                  <select
                                    aria-label="Subject"
                                    className={selectClass()}
                                    value={slot.subjectId}
                                    onChange={(event) =>
                                      updateSlot(key, index, { subjectId: event.target.value })
                                    }
                                  >
                                    <option value="">Subject</option>
                                    {subjects.map((subject) => (
                                      <option key={subject.subjectId} value={subject.subjectId}>
                                        {subject.displayName}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    aria-label="Teacher"
                                    className={selectClass()}
                                    value={slot.teacherId}
                                    onChange={(event) =>
                                      updateSlot(key, index, { teacherId: event.target.value })
                                    }
                                  >
                                    <option value="">Teacher</option>
                                    {teachers.map((teacher) => (
                                      <option key={teacher.id} value={teacher.id}>
                                        {teacher.name}
                                        {teacher.remainingLecture != null
                                          ? ` (${teacher.remainingLecture})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  {batches.length > 0 ? (
                                    <select
                                      aria-label="Batch"
                                      className={selectClass()}
                                      value={slot.batchId}
                                      onChange={(event) =>
                                        updateSlot(key, index, { batchId: event.target.value })
                                      }
                                    >
                                      <option value="">Batch</option>
                                      {batches.map((batch) => (
                                        <option key={batch.id} value={batch.id}>
                                          {batch.title}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                </div>
                                {(slot.entryId !== null || slot.deletable) ? (
                                  <button
                                    type="button"
                                    aria-label={slot.entryId !== null ? "Remove this period entry" : "Remove this subject teacher pair"}
                                    className="mt-1 flex size-5 shrink-0 items-center justify-center rounded !bg-red-500 text-white hover:!bg-red-600 disabled:opacity-50"
                                    onClick={() => void (slot.entryId !== null ? handleDeleteSlot(key, index) : removeSlot(key, index))}
                                    disabled={busy}
                                  >
                                    <X className="size-3" />
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                              onClick={() => addSlot(key)}
                              disabled={busy}
                            >
                              + Add
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
