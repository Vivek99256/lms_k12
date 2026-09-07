/**
 * SOP procedure text -> `ProcessSpec`.
 *
 * The deterministic half of the converter. An SOP procedure has a fixed
 * anatomy - attribute table, step table, output list - and that anatomy
 * survives a copy-paste out of the document, so most conversions need no model
 * at all: they need a parser that knows the anatomy and a catalogue to resolve
 * references against.
 *
 * This runs first, always. `app/api/process/convert` only reaches for the AI
 * when the text does not parse (an SOP written as prose rather than tables),
 * and the AI's proposal is fed back through `validateSpec` here so both routes
 * are held to the same standard. That ordering matters: a deterministic parse
 * is reproducible, free, and cannot hallucinate a business rule that the SOP
 * never stated.
 */

import { findProcedure, rulesFor, type SopModule } from './sop-catalog'
import {
  executionFor,
  parseActor,
  requiresHumanGate,
  type ActorMode,
  type ProcessSpec,
  type WorkflowStep,
} from './types'

export interface ParseIssue {
  level: 'error' | 'warning'
  message: string
  /** Which part of the procedure the issue is about, for inline display. */
  field?: string
}

export interface ParseResult {
  /** Null when the text could not be parsed into a process at all. */
  spec: ProcessSpec | null
  issues: ParseIssue[]
}

/** Values the SOP prints for "no action here" - an em dash, en dash or hyphen. */
const EMPTY_CELL = /^[-–—.\s]*$/

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cellValue(value: string): string {
  const text = clean(value)
  return EMPTY_CELL.test(text) ? '' : text
}

/** Split a semicolon- (or bullet-) separated attribute value into a list. */
function toList(value: string): string[] {
  return value
    .split(/;|•|\n/)
    .map((entry) => clean(entry).replace(/\.$/, ''))
    .filter(Boolean)
}

/** Every 'BR-nn' cited anywhere in the given text, in order, de-duplicated. */
function ruleRefsIn(...values: string[]): string[] {
  const found = new Set<string>()
  for (const value of values) {
    for (const match of value.matchAll(/BR-\s?(\d{1,3})/gi)) {
      found.add(`BR-${match[1].padStart(2, '0')}`)
    }
  }
  return [...found]
}

/** Procedure references cited in an output line, e.g. '(6.10)'. */
function handoffsIn(lines: string[]): string[] {
  const found = new Set<string>()
  for (const line of lines) {
    for (const match of line.matchAll(/\((\d+(?:\.\d+)+)\)/g)) found.add(match[1])
  }
  return [...found]
}

/** Split a table row on pipes, or on tabs / 2+ spaces when no pipe is present. */
function splitRow(line: string): string[] {
  const trimmed = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
  if (trimmed.includes('|')) return trimmed.split('|')
  if (trimmed.includes('\t')) return trimmed.split('\t')
  return trimmed.split(/\s{2,}/)
}

/**
 * The attribute keys the parser understands, mapped to their canonical field.
 * Aliases exist because SOPs are not consistent about "Input(s)" vs "Inputs".
 */
const ATTRIBUTE_KEYS: Record<string, string> = {
  objective: 'objective',
  purpose: 'objective',
  trigger: 'trigger',
  precondition: 'preconditions',
  preconditions: 'preconditions',
  input: 'inputs',
  inputs: 'inputs',
  'input(s)': 'inputs',
  'completion criteria': 'completionCriteria',
  'completion criterion': 'completionCriteria',
  completion: 'completionCriteria',
  'primary actor': 'primaryActor',
  procedure: 'procedure',
  records: 'records',
  record: 'records',
}

interface Sections {
  attributes: Record<string, string>
  stepRows: string[][]
  outputs: string[]
}

/**
 * One pass over the text, sorting lines into the three blocks. A line is a
 * step row if we are under a `Steps` heading and it starts with a number; an
 * output if we are under an `Output` heading; an attribute otherwise.
 */
