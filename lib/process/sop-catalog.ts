/**
 * The shape of a module catalogue, plus the LMS + PAL one.
 *
 * Conversion is only "standardised" if there is something to standardise
 * against. A `SopModule` is that something - a module's SOP header block, its
 * lifecycle stages (section 5), its business rules (section 8), its records
 * register (section 11) and its full procedure index (section 6). The converter
 * resolves a procedure reference here, so a parsed process inherits the module's
 * rules and stage instead of inventing them, and the UI can offer a real
 * "module -> process group -> procedure" pick list rather than a free-text box.
 *
 * Adding a module means adding a second `SopModule` and listing it in
 * `module-registry.ts` - no change to the parser, the task derivation, the
 * storage envelope or the screens. Fees is the second one; see
 * `fees-catalog.ts`.
 *
 * The five acting modes are fixed (they encode *who decides*, not job titles),
 * but the words wrapped around them are not: a fees counter has officers and
 * parents, not teachers and learners. `ModuleVocabulary` is where a module
 * renames them, and every default in it is the LMS + PAL wording this file
 * used before Fees existed - so a module that declares no vocabulary behaves
 * exactly as it always did.
 */

import { ACTOR_LABELS, type ActorMode, type BusinessRule, type ExecutionMode } from './types'

/**
 * A module's own words for the acting modes, the owners and the surfaces its
 * SOP talks about. Every field has an LMS + PAL default; a module overrides
 * only what it says differently.
 */
export interface ModuleVocabulary {
  /** How this module's SOP names each of the five acting modes, on screen. */
  actorLabels: Record<ActorMode, string>
  /**
   * Extra spellings of an actor that this module's SOPs use, e.g. 'Accountant'.
   * Keys are matched case- and space-insensitively; the canonical five always
   * parse, whatever a module adds here.
   */
  actorAliases: Record<string, ActorMode>
  /** How each execution mode reads on screen. */
  executionLabels: Record<ExecutionMode, string>
  /** Owner names written onto derived tasks. */
  owners: { staff: string; admin: string }
  /** Preconditions matching any of these are the admin's, not the staff actor's. */
  adminOwned: RegExp[]
  /** The non-staff actor: someone the module serves rather than employs. */
  selfService: {
    /** How the SOP refers to them, e.g. 'the learner'. */
    noun: string
    /** Owner recorded on their (non-assignable) task drafts. */
    owner: string
    /** Where their step is actually delivered, e.g. 'the PAL workspace'. */
    surface: string
    /** Badge and title wording for those drafts. */
    originLabel: string
  }
  /** An unattended system step whose result matches this earns a human gate. */
  gatedResult: RegExp
  /** What BR-07 protects in this module, named in a gated step's description. */
  gatedRecordNoun: string
  /** Closing instruction on a human-verification task. */
  gateInstruction: string
}

/** LMS + PAL's wording, and the fallback for any module that states none. */
export const DEFAULT_MODULE_VOCABULARY: ModuleVocabulary = {
  actorLabels: ACTOR_LABELS,
  actorAliases: {},
  executionLabels: {
    manual: 'Performed by a person',
    system: 'Runs unattended',
    human_in_the_loop: 'AI proposes, human applies',
    learner: 'Performed by the learner',
  },
  owners: { staff: 'Teacher', admin: 'LMS Administrator' },
  adminOwned: [
    /session year|syear|academic year|term\b/i,
    /grade|standard|division|section master/i,
    /difficulty band/i,
    /role|menu|permission/i,
    /model|prompt|persona|confidence threshold/i,
  ],
  selfService: {
    noun: 'the learner',
    owner: 'Student',
    surface: 'the PAL workspace',
    originLabel: 'Learner activity',
  },
  gatedResult: /mastery|misconception|score|scores|result|mark|grade|recommendation|band/i,
  gatedRecordNoun: 'learner-visible record',
  gateInstruction:
    'Log the acceptance per 6.15.6; flag and do not apply anything that looks wrong (9.5).',
}

