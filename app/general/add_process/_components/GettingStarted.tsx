"use client";

import { ArrowRight, ClipboardList, ListChecks, ScrollText, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { erpCardClass } from "@/components/erp/erp-ui";

/**
 * What the screen is, shown only when there is nothing else to look at.
 *
 * An empty converter is an unhelpful screen: three dropdowns and a blank
 * textarea give no clue what the output is or what "good input" looks like.
 * This says what comes out the other end and offers the one procedure that
 * ships with its full SOP text, so a first-time user can see a real conversion
 * before deciding whether to transcribe one of their own.
 *
 * It disappears the moment a process exists, and never returns for someone who
 * already has saved processes.
 */
export function GettingStarted({ onTrySample, disabled }: { onTrySample: () => void; disabled: boolean }) {
  return (
    <section className={erpCardClass}>
      <h2 className="font-semibold text-slate-900">Turn a written SOP procedure into something the ERP can run</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Pick a procedure from a module&apos;s SOP and paste its text. The converter reads the procedure&apos;s own
        anatomy - its attribute table, its numbered steps, its outputs - and produces three linked records.
      </p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            Icon: ClipboardList,
            title: "A Process",
            body: "Objective, trigger, preconditions, completion criteria and the business rules that govern it.",
          },
          {
            Icon: Workflow,
            title: "A Workflow",
            body: "Every step with its actor, what the system does, what is validated, and where a human must confirm.",
          },
          {
            Icon: ListChecks,
            title: "Tasks",
            body: "The work that actually falls to a person, ready to assign in People & Competency.",
          },
        ].map(({ Icon, title, body }) => (
          <li key={title} className="rounded-xl border border-slate-200 p-4">
            <Icon className="size-5 text-blue-600" aria-hidden />
            <h3 className="mt-2 text-sm font-medium text-slate-900">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <ScrollText className="size-5 shrink-0 text-blue-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">Try it on a real procedure</p>
          <p className="text-xs text-slate-600">
            LMS + PAL 6.9.4 &ldquo;Deliver the adaptive quiz and capture per-question responses&rdquo; ships with its
            full SOP text. Nothing is saved until you choose to save it.
          </p>
        </div>
        <Button type="button" onClick={onTrySample} disabled={disabled}>
          Load and convert 6.9.4
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
