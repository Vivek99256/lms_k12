"use client";

/**
 * Creating a department, properly.
 *
 * The old create dialog asked for nothing but a name and stopped there -
 * which left a department with no head, no documents, and no obvious route
 * to add any of them. This walks the whole setup, mirroring G2G's
 * `department-create-wizard.tsx` adapted to what this codebase actually has.
 *
 * SAVED AS YOU GO. Step 1 creates the department for real, and every later
 * step writes against that real id. A department created here starts
 * INACTIVE (`status: 0`) and is activated by Finish (`status: 1`), so an
 * abandoned wizard leaves a resumable draft rather than a half-built
 * department pretending to be finished.
 *
 * Note on this codebase's `hierarchy()` endpoint (which backs the
 * department list/tree on this page): it filters `WHERE status = 1`, so an
 * inactive draft will not show up in the list until Finish activates it -
 * unlike G2G's source, where a Status filter surfaces inactive drafts
 * directly in the grid. Changing that filter is out of scope here (it is a
 * shared read endpoint used elsewhere), so the tradeoff is: the draft still
 * exists and is fully resumable by id, it just is not browsable from the
 * list while inactive. Worth revisiting if that endpoint is ever revisited
 * for its own sake.
 *
 * Full 6-step parity with G2G's source wizard: Basics, Head, Job Roles,
 * Employees, Documents, Review. Job Roles sits BEFORE Employees, same
 * reasoning as source - an employee's place in a department is expressed
 * through a job role (department -> job role -> employee), and a role
 * belongs to exactly one department, so assigning people before any role
 * exists is how somebody ends up holding a role that belongs elsewhere.
 */

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { buildSessionContext } from "@/lib/erp-client";
import {
  createDepartment,
  getDepartmentEmployees,
  setDepartmentHead,
  updateDepartment,
} from "../../_lib/department-management-api";
import { HeadOfDepartmentPicker, type PickerEmployee } from "./head-of-department-picker";
import { DepartmentJobRolesPanel } from "./department-job-roles-panel";
import { DepartmentEmployeesPanel } from "./department-employees-panel";
import PoliciesModule from "./polices";
import RulesModule from "./rules";
import SopsModule from "./sops";

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { title: "Basics", hint: "Name, code and where it sits" },
  { title: "Head", hint: "Who leads this department" },
  { title: "Job Roles", hint: "The roles this department is made of" },
  { title: "Employees", hint: "Transfer or assign people" },
  { title: "Documents", hint: "SOPs, policies and rules" },
  { title: "Review", hint: "Confirm and activate" },
];

export type WizardParentOption = { id: number; name: string };

type CreatedDepartment = {
  id: number;
  name: string;
  code: string;
  description: string;
  parentName: string;
  head: string;
};