/** What a module may restate. Nested groups are merged field by field. */
export type ModuleVocabularyOverride = Partial<
  Omit<ModuleVocabulary, 'actorLabels' | 'executionLabels' | 'owners' | 'selfService'>
> & {
  actorLabels?: Partial<ModuleVocabulary['actorLabels']>
  executionLabels?: Partial<ModuleVocabulary['executionLabels']>
  owners?: Partial<ModuleVocabulary['owners']>
  selfService?: Partial<ModuleVocabulary['selfService']>
}

/** A module's vocabulary, with every unstated field filled from the default. */
export function vocabularyFor(module: Pick<SopModule, 'vocabulary'>): ModuleVocabulary {
  const stated = module.vocabulary
  if (!stated) return DEFAULT_MODULE_VOCABULARY

  return {
    ...DEFAULT_MODULE_VOCABULARY,
    ...stated,
    actorLabels: { ...DEFAULT_MODULE_VOCABULARY.actorLabels, ...stated.actorLabels },
    executionLabels: { ...DEFAULT_MODULE_VOCABULARY.executionLabels, ...stated.executionLabels },
    owners: { ...DEFAULT_MODULE_VOCABULARY.owners, ...stated.owners },
    selfService: { ...DEFAULT_MODULE_VOCABULARY.selfService, ...stated.selfService },
  }
}

/** One procedure as the SOP's table of contents lists it. */
export interface ProcedureIndexEntry {
  /** Procedure number as printed, e.g. '6.9.4'. */
  ref: string
  title: string
  primaryActor: ActorMode
  /** True when this repo ships the procedure's full attribute + step tables. */
  digitized: boolean
}

export interface ProcessGroup {
  /** Group number, e.g. '6.9'. */
  ref: string
  title: string
  /** Lifecycle stage (section 5) the group belongs to. */
  lifecycleStage: string
  procedures: ProcedureIndexEntry[]
}

export interface SopModule {
  /** Stable key used in URLs and stored envelopes. */
  key: string
  /** Display name, e.g. 'LMS + PAL'. */
  name: string
  sop: {
    document: string
    version: string
    organization: string
    effectiveDate: string
  }
  /** The end-to-end stages of section 5, in order. */
  lifecycleStages: string[]
  groups: ProcessGroup[]
  businessRules: BusinessRule[]
  /** Records register (section 11) - what a process may declare as an output record. */
  records: string[]
  /**
   * This module's own words for the acting modes, owners and surfaces. Omit it
   * and the LMS + PAL wording is used, which is what every screen showed before
   * a second module existed.
   */
  vocabulary?: ModuleVocabularyOverride
}

