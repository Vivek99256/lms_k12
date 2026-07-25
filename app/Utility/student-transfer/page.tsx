"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, LoaderCircle, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "../_components/ClassFilters";
import { StudentSelectionTable } from "../_components/StudentSelectionTable";
import {
  UtilityAlert,
  UtilityEmpty,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
  utilitySelectClass,
} from "../_components/utility-ui";
import {
  emptyClassOptions,
  loadClassOptions,
  type ClassOptions,
} from "../_lib/classOptions";
import { errorMessage } from "../_lib/erp";
import { selectableIds, toggleId, type UtilityStudent } from "../_lib/students";
import {
  ALWAYS_TRANSFERRED_MODULE,
  loadStudentTransferBootstrap,
  searchTransferableStudents,
  sessionAcademicYears,
  transferStudentsToInstitute,
  type InstituteOption,
  type StudentTransferSearch,
} from "./api";
import { buildSessionContext } from "@/lib/erp-client";
import type { LabelledKey } from "../_lib/erp";

export default function StudentTransferPage() {
  const [fromInstituteName, setFromInstituteName] = useState("");
  const [fromClientId, setFromClientId] = useState("");
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);

  const [fromOptions, setFromOptions] = useState<ClassOptions>(emptyClassOptions);
  const [toOptions, setToOptions] = useState<ClassOptions>(emptyClassOptions);

  const [fromSyear, setFromSyear] = useState("");
  const [fromClass, setFromClass] = useState<ClassSelection>(emptyClassSelection);
  const [toSubInstituteId, setToSubInstituteId] = useState("");
  const [toSyear, setToSyear] = useState("");
  const [toClass, setToClass] = useState<ClassSelection>(emptyClassSelection);

  const [students, setStudents] = useState<UtilityStudent[]>([]);
  const [modules, setModules] = useState<LabelledKey[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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
      const session = buildSessionContext();
      const [bootstrap, classes] = await Promise.all([
        loadStudentTransferBootstrap(),
        loadClassOptions(),
      ]);
      setFromInstituteName(bootstrap.fromInstituteName);
      setFromClientId(bootstrap.fromClientId);
      setInstitutes(bootstrap.institutes);
      setFromOptions(classes);

      const years = sessionAcademicYears();
      setAcademicYears(years);
      setFromSyear((current) => current || session.syear || years[0] || "");
      setToSyear((current) => current || session.syear || years[0] || "");
    } catch (value: unknown) {
      setError(errorMessage(value, "The student transfer screen could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Destination classes belong to the destination institute, not the current one.
  useEffect(() => {
    if (!toSubInstituteId) return;
    let active = true;
    void (async () => {
      try {
        const classes = await loadClassOptions({
          subInstituteId: toSubInstituteId,
          syear: toSyear || undefined,
        });
        if (active) setToOptions(classes);
      } catch {
        if (active) setToOptions(emptyClassOptions);
      }
    })();
    return () => {
      active = false;
    };
  }, [toSubInstituteId, toSyear]);

  const search: StudentTransferSearch = useMemo(
    () => ({
      gradeId: fromClass.gradeId,
      standardId: fromClass.standardId,
      divisionId: fromClass.divisionId,
      fromSyear,
      toSubInstituteId,
      toSyear,
      toAcademicSection: toClass.gradeId,
      toStandard: toClass.standardId,
      toDivision: toClass.divisionId,
      fromInstituteName,
      fromClientId,
    }),
    [fromClass, fromSyear, toSubInstituteId, toSyear, toClass, fromInstituteName, fromClientId]
  );

  const missingSearchField =
    !fromSyear ||
    !fromClass.gradeId ||
    !fromClass.standardId ||
    !fromClass.divisionId ||
    !toSubInstituteId ||
    !toSyear ||
    !toClass.gradeId ||
    !toClass.standardId ||
    !toClass.divisionId;

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (missingSearchField) {
      setError("Select the source class, destination institute, destination year and destination class.");
      return;
    }

    setSearching(true);
    try {
      const result = await searchTransferableStudents(search);
      setStudents(result.students);
      setModules(result.modules);
      setSelectedModules([ALWAYS_TRANSFERRED_MODULE]);
      setSelectedIds([]);
      setSearched(true);
    } catch (value: unknown) {
      setStudents([]);
      setModules([]);
      setSearched(true);
      setError(errorMessage(value, "Students could not be loaded."));
    } finally {
      setSearching(false);
    }
  }

  async function submitTransfer() {
    setError("");
    setNotice("");
    if (selectedIds.length === 0) {
      setError("Select at least one student to transfer.");
      return;
    }

    const destination = institutes.find((entry) => entry.id === Number(toSubInstituteId));
    if (
      !window.confirm(
        `Move ${selectedIds.length} student(s) to ${destination?.name ?? "the selected institute"}? Students with paid fees or an existing record there are rejected by the ERP.`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const message = await transferStudentsToInstitute(search, selectedIds, selectedModules);
      setNotice(message);
      setSelectedIds([]);
      const result = await searchTransferableStudents(search);
      setStudents(result.students);
    } catch (value: unknown) {
      setError(errorMessage(value, "The student transfer could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Student transfer"
        description="Move students to another institute of the same client, with their linked records."
        onRefresh={() => void load()}
        refreshing={loading || searching || saving}
      />

      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      {loading ? (
        <UtilitySection title="Transfer criteria">
          <UtilityLoading label="Loading institutes and classes…" />
        </UtilitySection>
      ) : (
        <form onSubmit={runSearch}>
          <UtilitySection
            title="Transfer criteria"
            description="Pick the class to move from and the institute, year and class to move into."
            icon={<Building2 className="size-5" />}
            footer={
              <Button type="submit" disabled={searching || missingSearchField}>
                {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                {searching ? "Searching…" : "Search students"}
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">From</p>
                <div className="space-y-2">
                  <Label htmlFor="from-institute">Institute name</Label>
                  <input
                    id="from-institute"
                    className={utilitySelectClass}
                    value={fromInstituteName}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-syear">Academic year *</Label>
                  <select
                    id="from-syear"
                    className={utilitySelectClass}
                    value={fromSyear}
                    onChange={(event) => setFromSyear(event.target.value)}
                    required
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <ClassFilters
                  idPrefix="from"
                  options={fromOptions}
                  value={fromClass}
                  onChange={setFromClass}
                />
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">To</p>
                <div className="space-y-2">
                  <Label htmlFor="to-institute">Institute name *</Label>
                  <select
                    id="to-institute"
                    className={utilitySelectClass}
                    value={toSubInstituteId}
                    onChange={(event) => {
                      setToSubInstituteId(event.target.value);
                      setToClass(emptyClassSelection);
                      setToOptions(emptyClassOptions);
                    }}
                    required
                  >
                    <option value="">Select destination institute</option>
                    {institutes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-syear">Academic year *</Label>
                  <select
                    id="to-syear"
                    className={utilitySelectClass}
                    value={toSyear}
                    onChange={(event) => setToSyear(event.target.value)}
                    required
                  >
                    <option value="">Select academic year</option>
                    {academicYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <ClassFilters
                  idPrefix="to"
                  options={toOptions}
                  value={toClass}
                  onChange={setToClass}
                  disabled={!toSubInstituteId}
                />
              </div>
            </div>
          </UtilitySection>
        </form>
      )}

      {searched && !loading ? (
        <UtilitySection
          title="Students to transfer"
          description="Tick the record groups that should move with each student. General information always moves."
          icon={<Send className="size-5" />}
          footer={
            students.length > 0 ? (
              <Button
                type="button"
                onClick={() => void submitTransfer()}
                disabled={saving || selectedIds.length === 0}
              >
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                {saving ? "Transferring…" : "Move to other institute"}
              </Button>
            ) : null
          }
        >
          {searching ? (
            <UtilityLoading label="Loading students…" />
          ) : students.length === 0 ? (
            <UtilityEmpty
              title="No students match this class."
              hint="Change the source academic section, standard or division and search again."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                {modules.map((module) => {
                  const locked = module.key === ALWAYS_TRANSFERRED_MODULE;
                  const checked = locked || selectedModules.includes(module.key);
                  return (
                    <label
                      key={module.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        checked ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700"
                      } ${locked ? "opacity-70" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-blue-600"
                        checked={checked}
                        disabled={locked}
                        onChange={() =>
                          setSelectedModules((current) =>
                            current.includes(module.key)
                              ? current.filter((entry) => entry !== module.key)
                              : [...current, module.key]
                          )
                        }
                      />
                      {module.label}
                    </label>
                  );
                })}
              </div>

              <StudentSelectionTable
                students={students}
                selectedIds={selectedIds}
                onToggle={(studentId) => setSelectedIds((current) => toggleId(current, studentId))}
                onToggleAll={(checked) => setSelectedIds(checked ? selectableIds(students) : [])}
                emptyTitle="No students match this class."
              />
            </div>
          )}
        </UtilitySection>
      ) : null}
    </main>
  );
}
