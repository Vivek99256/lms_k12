import assert from 'node:assert/strict'
import { test } from 'node:test'

import { convertSopProcedure } from './index'
import { deriveTasks, dueDateFor, unmappedSteps } from './derive-tasks'
import {
  checkSize,
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  removeProcess,
  storageKeyFor,
  upsertProcess,
} from './envelope'
import { specToIntakeText } from './intake'
import { parseSopProcedure, validateSpec } from './parser'
import { LMS_PAL_MODULE } from './sop-catalog'
import { LMS_PAL_6_9_4_SOURCE } from './sop-source'
import type { ProcessSpec } from './types'

const NOW = '2026-08-27T00:00:00.000Z'

function convert(text = LMS_PAL_6_9_4_SOURCE) {
  return convertSopProcedure(text, LMS_PAL_MODULE, { now: NOW })
}

function spec(): ProcessSpec {
  const result = convert()
  assert.ok(result.spec, 'the shipped 6.9.4 source must parse')
  return result.spec
}

/* -------------------------------------------------------------------- *
 * Parsing the SOP's own procedure anatomy
 * -------------------------------------------------------------------- */

test('parses 6.9.4 into a process resolved against the module catalogue', () => {
  const converted = spec()

  assert.equal(converted.ref, '6.9.4')
  assert.equal(converted.title, 'Deliver the adaptive quiz and capture per-question responses')
  assert.equal(converted.module, 'LMS + PAL')
  // Resolved from the catalogue, not from the pasted text.
  assert.equal(converted.lifecycleStage, 'Diagnose')
  assert.equal(converted.source.processGroup, '6.9 PAL adaptive learning loop')
  assert.equal(converted.primaryActor, 'student_ai')
  assert.equal(converted.status, 'draft')
  assert.equal(converted.source.method, 'structured')
})

test('reads the attribute table, including semicolon-separated lists', () => {
  const { attributes } = spec()

  assert.match(attributes.objective, /^Deliver an adaptive question set/)
  assert.equal(attributes.trigger, 'The learner starts a quiz on a chapter from the PAL workspace.')
  assert.equal(attributes.preconditions.length, 4)
  assert.equal(attributes.preconditions[0], 'Chapter is registered with tagged concepts')
  assert.equal(attributes.preconditions[3], 'the active session year is correct')
  assert.equal(attributes.inputs.length, 4)
  assert.match(attributes.completionCriteria, /every response is persisted/)
})

test('reads all seven steps with their actors, rules and execution modes', () => {
  const { workflow } = spec()

  assert.equal(workflow.steps.length, 7)
  assert.deepEqual(
    workflow.steps.map((step) => step.actor),
    ['student', 'ai', 'student_ai', 'student', 'ai', 'ai', 'student_ai']
  )
  // Execution mode is derived from the actor, never authored.
  assert.deepEqual(
    workflow.steps.map((step) => step.execution),
    ['learner', 'system', 'learner', 'learner', 'system', 'system', 'learner']
  )
  // The SOP prints an em dash for "no user action"; that is not content.
  assert.equal(workflow.steps[1].userAction, '')
  assert.equal(workflow.steps[6].decision, '')

  assert.deepEqual(workflow.steps[0].ruleRefs, ['BR-02'])
  assert.deepEqual(workflow.steps[1].ruleRefs, ['BR-03'])
  assert.deepEqual(workflow.steps[4].ruleRefs, ['BR-04'])
  assert.deepEqual(workflow.steps[5].ruleRefs, [])
})

test('captures outputs and resolves the procedures they hand over to', () => {
  const { workflow } = spec()

  assert.equal(workflow.outputs.length, 4)
  assert.match(workflow.outputs[0], /^A PAL attempt record/)
  assert.deepEqual(workflow.handoffs, ['6.10', '6.11'])
})

