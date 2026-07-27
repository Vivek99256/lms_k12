"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  FileSpreadsheet,
  Hash,
  LoaderCircle,
  Trash2,
  UserRoundX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  UtilityAlert,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
  utilityInputClass,
  utilitySelectClass,
} from "../_components/utility-ui";
import { divisionsForStandard, emptyClassOptions, loadClassOptions, type ClassOptions } from "../_lib/classOptions";
import { errorMessage } from "../_lib/erp";
import { buildSessionContext } from "@/lib/erp-client";
import {
  deleteBreakoffMonths,
  importActiveInactiveExcel,
  inactivateAllStudents,
  loadBulkUpdateBootstrap,
  rolloverLeaveBalance,
  updateRollNumbers,
  type ActiveInactiveMode,
  type BulkUpdateBootstrap,
} from "./api";

const emptyBootstrap: BulkUpdateBootstrap = {
  activeStudentCount: 0,
  standards: [],
  breakoffMonths: [],
};

type BusyAction =
  | "inactivate"
  | "breakoff"
  | "excel"
  | "rollno"
  | "earned-leave"
  | "casual-leave"
  | null;

export default function UpdateAllDataPage() {
  const [bootstrap, setBootstrap] = useState<BulkUpdateBootstrap>(emptyBootstrap);
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [currentSyear, setCurrentSyear] = useState("");

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [excelMode, setExcelMode] = useState<ActiveInactiveMode | "">("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rollNoStandard, setRollNoStandard] = useState("");
  const [rollNoDivision, setRollNoDivision] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextSyear = currentSyear ? String(Number(currentSyear) + 1) : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCurrentSyear(buildSessionContext().syear);
      const [data, classes] = await Promise.all([loadBulkUpdateBootstrap(), loadClassOptions()]);
      setBootstrap(data);
      setClassOptions(classes);
      setSelectedMonths([]);
    } catch (value: unknown) {
      setError(errorMessage(value, "The bulk update screen could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rollNoDivisions = useMemo(
    () => divisionsForStandard(classOptions, rollNoStandard),
    [classOptions, rollNoStandard]
  );

  async function run(action: Exclude<BusyAction, null>, confirmText: string, task: () => Promise<string>) {
    setError("");
    setNotice("");
    if (!window.confirm(confirmText)) return;

    setBusy(action);
    try {
      setNotice(await task());
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The update could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  function spinner(action: BusyAction) {
    return busy === action ? <LoaderCircle className="size-4 animate-spin" /> : null;
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Update all data"
        description="Year-end bulk maintenance for student enrolments, fee breakoff, roll numbers and leave balances."
        onRefresh={() => void load()}
        refreshing={loading || busy !== null}
      />

      <UtilityAlert tone="info">
        These actions apply to every matching record at once and cannot be undone from this screen.
      </UtilityAlert>
      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      {loading ? (
        <UtilitySection title="Bulk actions">
          <UtilityLoading label="Loading bulk update options…" />
        </UtilitySection>
      ) : (
        <>
          <UtilitySection
            title="Make all students inactive"
            description={`Sets today's end date on every active enrolment in ${currentSyear || "the current year"}.`}
            icon={<UserRoundX className="size-5" />}
            footer={
              <Button
                type="button"
                variant="destructive"
                disabled={busy !== null || bootstrap.activeStudentCount === 0}
                onClick={() =>
                  void run(
                    "inactivate",
                    `Make all ${bootstrap.activeStudentCount} active students inactive?`,
                    inactivateAllStudents
                  )
                }
              >
                {spinner("inactivate") ?? <UserRoundX className="size-4" />}
                Make all inactive
              </Button>
            }
          >
            <p className="text-sm text-slate-600">
              <span className="font-mono font-semibold text-slate-900">
                {bootstrap.activeStudentCount}
              </span>{" "}
              student{bootstrap.activeStudentCount === 1 ? "" : "s"} currently active.
            </p>
          </UtilitySection>

          <UtilitySection
            title="Delete fee breakoff"
            description="Selected months are archived to the breakoff log and then removed from the current year."
            icon={<Trash2 className="size-5" />}
            footer={
              bootstrap.breakoffMonths.length > 0 ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy !== null || selectedMonths.length === 0}
                  onClick={() =>
                    void run(
                      "breakoff",
                      `Delete the fee breakoff for ${selectedMonths.length} month(s)?`,
                      () => deleteBreakoffMonths(selectedMonths)
                    )
                  }
                >
                  {spinner("breakoff") ?? <Trash2 className="size-4" />}
                  Delete breakoff
                </Button>
              ) : null
            }
          >
            {bootstrap.breakoffMonths.length === 0 ? (
              <p className="text-sm text-slate-500">
                No fee months are configured for this institute and year.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {bootstrap.breakoffMonths.map((month) => {
                  const checked = selectedMonths.includes(month.key);
                  return (
                    <label
                      key={month.key}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        checked
                          ? "border-red-200 bg-red-50 text-red-900"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-red-600"
                        checked={checked}
                        onChange={() =>
                          setSelectedMonths((current) =>
                            current.includes(month.key)
                              ? current.filter((entry) => entry !== month.key)
                              : [...current, month.key]
                          )
                        }
                      />
                      {month.label}
                    </label>
                  );
                })}
              </div>
            )}
          </UtilitySection>

          <UtilitySection
            title="Activate or deactivate students from Excel"
            description="Upload an .xlsx or .xls file whose first column holds the GR number. The header row is skipped."
            icon={<FileSpreadsheet className="size-5" />}
            footer={
              <Button
                type="button"
                disabled={busy !== null || !excelMode || !excelFile}
                onClick={() => {
                  if (!excelMode || !excelFile) return;
                  void run(
                    "excel",
                    `Mark every student listed in "${excelFile.name}" as ${excelMode.toLowerCase()}?`,
                    async () => {
                      const message = await importActiveInactiveExcel(excelMode, excelFile);
                      setExcelFile(null);
                      setExcelMode("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      return message;
                    }
                  );
                }}
              >
                {spinner("excel") ?? <FileSpreadsheet className="size-4" />}
                Upload and apply
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="excel-mode">Action *</Label>
                <select
                  id="excel-mode"
                  className={utilitySelectClass}
                  value={excelMode}
                  onChange={(event) => setExcelMode(event.target.value as ActiveInactiveMode | "")}
                >
                  <option value="">Select</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="excel-file">Excel file *</Label>
                <input
                  id="excel-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className={`${utilityInputClass} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700`}
                  onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </UtilitySection>

          <UtilitySection
            title="Update student roll numbers"
            description="Renumbers the class 1..n in alphabetical order of first name, then last name."
            icon={<Hash className="size-5" />}
            footer={
              <Button
                type="button"
                disabled={busy !== null || !rollNoStandard || !rollNoDivision}
                onClick={() =>
                  void run(
                    "rollno",
                    "Renumber roll numbers for the selected standard and division?",
                    () => updateRollNumbers(rollNoStandard, rollNoDivision)
                  )
                }
              >
                {spinner("rollno") ?? <Hash className="size-4" />}
                Update roll numbers
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rollno-standard">Standard *</Label>
                <select
                  id="rollno-standard"
                  className={utilitySelectClass}
                  value={rollNoStandard}
                  onChange={(event) => {
                    setRollNoStandard(event.target.value);
                    setRollNoDivision("");
                  }}
                >
                  <option value="">Select standard</option>
                  {bootstrap.standards.map((standard) => (
                    <option key={standard.standardId} value={standard.standardId}>
                      {standard.gradeName ? `${standard.gradeName} — ` : ""}
                      {standard.standardName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollno-division">Division *</Label>
                <select
                  id="rollno-division"
                  className={utilitySelectClass}
                  value={rollNoDivision}
                  disabled={!rollNoStandard}
                  onChange={(event) => setRollNoDivision(event.target.value)}
                >
                  <option value="">Select division</option>
                  {rollNoDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </UtilitySection>

          <UtilitySection
            title="Rollover opening leave balances"
            description={`Carries this year's closing balance into ${nextSyear || "the next year"}. Employees who already have a next-year allocation are skipped.`}
            icon={<CalendarClock className="size-5" />}
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "earned-leave",
                      `Roll over earned-leave opening balances into ${nextSyear}?`,
                      () => rolloverLeaveBalance("earned")
                    )
                  }
                >
                  {spinner("earned-leave") ?? <CalendarClock className="size-4" />}
                  Rollover earned leave
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "casual-leave",
                      `Roll over casual-leave opening balances into ${nextSyear}?`,
                      () => rolloverLeaveBalance("casual")
                    )
                  }
                >
                  {spinner("casual-leave") ?? <CalendarClock className="size-4" />}
                  Rollover casual leave
                </Button>
              </>
            }
          >
            <p className="text-sm text-slate-500">
              Only the current year&apos;s closed leave balance is carried forward.
            </p>
          </UtilitySection>
        </>
      )}
    </main>
  );
}