function sectionise(text: string): Sections {
  const attributes: Record<string, string> = {}
  const stepRows: string[][] = []
  const outputs: string[] = []

  let mode: 'attributes' | 'steps' | 'outputs' = 'attributes'
  let lastAttributeKey: string | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = line.replace(/[:|].*$/, '').trim().toLowerCase()
    if (/^steps?(\b|$)/.test(heading) && line.length < 60) {
      mode = 'steps'
      lastAttributeKey = null
      continue
    }
    if (/^(outputs?|procedure outputs?)(\b|$)/.test(heading) && line.length < 60) {
      mode = 'outputs'
      lastAttributeKey = null
      continue
    }

    if (mode === 'outputs') {
      outputs.push(clean(line.replace(/^[-•*–]\s*/, '')))
      continue
    }

    if (mode === 'steps') {
      const cells = splitRow(line)
      // The header row ("Step | Actor | ...") has no leading number.
      if (!/^\s*\d+\s*$/.test(cells[0] ?? '')) continue
      stepRows.push(cells)
      continue
    }

    const match = line.match(/^([A-Za-z()/ ]{3,40}?)\s*[:–-]\s*(.*)$/)
    const key = match ? ATTRIBUTE_KEYS[match[1].trim().toLowerCase()] : undefined
    if (match && key) {
      attributes[key] = clean(match[2])
      lastAttributeKey = key
      continue
    }

    // A wrapped continuation of the previous attribute (PDF copy-paste folds lines).
    if (lastAttributeKey) {
      attributes[lastAttributeKey] = clean(`${attributes[lastAttributeKey]} ${line}`)
    }
  }

  return { attributes, stepRows, outputs }
}

function toStep(cells: string[], issues: ParseIssue[]): WorkflowStep | null {
  const [rawNo, rawActor, rawUser, rawSystem, rawDecision, rawResult] = cells
  const no = Number(clean(rawNo ?? ''))
  if (!Number.isFinite(no) || no <= 0) return null

  const actorText = clean(rawActor ?? '')
  const actor = parseActor(actorText)
  if (!actor) {
    issues.push({
      level: 'error',
      field: `step-${no}`,
      message: `Step ${no}: "${actorText || 'blank'}" is not one of the five SOP actors (Teacher, AI, Teacher + AI, Student, Student + AI).`,
    })
    return null
  }

  const decision = cellValue(rawDecision ?? '')
  const systemAction = cellValue(rawSystem ?? '')

  return {
    no,
    actor,
    userAction: cellValue(rawUser ?? ''),
    systemAction,
    decision,
    ruleRefs: ruleRefsIn(decision, systemAction),
    result: cellValue(rawResult ?? ''),
    execution: executionFor(actor),
    humanGate: requiresHumanGate(actor),
  }
}

export interface ParseOptions {
  /** Injected so conversions are reproducible in tests. */
  now?: string
  /** Recorded as provenance on the produced spec. */
  method?: ProcessSpec['source']['method']
  model?: string
}

export function parseSopProcedure(
  text: string,
  module: SopModule,
  options: ParseOptions = {}
): ParseResult {
  const issues: ParseIssue[] = []
  const { attributes, stepRows, outputs } = sectionise(text)

  const procedureLine = attributes.procedure ?? ''
  const refMatch = procedureLine.match(/(\d+(?:\.\d+)+)/)
  if (!refMatch) {
    issues.push({
      level: 'error',
      field: 'procedure',
      message: 'No procedure reference found. The first line must read "Procedure: 6.9.4 <title>".',
    })
    return { spec: null, issues }
  }

  const ref = refMatch[1]
  const catalogued = findProcedure(module, ref)
  const parsedTitle = clean(procedureLine.slice(procedureLine.indexOf(ref) + ref.length))
  const title = parsedTitle || catalogued?.procedure.title || ''

  if (!catalogued) {
    issues.push({
      level: 'warning',
      field: 'procedure',
      message: `Procedure ${ref} is not in the ${module.name} SOP index. It will be stored, but its lifecycle stage cannot be resolved.`,
    })
  } else if (parsedTitle && parsedTitle.toLowerCase() !== catalogued.procedure.title.toLowerCase()) {
    issues.push({
      level: 'warning',
      field: 'procedure',
      message: `Title differs from the SOP index, which reads "${catalogued.procedure.title}".`,
    })
  }

  const steps = stepRows
    .map((cells) => toStep(cells, issues))
    .filter((step): step is WorkflowStep => step !== null)
    .sort((left, right) => left.no - right.no)

  if (!steps.length) {
    issues.push({
      level: 'error',
      field: 'steps',
      message: 'No step rows were found. A procedure needs at least one step under a "Steps" heading.',
    })
    return { spec: null, issues }
  }

  const declaredActor = attributes.primaryActor ? parseActor(attributes.primaryActor) : null
  if (attributes.primaryActor && !declaredActor) {
    issues.push({
      level: 'warning',
      field: 'primaryActor',
      message: `"${attributes.primaryActor}" is not one of the five SOP actors; the indexed actor was used instead.`,
    })
  }
  const primaryActor: ActorMode =
    declaredActor ?? catalogued?.procedure.primaryActor ?? steps[0].actor

  const spec: ProcessSpec = {
    specVersion: 1,
    ref,
    title,
    module: module.name,
    lifecycleStage: catalogued?.group.lifecycleStage ?? '',
    primaryActor,
    status: 'draft',
    attributes: {
      objective: attributes.objective ?? '',
      trigger: attributes.trigger ?? '',
      preconditions: toList(attributes.preconditions ?? ''),
      inputs: toList(attributes.inputs ?? ''),
      completionCriteria: attributes.completionCriteria ?? '',
    },
    workflow: {
      steps,
      outputs: outputs.filter(Boolean),
      handoffs: handoffsIn(outputs),
    },
    businessRules: rulesFor(
      module,
      steps.flatMap((step) => step.ruleRefs),
      steps.some((step) => step.actor === 'ai' || step.actor === 'teacher_ai' || step.actor === 'student_ai')
    ),
    records: toList(attributes.records ?? ''),
    tasks: [],
    source: {
      document: module.sop.document,
      version: module.sop.version,
      organization: module.sop.organization,
      effectiveDate: module.sop.effectiveDate,
      procedureRef: ref,
      processGroup: catalogued ? `${catalogued.group.ref} ${catalogued.group.title}` : '',
      method: options.method ?? 'structured',
      ...(options.model ? { model: options.model } : {}),
      convertedAt: options.now ?? new Date().toISOString(),
    },
  }

  return { spec, issues: [...issues, ...validateSpec(spec, module)] }
}