test('inherits cited rules plus the unconditional AI-governance rules', () => {
  const ids = spec().businessRules.map((rule) => rule.id)

  assert.deepEqual(ids, ['BR-02', 'BR-03', 'BR-04', 'BR-07', 'BR-08'])
})

test('accepts tab-separated step tables as well as pipes', () => {
  const tabbed = LMS_PAL_6_9_4_SOURCE.split('\n')
    .map((line) => (/^\d+ \|/.test(line) ? line.split(' | ').join('\t') : line))
    .join('\n')

  const result = parseSopProcedure(tabbed, LMS_PAL_MODULE, { now: NOW })
  assert.equal(result.spec?.workflow.steps.length, 7)
})

test('reports a missing procedure reference instead of guessing one', () => {
  const result = parseSopProcedure('Objective: something\nSteps\n1 | Teacher | a | b | c | d', LMS_PAL_MODULE)

  assert.equal(result.spec, null)
  assert.ok(result.issues.some((issue) => issue.level === 'error' && issue.field === 'procedure'))
})

test('rejects an actor outside the five SOP acting modes', () => {
  const broken = LMS_PAL_6_9_4_SOURCE.replace('1 | Student |', '1 | Principal |')
  const result = parseSopProcedure(broken, LMS_PAL_MODULE, { now: NOW })

  assert.ok(
    result.issues.some((issue) => issue.level === 'error' && /not one of the five SOP actors/.test(issue.message))
  )
  assert.equal(result.spec?.workflow.steps.length, 6)
})

test('flags an AI step that would publish a record, which BR-07 forbids', () => {
  const converted = spec()
  const tampered: ProcessSpec = {
    ...converted,
    workflow: {
      ...converted.workflow,
      steps: converted.workflow.steps.map((step) =>
        step.no === 5 ? { ...step, systemAction: 'Scores the attempt and publishes the result' } : step
      ),
    },
  }

  const issues = validateSpec(tampered, LMS_PAL_MODULE)
  assert.ok(issues.some((issue) => issue.level === 'error' && /BR-07 forbids/.test(issue.message)))
})

test('warns when a procedure states no completion criteria', () => {
  const withoutCriteria = LMS_PAL_6_9_4_SOURCE.split('\n')
    .filter((line) => !line.startsWith('Completion criteria:'))
    .join('\n')

  const result = parseSopProcedure(withoutCriteria, LMS_PAL_MODULE, { now: NOW })
  assert.ok(result.issues.some((issue) => issue.field === 'completionCriteria'))
})

/* -------------------------------------------------------------------- *
 * Task derivation
 * -------------------------------------------------------------------- */

test('derives no assigned task from a learner or engine step', () => {
  const converted = spec()

  // Every one of 6.9.4's seven steps is Student / AI / Student + AI, so a
  // naive step-to-task mapping would assign quiz-answering to a teacher.
  const stepTasks = converted.tasks.filter((task) => task.origin === 'step')
  assert.equal(stepTasks.length, 0)

  const learnerTasks = converted.tasks.filter((task) => task.origin === 'learner_activity')
  assert.equal(learnerTasks.length, 4)
  assert.ok(learnerTasks.every((task) => !task.assignable && !task.selected))
})

test('derives one readiness task per precondition, owned per the master-data register', () => {
  const readiness = spec().tasks.filter((task) => task.origin === 'precondition')

  assert.equal(readiness.length, 4)
  assert.deepEqual(
    readiness.map((task) => task.owner),
    ['Teacher', 'Teacher', 'Teacher', 'LMS Administrator']
  )
  assert.match(readiness[0].title, /^Confirm chapter is registered/)
  assert.ok(readiness.every((task) => task.assignable && task.selected))
})

