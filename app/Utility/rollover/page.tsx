"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Repeat2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "../_components/ClassFilters";
import { StudentSelectionTable } from "../_components/StudentSelectionTable";
import {
  UtilityAlert,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
  utilitySelectClass,
} from "../_components/utility-ui";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "../_lib/classOptions";
import { errorMessage } from "../_lib/erp";
import { selectableIds, toggleId, type UtilityStudent } from "../_lib/students";
import { buildSessionContext } from "@/lib/erp-client";
import {
  MINIMUM_TABLES,
  loadRolloverBootstrap,
  rolloverAllData,
  rolloverAllStudentsOnly,
  rolloverSelectedStudents,
  searchRolloverStudents,
  type RolloverModule,
  type SelectedStudentSearch,
} from "./api";

type StudentScope = "none" | "all_students" | "selected_students";

export default function RolloverPage() {
  const [instituteName, setInstituteName] = useState("");
  const [modules, setModules] = useState<RolloverModule[]>([]);
  const [enrolment, setEnrolment] = useState({
    currentYearStudents: 0,
    nextYearStudents: 0,
    remaining: 0,
  });
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [studentScope, setStudentScope] = useState<StudentScope>("none");

  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [fromClass, setFromClass] = useState<ClassSelection>(emptyClassSelection);
  const [toClass, setToClass] = useState<ClassSelection>(emptyClassSelection);
  const [students, setStudents] = useState<UtilityStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);

  const [currentSyear, setCurrentSyear] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const nextSyear = currentSyear ? String(Number(currentSyear) + 1) : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = buildSessionContext();
      setCurrentSyear(session.syear);
      const [bootstrap, classes] = await Promise.all([
        loadRolloverBootstrap(),
        loadClassOptions(),
      ]);
      setInstituteName(bootstrap.fromInstituteName);
      setModules(bootstrap.modules);
      setEnrolment(bootstrap.enrolment);
      setClassOptions(classes);
      // Mirrors the Blade defaults: mandatory tables plus anything already rolled over.
      setSelectedTables(
        bootstrap.modules
          .filter((module) => module.mandatory || module.done)
          .map((module) => module.key)
      );
    } catch (value: unknown) {
      setError(errorMessage(value, "The rollover status could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const search: SelectedStudentSearch = useMemo(
    () => ({
      tables: selectedTables,
      gradeId: fromClass.gradeId,
      standardId: fromClass.standardId,
      divisionId: fromClass.divisionId,
      toAcademicSection: toClass.gradeId,
      toStandard: toClass.standardId,
      toDivision: toClass.divisionId,
      toNextSyear: nextSyear,
      fromInstituteName: instituteName,
    }),
    [selectedTables, fromClass, toClass, nextSyear, instituteName]
  );

  function toggleTable(module: RolloverModule) {
    if (module.mandatory || module.done) return;
    setSelectedTables((current) =>
      current.includes(module.key)
        ? current.filter((entry) => entry !== module.key)
        : [...current, module.key]
    );
  }

  async function runRollover() {
    setError("");
    setNotice("");
    if (selectedTables.length < MINIMUM_TABLES) {
      setError(`Select at least ${MINIMUM_TABLES} modules before running the rollover.`);
      return;
    }
    if (studentScope === "selected_students") {
      setError("Search and pick the students below, then roll them over from that panel.");
      return;
    }
    if (
      !window.confirm(
        `Roll over ${selectedTables.length} module(s)${
          studentScope === "all_students" ? " and all active student enrolments" : ""
        } into ${nextSyear || "the next academic year"}?`
      )
    ) {
      return;
    }

    setRunning(true);
    try {
      const message = await rolloverAllData(selectedTables, studentScope === "all_students");
      setNotice(message);
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The rollover could not be completed."));
    } finally {
      setRunning(false);
    }
  }

  async function runStudentsOnly() {
    setError("");
    setNotice("");
    if (!window.confirm(`Roll over all active student enrolments into ${nextSyear}?`)) return;

    setRunning(true);
    try {
      setNotice(await rolloverAllStudentsOnly());
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The student rollover could not be completed."));
    } finally {
      setRunning(false);
    }
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (
      !fromClass.gradeId ||
      !fromClass.standardId ||
      !fromClass.divisionId ||
      !toClass.gradeId ||
      !toClass.standardId ||
      !toClass.divisionId
    ) {
      setError("Select both the current class and the destination class.");
      return;
    }

    setSearching(true);
    try {
      const result = await searchRolloverStudents(search);
      setStudents(result.students);
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

  async function submitSelected() {
    setError("");
    setNotice("");
    if (selectedIds.length === 0) {
      setError("Select at least one student.");
      return;
    }
    if (!window.confirm(`Roll over ${selectedIds.length} student(s) into ${nextSyear}?`)) return;

    setRunning(true);
    try {
      const message = await rolloverSelectedStudents(search, selectedIds, currentSyear);
      setNotice(message);
      setSelectedIds([]);
      const result = await searchRolloverStudents(search);
      setStudents(result.students);
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The selected students could not be rolled over."));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Rollover"
        description={`Copy master data and enrolments from ${currentSyear || "the current year"} into ${nextSyear || "the next year"}.`}
        onRefresh={() => void load()}
        refreshing={loading || running || searching}
      />

      <UtilityAlert tone="info">
        Map the next grade and next standard on every standard before running a rollover — enrolments
        without a mapped next standard are skipped.
      </UtilityAlert>
      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      <UtilitySection
        title="Modules to roll over"
        description={instituteName ? `Institute: ${instituteName}` : undefined}
        icon={<Repeat2 className="size-5" />}
        footer={
          !loading ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runStudentsOnly()}
                disabled={running || enrolment.remaining <= 0}
              >
                <Users className="size-4" />
                Roll over students only
              </Button>
              <Button type="button" onClick={() => void runRollover()} disabled={running}>
                {running ? <LoaderCircle className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}
                {running ? "Rolling over…" : "Rollover data"}
              </Button>
            </>
          ) : null
        }
      >
        {loading ? (
          <UtilityLoading label="Loading rollover status…" />
        ) : (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Include</TableHead>
                    <TableHead>Module name</TableHead>
                    <TableHead className="w-40">Rows in {nextSyear || "next year"}</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.key}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Include ${module.label}`}
                          className="size-4 accent-blue-600"
                          checked={selectedTables.includes(module.key)}
                          disabled={module.mandatory || module.done}
                          onChange={() => toggleTable(module)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {module.label}
                        {module.mandatory ? (
                          <span className="ml-2 text-xs text-slate-500">(required)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{module.existingCount}</TableCell>
                      <TableCell>
                        {module.done ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <Check className="size-4" /> Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <X className="size-4" /> Pending
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-medium text-slate-900">Student enrolment</TableCell>
                    <TableCell className="font-mono text-xs">
                      {enrolment.currentYearStudents} / {enrolment.nextYearStudents}
                    </TableCell>
                    <TableCell>
                      {enrolment.remaining <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Check className="size-4" /> Done
                        </span>
                      ) : (
                        <span className="text-red-600">{enrolment.remaining} pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Student enrolment scope</legend>
              {(
                [
                  ["none", "Master data only"],
                  ["all_students", "All students"],
                  ["selected_students", "Selected students"],
                ] as Array<[StudentScope, string]>
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="student-scope"
                    className="size-4 accent-blue-600"
                    value={value}
                    checked={studentScope === value}
                    disabled={value !== "none" && enrolment.remaining <= 0}
                    onChange={() => setStudentScope(value)}
                  />
                  {label}
                  {value !== "none" && enrolment.remaining <= 0 ? (
                    <span className="text-xs text-slate-400">(all students already rolled over)</span>
                  ) : null}
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </UtilitySection>

      {studentScope === "selected_students" ? (
        <>
          <form onSubmit={runSearch}>
            <UtilitySection
              title="Selected students"
              description={`Map a source class to a destination class in ${nextSyear || "the next year"}.`}
              icon={<Search className="size-5" />}
              footer={
                <Button type="submit" disabled={searching}>
                  {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {searching ? "Searching…" : "Search students"}
                </Button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    From {currentSyear}
                  </p>
                  <ClassFilters
                    idPrefix="rollover-from"
                    options={classOptions}
                    value={fromClass}
                    onChange={setFromClass}
                  />
                </div>
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    To {nextSyear}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="rollover-next-year">Academic year</Label>
                    <input
                      id="rollover-next-year"
                      className={utilitySelectClass}
                      value={nextSyear}
                      readOnly
                    />
                  </div>
                  <ClassFilters
                    idPrefix="rollover-to"
                    options={classOptions}
                    value={toClass}
                    onChange={setToClass}
                  />
                </div>
              </div>
            </UtilitySection>
          </form>

          {searched ? (
            <UtilitySection
              title="Students in the selected class"
              icon={<Users className="size-5" />}
              footer={
                students.length > 0 ? (
                  <Button
                    type="button"
                    onClick={() => void submitSelected()}
                    disabled={running || selectedIds.length === 0}
                  >
                    {running ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Repeat2 className="size-4" />
                    )}
                    {running ? "Rolling over…" : "Rollover students"}
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
                  showRollNo
                  emptyTitle="No students found in this class."
                  emptyHint="Pick a different academic section, standard or division."
                />
              )}
            </UtilitySection>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