/**
 * Completeness and consistency checks applied to *any* spec, however it was
 * produced. Warnings are the SOP's own requirements: a procedure with no
 * objective or no completion criteria is not a procedure, and a cited rule that
 * the module does not define is a transcription error worth surfacing before a
 * teacher signs it off.
 */
export function validateSpec(spec: ProcessSpec, module: SopModule): ParseIssue[] {
  const issues: ParseIssue[] = []

  if (!spec.title) issues.push({ level: 'warning', field: 'title', message: 'The process has no title.' })
  if (!spec.attributes.objective) {
    issues.push({ level: 'warning', field: 'objective', message: 'No objective was stated.' })
  }
  if (!spec.attributes.trigger) {
    issues.push({ level: 'warning', field: 'trigger', message: 'No trigger was stated - it will not be clear what starts this process.' })
  }
  if (!spec.attributes.completionCriteria) {
    issues.push({
      level: 'warning',
      field: 'completionCriteria',
      message: 'No completion criteria were stated - the process has no defined end.',
    })
  }
  if (!spec.attributes.preconditions.length) {
    issues.push({
      level: 'warning',
      field: 'preconditions',
      message: 'No preconditions were stated, so no readiness tasks can be derived.',
    })
  }
  if (!spec.workflow.outputs.length) {
    issues.push({ level: 'warning', field: 'outputs', message: 'The procedure declares no outputs.' })
  }

  const numbers = spec.workflow.steps.map((step) => step.no)
  const expected = numbers.map((_, index) => index + 1)
  if (numbers.join(',') !== expected.join(',')) {
    issues.push({
      level: 'warning',
      field: 'steps',
      message: `Step numbering is not contiguous (${numbers.join(', ')}).`,
    })
  }

  const known = new Set(module.businessRules.map((rule) => rule.id))
  for (const ruleId of new Set(spec.workflow.steps.flatMap((step) => step.ruleRefs))) {
    if (!known.has(ruleId)) {
      issues.push({
        level: 'warning',
        field: 'rules',
        message: `${ruleId} is cited by a step but is not defined in the ${module.name} rule set.`,
      })
    }
  }

  // Section 3.3 / BR-07: the AI owns no record. A step that both runs unattended
  // and writes something learner-visible has lost its human gate somewhere.
  for (const step of spec.workflow.steps) {
    if (step.actor === 'ai' && /publish|release|approve|close the intervention/i.test(step.systemAction)) {
      issues.push({
        level: 'error',
        field: `step-${step.no}`,
        message: `Step ${step.no} has the AI publishing or releasing a record, which BR-07 forbids. Reassign it to Teacher + AI.`,
      })
    }
  }

  return issues
}
