/**
 * `ProcessSpec` -> assignable task drafts.
 *
 * The step where most naive conversions go wrong is this one: they turn every
 * workflow step into a task. That produces nonsense - "Answers each question in
 * turn" assigned to a member of staff - because a *step* and a *task* are not
 * the same object. A step is something that happens inside the process,
 * whoever or whatever performs it. A task is a unit of work owned by a named
 * person, and Task Management assigns to staff.
 *
 * 6.9.4 is the clearest possible case: all seven of its steps belong to the
 * learner or the engine, so a step-to-task mapping would derive *zero* work for
 * anyone - while the procedure plainly does create teacher obligations. Those
 * obligations live in the preconditions, the business rules and the handovers.
 * So tasks are derived from four sources, in this order:
 *
 *   1. preconditions      -> readiness work that must be true before the
 *                            process can run at all (SOP 4.1 / 4.2)
 *   2. staff steps        -> steps whose actor is Teacher or Teacher + AI
 *   3. AI-output gates    -> BR-07: the AI owns no record, so every unattended
 *                            step that moves a learner-visible record earns a
 *                            human verification task (6.15.6)
 *   4. handovers          -> procedures this one feeds (6.10, 6.11 ...)
 *
 * Learner steps are still emitted, marked `assignable: false`, so the process
 * record stays complete and the reviewer can see what was deliberately not
 * assigned rather than wondering what was dropped.
 */

import type { SopModule } from './sop-catalog'
import { findProcedure, resolveRef } from './sop-catalog'
import { ACTOR_LABELS, type ProcessSpec, type TaskDraft, type TaskPriority, type WorkflowStep } from './types'

/**
 * Owners taken from the SOP's master-data register (4.2), which names who owns
 * each prerequisite. Anything not matched here is the teacher's - they own the
 * academic content.
 */
const ADMIN_OWNED = [
  /session year|syear|academic year|term\b/i,
  /grade|standard|division|section master/i,
  /difficulty band/i,
  /role|menu|permission/i,
  /model|prompt|persona|confidence threshold/i,
]

function ownerFor(text: string): string {
  return ADMIN_OWNED.some((pattern) => pattern.test(text)) ? 'LMS Administrator' : 'Teacher'
}

/** Sentence-case a fragment lifted out of the SOP so it reads as an instruction. */
function asTitle(verb: string, fragment: string): string {
  const trimmed = fragment.replace(/\s+/g, ' ').trim().replace(/\.$/, '')
  const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
  return `${verb} ${lowered}`
}

/**
 * Crude singularisation, enough to match "prerequisites" against
 * "prerequisite". Only a single trailing "s" comes off: stripping "es" turns
 * "prerequisites" into "prerequisit", which then matches nothing. Words ending
 * in "ss" ("process") are left alone.
 */
function stem(word: string): string {
  return word.endsWith('ss') ? word : word.replace(/s$/, '')
}

function significantWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length > 5)
        .map(stem)
    ),
  ]
}

/**
 * Which rules govern a precondition.
 *
 * Searched against the *module's whole* rule set, not the rules this
 * procedure's steps happen to cite. A precondition is about the state of the
 * system before the procedure runs, and the rule that enforces that state is
 * usually not the rule the steps mention: 6.9.4's steps never cite BR-12, but
 * BR-12 is exactly what makes "the active session year is correct" a real
 * precondition rather than a note.
 *
 * Two matching words are required. One is noise - "complete" alone pairs
 * "prerequisites are complete" with every rule that ends in "until tagging is
 * complete".
 */
function rulesTouching(module: SopModule, text: string): string[] {
  const words = significantWords(text)

  return module.businessRules
    .filter((rule) => {
      const subject = significantWords(`${rule.rule} ${rule.appliesAt}`)
      return words.filter((word) => subject.includes(word)).length >= 2
    })
    .map((rule) => rule.id)
}

/** A step is learner-visible when its result touches a record a student or parent sees. */
const LEARNER_VISIBLE = /mastery|misconception|score|scores|result|mark|grade|recommendation|band/i

function priorityFor(origin: TaskDraft['origin'], ruleRefs: string[]): TaskPriority {
  if (origin === 'gate') return 'High'
  if (origin === 'precondition') return ruleRefs.length ? 'High' : 'Medium'
  if (origin === 'step') return 'Medium'
  return 'Low'
}

/**
 * Task Management's repeat cadence, in days.
 *
 * Every derived task is one-off, and one-off is `'1'`, not `'0'`. Zero is not a
 * value this system accepts: the bulk importer clamps it (`max((int) $raw, 1)`)
 * and the create modal defaults to 1, so a 0 written straight through the
 * `/task` endpoint — which does not clamp — would be an out-of-range value
 * sitting in the column. Recurrence itself only ever applies to tasks whose
 * type is "Daily Task"; these carry a priority as their type, so the field is
 * stored and not acted on.
 */
