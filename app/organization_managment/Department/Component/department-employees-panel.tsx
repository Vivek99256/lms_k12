"use client";

/**
 * Staffing a department: transfer people in, pull in employees who have no
 * department, remove people, or go create a new employee.
 *
 * There was previously no way to put anybody in a department from this
 * screen at all. Creating one produced an empty shell, and department moves
 * elsewhere in the app (Employee Directory's edit form) happen one person at
 * a time with no bulk tool and no "everyone with no department" view.
 *
 * Ported from G2G's `department-employees-panel.tsx`, adapted to this
 * codebase: uses `department-management-api.ts`'s `getDepartmentEmployees` /
 * `assignDepartmentEmployees` / `unassignDepartmentEmployees` (wrapping
 * `departmentController@employees` / `assignEmployees` / `unassignEmployees`)
 * instead of G2G's `organizationService`, shadcn `Select` instead of
 * `SelectInput`, and a plain `router.push()` instead of
 * `resolveAccessLink()` (this codebase has no access-link registry).
 *
 * Used by the department creation wizard's "Employees" step.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, ExternalLink, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildSessionContext } from "@/lib/erp-client";
import {
  assignDepartmentEmployees,
  getDepartmentEmployees,
  unassignDepartmentEmployees,
  type DepartmentEmployee,
} from "../../_lib/department-management-api";
import {
  competencyLibrariesService,
  type JobroleRow,
} from "@/app/capability-intelligence/_lib/libraries-taxonomy-api";

type Source = "transfer" | "unassigned";

function fullName(employee: DepartmentEmployee): string {
  return employee.name?.trim() || `Employee #${employee.id}`;
}

export function DepartmentEmployeesPanel({
  department,
  departments,
  canManage,
  onChanged,
}: {
  department: { id: number; name: string };
  /** Every department in the tenant, for the "transfer from" selector. */
  departments: Array<{ id: number; name: string }>;
  canManage: boolean;
  /** Fired after any successful move, so the caller can reload headcounts. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("transfer");
  const [sourceDepartmentId, setSourceDepartmentId] = useState<number | "">("");
  // The role the moved employees take in THIS department. Optional, because
  // a department may not have its roles defined yet.
  const [jobRoleId, setJobRoleId] = useState<number | "">("");
  const [jobRoles, setJobRoles] = useState<JobroleRow[]>([]);
  const [candidates, setCandidates] = useState<DepartmentEmployee[]>([]);
  const [current, setCurrent] = useState<DepartmentEmployee[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  /** Everything except this department - you cannot transfer from yourself. */
  const transferSources = useMemo(
    () =>
      departments
        .filter((d) => d.id !== department.id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [departments, department.id]
  );

  const loadCurrent = useCallback(async () => {
    try {
      const session = buildSessionContext();
      const data = await getDepartmentEmployees(session, { departmentId: department.id });
      setCurrent(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load current employees.");
    }
  }, [department.id]);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const session = buildSessionContext();
      if (source === "unassigned") {
        setCandidates(await getDepartmentEmployees(session, { unassigned: true }));
      } else if (sourceDepartmentId) {
        setCandidates(await getDepartmentEmployees(session, { departmentId: sourceDepartmentId }));
      } else {
        // Nothing selected yet - deliberately empty rather than everyone.
        setCandidates([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load employees.");
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [source, sourceDepartmentId]);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent]);

  // This department's own roles - the only ones an employee moving here may
  // hold, which is why the backend refuses (clears, not errors) a role from
  // anywhere else.
  useEffect(() => {
    let cancelled = false;
    const session = buildSessionContext();
    competencyLibrariesService
      .list<JobroleRow>(session, "jobrole", { department_id: String(department.id), per_page: 200 })
      .then((response) => {
        if (!cancelled) setJobRoles(response?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setJobRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [department.id]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const visibleCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (employee) =>
        fullName(employee).toLowerCase().includes(q) ||
        String(employee.employee_no ?? "").toLowerCase().includes(q)
    );
  }, [candidates, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<{ applied: number; refused: number; message?: string }>) {
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      // The endpoint reports per employee, so say what actually happened
      // rather than assuming the whole batch went through.
      setNotice(
        result.refused > 0
          ? `${result.applied} moved, ${result.refused} skipped.`
          : result.message || `${result.applied} employee(s) moved.`
      );
      setSelected(new Set());
      await Promise.all([loadCurrent(), loadCandidates()]);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update employees.");
    } finally {
      setIsSaving(false);
    }
  }

  const addSelected = () =>
    run(async () => {
      const session = buildSessionContext();
      return assignDepartmentEmployees(session, department.id, Array.from(selected), {
        remarks: source === "unassigned" ? "Assigned from unassigned pool" : "Department transfer",
        // A job role belongs to exactly one department, so moving someone
        // without giving them a role of THIS department leaves them holding
        // one from the department they just left. When no role is chosen
        // the backend clears a stale one.
        ...(jobRoleId ? { jobroleId: jobRoleId } : {}),
      });
    });

  const removeEmployee = (id: number) =>
    run(async () => {
      const session = buildSessionContext();
      return unassignDepartmentEmployees(session, department.id, [id]);
    });

  /**
   * Creating a brand-new employee belongs to the Employee Directory, which
   * owns the whole joining process. Sending the user there beats a second,
   * partial employee form living inside department setup.
   */
  function goToEmployeeDirectory() {
    router.push("/organization-management/employee-directory");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4" />
          Employees ({current.length})
        </h4>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={goToEmployeeDirectory}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Add new employee
          </Button>
        )}
      </div>

      {notice && <p className="text-xs text-emerald-600">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {current.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border">
          {current.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">
                {fullName(employee)}
                {employee.employee_no && (
                  <span className="ml-2 text-xs text-muted-foreground">{employee.employee_no}</span>
                )}
              </span>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => void removeEmployee(employee.id)}
                >
                  <UserMinus className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={source}
              onValueChange={(value) => {
                setSource(value as Source);
                setSelected(new Set());
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-56">
                {/* This Select wrapper (base-ui, not Radix) does not
                    auto-resolve a label from the matching SelectItem -
                    SelectValue needs to be told what to display. */}
                <SelectValue>
                  {source === "transfer" ? "Transfer from a department" : "Employees with no department"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Transfer from a department</SelectItem>
                <SelectItem value="unassigned">Employees with no department</SelectItem>
              </SelectContent>
            </Select>
            {source === "transfer" && (
              <Select
                value={sourceDepartmentId === "" ? undefined : String(sourceDepartmentId)}
                onValueChange={(value) => setSourceDepartmentId(Number(value))}
              >
                <SelectTrigger className="h-9 w-full sm:w-64">
                  <SelectValue>
                    {sourceDepartmentId === ""
                      ? "Select a department..."
                      : (transferSources.find((d) => d.id === sourceDepartmentId)?.name ??
                        "Select a department...")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {transferSources.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees..."
              className="h-9 pl-9"
            />
          </div>

          <div className="max-h-56 min-h-24 overflow-y-auto rounded-md border border-border">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading employees...</p>}
            {!isLoading && source === "transfer" && !sourceDepartmentId && (
              <p className="p-3 text-sm text-muted-foreground">
                Choose a department to transfer employees from.
              </p>
            )}
            {!isLoading && visibleCandidates.length === 0 && (source !== "transfer" || sourceDepartmentId) && (
              <p className="p-3 text-sm text-muted-foreground">
                {source === "unassigned"
                  ? "Every employee is already assigned to a department."
                  : "That department has no employees to transfer."}
              </p>
            )}
            {!isLoading &&
              visibleCandidates.map((employee) => {
                const isSelected = selected.has(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggle(employee.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && "✓"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{fullName(employee)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[employee.employee_no, employee.department_name].filter(Boolean).join(" · ") ||
                          "No department"}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>

          {jobRoles.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Job role in this department{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Select
                value={jobRoleId === "" ? undefined : String(jobRoleId)}
                onValueChange={(value) => setJobRoleId(value === "none" ? "" : Number(value))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {jobRoleId === ""
                      ? "Keep or clear their current role"
                      : (jobRoles.find((role) => role.id === jobRoleId)?.jobrole ??
                        "Keep or clear their current role")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep or clear their current role</SelectItem>
                  {jobRoles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.jobrole}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || selected.size === 0}
              onClick={() => void addSelected()}
            >
              {source === "unassigned" ? (
                <UserPlus className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
              )}
              {source === "unassigned" ? "Assign to department" : "Transfer to this department"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
