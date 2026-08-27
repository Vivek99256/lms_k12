/**
 * The canonical intake format, written rather than read.
 *
 * `parser.ts` turns the block format into a `ProcessSpec`; this turns a spec
 * (or a model's proposal) back into that block format. Two callers need it:
 *
 *   - the AI route, which constrains the model to a JSON shape and then
 *     *renders* that shape into intake text so the proposal is converted by the
 *     same parser and held to the same validation as a pasted procedure. The
 *     model normalises prose; it never gets to define the process record.
 *   - the review screen's "copy as SOP text", so a converted process can go
 *     back into a document, be edited, and be re-imported without loss.
 *
 * Round-tripping is covered by a test: spec -> text -> spec must be identical.
 */

import { ACTOR_LABELS, type ProcessSpec } from './types'

export interface IntakeStep {
  no: number
  actor: string
  userAction: string
  systemAction: string
  decision: string
  result: string
}

/** The loose shape both a model proposal and a stored spec can be reduced to. */
export interface IntakeDraft {
  procedureRef: string
  title: string
  primaryActor: string
  objective: string
  trigger: string
  preconditions: string[]
  inputs: string[]
  completionCriteria: string
  steps: IntakeStep[]
  outputs: string[]
}

/** The SOP prints a dash where a cell has no content; the parser reads it back as empty. */
function cell(value: string): string {
  const trimmed = value?.replace(/\|/g, '/').replace(/\s+/g, ' ').trim() ?? ''
  return trimmed || '-'
}

function list(values: string[]): string {
  return values.length ? values.join('; ') : '-'
}

export function toIntakeText(draft: IntakeDraft): string {
  const lines = [
    `Procedure: ${draft.procedureRef} ${draft.title}`.trim(),
    `Primary actor: ${draft.primaryActor}`,
    '',
    `Objective: ${cell(draft.objective)}`,
    `Trigger: ${cell(draft.trigger)}`,
    `Preconditions: ${list(draft.preconditions)}`,
    `Inputs: ${list(draft.inputs)}`,
    `Completion criteria: ${cell(draft.completionCriteria)}`,
    '',
    'Steps',
    'Step | Actor | User / operational action | System action / response | Decision / validation | Result',
  ]

  for (const step of draft.steps) {
    lines.push(
      [
        step.no,
        cell(step.actor),
        cell(step.userAction),
        cell(step.systemAction),
        cell(step.decision),
        cell(step.result),
      ].join(' | ')
    )
  }

  lines.push('', 'Output')
  for (const output of draft.outputs) lines.push(`- ${output}`)

  return `${lines.join('\n')}\n`
}

export function specToIntakeDraft(spec: ProcessSpec): IntakeDraft {
  return {
    procedureRef: spec.ref,
    title: spec.title,
    primaryActor: ACTOR_LABELS[spec.primaryActor],
    objective: spec.attributes.objective,
    trigger: spec.attributes.trigger,
    preconditions: spec.attributes.preconditions,
    inputs: spec.attributes.inputs,
    completionCriteria: spec.attributes.completionCriteria,
    steps: spec.workflow.steps.map((step) => ({
      no: step.no,
      actor: ACTOR_LABELS[step.actor],
      userAction: step.userAction,
      systemAction: step.systemAction,
      // Rules are parsed back out of the decision cell, so they must be written
      // into it - otherwise a round-trip silently drops every BR citation.
      decision: step.ruleRefs.length && !/BR-\d/.test(step.decision)
        ? `${step.ruleRefs.join(', ')}: ${step.decision || 'checked'}`
        : step.decision,
      result: step.result,
    })),
    outputs: spec.workflow.outputs,
  }
}

/** Convenience for the review screen's copy-out button. */
export function specToIntakeText(spec: ProcessSpec): string {
  return toIntakeText(specToIntakeDraft(spec))
}