const ONE_OFF = '1'

/** Days from publication. Readiness first, gates fastest, follow-through last. */
const DUE_OFFSETS: Record<TaskDraft['origin'], number> = {
  precondition: 2,
  gate: 1,
  step: 3,
  output: 5,
  learner_activity: 0,
}

export interface DeriveOptions {
  /**
   * Carried over from a previous derivation so a re-parse does not discard the
   * reviewer's include/exclude choices. Keyed by `TaskDraft.key`.
   */
  previous?: TaskDraft[]
}

export function deriveTasks(spec: ProcessSpec, module: SopModule, options: DeriveOptions = {}): TaskDraft[] {
  const kraStage = spec.lifecycleStage || findProcedure(module, spec.ref)?.group.lifecycleStage || 'Operations'
  const kra = `${module.name} - ${kraStage}`
  const drafts: TaskDraft[] = []

  const push = (draft: Omit<TaskDraft, 'selected' | 'kra'>) => {
    drafts.push({ ...draft, kra, selected: draft.assignable })
  }

  /* 1. Preconditions -> readiness work ---------------------------------- */

  spec.attributes.preconditions.forEach((precondition, position) => {
    const ruleRefs = rulesTouching(module, precondition)
    const owner = ownerFor(precondition)
    push({
      key: `${spec.ref}-P${position + 1}`,
      title: asTitle('Confirm', precondition),
      description:
        `Readiness check for ${spec.ref} ${spec.title}. The procedure cannot run until this precondition holds: ` +
        `${precondition}.` +
        (ruleRefs.length ? ` Enforced by ${ruleRefs.join(', ')}.` : ''),
      origin: 'precondition',
      actor: 'teacher',
      owner,
      priority: priorityFor('precondition', ruleRefs),
      stepNos: [],
      ruleRefs,
      kpa: 'Process readiness',
      observationPoint: `${precondition} - verified before the next attempt window opens.`,
      dueOffsetDays: DUE_OFFSETS.precondition,
      repeatDays: ONE_OFF,
      assignable: true,
    })
  })

  /* 2. Staff steps -> directly assigned work ---------------------------- */

  const staffSteps = spec.workflow.steps.filter(
    (step) => step.actor === 'teacher' || step.actor === 'teacher_ai'
  )

  staffSteps.forEach((step) => {
    const gated = step.humanGate
    push({
      key: `${spec.ref}-S${step.no}`,
      title: asTitle('Carry out', step.userAction || step.systemAction || `step ${step.no}`),
      description:
        `Step ${step.no} of ${spec.ref} ${spec.title}, performed by ${ACTOR_LABELS[step.actor]}. ` +
        (step.userAction ? `Action: ${step.userAction}. ` : '') +
        (step.systemAction ? `The system will ${lowerFirst(step.systemAction)}. ` : '') +
        (gated
          ? 'BR-07 applies: the AI proposal must be previewed and explicitly applied by this person before it reaches any learner-visible record.'
          : ''),
      origin: 'step',
      actor: step.actor,
      owner: 'Teacher',
      priority: priorityFor('step', step.ruleRefs),
      stepNos: [step.no],
      ruleRefs: step.ruleRefs,
      kpa: step.result || 'Step completed',
      observationPoint: step.decision || step.result || spec.attributes.completionCriteria,
      dueOffsetDays: DUE_OFFSETS.step,
      repeatDays: ONE_OFF,
      assignable: true,
    })
  })

  /* 3. Unattended AI steps -> human verification gates ------------------ */

  spec.workflow.steps
    .filter((step) => step.actor === 'ai' && LEARNER_VISIBLE.test(`${step.result} ${step.systemAction}`))
    .forEach((step) => {
      push({
        key: `${spec.ref}-G${step.no}`,
        // The SOP writes system actions in the third person ("Scores the
        // attempt..."), so they cannot be spliced after a verb. Naming the step
        // and quoting the action keeps the title readable for any procedure.
        title: `Verify the output of step ${step.no}: ${lowerFirst(step.systemAction)}`,
        description:
          `Human verification gate for step ${step.no} of ${spec.ref} ${spec.title}. The engine runs this step ` +
          `unattended and the SOP gives the AI ownership of no record, so a named person confirms the output ` +
          `before it is relied on. System action: ${step.systemAction}. Expected result: ${step.result}.` +
          (step.ruleRefs.length ? ` Checked against ${step.ruleRefs.join(', ')}.` : '') +
          ' Log the acceptance per 6.15.6; flag and do not apply anything that looks wrong (9.5).',
        origin: 'gate',
        actor: 'teacher_ai',
        owner: 'Teacher',
        priority: priorityFor('gate', step.ruleRefs),
        stepNos: [step.no],
        ruleRefs: [...new Set([...step.ruleRefs, 'BR-07'])],
        kpa: 'AI output verified and logged',
        observationPoint: step.decision || `${step.result} reviewed and accepted or flagged.`,
        dueOffsetDays: DUE_OFFSETS.gate,
        repeatDays: ONE_OFF,
        assignable: true,
      })
    })

  /* 4. Handovers -> follow-through work --------------------------------- */

  spec.workflow.handoffs.forEach((handoffRef, position) => {
    const target = resolveRef(module, handoffRef)
    const targetTitle = target ? target.title : `procedure ${handoffRef}`
    push({
      key: `${spec.ref}-H${position + 1}`,
      title: `Action the handover to ${handoffRef} ${targetTitle}`,
      description:
        `${spec.ref} ${spec.title} hands its output to ${handoffRef} ${targetTitle}. ` +
        `Pick up what this run produced and carry it into that ` +
        `${target?.kind === 'group' ? 'process group' : 'procedure'} so the loop closes.` +
        (target?.kind === 'procedure' ? ` Primary actor there: ${ACTOR_LABELS[target.primaryActor]}.` : ''),
      origin: 'output',
      actor: 'teacher',
      owner: 'Teacher',
      priority: priorityFor('output', []),
      stepNos: [],
      ruleRefs: [],
      kpa: `Handover to ${handoffRef} completed`,
      observationPoint: `No output of ${spec.ref} is left unactioned at the end of the cycle.`,
      dueOffsetDays: DUE_OFFSETS.output,
      repeatDays: ONE_OFF,
      assignable: true,
    })
  })

  /* 5. Learner steps -> recorded, never assigned ------------------------ */

  spec.workflow.steps
    .filter((step) => step.actor === 'student' || step.actor === 'student_ai')
    .forEach((step) => {
      push({
        key: `${spec.ref}-L${step.no}`,
        title: asTitle('Learner activity:', step.userAction || `step ${step.no}`),
        description:
          `Step ${step.no} of ${spec.ref} ${spec.title} is performed by the learner (${ACTOR_LABELS[step.actor]}). ` +
          'Recorded here for completeness. Task Management assigns to staff, so this is not published as a task; ' +
          'it is delivered to the learner by the PAL workspace itself.',
        origin: 'learner_activity',
        actor: step.actor,
        owner: 'Student',
        priority: 'Low',
        stepNos: [step.no],
        ruleRefs: step.ruleRefs,
        kpa: step.result || 'Learner action captured',
        observationPoint: step.decision || step.result,
        dueOffsetDays: DUE_OFFSETS.learner_activity,
        repeatDays: ONE_OFF,
        assignable: false,
      })
    })

  return applyPreviousChoices(drafts, options.previous)
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

/** Keep the reviewer's include/exclude decisions across a re-derivation. */
function applyPreviousChoices(drafts: TaskDraft[], previous?: TaskDraft[]): TaskDraft[] {
  if (!previous?.length) return drafts
  const byKey = new Map(previous.map((draft) => [draft.key, draft]))
  return drafts.map((draft) => {
    const earlier = byKey.get(draft.key)
    if (!earlier) return draft
    return {
      ...draft,
      selected: draft.assignable ? earlier.selected : false,
      priority: earlier.priority,
      dueOffsetDays: earlier.dueOffsetDays,
    }
  })
}

/** ISO date `dueOffsetDays` from `from`, in the `YYYY-MM-DD` form Task Management takes. */
export function dueDateFor(draft: TaskDraft, from: Date): string {
  const due = new Date(from.getTime())
  due.setDate(due.getDate() + draft.dueOffsetDays)
  return due.toISOString().slice(0, 10)
}

export const TASK_ORIGIN_LABELS: Record<TaskDraft['origin'], string> = {
  precondition: 'Readiness',
  step: 'Workflow step',
  gate: 'Human gate',
  output: 'Handover',
  learner_activity: 'Learner activity',
}

/** Steps that produced no task at all, so the reviewer can see the coverage gap. */
export function unmappedSteps(spec: ProcessSpec, tasks: TaskDraft[]): WorkflowStep[] {
  const covered = new Set(tasks.flatMap((task) => task.stepNos))
  return spec.workflow.steps.filter((step) => !covered.has(step.no))
}
