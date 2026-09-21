"use client";

import { useMemo } from "react";
import { FileInput, LoaderCircle, RotateCcw, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErpSection, erpSelectClass } from "@/components/erp/erp-ui";
import { SOP_MODULES, vocabularyFor, type SopModule } from "@/lib/process";
import { IssueList } from "./process-ui";
import type { ParseIssue } from "@/lib/process";

/**
 * Step 1 - what is being converted.
 *
 * The intake is a *pick* before it is a paste. Choosing module, process group
 * and procedure resolves the conversion against the SOP index, which is what
 * lets the parser fill in the lifecycle stage, the owning process group and the
 * governing business rules without the transcriber retyping any of it - and
 * what makes the result comparable across procedures instead of being one
 * person's free text.
 *
 * Those three fields are also the whole identity of a process. The screen used
 * to ask for a menu as well, because a menu was the legacy row's key; that made
 * a person choose from hundreds of unrelated titles to answer a question the
 * procedure number already answers. Storage now keys itself off the module and
 * the reference, so the question is not asked.
 *
 * All three lists come from the module registry and nowhere else: the Module
 * select is `SOP_MODULES`, Process group is the chosen module's `groups`, and
 * Procedure is the chosen group's `procedures`. Registering a module is
 * therefore the whole of adding it to this screen - there is no list here to
 * keep in step. Each option is annotated with what the module actually
 * carries, so "configured" is visible rather than assumed.
 */

export interface SourceState {
  moduleKey: string;
  groupRef: string;
  procedureRef: string;
  text: string;
  allowAi: boolean;
}

