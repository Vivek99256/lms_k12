"use client";

import { Bot, ClipboardList, Pencil, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErpSection } from "@/components/erp/erp-ui";
import type { ParseIssue, ProcessSpec } from "@/lib/process";
import { ActorBadge, BulletList, CleanBill, Detail, IssueList, RuleChip } from "./process-ui";

/**
 * Step 2 - the Process record.
 *
 * This is the SOP's procedure attribute table, typed and resolved. The value
 * over the old free-text box is that every one of these fields now exists as a
 * field: a process with no trigger or no completion criteria is visibly
 * incomplete here, where before it was just a paragraph somebody had or had not
 * written.
 *
 * Editing happens by going back to the source text, not by editing the record
 * in place. The SOP document stays the thing of record, and the process stays a
 * faithful conversion of it rather than a fork that quietly drifts.
 */
export function StepProcess({
  spec,
  issues,
  onEditSource,
  disabled,
}: {
  spec: ProcessSpec;
  issues: ParseIssue[];
  onEditSource: () => void;
  disabled: boolean;
}) {
  const aiAssisted = spec.source.method === "ai";

  return (
    <div className="space-y-5">
      <ErpSection
        title="2. Process"
        description="The procedure as a standardised record, resolved against the module's SOP index."
        icon={<ClipboardList className="size-5" />}
        footer={
          <Button type="button" variant="outline" onClick={onEditSource} disabled={disabled}>
            <Pencil className="size-4" />
            Edit source text
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-1 font-mono text-xs font-semibold text-white">{spec.ref}</span>
          <h3 className="text-lg font-semibold text-slate-900">{spec.title}</h3>
          <ActorBadge actor={spec.primaryActor} />
        </div>

        <dl>
          <Detail label="Module">{spec.module}</Detail>
          <Detail label="Process group">{spec.source.processGroup}</Detail>
          <Detail label="Lifecycle stage">{spec.lifecycleStage}</Detail>
          <Detail label="Objective">{spec.attributes.objective}</Detail>
          <Detail label="Trigger">{spec.attributes.trigger}</Detail>
          <Detail label="Preconditions">
            <BulletList items={spec.attributes.preconditions} />
          </Detail>
          <Detail label="Inputs">
            <BulletList items={spec.attributes.inputs} />
          </Detail>
          <Detail label="Completion criteria">{spec.attributes.completionCriteria}</Detail>
          <Detail label="Outputs">
            <BulletList items={spec.workflow.outputs} />
          </Detail>
          <Detail label="Hands over to">
            {spec.workflow.handoffs.length ? spec.workflow.handoffs.join(", ") : ""}
          </Detail>
        </dl>

        <div className="mt-4">
          {issues.length ? (
            <IssueList issues={issues} />
          ) : (
            <CleanBill>
              The procedure converted cleanly - every attribute the SOP standard requires is present.
            </CleanBill>
          )}
        </div>
      </ErpSection>

      <ErpSection
        title="Governing business rules"
        description="Inherited from the module rule set: the rules this procedure's steps cite, plus the AI-governance rules that apply to every AI interaction."
        icon={<ScrollText className="size-5" />}
      >
        {spec.businessRules.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-20 px-2 py-2">Rule</th>
                  <th className="px-2 py-2">Validation</th>
                  <th className="w-40 px-2 py-2">Applies at</th>
                  <th className="px-2 py-2">On failure</th>
                </tr>
              </thead>
              <tbody>
                {spec.businessRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-2 py-2">
                      <RuleChip id={rule.id} />
                    </td>
                    <td className="px-2 py-2 text-slate-700">{rule.rule}</td>
                    <td className="px-2 py-2 text-slate-600">{rule.appliesAt}</td>
                    <td className="px-2 py-2 text-slate-600">{rule.failureBehaviour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No business rules are cited by this procedure.</p>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Bot className="mt-0.5 size-3.5 shrink-0 text-violet-500" aria-hidden />
          <span>
            Converted {new Date(spec.source.convertedAt).toLocaleString()} from {spec.source.document} v
            {spec.source.version}{" "}
            {aiAssisted ? (
              <>
                using AI normalisation ({spec.source.model}). The model reshaped the text; this record was produced and
                checked by the same parser as a hand-pasted procedure, and nothing is saved until you save it.
              </>
            ) : (
              <>by deterministic parse of the SOP tables - no AI was involved.</>
            )}
          </span>
        </p>
      </ErpSection>
    </div>
  );
}