test('a precondition cites the rule that enforces it, module-wide', () => {
  const readiness = spec().tasks.filter((task) => task.origin === 'precondition')
  const cited = Object.fromEntries(readiness.map((task) => [task.key, task.ruleRefs]))

  assert.deepEqual(cited['6.9.4-P1'], ['BR-01'], 'tagged concepts is BR-01')
  assert.deepEqual(cited['6.9.4-P2'], ['BR-02'], 'prerequisites complete is BR-02')
  assert.deepEqual(cited['6.9.4-P3'], ['BR-03', 'BR-05'], 'the item bank is governed by both')
  // BR-12 is never cited by a step of 6.9.4 - it is found because preconditions
  // are matched against the module's whole rule set, not the inherited subset.
  assert.deepEqual(cited['6.9.4-P4'], ['BR-12'], 'active session year is BR-12')

  // A rule-backed precondition blocks the process, so it outranks one that is
  // merely stated.
  assert.ok(readiness.every((task) => task.priority === 'High'))
})

test('derives a human verification gate for every unattended AI step that moves a learner-visible record', () => {
  const gates = spec().tasks.filter((task) => task.origin === 'gate')

  // Steps 5 (mastery) and 6 (misconceptions) qualify; step 2 only builds a
  // question set, which no learner record depends on.
  assert.deepEqual(gates.map((task) => task.stepNos.join()), ['5', '6'])
  assert.ok(gates.every((task) => task.priority === 'High'))
  assert.ok(gates.every((task) => task.ruleRefs.includes('BR-07')))
  assert.ok(gates.every((task) => task.actor === 'teacher_ai'))
})

test('derives a follow-through task for each declared handover', () => {
  const handovers = spec().tasks.filter((task) => task.origin === 'output')

  assert.equal(handovers.length, 2)
  // The SOP hands over at process-group level ("raised for remediation (6.10)"),
  // so the reference resolves to the group, not to 6.10.1.
  assert.equal(handovers[0].title, 'Action the handover to 6.10 Misconception detection and remediation')
  assert.equal(handovers[1].title, 'Action the handover to 6.11 Pedagogy engine and adaptive practice')
})

test('every derived task carries the KRA, KPA and observation point Task Management stores', () => {
  for (const task of spec().tasks) {
    assert.equal(task.kra, 'LMS + PAL - Diagnose')
    assert.ok(task.kpa, `${task.key} has no KPA`)
    assert.ok(task.observationPoint !== undefined, `${task.key} has no observation point`)
    // '0' is out of range for this column - the bulk importer clamps it to 1
    // and the /task endpoint does not, so it must never be derived.
    assert.equal(task.repeatDays, '1', `${task.key} has an out-of-range repeat cadence`)
  }
})

test('re-derivation keeps the reviewer include and exclude choices', () => {
  const converted = spec()
  const edited = converted.tasks.map((task) =>
    task.key === '6.9.4-P1' ? { ...task, selected: false, dueOffsetDays: 9 } : task
  )

  const rederived = deriveTasks(converted, LMS_PAL_MODULE, { previous: edited })
  const kept = rederived.find((task) => task.key === '6.9.4-P1')

  assert.equal(kept?.selected, false)
  assert.equal(kept?.dueOffsetDays, 9)
  // Untouched drafts keep their defaults.
  assert.equal(rederived.find((task) => task.key === '6.9.4-P2')?.selected, true)
})

test('reports which steps produced no task, so coverage gaps are visible', () => {
  const converted = spec()
  const gaps = unmappedSteps(converted, converted.tasks)

  // Step 2 builds the question set unattended and touches no learner record.
  assert.deepEqual(gaps.map((step) => step.no), [2])
})

test('due dates are offsets from the publication date', () => {
  const converted = spec()
  const gate = converted.tasks.find((task) => task.origin === 'gate')
  const readiness = converted.tasks.find((task) => task.origin === 'precondition')

  assert.equal(dueDateFor(gate!, new Date('2026-08-27T00:00:00Z')), '2026-08-28')
  assert.equal(dueDateFor(readiness!, new Date('2026-08-27T00:00:00Z')), '2026-08-29')
})

/* -------------------------------------------------------------------- *
 * Intake round-trip (the path the AI proposal is normalised through)
 * -------------------------------------------------------------------- */

