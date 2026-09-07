"use client";

/**
 * The job roles that belong to a department.
 *
 * This is the middle link of department -> job role -> employee, and
 * Department Management previously had no view of it at all: creating a
 * department gave you somewhere to put people but nothing to put them in.
 *
 * CREATION DELIBERATELY LIVES ELSEWHERE. Job roles are created in Capability
 * Library, whose form already covers levels, categories, responsibilities
 * and skills, and whose endpoint writes `department_id` correctly. A second
 * create form here would write the same table (`s_user_jobrole`) with fewer
 * fields and drift from it, so this panel lists, shows headcount (when
 * given one), and links out.
 *
 * Ported from G2G's `department-job-roles-panel.tsx`, adapted to this
 * codebase: fetches through `competencyLibrariesService.list('jobrole', {
 * department_id })` (this project's Capability Library client) rather than
 * G2G's dedicated `/jobroles-by-department` Laravel route, and navigates
 * with a plain `router.push()` since this codebase has no
 * `useSidebarNavigation().resolveAccessLink()` / access-link registry to
 * route through.
 *
 * Used by the department creation wizard's "Job Roles" step.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildSessionContext } from "@/lib/erp-client";
import {
  competencyLibrariesService,
  type JobroleRow,
} from "@/app/capability-intelligence/_lib/libraries-taxonomy-api";

export function DepartmentJobRolesPanel({
  department,
  canManage,
  /** Employees per role (keyed by role id, as a string), so a role that nobody holds is visible as such. */
  employeeCountByRole,
  onRolesLoaded,
}: {
  department: { id: number; name: string };
  canManage: boolean;
  employeeCountByRole?: Record<string, number>;
  /** Fired whenever the role list (re)loads, so a caller (e.g. the Employees step) can reuse it. */
  onRolesLoaded?: (roles: JobroleRow[]) => void;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<JobroleRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const session = buildSessionContext();
      const response = await competencyLibrariesService.list<JobroleRow>(session, "jobrole", {
        department_id: String(department.id),
        per_page: 200,
      });
      const data = response?.data ?? [];
      setRoles(data);
      onRolesLoaded?.(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load job roles.");
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
    // onRolesLoaded is intentionally excluded - callers pass an inline
    // function, and including it would re-run this fetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (role) =>
        role.jobrole?.toLowerCase().includes(q) ||
        (role.jobrole_category ?? "").toLowerCase().includes(q)
    );
  }, [roles, search]);

  function openLibrary() {
    router.push("/capability-intelligence/capability-library");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="size-4" />
          Job roles ({roles.length})
        </h4>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={openLibrary}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Create in library
            </Button>
          )}
        </div>
      </div>

      {roles.length > 4 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job roles..."
            className="h-9 pl-9"
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading job roles...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && roles.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>No job roles are defined for {department.name} yet.</p>
          <p className="mt-1">
            Job roles are created in Capability Library and assigned to a department there. Employees
            are then given one of this department&apos;s roles.
          </p>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          {visible.map((role) => {
            const held = employeeCountByRole?.[String(role.id)] ?? 0;
            return (
              <div
                key={role.id}
                className="flex items-start gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{role.jobrole}</p>
                  {(role.jobrole_category || role.description) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[role.jobrole_category, role.description].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {employeeCountByRole && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    title={`${held} employee${held === 1 ? "" : "s"} hold this role`}
                  >
                    <Users className="size-3" aria-hidden="true" />
                    {held}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && roles.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No job roles match that search.</p>
      )}
    </div>
  );
}
