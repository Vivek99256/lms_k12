/**
 * The canonical Process / Workflow / Task model.
 *
 * An SOP is prose: a procedure is a heading, an attribute table, a step table
 * and a list of outputs. None of that is executable. This module is the shape
 * that prose is converted *into* - one vocabulary that every module's SOP maps
 * onto, so a procedure from LMS + PAL and a procedure from Fees produce
 * structurally identical records that the same screens, the same validations
 * and the same task publisher can handle.
 *
 * Three levels, deliberately separated:
 *
 *   Process   - the unit of accountability. What the procedure is for, when it
 *               fires, what must be true first, when it is done. One SOP
 *               procedure (e.g. 6.9.4) becomes exactly one Process.
 *   Workflow  - the ordered steps inside that Process, each with its actor,
 *               its system behaviour, its validation and its result. This is
 *               the SOP's step table, typed.
 *   Task      - a unit of *assignable work* derived from the Process. Not the
 *               same thing as a step: many steps are executed by the system or
 *               by a learner and are nobody's assignment, while some tasks
 *               (readiness, approval) come from preconditions and rules rather
 *               than from any single step. See `derive-tasks.ts`.
 *
 * Nothing here is LMS-specific. The LMS + PAL vocabulary lives in
 * `sop-catalog.ts`.
 */

/**
 * The five acting modes of the SOP (section 3.1). They are not job titles -
 * they encode *who decides*, which is what determines whether a step can become
 * an assigned task and whether a human gate is mandatory.
 */
export type ActorMode = 'teacher' | 'ai' | 'teacher_ai' | 'student' | 'student_ai'

/** How a step actually runs, derived from its actor. */
export type ExecutionMode =
  /** A person does it. */
  | 'manual'
  /** The system does it unattended; the AI owns no record (SOP section 3.3). */
  | 'system'
  /** The system proposes, a named human accepts (SOP section 7.4, BR-07). */
  | 'human_in_the_loop'
  /** A learner does it; the system records it. Not staff-assignable work. */
  | 'learner'

/** Lifecycle state of a converted Process, mirroring the SOP's content states (4.3.2). */
export type ProcessStatus = 'draft' | 'in_review' | 'approved' | 'published'

/** Where a derived task came from. Drives default assignability and wording. */
export type TaskOrigin =
  /** Master data or configuration that must be true before the process can run. */
  | 'precondition'
  /** A workflow step performed by a staff actor. */
  | 'step'
  /** A mandatory human confirmation of AI or system output. */
  | 'gate'
  /** Follow-up owed on something the process produced. */
  | 'output'
  /** A step the learner performs. Recorded for completeness; not staff work. */
  | 'learner_activity'

export type TaskPriority = 'High' | 'Medium' | 'Low'

/** The procedure attribute table (the first table under SOP 6.9.4). */
export interface ProcessAttributes {
  objective: string
  trigger: string
  preconditions: string[]
  inputs: string[]
  completionCriteria: string
}

/** One row of the SOP step table. */
export interface WorkflowStep {
  /** 1-based position, as printed in the SOP. */
  no: number
  actor: ActorMode
  /** What the person does. Empty for unattended system steps (the SOP prints an em dash). */
  userAction: string
  /** What the system does in response. */
  systemAction: string
  /** The validation or branch taken at this step. */
  decision: string
  /** Business rules this step is governed by, e.g. ['BR-02']. */
  ruleRefs: string[]
  /** What the step leaves behind. */
  result: string
  /** Derived from `actor` - never authored by hand. */
  execution: ExecutionMode
  /** True when the step writes to a learner-visible record and so needs a human Apply. */
  humanGate: boolean
}

export interface Workflow {
  steps: WorkflowStep[]
  /** Procedure outputs - what exists once the workflow completes. */
  outputs: string[]
  /** Other procedures this one hands over to, e.g. ['6.10', '6.11']. */
  handoffs: string[]
}

/** A business rule as it applies to this process (copied from the module catalogue). */
export interface BusinessRule {
  id: string
  rule: string
  appliesAt: string
  enforcement: 'System' | 'Manual'
  failureBehaviour: string
}

