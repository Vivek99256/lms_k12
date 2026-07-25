"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Receipt, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UtilityAlert,
  UtilityEmpty,
  UtilityLoading,
  UtilityPageHeader,
  UtilitySection,
} from "../_components/utility-ui";
import { errorMessage, type LabelledKey } from "../_lib/erp";
import { buildSessionContext } from "@/lib/erp-client";
import {
  deleteBreakoffMonths,
  loadBreakoffMonths,
  loadBreakoffRolloverStatus,
  rolloverFeeBreakoff,
  type FeeRolloverModule,
} from "./api";

export default function BreakoffRolloverPage() {
  const [instituteName, setInstituteName] = useState("");
  const [modules, setModules] = useState<FeeRolloverModule[]>([]);
  const [months, setMonths] = useState<LabelledKey[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [includeAdvanceFees, setIncludeAdvanceFees] = useState(false);

  const [currentSyear, setCurrentSyear] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const nextSyear = currentSyear ? String(Number(currentSyear) + 1) : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCurrentSyear(buildSessionContext().syear);
      const [status, monthOptions] = await Promise.all([
        loadBreakoffRolloverStatus(),
        loadBreakoffMonths(),
      ]);
      setInstituteName(status.instituteName);
      setModules(status.modules);
      setMonths(monthOptions);
      setSelectedMonths([]);
    } catch (value: unknown) {
      setError(errorMessage(value, "The breakoff rollover status could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const alreadyRolled = modules.find((module) => module.key === "fees_breackoff")?.done ?? false;

  async function runRollover() {
    setError("");
    setNotice("");
    if (
      !window.confirm(
        `Roll fee map years, fee titles and fee breakoff${
          includeAdvanceFees ? " and advance fees" : ""
        } into ${nextSyear || "the next academic year"}?`
      )
    ) {
      return;
    }

    setRunning(true);
    try {
      setNotice(await rolloverFeeBreakoff(includeAdvanceFees));
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The fee breakoff rollover could not be completed."));
    } finally {
      setRunning(false);
    }
  }

  async function runDelete() {
    setError("");
    setNotice("");
    if (selectedMonths.length === 0) {
      setError("Select at least one fee month to delete.");
      return;
    }
    if (
      !window.confirm(
        `Delete the ${currentSyear} fee breakoff for ${selectedMonths.length} month(s)? Deleted rows are archived to the breakoff log first.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      setNotice(await deleteBreakoffMonths(selectedMonths));
      setSelectedMonths([]);
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The breakoff months could not be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <UtilityPageHeader
        title="Breakoff rollover"
        description={`Carry the fee breakoff into ${nextSyear || "the next year"}, or clear a month in ${currentSyear || "the current year"}.`}
        onRefresh={() => void load()}
        refreshing={loading || running || deleting}
      />

      <UtilityAlert tone="error">{error}</UtilityAlert>
      <UtilityAlert tone="success">{notice}</UtilityAlert>

      <UtilitySection
        title={`Roll fee breakoff into ${nextSyear || "the next year"}`}
        description={instituteName ? `Institute: ${instituteName}` : undefined}
        icon={<Receipt className="size-5" />}
        footer={
          !loading ? (
            <Button type="button" onClick={() => void runRollover()} disabled={running || alreadyRolled}>
              {running ? <LoaderCircle className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              {running ? "Rolling over…" : "Rollover fee breakoff"}
            </Button>
          ) : null
        }
      >
        {loading ? (
          <UtilityLoading label="Loading fee rollover status…" />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Fee map years and fee titles are rolled first — the breakoff rows re-point at the new
              year&apos;s fee titles and their month suffix is shifted forward. Rows with a zero amount
              are skipped, and the rollover is refused if next-year breakoff rows already exist.
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="w-40">Rows in {nextSyear || "next year"}</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.key}>
                      <TableCell className="font-medium text-slate-900">{module.label}</TableCell>
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
                </TableBody>
              </Table>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 accent-blue-600"
                checked={includeAdvanceFees}
                onChange={(event) => setIncludeAdvanceFees(event.target.checked)}
              />
              Also allocate advance fees collected this year against next year&apos;s breakoff
            </label>

            {alreadyRolled ? (
              <UtilityAlert tone="info">
                Fee breakoff rows already exist for {nextSyear}. The ERP will not roll them over a
                second time.
              </UtilityAlert>
            ) : null}
          </div>
        )}
      </UtilitySection>

      <UtilitySection
        title={`Delete ${currentSyear || "current year"} breakoff by month`}
        description="Rows are copied into the breakoff log before they are removed."
        icon={<Trash2 className="size-5" />}
        footer={
          !loading && months.length > 0 ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void runDelete()}
              disabled={deleting || selectedMonths.length === 0}
            >
              {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? "Deleting…" : `Delete ${selectedMonths.length || ""} month(s)`.trim()}
            </Button>
          ) : null
        }
      >
        {loading ? (
          <UtilityLoading label="Loading fee months…" />
        ) : months.length === 0 ? (
          <UtilityEmpty
            title="No fee months are configured."
            hint="Map the fee year range (from month / to month) before a breakoff can be deleted."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {months.map((month) => {
              const checked = selectedMonths.includes(month.key);
              return (
                <label
                  key={month.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 text-slate-700"
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
    </main>
  );
}
