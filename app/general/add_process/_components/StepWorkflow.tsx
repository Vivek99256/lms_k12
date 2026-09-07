"use client";

import { useMemo } from "react";
import { ArrowRight, GitBranch, ShieldAlert, Workflow as WorkflowIcon } from "lucide-react";

import { ErpSection } from "@/components/erp/erp-ui";
import { ACTOR_LABELS, type ActorMode, type ProcessSpec } from "@/lib/process";
import { ActorBadge, ExecutionLabel, RuleChip } from "./process-ui";

/**
 * Step 3 - the Workflow.
 *
 * Two views of the same seven rows, because they answer different questions.
 *
 * The lane strip answers "who is actually doing this?" at a glance, which for
 * an adaptive-learning procedure is the whole point: 6.9.4 runs entirely
 * between the learner and the engine, and seeing four learner steps and three
 * engine steps with no teacher lane at all is what makes the task derivation on
 * the next screen make sense rather than look like a bug.
 *
 * The table answers "what exactly happens, and what is checked", which is what
 * a reviewer signing the process off needs.
 */

/** Lanes are drawn in SOP actor order, and only for actors this process uses. */
const LANE_ORDER: ActorMode[] = ["teacher", "teacher_ai", "ai", "student_ai", "student"];

export function StepWorkflow({ spec }: { spec: ProcessSpec }) {
  const lanes = useMemo(() => {
    const used = new Set(spec.workflow.steps.map((step) => step.actor));
    return LANE_ORDER.filter((actor) => used.has(actor));
  }, [spec.workflow.steps]);

  const gates = spec.workflow.steps.filter((step) => step.humanGate);

  return (
    <div className="space-y-5">
      <ErpSection
        title="3. Workflow"
        description={`${spec.workflow.steps.length} steps across ${lanes.length} acting ${lanes.length === 1 ? "mode" : "modes"}.`}
        icon={<WorkflowIcon className="size-5" />}
      >
        {/* Lane strip -------------------------------------------------- */}
        <div className="mb-6 overflow-x-auto">
          <div className="min-w-[640px] space-y-2">
            {lanes.map((actor) => (
              <div key={actor} className="flex items-stretch gap-3">
                <div className="flex w-36 shrink-0 items-center">
                  <ActorBadge actor={actor} />
                </div>
                <div
                  className="grid flex-1 gap-2"
                  style={{ gridTemplateColumns: `repeat(${spec.workflow.steps.length}, minmax(0, 1fr))` }}
                >
                  {spec.workflow.steps.map((step) =>
                    step.actor === actor ? (
                      <div
                        key={step.no}
                        title={step.userAction || step.systemAction}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-center shadow-sm"
                      >
                        <span className="font-mono text-xs font-semibold text-slate-900">{step.no}</span>
                        {step.humanGate ? (
                          <ShieldAlert className="mx-auto mt-0.5 size-3 text-amber-600" aria-label="Human gate" />
                        ) : null}
                      </div>
                    ) : (
                      <div key={step.no} className="rounded-lg border border-dashed border-slate-100" />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step table -------------------------------------------------- */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-12 px-2 py-2">Step</th>
                <th className="w-36 px-2 py-2">Actor</th>
                <th className="px-2 py-2">User action</th>
                <th className="px-2 py-2">System action</th>
                <th className="px-2 py-2">Decision / validation</th>
                <th className="px-2 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {spec.workflow.steps.map((step) => (
                <tr key={step.no} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-2 py-3 font-mono text-xs font-semibold text-slate-900">{step.no}</td>
                  <td className="px-2 py-3">
                    <ActorBadge actor={step.actor} />
                    <div className="mt-1">
                      <ExecutionLabel execution={step.execution} />
                    </div>
                  </td>
                  <td className="px-2 py-3 text-slate-700">
                    {step.userAction || <span className="text-slate-400">No user action</span>}
                  </td>
                  <td className="px-2 py-3 text-slate-700">{step.systemAction || <span className="text-slate-400">-</span>}</td>
                  <td className="px-2 py-3 text-slate-700">
                    {step.ruleRefs.length ? (
                      <span className="mr-1.5 inline-flex gap-1">
                        {step.ruleRefs.map((ruleId) => (
                          <RuleChip
                            key={ruleId}
                            id={ruleId}
                            title={spec.businessRules.find((rule) => rule.id === ruleId)?.rule}
                          />
                        ))}
                      </span>
                    ) : null}
                    {step.decision || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-2 py-3 text-slate-700">{step.result || <span className="text-slate-400">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {gates.length ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {gates.length} {gates.length === 1 ? "step carries" : "steps carry"} a mandatory human gate (
              {gates.map((step) => step.no).join(", ")}). BR-07: the AI proposal must be previewed and explicitly applied
              by a named person before it reaches a learner-visible record.
            </span>
          </p>
        ) : null}
      </ErpSection>

      {spec.workflow.handoffs.length ? (
        <ErpSection
          title="Handovers"
          description="Where this procedure's output goes next in the lifecycle."
          icon={<GitBranch className="size-5" />}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              {spec.ref} {spec.title}
            </span>
            <ArrowRight className="size-4 text-slate-400" aria-hidden />
            <div className="flex flex-wrap gap-2">
              {spec.workflow.handoffs.map((ref) => (
                <span
                  key={ref}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800"
                >
                  {ref}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Each handover becomes a follow-through task on the next screen, so nothing this procedure produces is left
            unactioned at the end of the cycle. Primary actors there:{" "}
            {spec.workflow.handoffs.map((ref) => ref).join(", ")} - see the module SOP.
          </p>
        </ErpSection>
      ) : null}
    </div>
  );
}

/** Exported for the summary line on the review screen. */
export function actorSummary(spec: ProcessSpec): string {
  const counts = new Map<ActorMode, number>();
  for (const step of spec.workflow.steps) counts.set(step.actor, (counts.get(step.actor) ?? 0) + 1);
  return [...counts.entries()].map(([actor, count]) => `${count} ${ACTOR_LABELS[actor]}`).join(", ");
}
