"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, GitBranchPlus, LoaderCircle, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErpAlert, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import {
  convertSopProcedure,
  deriveTasks,
  findModule,
  findProcedure,
  shippedSourceFor,
  specToIntakeText,
  storageKeyFor,
  SOP_MODULES,
  SOP_SOURCE_TEMPLATE,
  type ParseIssue,
  type ProcessSpec,
  type ProcessStatus,
  type TaskDraft,
} from "@/lib/process";
import { deleteAddProcess } from "./api";
import {
  loadProcessRows,
  saveProcess,
  type StoredProcessRow,
} from "./_lib/process-store";
import { PublishPanel } from "./_components/PublishPanel";
import { StepProcess } from "./_components/StepProcess";
import { StepSource, type SourceState } from "./_components/StepSource";
import { StepTasks } from "./_components/StepTasks";
import { StepWorkflow } from "./_components/StepWorkflow";
import { GettingStarted } from "./_components/GettingStarted";
import { ProcessToolbar, SECTION_IDS, type ToolbarStep } from "./_components/ProcessToolbar";

/**
 * Add Process - SOP to Process, Workflow and Tasks.
 *
 * The screen this replaces stored one CKEditor blob per menu: whatever a person
 * typed, in whatever shape they typed it, unqueryable and unassignable. This
 * one takes the same input - a module and a written procedure - and produces a
 * structured Process, its Workflow, and the Tasks that follow from it, then
 * hands those tasks to People & Competency > Task management.
 *
 * Four steps, in the order the SOP itself imposes:
 *
 *   1. Source   - which module, which procedure, and the procedure text
 *   2. Process  - the attribute record, resolved against the module's SOP index
 *   3. Workflow - the step table with actors, gates and rule citations
 *   4. Tasks    - what a person actually has to do, and who does it
 *
 * Nothing is written until a person presses Save, and no task is raised until a
 * person names an assignee. That is not caution for its own sake - it is the
 * SOP's own rule (7.4, BR-07) applied to the tool that digitises it.
 *
 * Legacy rows are safe: anything that is not a converted document opens as
 * legacy content and is left exactly as it was found.
 */

const STATUS_LABELS: Record<ProcessStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
};

function emptySource(): SourceState {
  return {
    moduleKey: SOP_MODULES[0]?.key ?? "",
    groupRef: "",
    procedureRef: "",
    text: "",
    allowAi: true,
  };
}

/** The one procedure that ships with its full SOP text, offered on first run. */
const SAMPLE = { moduleKey: "lms-pal", groupRef: "6.9", procedureRef: "6.9.4" } as const;

/**
 * What "unsaved" compares. Everything a save would persist, and nothing else -
 * `convertedAt` moves on every re-parse, so including it would mark a process
 * dirty for merely being re-read.
 */
function snapshot(spec: ProcessSpec | null): string {
  if (!spec) return "";
  const { source, ...rest } = spec;
  return JSON.stringify({ ...rest, sourceRef: source.procedureRef, method: source.method });
}