export function DepartmentCreateWizard({
  open,
  parentOptions,
  initialParent,
  onCancel,
  onCreated,
  onFinished,
}: {
  open: boolean;
  /** Every department/sub-department currently in the list, for the parent picker. */
  parentOptions: WizardParentOption[];
  /** Pre-selected parent when launched from "Add sub-department". */
  initialParent?: WizardParentOption | null;
  onCancel: () => void;
  /** Fired after step 1, so the department list can pick up the new (inactive) department. */
  onCreated?: () => void;
  /** Fired after Finish activates the department. */
  onFinished: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | "">(initialParent?.id ?? "");
  const [created, setCreated] = useState<CreatedDepartment | null>(null);
  const [headSearch, setHeadSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  // Org-wide head candidates (not scoped to this new, currently-empty
  // department). A small default batch (`limit: 30`) loads immediately when
  // the step opens, so the picker isn't empty before the user types anything
  // - then typing re-fetches, debounced, scoped by `search` instead of
  // `limit`. This replaces an earlier "fetch every tenant employee up to
  // 500, sorted by a computed name column" load, which was slow against a
  // remote dev database; a capped default batch keeps the same instant-list
  // feel without paying for the full unfiltered query every time.
  const [headCandidates, setHeadCandidates] = useState<PickerEmployee[]>([]);
  const [headCandidatesLoading, setHeadCandidatesLoading] = useState(false);

  function reset() {
    setStep(0);
    setName("");
    setCode("");
    setDescription("");
    setParentId(initialParent?.id ?? "");
    setCreated(null);
    setHeadSearch("");
    setError("");
    setHeadCandidates([]);
    setHeadCandidatesLoading(false);
  }

  useEffect(() => {
    if (step !== 1 || !created) return;

    const query = headSearch.trim();
    let cancelled = false;
    setHeadCandidatesLoading(true);

    // The default (empty-search) batch loads right away; once the user
    // types, debounce so every keystroke doesn't fire its own request.
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
            setError(
              cause instanceof Error ? cause.message : "Failed to load employees for head of department."
            );
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
  }, [step, created, headSearch]);

  function cancel() {
    if (isSaving) return;
    reset();
    onCancel();
  }

  /** Step 1 -> creates the real record, then immediately marks it inactive. */
  async function createAndContinue() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Department name is required.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      const response = await createDepartment(session, {
        department: trimmedName,
        parentId: parentId === "" ? 0 : parentId,
        code: code.trim() || undefined,
        description: description.trim() || undefined,
      });

      const newId = response?.data?.id;
      if (!newId) throw new Error("The department was created but no id came back.");

      // Deliberately inactive until Finish.
      await updateDepartment(session, newId, { status: 0 });

      const parent = parentOptions.find((option) => option.id === parentId);
      setCreated({
        id: newId,
        name: trimmedName,
        code: code.trim(),
        description: description.trim(),
        parentName: parent?.name ?? "None (top level)",
        head: "-",
      });

      onCreated?.();
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create department.");
    } finally {
      setIsSaving(false);
    }
  }

  /** Final step -> activate. */
  async function finish() {
    if (!created) return;
    setIsSaving(true);
    setError("");
    try {
      const session = buildSessionContext();
      await updateDepartment(session, created.id, { status: 1 });
      reset();
      onFinished();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to activate department.");
    } finally {
      setIsSaving(false);
    }
  }

  async function assignHead(employeeId: number) {
    if (!created) return;
    setIsSaving(true);
    setError("");
    try {
      const session = buildSessionContext();
      await setDepartmentHead(session, created.id, employeeId);
      const picked = headCandidates.find((employee) => employee.id === employeeId);
      setCreated((prev) => (prev ? { ...prev, head: picked?.name ?? prev.head } : prev));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to assign head of department.");
    } finally {
      setIsSaving(false);
    }
  }

  async function clearHead() {
    if (!created) return;
    setIsSaving(true);
    setError("");
    try {
      const session = buildSessionContext();
      await setDepartmentHead(session, created.id, null);
      setCreated((prev) => (prev ? { ...prev, head: "-" } : prev));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to clear head of department.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      // Radix's default modal focus-trap fights the Parent department
      // `<Select>` below: base-ui's Select popup portals separately, outside
      // Radix's trap boundary, so the trap yanks focus back to the dialog
      // and the popup never stays open. `modal={false}` drops the trap and
      // scroll-lock while the overlay/backdrop still render unchanged.
      modal={false}
      onOpenChange={(next) => {
        if (!next) cancel();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialParent ? `Add sub-department under ${initialParent.name}` : "Create department"}
          </DialogTitle>
          <DialogDescription>{STEPS[step].hint}</DialogDescription>
        </DialogHeader>

        {/* Step rail. Completed steps are ticked; later steps are inert -
            there is no department to write against until step 1 completes. */}
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {STEPS.map((entry, index) => (
            <li key={entry.title} className="flex items-center gap-1">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  index < step && "bg-emerald-600 text-white",
                  index === step && "bg-blue-600 text-white",
                  index > step && "bg-muted text-muted-foreground"
                )}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={cn(index === step ? "font-medium text-foreground" : "text-muted-foreground")}>
                {entry.title}
              </span>
              {index < STEPS.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="min-h-[280px] py-2">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="wizard-dept-name" className="text-sm font-medium text-foreground">
                  Department name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="wizard-dept-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Quality Assurance"
                  disabled={isSaving}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-dept-code" className="text-sm font-medium text-foreground">
                  Code <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="wizard-dept-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="e.g. ENG-QA"
                  maxLength={50}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-dept-parent" className="text-sm font-medium text-foreground">
                  Parent department
                </label>
                <Select
                  value={parentId === "" ? "none" : String(parentId)}
                  onValueChange={(value) => setParentId(value === "none" ? "" : Number(value))}
                  disabled={isSaving}
                >
                  <SelectTrigger id="wizard-dept-parent" className="h-9 w-full">
                    {/* This Select wrapper (base-ui, not Radix) does not
                        auto-resolve a label from the matching SelectItem -
                        SelectValue needs to be told what to display, same as
                        the working filters in Department/page.tsx already do. */}
                    <SelectValue>
                      {parentId === ""
                        ? "None (top level)"
                        : (parentOptions.find((option) => option.id === parentId)?.name ?? "None (top level)")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top level)</SelectItem>
                    {parentOptions
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          {option.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-dept-description" className="text-sm font-medium text-foreground">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="wizard-dept-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  disabled={isSaving}
                  placeholder="What this department is responsible for"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {step === 1 && created && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {created.head !== "-" ? (
                  <>
                    Head of department:{" "}
                    <span className="font-medium text-foreground">{created.head}</span>
                  </>
                ) : (
                  "Optional — search for any existing employee to lead this department. You can change this later from the department details panel."
                )}
              </p>
              <HeadOfDepartmentPicker
                currentHead={created.head}
                employees={headCandidates}
                search={headSearch}
                onSearchChange={setHeadSearch}
                isSubmitting={isSaving}
                loading={headCandidatesLoading}
                emptyHint={
                  headSearch.trim()
                    ? "No employees match that search."
                    : "No employees available to assign."
                }
                onAssign={(employeeId) => void assignHead(employeeId)}
                onClear={() => void clearHead()}
                error={null}
              />
            </div>
          )}

          {step === 2 && created && (
            <DepartmentJobRolesPanel department={{ id: created.id, name: created.name }} canManage />
          )}

          {step === 3 && created && (
            <DepartmentEmployeesPanel
              department={{ id: created.id, name: created.name }}
              departments={parentOptions}
              canManage
              onChanged={onCreated}
            />
          )}

          {step === 4 && created && (
            <DocumentsStep departmentId={created.id} departmentName={created.name} />
          )}

          {step === 5 && created && (
            <dl className="space-y-3 text-sm">
              <ReviewRow label="Name" value={created.name} />
              <ReviewRow label="Code" value={created.code || "—"} />
              <ReviewRow label="Parent" value={created.parentName} />
              <ReviewRow label="Head of department" value={created.head === "-" ? "Unassigned" : created.head} />
              <ReviewRow label="Description" value={created.description || "—"} />
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                This department is currently <strong>Inactive</strong>. Finishing will activate it and
                make it available across the application.
              </p>
            </dl>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={cancel} disabled={isSaving}>
            {created ? "Finish later" : "Cancel"}
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((current) => (current - 1) as WizardStep)}
                disabled={isSaving}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
            )}

            {step === 0 && (
              <Button type="button" onClick={() => void createAndContinue()} disabled={isSaving || !name.trim()}>
                {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Save &amp; continue
              </Button>
            )}

            {step > 0 && step < 5 && (
              <Button
                type="button"
                onClick={() => setStep((current) => (current + 1) as WizardStep)}
                disabled={isSaving}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {step === 5 && (
              <Button type="button" onClick={() => void finish()} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Finish &amp; activate
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Step 3 reuses the very same tab components the details panel uses, so a
 * document added during setup and one added later go through identical
 * code (`SopsModule` takes a real `departmentId`; `PoliciesModule`/
 * `RulesModule` only take `departmentName`, matching how they're already
 * wired in `Department/page.tsx`'s details Sheet).
 */
function DocumentsStep({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const [tab, setTab] = useState<"sops" | "policies" | "rules">("sops");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-muted p-1">
        {(["sops", "policies", "rules"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {key}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Optional — these can also be added at any time from the department details panel.
      </p>
      <div className="rounded-md border border-border">
        {tab === "sops" && <SopsModule departmentName={departmentName} departmentId={departmentId} />}
        {tab === "policies" && <PoliciesModule departmentName={departmentName} />}
        {tab === "rules" && <RulesModule departmentName={departmentName} />}
      </div>
    </div>
  );
}