test('a spec rendered back to intake text re-parses to the same process', () => {
  const original = spec()
  const reparsed = convert(specToIntakeText(original)).spec

  assert.ok(reparsed)
  assert.deepEqual(reparsed.attributes, original.attributes)
  assert.deepEqual(reparsed.workflow, original.workflow)
  assert.deepEqual(
    reparsed.businessRules.map((rule) => rule.id),
    original.businessRules.map((rule) => rule.id)
  )
  assert.deepEqual(
    reparsed.tasks.map((task) => task.key),
    original.tasks.map((task) => task.key)
  )
})

/* -------------------------------------------------------------------- *
 * Storage envelope
 * -------------------------------------------------------------------- */

test('a legacy CKEditor value decodes as legacy, not as a broken process', () => {
  const decoded = decodeEnvelope('<p>Old free-text process</p>')

  assert.equal(decoded.kind, 'legacy')
  assert.equal(decoded.kind === 'legacy' && decoded.html, '<p>Old free-text process</p>')
})

test('an empty column decodes as empty', () => {
  assert.equal(decodeEnvelope('   ').kind, 'empty')
})

test('unrelated JSON is reported rather than silently overwritten', () => {
  const decoded = decodeEnvelope('{"some":"other document"}')
  assert.equal(decoded.kind, 'unreadable')
})

test('each procedure gets its own storage row, keyed by module and reference', () => {
  const key = storageKeyFor(spec())

  assert.equal(key.menuName, 'LMS + PAL 6.9.4')
  assert.equal(key.menuDetails, '0/LMS + PAL 6.9.4')

  // Two procedures never share a row, so the ~4-per-row TEXT ceiling never binds.
  assert.notEqual(storageKeyFor({ module: 'LMS + PAL', ref: '6.9.5' }).menuName, key.menuName)

  // The controller splits menuDetails on '/', so neither half may contain one.
  assert.equal(storageKeyFor({ module: 'LMS/PAL', ref: '6.9.4' }).menuDetails.split('/').length, 2)

  // The name must not collide with a real menu title: OnboardingApiController
  // and tourController read this table by menu_name and strip the value to
  // plain text, so a converted row landing on a menu they know about would
  // render raw JSON to users.
  assert.match(key.menuName, /\s\d+(\.\d+)+$/)
})

test('a saved envelope round-trips and keeps other procedures on the same menu', () => {
  const converted = spec()
  const envelope = upsertProcess(
    createEnvelope({ module: LMS_PAL_MODULE.name, sop: LMS_PAL_MODULE.sop, now: NOW }),
    converted,
    NOW
  )
  const withSibling = upsertProcess(envelope, { ...converted, ref: '6.9.5', title: 'Submit the attempt' }, NOW)

  const decoded = decodeEnvelope(encodeEnvelope(withSibling))
  assert.equal(decoded.kind, 'envelope')
  assert.deepEqual(
    decoded.kind === 'envelope' ? decoded.envelope.processes.map((process) => process.ref) : [],
    ['6.9.4', '6.9.5']
  )

  // Re-converting 6.9.4 replaces only 6.9.4.
  const reconverted = upsertProcess(withSibling, { ...converted, title: 'Revised title' }, NOW)
  assert.equal(reconverted.processes.length, 2)
  assert.equal(reconverted.processes[0].title, 'Revised title')

  assert.equal(removeProcess(reconverted, '6.9.4', NOW).processes.length, 1)
})

test('one converted procedure fits the TEXT column with room to spare', () => {
  const envelope = upsertProcess(
    createEnvelope({ module: LMS_PAL_MODULE.name, sop: LMS_PAL_MODULE.sop, now: NOW }),
    spec(),
    NOW
  )
  const size = checkSize(envelope)

  assert.ok(size.withinBudget, `envelope is ${size.bytes} bytes, over the ${size.budget} budget`)
})