/** SOP section 8 - the rules a converted process is checked against. */
const LMS_PAL_RULES: BusinessRule[] = [
  {
    id: 'BR-01',
    rule: 'A chapter cannot be assessed in PAL unless it exists in the chapter registry with at least one tagged concept.',
    appliesAt: 'PAL chapter launch',
    enforcement: 'System',
    failureBehaviour: 'Chapter is not offered; teacher is shown the missing-tag reason.',
  },
  {
    id: 'BR-02',
    rule: 'A learner may open a chapter only when its prerequisite chapters are complete.',
    appliesAt: 'PAL chapter launch',
    enforcement: 'System',
    failureBehaviour: 'Launch blocked; prerequisite named to the learner.',
  },
  {
    id: 'BR-03',
    rule: 'The first PAL attempt on a chapter uses a mixed set of easy, medium and hard items; later attempts promote by one difficulty level.',
    appliesAt: 'Adaptive question selection',
    enforcement: 'System',
    failureBehaviour: 'If insufficient items exist at the target level, the engine falls back one level and logs the shortfall.',
  },
  {
    id: 'BR-04',
    rule: 'Concept mastery is banded as: below 40% = needs practice, 40% to below 70% = developing, 70% and above = mastered.',
    appliesAt: 'Attempt scoring',
    enforcement: 'System',
    failureBehaviour: 'Score outside range rejected; attempt flagged for review.',
  },
  {
    id: 'BR-05',
    rule: 'Every question must carry a concept tag and a difficulty level before it can be released to a paper.',
    appliesAt: 'Question approval',
    enforcement: 'System',
    failureBehaviour: 'Release blocked until tagging is complete.',
  },
  {
    id: 'BR-06',
    rule: 'A misconception marked persistent after two remediation cycles must be escalated to the teacher for re-teach.',
    appliesAt: 'Misconception re-assessment',
    enforcement: 'System',
    failureBehaviour: 'Escalation raised automatically; teacher notified.',
  },
  {
    id: 'BR-07',
    rule: 'AI output may never be written to a learner-visible record without an explicit human Apply action.',
    appliesAt: 'Every AI interaction',
    enforcement: 'System',
    failureBehaviour: 'Proposal is held in preview; no record is changed.',
  },
  {
    id: 'BR-08',
    rule: 'AI output below the configured confidence threshold is presented as a proposal only, never pre-applied.',
    appliesAt: 'Every AI interaction',
    enforcement: 'System',
    failureBehaviour: 'Proposal shown with a low-confidence warning.',
  },
  {
    id: 'BR-09',
    rule: 'A released mark may not be edited; a correction must be issued as a new, logged revision.',
    appliesAt: 'Marks correction',
    enforcement: 'System',
    failureBehaviour: 'Edit refused; correction workflow required.',
  },
  {
    id: 'BR-10',
    rule: 'A teacher may view only learners in classes and subjects allocated to them.',
    appliesAt: 'Every learner-data read',
    enforcement: 'System',
    failureBehaviour: 'Access refused with an authorisation error and an audit entry.',
  },
  {
    id: 'BR-11',
    rule: 'Late submissions are accepted only within the configured grace window and are marked late.',
    appliesAt: 'Homework / assignment submission',
    enforcement: 'System',
    failureBehaviour: 'Submission refused after the window; teacher may override with justification.',
  },
  {
    id: 'BR-12',
    rule: 'PAL data is scoped to the active session year; records from other years are read-only.',
    appliesAt: 'PAL workspace and reports',
    enforcement: 'System',
    failureBehaviour: 'Out-of-year records shown read-only.',
  },
]

/**
 * Compact index builder - the SOP's ToC is title + actor, nothing more.
 * Exported so every module catalogue writes its index the same way.
 */
export function procedureIndex(
  rows: Array<[string, string, ActorMode]>,
  digitizedRefs: string[] = []
): ProcedureIndexEntry[] {
  return rows.map(([ref, title, primaryActor]) => ({
    ref,
    title,
    primaryActor,
    digitized: digitizedRefs.includes(ref),
  }))
}

