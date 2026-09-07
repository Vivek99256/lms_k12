"use client";

/**
 * Employee picker used to assign/change a department's head.
 *
 * Extracted out of `Department/page.tsx`'s "Assign / change HOD" dialog so
 * the same picker (same rendering, same API call semantics) can be reused
 * inside the department creation wizard's "Head" step, instead of forking a
 * second implementation. Call sites differ in what `employees` list they
 * pass in - the page's dialog and the edit dialog pass the target
 * department's already-loaded `employees_list`, while the create wizard's
 * Head step passes org-wide candidates (a freshly-created department has no
 * staff of its own yet, but any existing employee is still a valid head -
 * see `getDepartmentEmployees(session, {})` in
 * `department-create-wizard.tsx`). The empty state below only shows when
 * whichever list was passed in is genuinely empty.
 */

import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickerEmployee = {
  id: number;
  name: string;
  employee_no?: string | number | null;
  /** The employee's current department, if any - shown as part of the subtitle. */
  department_name?: string | null;
};

export function HeadOfDepartmentPicker({
  currentHead,
  employees,
  search,
  onSearchChange,
  isSubmitting,
  onAssign,
  onClear,
  error,
  loading = false,
  emptyHint,
}: {
  /** Current head's display name, or "-" if unassigned. */
  currentHead: string;
  employees: PickerEmployee[];
  search: string;
  onSearchChange: (value: string) => void;
  isSubmitting: boolean;
  onAssign: (employeeId: number) => void;
  onClear: () => void;
  error?: string | null;
  /**
   * True while `employees` is being fetched for the current `search` term
   * (the wizard's org-wide search-as-you-type case). The search box stays
   * interactive throughout - only the results area shows a spinner - so
   * typing is never interrupted by the list disappearing mid-fetch.
   */
  loading?: boolean;
  /** Overrides the default "no employees" copy, e.g. to prompt a search. */
  emptyHint?: string;
}) {
  // The wizard passes already search-filtered results (its fetch takes a
  // `search` query param), so re-filtering client-side here would just
  // narrow that same list a second time - harmless, but pointless. Callers
  // with a small, already-loaded, unfiltered list (the row-menu dialog, the
  // edit dialog) still rely on this local filter, so it stays unconditional.
  const q = search.trim().toLowerCase();
  const visible = q
    ? employees.filter(
        (employee) =>
          employee.name?.toLowerCase().includes(q) ||
          String(employee.employee_no ?? "").toLowerCase().includes(q)
      )
    : employees;

  return (
    <div className="space-y-3">
      {currentHead !== "-" ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
          <span>
            Current: <span className="font-medium text-foreground">{currentHead}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or employee number..."
          className="h-9 pl-9"
        />
      </div>

      <div className="max-h-72 min-h-32 overflow-y-auto rounded-md border border-border">
        {loading ? (
          <p className="flex items-center gap-2 p-4 text-[12px] text-muted-foreground">
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            Searching...
          </p>
        ) : employees.length === 0 ? (
          <p className="p-4 text-[12px] text-muted-foreground">
            {emptyHint ?? "No employees available to assign."}
          </p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-[12px] text-muted-foreground">No employees match that search.</p>
        ) : (
          visible.map((employee) => {
            const isCurrent = currentHead === employee.name;
            return (
              <button
                key={employee.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => onAssign(employee.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-[12px] transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50",
                  isCurrent && "bg-blue-50"
                )}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{employee.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[employee.employee_no, employee.department_name].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {isCurrent ? (
                  <span className="shrink-0 text-[11px] font-medium text-blue-600">Current</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