function jumpTo(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AddProcessPage() {
  const [rows, setRows] = useState<StoredProcessRow[]>([]);
  const [source, setSource] = useState<SourceState>(emptySource);
  const [spec, setSpec] = useState<ProcessSpec | null>(null);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [status, setStatus] = useState<ProcessStatus>("draft");

  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  /** The spec as last written or opened; drives the unsaved-changes indicator. */
  const [savedSnapshot, setSavedSnapshot] = useState("");

  // Fixed for the session so the due-date column does not shift under the user
  // mid-review, and so what the preview shows is what gets published.
  const [publishFrom] = useState(() => new Date());

  const sopModule = useMemo(() => findModule(source.moduleKey), [source.moduleKey]);
  const busy = loading || converting || saving || deletingId !== null;

  const selectedTaskCount = spec?.tasks.filter((task) => task.selected).length ?? 0;
  const dirty = Boolean(spec) && snapshot(spec ? { ...spec, status } : null) !== savedSnapshot;

  const toolbarSteps: ToolbarStep[] = useMemo(() => {
    if (!spec) return [];
    const errors = issues.filter((issue) => issue.level === "error").length;
    const warnings = issues.length - errors;
    return [
      { id: SECTION_IDS.source, label: "Source", detail: `${spec.source.method === "ai" ? "AI-normalised" : "SOP tables"}`, done: true },
      {
        id: SECTION_IDS.process,
        label: "Process",
        detail: errors ? `${errors} to fix` : warnings ? `${warnings} gaps` : "Complete",
        done: !errors,
      },
      { id: SECTION_IDS.workflow, label: "Workflow", detail: `${spec.workflow.steps.length} steps`, done: true },
      {
        id: SECTION_IDS.tasks,
        label: "Tasks",
        detail: `${selectedTaskCount} of ${spec.tasks.length} selected`,
        done: selectedTaskCount > 0,
      },
      {
        id: SECTION_IDS.publish,
        label: "Publish",
        detail: selectedTaskCount ? "Ready to assign" : "Nothing selected",
        done: false,
      },
    ];
  }, [spec, issues, selectedTaskCount]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await loadProcessRows());
    } catch (value: unknown) {
      setError(errorMessage(value, "Saved processes could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The Laravel proxy depends on the browser session context from localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function updateSource(next: Partial<SourceState>) {
    setSource((current) => {
      const merged = { ...current, ...next };

      // Picking a procedure that ships with SOP text loads it, as long as the
      // box is empty or still holds another procedure's text - never clobber
      // something the user typed.
      if (next.procedureRef && next.procedureRef !== current.procedureRef) {
        const shipped = shippedSourceFor(merged.moduleKey, next.procedureRef);
        const untouched = !current.text.trim() || current.text === shippedSourceFor(merged.moduleKey, current.procedureRef);
        if (shipped && untouched) merged.text = shipped;
      }

      return merged;
    });
  }

  function loadShippedSource() {
    const shipped = shippedSourceFor(source.moduleKey, source.procedureRef);
    updateSource({ text: shipped ?? SOP_SOURCE_TEMPLATE });
  }

  /**
   * Convert.
   *
   * The deterministic parse runs here, in the browser: it is pure, it is
   * instant, and for a procedure pasted with its tables intact it is the whole
   * answer - so the common case costs no round trip and no model call. Only
   * when that parse fails does this reach for `api/process/convert`, which
   * normalises prose with the model and then runs the very same parser
   * server-side.
   */
  async function convert(from: SourceState = source) {
    // Resolved from the passed source, not from state: "try the sample"
    // converts a source that has not been committed to state yet.
    const target = findModule(from.moduleKey);
    if (!target) return;

    setConverting(true);
    setError("");
    setNotice("");

    try {
      const local = convertSopProcedure(from.text, target, { previousTasks: spec?.tasks });
      const blocked = !local.spec || local.issues.some((issue) => issue.level === "error");

      if (!blocked) {
        applyConversion(local.spec!, local.issues, "Converted from the SOP tables - no AI was used.");
        return;
      }

      if (!from.allowAi) {
        setSpec(null);
        setIssues(local.issues);
        setError("The text could not be converted. Fix the errors below, or allow AI normalisation.");
        return;
      }

      const response = await fetch("/api/process/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: from.text,
          moduleKey: from.moduleKey,
          procedureRef: from.procedureRef || undefined,
          allowAi: true,
        }),
      });

      const payload = (await response.json()) as {
        spec?: ProcessSpec | null;
        issues?: ParseIssue[];
        method?: string;
        model?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !payload.spec) {
        setSpec(null);
        setIssues(payload.issues ?? local.issues);
        setError(payload.error ?? "The text could not be converted into a process.");
        return;
      }

      applyConversion(
        { ...payload.spec, tasks: deriveTasks(payload.spec, target, { previous: spec?.tasks }) },
        payload.issues ?? [],
        `Normalised by AI (${payload.model ?? "model"}), then converted and checked by the same parser. Review before saving.`
      );
    } catch (value: unknown) {
      setError(errorMessage(value, "The conversion failed."));
    } finally {
      setConverting(false);
    }
  }

  function applyConversion(next: ProcessSpec, nextIssues: ParseIssue[], message: string) {
    setSpec({ ...next, status });
    setIssues(nextIssues);
    setNotice(message);
    // The result renders below three screens of form. Landing on it is the
    // difference between "nothing happened" and "here is what you made".
    jumpTo(SECTION_IDS.process);
  }

  function updateTask(key: string, next: Partial<TaskDraft>) {
    setSpec((current) =>
      current
        ? { ...current, tasks: current.tasks.map((task) => (task.key === key ? { ...task, ...next } : task)) }
        : current
    );
  }

  /** Select or clear many drafts at once. `keys === null` means all assignable ones. */
  function bulkSelect(keys: string[] | null, selected: boolean) {
    const wanted = keys ? new Set(keys) : null;
    setSpec((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((task) =>
              task.assignable && (!wanted || wanted.has(task.key)) ? { ...task, selected } : task
            ),
          }
        : current
    );
  }

  async function save() {
    if (!spec || !sopModule) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = { ...spec, status };
      const { message } = await saveProcess({ spec: saved, module: sopModule });
      setNotice(message);
      setSavedSnapshot(snapshot(saved));
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The process could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  /** Reopen a stored process for review. */
  function open(stored: ProcessSpec) {
    const found = findProcedure(findModule(source.moduleKey) ?? SOP_MODULES[0], stored.ref);
    setSource((current) => ({
      ...current,
      groupRef: found?.group.ref ?? current.groupRef,
      procedureRef: stored.ref,
      text: specToIntakeText(stored),
    }));
    setSpec(stored);
    setStatus(stored.status);
    setIssues([]);
    setSavedSnapshot(snapshot(stored));
    setNotice(`Opened ${stored.ref} ${stored.title}.`);
    jumpTo(SECTION_IDS.process);
  }

  /** Fill in the shipped sample and convert it in one click, for a first visit. */
  function trySample() {
    const shipped = shippedSourceFor(SAMPLE.moduleKey, SAMPLE.procedureRef);
    if (!shipped) return;

    const next: SourceState = {
      moduleKey: SAMPLE.moduleKey,
      groupRef: SAMPLE.groupRef,
      procedureRef: SAMPLE.procedureRef,
      text: shipped,
      allowAi: true,
    };
    setSource(next);
    // Passed explicitly rather than read back from state, which this render
    // has not seen yet.
    void convert(next);
  }

  async function remove(row: StoredProcessRow) {
    const what = row.processes.length
      ? row.processes.map((process) => `${process.ref} ${process.title}`).join(", ")
      : `the legacy free-text process on "${row.record.menuName}"`;
    if (!window.confirm(`Delete ${what}?`)) return;

    setDeletingId(row.record.id);
    setError("");
    setNotice("");
    try {
      setNotice(await deleteAddProcess(row.record.id));
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The record could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Array<RecordColumn<StoredProcessRow>> = [
    {
      key: "process",
      label: "Process",
      value: (row) =>
        row.processes.length
          ? row.processes.map((process) => `${process.ref} ${process.title}`).join(", ")
          : `${row.record.menuName} (legacy free text)`,
      render: (row) =>
        row.processes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {row.processes.map((process) => (
              <button
                key={process.ref}
                type="button"
                disabled={busy}
                onClick={() => open(process)}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
                title={`Open ${process.ref} for review`}
              >
                <span className="font-mono font-semibold">{process.ref}</span> {process.title}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-500">
            {row.record.menuName} - legacy free text, not converted
          </span>
        ),
    },
    {
      key: "module",
      label: "Module",
      value: (row) => (row.processes.length ? row.processes[0].module : "-"),
    },
    {
      key: "stage",
      label: "Stage",
      value: (row) => (row.processes.length ? row.processes[0].lifecycleStage : "-"),
    },
    {
      key: "status",
      label: "Status",
      value: (row) =>
        row.processes.length
          ? [...new Set(row.processes.map((process) => STATUS_LABELS[process.status]))].join(", ")
          : "Legacy",
    },
    { key: "created_by_name", label: "Created by", value: (row) => row.record.createdByName },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Add Process"
        description="Convert a module SOP procedure into a standardised Process, Workflow and set of Tasks."
        onRefresh={() => void load()}
        refreshing={busy}
      />

      {spec ? (
        <ProcessToolbar
          spec={spec}
          steps={toolbarSteps}
          status={status}
          onStatusChange={setStatus}
          dirty={dirty}
          saving={saving}
          busy={busy}
          onSave={() => void save()}
          onJump={jumpTo}
          selectedTaskCount={selectedTaskCount}
        />
      ) : null}

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {!spec && !loading && !rows.length ? (
        <GettingStarted onTrySample={trySample} disabled={busy} />
      ) : null}

      <div id={SECTION_IDS.source} className="scroll-mt-40">
        <StepSource
          state={source}
          onChange={updateSource}
          issues={spec ? [] : issues}
          converting={converting}
          onConvert={() => void convert()}
          onLoadShippedSource={loadShippedSource}
          hasShippedSource={Boolean(shippedSourceFor(source.moduleKey, source.procedureRef))}
          disabled={saving}
        />
      </div>

      {spec ? (
        <>
          <div id={SECTION_IDS.process} className="scroll-mt-40">
            <StepProcess
              spec={spec}
              issues={issues}
              onEditSource={() => jumpTo(SECTION_IDS.source)}
              disabled={busy}
            />
          </div>

          <div id={SECTION_IDS.workflow} className="scroll-mt-40">
            <StepWorkflow spec={spec} />
          </div>

          <div id={SECTION_IDS.tasks} className="scroll-mt-40">
            <StepTasks
              spec={spec}
              tasks={spec.tasks}
              onTaskChange={updateTask}
              onBulkSelect={bulkSelect}
              publishFrom={publishFrom}
              disabled={busy}
            />
          </div>

          <ErpSection
            title="Save the process"
            description="Saving records the process, its workflow and its task drafts under its own procedure key. It does not raise any task."
            icon={<Save className="size-5" />}
            footer={
              <Button type="button" onClick={() => void save()} disabled={busy || !dirty}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {dirty ? "Save process" : "No changes to save"}
              </Button>
            }
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Stored as", value: storageKeyFor(spec).menuName, mono: true },
                { label: "Status", value: STATUS_LABELS[status] },
                { label: "Workflow steps", value: String(spec.workflow.steps.length) },
                {
                  label: "Task drafts",
                  value: `${selectedTaskCount} selected of ${spec.tasks.length}`,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                  <dd
                    className={`mt-1 text-slate-900 ${item.mono ? "font-mono text-xs" : "text-sm font-medium"}`}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Status is set in the bar at the top of the page. Approval is a person&apos;s act, not the
              converter&apos;s - a process stays a draft until someone accountable marks it otherwise.
            </p>
          </ErpSection>

          <div id={SECTION_IDS.publish} className="scroll-mt-40">
            <PublishPanel
              drafts={spec.tasks}
              processLabel={`${spec.ref} ${spec.title}`}
              disabled={busy}
            />
          </div>
        </>
      ) : null}

      <ErpSection
        title="Saved processes"
        description="Converted processes, plus any legacy free-text entries that have not been converted yet."
        icon={<FileText className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading saved processes..." />
        ) : (
          <RecordTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.record.id}
            searchPlaceholder="Search processes..."
            exportFilename="processes"
            exportTitle="Processes"
            emptyTitle="No processes are stored yet."
            emptyHint="Convert an SOP procedure above to create the first one."
            actions={(row) => (
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void remove(row)}
                aria-label={`Delete ${row.processes.length ? row.processes.map((process) => process.ref).join(", ") : row.record.menuName}`}
              >
                {deletingId === row.record.id ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            )}
          />
        )}
      </ErpSection>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <GitBranchPlus className="size-3.5" aria-hidden />
        Each process is stored in its own row of the existing requirements record, keyed by module and procedure number.
        Legacy free-text entries are left untouched, and no schema change was needed.
      </p>
    </main>
  );
}