export const LMS_PAL_MODULE: SopModule = {
  key: 'lms-pal',
  name: 'LMS + PAL',
  sop: {
    document: 'LMS + PAL SOP',
    version: '1.0',
    organization: 'Anand Niketan',
    effectiveDate: '25 Aug 2026',
  },
  lifecycleStages: [
    'Plan',
    'Author',
    'Approve',
    'Deliver',
    'Diagnose',
    'Adapt',
    'Remediate',
    'Re-assess',
    'Report & intervene',
  ],
  businessRules: LMS_PAL_RULES,
  records: [
    'Curriculum, syllabus, monthly and lesson plans',
    'Teacher diary entries',
    'Chapter content and H5P items, with versions',
    'Homework and assignment submissions with annotations',
    'Quiz and examination attempts with responses',
    'PAL attempts, scores and difficulty level',
    'Concept-mastery map',
    'Misconception and remediation records',
    'Practice history and review schedule',
    'Marks, grades and published results',
    'Intervention plans and closure notes',
    'AI proposal, preview and acceptance log',
  ],
  groups: [
    {
      ref: '6.1',
      title: 'Academic foundation and module setup',
      lifecycleStage: 'Plan',
      procedures: procedureIndex([
        ['6.1.1', 'Activate academic year, term and session year', 'teacher'],
        ['6.1.2', 'Configure grade, standard and division structure', 'teacher'],
        ['6.1.3', 'Map subjects to standards and allocate teachers', 'teacher'],
        ['6.1.4', 'Create course master and chapter registry', 'teacher'],
        ['6.1.5', 'Tag chapters with concepts and learning outcomes', 'teacher_ai'],
        ['6.1.6', 'Configure global mapping and class-level module enablement', 'teacher'],
        ['6.1.7', 'Enable PAL for a subject and chapter', 'teacher'],
        ['6.1.8', 'Provision roles, menus and permissions', 'teacher'],
      ]),
    },
    {
      ref: '6.2',
      title: 'Curriculum and instructional planning',
      lifecycleStage: 'Plan',
      procedures: procedureIndex([
        ['6.2.1', 'Prepare the annual curriculum plan', 'teacher'],
        ['6.2.2', 'Define the syllabus plan and pacing', 'teacher_ai'],
        ['6.2.3', 'Prepare the monthly plan', 'teacher'],
        ['6.2.4', 'Draft the lesson plan', 'teacher_ai'],
        ['6.2.5', 'Review and approve the lesson plan', 'teacher'],
        ['6.2.6', 'Record the daily teacher diary entry', 'teacher'],
        ['6.2.7', 'Reconcile planned versus actual syllabus coverage', 'teacher_ai'],
        ['6.2.8', 'Revise a plan and obtain re-approval', 'teacher'],
      ]),
    },
    {
      ref: '6.3',
      title: 'Learning content and resource authoring',
      lifecycleStage: 'Author',
      procedures: procedureIndex([
        ['6.3.1', 'Upload chapter content (documents, video, links)', 'teacher'],
        ['6.3.2', 'Maintain the teacher resource library', 'teacher'],
        ['6.3.3', 'Publish the book list and reference material', 'teacher'],
        ['6.3.4', 'Author an H5P flashcard set', 'teacher'],
        ['6.3.5', 'Author an H5P multiple-choice set', 'teacher_ai'],
        ['6.3.6', 'Author an H5P interactive video with timed interactions', 'teacher'],
        ['6.3.7', 'Author scenario-based (hotspot) content', 'teacher_ai'],
        ['6.3.8', 'Generate content descriptions and summaries with AI assistance', 'teacher_ai'],
        ['6.3.9', 'Tag content with metadata, difficulty and pedagogy', 'teacher_ai'],
        ['6.3.10', 'Version, replace or retire a content item', 'teacher'],
      ]),
    },
    {
      ref: '6.4',
      title: 'Content review, approval and publication',
      lifecycleStage: 'Approve',
      procedures: procedureIndex([
        ['6.4.1', 'Submit content for review', 'teacher'],
        ['6.4.2', 'Review academic accuracy and curriculum alignment', 'teacher'],
        ['6.4.3', 'Screen AI-assisted content for age-appropriateness and safety', 'teacher_ai'],
        ['6.4.4', 'Approve, reject or return content for rework', 'teacher'],
        ['6.4.5', 'Publish content and schedule class visibility', 'teacher'],
        ['6.4.6', 'Withdraw or unpublish content', 'teacher'],
        ['6.4.7', 'Run the periodic content-health and coverage audit', 'teacher_ai'],
      ]),
    },
    {
      ref: '6.5',
      title: 'Learning delivery and engagement',
      lifecycleStage: 'Deliver',
      procedures: procedureIndex([
        ['6.5.1', 'Access the student LMS dashboard', 'student'],
        ['6.5.2', 'Consume chapter content and learning material', 'student'],
        ['6.5.3', 'Play interactive (H5P) practice content', 'student_ai'],
        ['6.5.4', 'Participate in the activity stream', 'student'],
        ['6.5.5', 'Raise a doubt or query', 'student'],
        ['6.5.6', 'Use the AI study assistant for explanation and revision', 'student_ai'],
        ['6.5.7', 'Respond to student queries', 'teacher'],
        ['6.5.8', 'Broadcast an announcement or class message', 'teacher'],
        ['6.5.9', 'Participate in leaderboard recognition', 'student'],
      ]),
    },
    {
      ref: '6.6',
      title: 'Homework',
      lifecycleStage: 'Deliver',
      procedures: procedureIndex([
        ['6.6.1', 'Create and schedule homework', 'teacher_ai'],
        ['6.6.2', 'Publish homework to a class', 'teacher'],
        ['6.6.3', 'Submit homework', 'student'],
        ['6.6.4', 'Self-check a draft before submission with AI assistance', 'student_ai'],
        ['6.6.5', 'Evaluate homework and release feedback', 'teacher_ai'],
        ['6.6.6', 'Follow up on non-submission', 'teacher'],
        ['6.6.7', 'Review the homework and submission reports', 'teacher'],
      ]),
    },
    {
      ref: '6.7',
      title: 'Assignments and evaluation',
      lifecycleStage: 'Deliver',
      procedures: procedureIndex([
        ['6.7.1', 'Create an assignment with rubric and due date', 'teacher_ai'],
        ['6.7.2', 'Distribute the assignment to the class', 'teacher'],
        ['6.7.3', 'Submit an assignment and upload files', 'student'],
        ['6.7.4', 'Annotate and mark the submission inline', 'teacher'],
        ['6.7.5', 'Produce a first-pass evaluation and feedback draft with AI', 'teacher_ai'],
        ['6.7.6', 'Award marks and release feedback', 'teacher'],
        ['6.7.7', 'Handle resubmission and late submission', 'teacher'],
        ['6.7.8', 'Track assignment submission status', 'teacher'],
      ]),
    },
    {
      ref: '6.8',
      title: 'Assessment - LMS quiz and online examination',
      lifecycleStage: 'Deliver',
      procedures: procedureIndex([
        ['6.8.1', 'Define the question-paper blueprint', 'teacher'],
        ['6.8.2', 'Author questions and maintain the question bank', 'teacher'],
        ['6.8.3', 'Generate candidate questions from chapter content with AI', 'teacher_ai'],
        ['6.8.4', 'Review, tag difficulty and approve questions', 'teacher'],
        ['6.8.5', 'Create and schedule a quiz or online examination', 'teacher'],
        ['6.8.6', 'Configure attempt window, timing and attempt rules', 'teacher'],
        ['6.8.7', 'Attempt the quiz or online examination', 'student'],
        ['6.8.8', 'Auto-evaluate objective responses', 'ai'],
        ['6.8.9', 'Evaluate subjective responses with AI-assisted scoring', 'teacher_ai'],
        ['6.8.10', 'Compute and publish results', 'teacher'],
        ['6.8.11', 'Review question-wise analysis and item quality', 'teacher_ai'],
        ['6.8.12', 'Handle integrity and malpractice exceptions', 'teacher'],
      ]),
    },
    {
      ref: '6.9',
      title: 'PAL adaptive learning loop',
      lifecycleStage: 'Diagnose',
      procedures: procedureIndex(
        [
          ['6.9.1', 'Enter the PAL workspace and select subject and chapter', 'student'],
          ['6.9.2', 'Evaluate prerequisite completion and attempt eligibility', 'ai'],
          ['6.9.3', 'Generate the first-attempt mixed-difficulty question set', 'ai'],
          ['6.9.4', 'Deliver the adaptive quiz and capture per-question responses', 'student_ai'],
          ['6.9.5', 'Submit the attempt and compute the score', 'student_ai'],
          ['6.9.6', 'Compute concept mastery and assign the difficulty level', 'ai'],
          ['6.9.7', 'Review the result and choose the next step', 'student_ai'],
          ['6.9.8', 'Promote difficulty on a subsequent attempt', 'ai'],
          ['6.9.9', 'Retake the chapter and re-verify mastery', 'student_ai'],
          ['6.9.10', "Review a learner's PAL workspace using the student picker", 'teacher'],
          ['6.9.11', 'Open the class preview (guest-student) view', 'teacher'],
        ],
        // The SOP authors 6.9.4 in full and makes it the template every other
        // procedure is written against ("authored per 6.9.4").
        ['6.9.4']
      ),
    },
    {
      ref: '6.10',
      title: 'Misconception detection and remediation',
      lifecycleStage: 'Remediate',
      procedures: procedureIndex([
        ['6.10.1', 'Detect misconceptions from incorrect responses', 'ai'],
        ['6.10.2', 'Surface the detected misconception to the learner', 'student_ai'],
        ['6.10.3', 'Generate corrective content for a misconception', 'teacher_ai'],
        ['6.10.4', 'Validate AI-generated corrective content before release', 'teacher'],
        ['6.10.5', 'Deliver remediation and track content visits', 'student_ai'],
        ['6.10.6', 'Re-assess and close the misconception', 'student_ai'],
        ['6.10.7', 'Review class-wide misconception patterns', 'teacher_ai'],
        ['6.10.8', 'Re-teach persistent class-level misconceptions', 'teacher'],
      ]),
    },
    {
      ref: '6.11',
      title: 'Pedagogy engine and adaptive practice',
      lifecycleStage: 'Adapt',
      procedures: procedureIndex([
        ['6.11.1', 'Configure pedagogy-engine rules and thresholds', 'teacher'],
        ['6.11.2', 'Evaluate the engagement score and rule triggers', 'ai'],
        ['6.11.3', 'Recommend suggested content for a concept', 'ai'],
        ['6.11.4', 'Accept and open a recommendation', 'student_ai'],
        ['6.11.5', 'Generate an adaptive practice set', 'student_ai'],
        ['6.11.6', 'Attempt practice with hints and scoring', 'student_ai'],
        ['6.11.7', 'Schedule spaced-repetition review', 'ai'],
        ['6.11.8', 'Review personal practice history', 'student'],
        ['6.11.9', 'Override an engine recommendation', 'teacher'],
        ['6.11.10', 'Review recommendation effectiveness', 'teacher_ai'],
      ]),
    },
    {
      ref: '6.12',
      title: 'Marks, results and result personalisation',
      lifecycleStage: 'Report & intervene',
      procedures: procedureIndex([
        ['6.12.1', 'Capture offline or classroom marks', 'teacher'],
        ['6.12.2', 'Enter bulk personalised marks', 'teacher'],
        ['6.12.3', 'Ingest marks into the adaptive engine', 'ai'],
        ['6.12.4', 'Compute and moderate grades', 'teacher'],
        ['6.12.5', 'Verify results within the correction window', 'teacher'],
        ['6.12.6', 'Publish results to students and parents', 'teacher'],
        ['6.12.7', 'Correct and re-issue a published result', 'teacher'],
      ]),
    },
    {
      ref: '6.13',
      title: 'Learner progress monitoring and intervention',
      lifecycleStage: 'Report & intervene',
      procedures: procedureIndex([
        ['6.13.1', 'Review the student analysis view', 'teacher_ai'],
        ['6.13.2', 'Identify weak concepts from mastery data', 'ai'],
        ['6.13.3', 'Identify and prioritise at-risk learners', 'teacher_ai'],
        ['6.13.4', 'Create an intervention plan', 'teacher_ai'],
        ['6.13.5', 'Form differentiated groups and assign targeted practice', 'teacher_ai'],
        ['6.13.6', 'Self-monitor personal progress', 'student'],
        ['6.13.7', 'Communicate progress to parents', 'teacher'],
        ['6.13.8', 'Monitor and close an intervention', 'teacher_ai'],
        ['6.13.9', 'Escalate to the coordinator or counsellor', 'teacher'],
      ]),
    },
    {
      ref: '6.14',
      title: 'Reporting, analytics and communication',
      lifecycleStage: 'Report & intervene',
      procedures: procedureIndex([
        ['6.14.1', 'Generate and export the PAL attempts report', 'teacher'],
        ['6.14.2', 'Generate the question-wise report', 'teacher'],
        ['6.14.3', 'Generate homework and assignment submission reports', 'teacher'],
        ['6.14.4', 'Review the teacher dashboard and daily activity report', 'teacher'],
        ['6.14.5', 'Generate class and leaderboard reports', 'teacher'],
        ['6.14.6', 'Produce an AI narrative summary for a review meeting', 'teacher_ai'],
        ['6.14.7', 'Distribute and archive scheduled reports', 'teacher'],
        ['6.14.8', 'Run an ad-hoc query through the conversational assistant', 'teacher_ai'],
      ]),
    },
    {
      ref: '6.15',
      title: 'AI operations and human-in-the-loop governance',
      lifecycleStage: 'Report & intervene',
      procedures: procedureIndex([
        ['6.15.1', 'Use the AI field assistant (suggest, preview, apply)', 'teacher_ai'],
        ['6.15.2', 'Use the conversational assistant within session scope', 'teacher_ai'],
        ['6.15.3', 'Apply guardrails to the student-facing AI assistant', 'student_ai'],
        ['6.15.4', 'Configure models, prompts and personas', 'teacher'],
        ['6.15.5', 'Set confidence thresholds and propose-versus-apply policy', 'teacher'],
        ['6.15.6', 'Verify AI output and log acceptance', 'teacher'],
        ['6.15.7', 'Screen AI output for bias, safety and age-appropriateness', 'teacher_ai'],
        ['6.15.8', 'Operate in degraded mode when AI is unavailable', 'teacher'],
        ['6.15.9', 'Review the AI audit trail and periodic evaluation', 'teacher'],
      ]),
    },
  ],
}

