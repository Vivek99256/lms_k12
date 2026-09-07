"use client";

/**
 * Edit dialog for a department or sub-department.
 *
 * The old dialog collected a name and nothing else, because the update
 * endpoint wrote a name and nothing else. Code, description, status,
 * parent and head are all real, editable fields now (see the department
 * creation wizard and `updateDepartment()`/`setDepartmentHead()` in
 * `_lib/department-management-api.ts`), so the form that claims to edit a
 * department can actually edit one - mirroring G2G's
 * `department-list.tsx` edit dialog.
 *
 * Parent and status used to be reachable only from the row's kebab menu
 * ("Add sub-department", a separate reorder control) or not at all
 * (status could never be changed, even though the API already accepted
 * it). Head reuses the same `HeadOfDepartmentPicker` and
 * `setDepartmentHead()` call already built for the standalone "Assign /
 * change HOD" dialog, just embedded here and staged (not submitted)
 * until Save - see `save()` below for why the head write happens first.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildSessionContext } from "@/lib/erp-client";
import { getDepartmentEmployees, setDepartmentHead, updateDepartment } from "../../_lib/department-management-api";
import { HeadOfDepartmentPicker, type PickerEmployee } from "./head-of-department-picker";

type DepartmentStatus = "Active" | "Inactive" | "Pending";

export type EditableDepartment = {
  apiId: number;
  name: string;
  code: string;
  description: string;
  /** Immediate parent's backend id, or 0 for top-level. */
  parentApiId: number;
  /** Parent's display name, or "-" for top-level. */
  parent: string;
  status: DepartmentStatus;
  /** Current head's display name, or "-" if unassigned. */
  head: string;
  employees_list: PickerEmployee[];
};

export type EditParentOption = { id: number; name: string; parent: string };