export function StepSource({
  state,
  modules = SOP_MODULES,
  libraryError = "",
  onChange,
  issues,
  converting,
  onConvert,
  onLoadShippedSource,
  hasShippedSource,
  disabled,
}: {
  state: SourceState;
  /**
   * The modules this screen offers.
   *
   * Defaults to the registry, and the converter passes the registry plus the
   * module it was opened from when that module has no SOP catalogue yet — so a
   * person who reached Process Builder from Student is offered Student, rather
   * than a list that silently excludes where they are.
   */
  modules?: SopModule[];
  /**
   * Why the institute's SOP library is missing from the pickers, when it is
   * missing because the request failed rather than because there is nothing to
   * show. Reported here because the two look identical otherwise.
   */
  libraryError?: string;
  onChange: (next: Partial<SourceState>) => void;
  issues: ParseIssue[];
  converting: boolean;
  onConvert: () => void;
  onLoadShippedSource: () => void;
  hasShippedSource: boolean;
  disabled: boolean;
}) {
  const sopModule: SopModule | undefined = useMemo(
    () => modules.find((entry) => entry.key === state.moduleKey),
    [modules, state.moduleKey]
  );

  const group = useMemo(
    () => sopModule?.groups.find((entry) => entry.ref === state.groupRef),
    [sopModule, state.groupRef]
  );

  const procedure = useMemo(
    () => group?.procedures.find((entry) => entry.ref === state.procedureRef),
    [group, state.procedureRef]
  );

  /** What the chosen module carries, so the caption states it rather than implies it. */
  const catalogued = useMemo(() => {
    const groups = sopModule?.groups ?? [];
    return {
      groups: groups.length,
      procedures: groups.reduce((total, entry) => total + entry.procedures.length, 0),
    };
  }, [sopModule]);

  return (
    <ErpSection
      title="1. Source"
      description="Pick the module and the SOP procedure, then paste the procedure text."
      icon={<FileInput className="size-5" />}
      footer={
        <>
          {hasShippedSource ? (
            <Button type="button" variant="outline" onClick={onLoadShippedSource} disabled={disabled || converting}>
              <RotateCcw className="size-4" />
              Load SOP text
            </Button>
          ) : null}
          <Button type="button" onClick={onConvert} disabled={disabled || converting || !state.text.trim()}>
            {converting ? <LoaderCircle className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Convert to process
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="module">Module *</Label>
          <select
            id="module"
            className={erpSelectClass}
            value={state.moduleKey}
            disabled={disabled}
            onChange={(event) => onChange({ moduleKey: event.target.value, groupRef: "", procedureRef: "" })}
          >
            {modules.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.name}
              </option>
            ))}
          </select>
          {sopModule && sopModule.sop.document ? (
            <p className="text-xs text-slate-500">
              {sopModule.sop.document} v{sopModule.sop.version} &middot; {sopModule.sop.organization} &middot; effective{" "}
              {sopModule.sop.effectiveDate} &middot; {catalogued.groups} process groups, {catalogued.procedures}{" "}
              procedures
            </p>
          ) : sopModule && libraryError ? (
            <p className="text-xs text-amber-700">
              The institute SOP library could not be loaded, so the pickers are empty &middot;{" "}
              {libraryError}
            </p>
          ) : sopModule && catalogued.procedures > 0 ? (
            // No shipped catalogue, but the institute has written SOPs and they
            // are what the pickers below list. Counted rather than described,
            // so the caption cannot claim more than the library holds.
            <p className="text-xs text-slate-500">
              No SOP catalogue shipped for {sopModule.name} &middot; {catalogued.procedures}{" "}
              {catalogued.procedures === 1 ? "document" : "documents"} from this institute&apos;s SOP
              library, in {catalogued.groups} {catalogued.groups === 1 ? "group" : "groups"}
            </p>
          ) : sopModule ? (
            // Neither a catalogue nor a stored document. Saying so is the point:
            // the pickers below will be empty, and that is a fact about the SOP
            // rather than a fault in this screen.
            <p className="text-xs text-slate-500">
              No SOP digitized for {sopModule.name} yet &middot; paste the procedure text below and
              the converter will read it
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="group">Process group</Label>
          <select
            id="group"
            className={erpSelectClass}
            value={state.groupRef}
            disabled={disabled || !sopModule}
            onChange={(event) => onChange({ groupRef: event.target.value, procedureRef: "" })}
          >
            <option value="">Select a process group</option>
            {sopModule?.groups.map((entry) => (
              <option key={entry.ref} value={entry.ref}>
                {entry.ref} {entry.title} ({entry.procedures.length})
              </option>
            ))}
          </select>
          {group ? <p className="text-xs text-slate-500">Lifecycle stage: {group.lifecycleStage}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="procedure">Procedure</Label>
          <select
            id="procedure"
            className={erpSelectClass}
            value={state.procedureRef}
            disabled={disabled || !group}
            onChange={(event) => onChange({ procedureRef: event.target.value })}
          >
            <option value="">Select a procedure</option>
            {group?.procedures.map((entry) => (
              <option key={entry.ref} value={entry.ref}>
                {entry.ref} {entry.title}
                {entry.digitized ? " (SOP text available)" : ""}
              </option>
            ))}
          </select>
          {procedure && sopModule ? (
            <p className="text-xs text-slate-500">
              Primary actor per the SOP index: {vocabularyFor(sopModule).actorLabels[procedure.primaryActor]}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sopText">Procedure text *</Label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300"
                checked={state.allowAi}
                disabled={disabled}
                onChange={(event) => onChange({ allowAi: event.target.checked })}
              />
              <Sparkles className="size-3.5 text-violet-500" aria-hidden />
              Use AI to normalise unstructured text
            </label>
          </div>
          <Textarea
            id="sopText"
            rows={16}
            value={state.text}
            disabled={disabled}
            onChange={(event) => onChange({ text: event.target.value })}
            placeholder="Paste the procedure: its attribute lines, its numbered step table and its outputs."
            className="min-h-[320px] resize-y font-mono text-xs leading-5"
          />
          <p className="text-xs text-slate-500">
            A procedure pasted with its tables intact is converted deterministically - no AI call, nothing to review for
            invention. AI is used only when that parse fails, and only to reshape the prose; the result is parsed and
            checked by the same code either way.
          </p>
        </div>
      </div>

      {issues.length ? (
        <div className="mt-4">
          <IssueList issues={issues} />
        </div>
      ) : null}
    </ErpSection>
  );
}