/** Resolve a procedure reference to its group + index entry within a module. */
export function findProcedure(
  module: SopModule,
  ref: string
): { group: ProcessGroup; procedure: ProcedureIndexEntry } | undefined {
  for (const group of module.groups) {
    const procedure = group.procedures.find((entry) => entry.ref === ref)
    if (procedure) return { group, procedure }
  }
  return undefined
}

/**
 * Resolve any reference the SOP cites - a procedure ('6.9.4') or a whole
 * process group ('6.10'). Procedure outputs hand over at group level
 * ("raised for remediation (6.10)"), so both forms have to resolve or the
 * handover reads back as a bare number.
 */
export function resolveRef(
  module: SopModule,
  ref: string
): { kind: 'procedure'; title: string; primaryActor: ActorMode } | { kind: 'group'; title: string } | undefined {
  const found = findProcedure(module, ref)
  if (found) {
    return { kind: 'procedure', title: found.procedure.title, primaryActor: found.procedure.primaryActor }
  }

  const group = module.groups.find((candidate) => candidate.ref === ref)
  return group ? { kind: 'group', title: group.title } : undefined
}

/**
 * The rules that govern a given procedure.
 *
 * A rule applies when the procedure's own steps cite it, plus the two
 * unconditional AI-governance rules (BR-07, BR-08) which the SOP applies at
 * "every AI interaction" - so any procedure with an AI actor inherits them
 * whether or not its step table names them.
 */
export function rulesFor(module: SopModule, citedIds: string[], hasAiActor: boolean): BusinessRule[] {
  const wanted = new Set(citedIds)
  if (hasAiActor) {
    wanted.add('BR-07')
    wanted.add('BR-08')
  }
  return module.businessRules.filter((rule) => wanted.has(rule.id))
}