export function DepartmentEditDialog({
  open,
  target,
  parentOptions,
  onCancel,
  onSaved,
}: {
  open: boolean;
  target: EditableDepartment | null;
  /**
   * Every department/sub-department eligible as this department's new
   * parent. The caller (`Department/page.tsx`) already excludes the
   * department itself and everything beneath it - the backend rejects
   * those moves anyway ("beneath itself or one of its own
   * sub-departments"), so offering them here would only produce a
   * guaranteed 422.
   */
  parentOptions: EditParentOption[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState(0);
  const [status, setStatus] = useState<"1" | "0">("1");
  // undefined = head untouched this session; null = explicitly cleared; a
  // number = a newly picked employee id. Only sent (via setDepartmentHead)
  // when not undefined - see save() below.
  const [headId, setHeadId] = useState<number | null | undefined>(undefined);
  const [headSearch, setHeadSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Org-wide candidates, same as the creation wizard's Head step and the
  // row-menu "Assign/change HOD" dialog - not scoped to `target.employees_list`,
  // since a department with no employees of its own can still get a head
  // assigned from anywhere in the tenant.
  const [headCandidates, setHeadCandidates] = useState<PickerEmployee[]>([]);
  const [headCandidatesLoading, setHeadCandidatesLoading] = useState(false);

  // Re-seeded every time a (possibly different) row is opened for editing -
  // the dialog stays mounted across opens/closes, so plain useState
  // initializers would only ever run once.
  useEffect(() => {
    if (!open || !target) return;
    setName(target.name);
    setCode(target.code ?? "");
    setDescription(target.description ?? "");
    setParentId(target.parentApiId);
    setStatus(target.status === "Active" ? "1" : "0");
    setHeadId(undefined);
    setHeadSearch("");
    setError(null);
  }, [open, target]);

  useEffect(() => {
    if (!open || !target) return;

    const query = headSearch.trim();
    let cancelled = false;
    setHeadCandidatesLoading(true);

    const delay = query ? 300 : 0;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const session = buildSessionContext();
          const data = await getDepartmentEmployees(
            session,
            query ? { search: query, limit: 50 } : { limit: 30 }
          );
          if (cancelled) return;
          setHeadCandidates(
            data.map((employee) => ({
              id: employee.id,
              name: employee.name?.trim() || `Employee #${employee.id}`,
              employee_no: employee.employee_no ?? undefined,
              department_name: employee.department_name ?? undefined,
            }))
          );
        } catch (cause) {
          if (!cancelled) {
            setError(cause instanceof Error ? cause.message : "Failed to load employees.");
          }
        } finally {
          if (!cancelled) setHeadCandidatesLoading(false);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, target, headSearch]);

  function close() {
    if (isSaving) return;
    onCancel();
  }

  async function save() {
    if (!target) return;

    const nextName = name.trim();
    if (!nextName) {
      setError("Department name is required.");
      return;
    }

    const nextCode = code.trim();
    const nextDescription = description.trim();
    const nextStatus = Number(status) as 0 | 1;
    const currentStatus = target.status === "Active" ? 1 : 0;

    // Compares every field the form shows, not just the name - editing
    // only the code (or only the status) used to look like a no-op and
    // close without saving.
    const unchanged =
      nextName === target.name &&
      nextCode === (target.code ?? "") &&
      nextDescription === (target.description ?? "") &&
      parentId === target.parentApiId &&
      nextStatus === currentStatus &&
      headId === undefined;

    if (unchanged) {
      onCancel();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      // The head lives on its own endpoint (it validates the employee
      // against the tenant), so a head change is a second call rather
      // than a field on update. Done first: if it's refused, nothing else
      // has been written.
      if (headId !== undefined) {
        await setDepartmentHead(session, target.apiId, headId);
      }

      await updateDepartment(session, target.apiId, {
        department: nextName,
        code: nextCode,
        description: nextDescription,
        status: nextStatus,
        // Only sent when it actually changed - the backend's cycle-check
        // rejects a parent that is the department's own descendant, and
        // there's no reason to invite that on an edit that didn't touch
        // parent at all.
        ...(parentId !== target.parentApiId ? { parentId } : {}),
      });

      onSaved(
        target.parent !== "-"
          ? "Sub-department updated successfully."
          : "Department updated successfully."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update department.");
    } finally {
      setIsSaving(false);
    }
  }

  // What the head picker should show as "current" - the staged selection
  // once the user has touched it this session, otherwise the row's actual
  // current head.
  const pendingHeadName =
    headId === undefined
      ? (target?.head ?? "-")
      : headId === null
        ? "-"
        : (headCandidates.find((employee) => employee.id === headId)?.name ?? "-");

  return (
    <Dialog
      open={open}
      // Same fix as department-create-wizard.tsx: this dialog nests two
      // base-ui `<Select>`s (Parent, Status) whose popups portal outside
      // Radix's modal focus-trap boundary, so the trap fights the popup and
      // it never stays open. `modal={false}` removes the trap/scroll-lock;
      // the overlay/backdrop are unaffected.
      modal={false}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {target && target.parent !== "-" ? "sub-department" : "department"}
          </DialogTitle>
          <DialogDescription>
            {target && target.parent !== "-"
              ? `Parent department: ${target.parent}`
              : "Update this department's name, code, hierarchy and description."}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <label htmlFor="edit-dept-name" className="text-sm font-medium text-foreground">
              Department name
            </label>
            <Input
              id="edit-dept-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-dept-code" className="text-sm font-medium text-foreground">
              Code <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="edit-dept-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              placeholder="e.g. HR, ENG-QA"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit-dept-parent" className="text-sm font-medium text-foreground">
                Parent department
              </label>
              <Select
                value={parentId === 0 ? "none" : String(parentId)}
                onValueChange={(value) => setParentId(value === "none" ? 0 : Number(value))}
                disabled={isSaving}
              >
                <SelectTrigger id="edit-dept-parent" className="h-9 w-full">
                  {/* This Select wrapper (base-ui, not Radix) does not
                      auto-resolve a label from the matching SelectItem -
                      SelectValue needs to be told what to display, same as
                      the working filters in Department/page.tsx already do. */}
                  <SelectValue>
                    {(() => {
                      if (parentId === 0) return "None (top level)";
                      const option = parentOptions.find((candidate) => candidate.id === parentId);
                      if (!option) return "None (top level)";
                      return option.parent !== "-" ? `${option.parent} / ${option.name}` : option.name;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.parent !== "-" ? `${option.parent} / ${option.name}` : option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-dept-status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value === "0" ? "0" : "1")}
                disabled={isSaving}
              >
                <SelectTrigger id="edit-dept-status" className="h-9 w-full">
                  <SelectValue>{status === "1" ? "Active" : "Inactive"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Head of department{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <HeadOfDepartmentPicker
              currentHead={pendingHeadName}
              employees={headCandidates}
              loading={headCandidatesLoading}
              emptyHint={headSearch.trim() ? "No employees match that search." : "No employees available to assign."}
              search={headSearch}
              onSearchChange={setHeadSearch}
              isSubmitting={isSaving}
              onAssign={(employeeId) => setHeadId(employeeId)}
              onClear={() => setHeadId(null)}
            />
            {target && target.head !== "-" && pendingHeadName === "-" ? (
              <p className="text-xs text-muted-foreground">
                Saving will clear the current head ({target.head}).
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-dept-description" className="text-sm font-medium text-foreground">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="edit-dept-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              disabled={isSaving}
              placeholder="What this department is responsible for"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