export interface TaskDraft {
  /** Stable key within the process, e.g. '6.9.4-P1'. Used for dedupe on re-derivation. */
  key: string
  title: string
  description: string
  origin: TaskOrigin
  /** The acting mode responsible. */
  actor: ActorMode
  /** Human-readable owner, e.g. 'Teacher', 'LMS Administrator'. */
  owner: string
  priority: TaskPriority
  /** Workflow steps this task covers (empty for preconditions). */
  stepNos: number[]
  ruleRefs: string[]
  /** Key result area / key performance area, as Task Management records them. */
  kra: string
  kpa: string
  /** What an observer checks to call this done. */
  observationPoint: string
  /** Days from publication until due. */
  dueOffsetDays: number
  /** Task Management's repeat cadence in days; '0' for one-off. */
  repeatDays: string
  /**
   * False for learner activities: Task Management assigns to staff, so a
   * student step is recorded on the process but cannot be published as a task.
   */
  assignable: boolean
  /** Whether the reviewer has selected this draft for publication. */
  selected: boolean
}

/** Provenance - which SOP, which version, which procedure, and how it was converted. */
export interface SopSource {
  /** SOP document name, e.g. 'LMS + PAL SOP'. */
  document: string
  version: string
  organization: string
  effectiveDate: string
  /** Procedure number as printed, e.g. '6.9.4'. */
  procedureRef: string
  /** Owning process group, e.g. '6.9 PAL adaptive learning loop'. */
  processGroup: string
  /** How the conversion was produced. */
  method: 'structured' | 'ai' | 'catalogue'
  /** Set when `method` is 'ai' - the model that produced the proposal. */
  model?: string
  convertedAt: string
}

/** One converted procedure. This is the record the feature produces. */
export interface ProcessSpec {
  specVersion: 1
  /** Procedure reference, unique within a module, e.g. '6.9.4'. */
  ref: string
  title: string
  module: string
  /** End-to-end lifecycle stage this procedure sits in (SOP section 5), e.g. 'Diagnose'. */
  lifecycleStage: string
  primaryActor: ActorMode
  status: ProcessStatus
  attributes: ProcessAttributes
  workflow: Workflow
  businessRules: BusinessRule[]
  /** Records the process creates or updates (SOP section 11). */
  records: string[]
  tasks: TaskDraft[]
  source: SopSource
}

/**
 * The stored document. One row of `requirement_gathering` holds one envelope,
 * so a menu can carry several converted procedures without a schema change.
 */
export interface ProcessSpecEnvelope {
  /** Discriminator - distinguishes a converted document from legacy CKEditor HTML. */
  __processSpec: 1
  module: string
  /** SOP header block (the cover page). */
  sop: {
    document: string
    version: string
    organization: string
    effectiveDate: string
  }
  processes: ProcessSpec[]
  updatedAt: string
}

/** `actor` to how the step runs. The single place this mapping is made. */
export function executionFor(actor: ActorMode): ExecutionMode {
  switch (actor) {
    case 'teacher':
      return 'manual'
    case 'ai':
      return 'system'
    case 'teacher_ai':
      return 'human_in_the_loop'
    case 'student':
    case 'student_ai':
      return 'learner'
  }
}

/**
 * BR-07: AI output may never reach a learner-visible record without an explicit
 * human Apply. Only `teacher_ai` steps carry that gate - a pure `ai` step
 * computes and recommends (it owns no record), and a `student_ai` step is the
 * learner's own answer.
 */
export function requiresHumanGate(actor: ActorMode): boolean {
  return actor === 'teacher_ai'
}

export const ACTOR_LABELS: Record<ActorMode, string> = {
  teacher: 'Teacher',
  ai: 'AI',
  teacher_ai: 'Teacher + AI',
  student: 'Student',
  student_ai: 'Student + AI',
}

/** Parse an SOP actor label ('Teacher + AI', 'Student+AI', 'AI') into an `ActorMode`. */
export function parseActor(raw: string): ActorMode | null {
  const normalized = raw.toLowerCase().replace(/[\s_]+/g, '').replace(/&/g, '+')
  switch (normalized) {
    case 'teacher':
      return 'teacher'
    case 'ai':
    case 'system':
      return 'ai'
    case 'teacher+ai':
    case 'ai+teacher':
      return 'teacher_ai'
    case 'student':
    case 'learner':
      return 'student'
    case 'student+ai':
    case 'ai+student':
    case 'learner+ai':
      return 'student_ai'
    default:
      return null
  }
}
