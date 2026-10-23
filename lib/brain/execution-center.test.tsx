import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ExecutionCenterView,
  ExecutionDetail,
  type ExecutionFilters,
} from '@/app/enterprise-brain/intelligence-loop/executions/_components/ExecutionCenterView';
import type { BrainExecutionCenterPayload, BrainExecutionCounts, BrainExecutionRecord } from './api';
import { GROUP_TONE, OUTCOME_STATE, ageText, changeText, ofText } from './execution-center';

const counts = (over: Partial<BrainExecutionCounts> = {}): BrainExecutionCounts => ({
  queued: 0, running: 0, completed: 0, failed: 0, blocked: 0, rolled_back: 0, other: 0, total: 0, ...over,
});

const UUID = '6b42338a-a8c4-4eb6-9ea6-0b2eb31c504e';

const record = (over: Partial<BrainExecutionRecord> = {}): BrainExecutionRecord => ({
  id: UUID, esoId: 'eso-1', decisionId: 'dec-1',
  title: 'Assign a head to every department', reason: 'Departments have no head.',
  decision: { rationale: 'Approved this week', status: 'approved', decidedBy: 'User #86', decidedAt: '2026-09-07 16:11:39' },
  action: { code: 'ESO-1', name: 'Assign heads' },
  executor: { label: 'User #86', type: 'human', raw: '86' },
  status: 'completed', group: 'completed', createdAt: '2026-09-07 16:11:39', startedAt: null, completedAt: '2026-09-07 16:11:41',
  ageDays: 45, error: null, isSample: false,
  outcome: { id: 'o1', result: 'partial', feedback: '18 of 607 departments now have a head.', confidence: 0.6,
    confidenceMeaning: '60% is a fixed value set from the reported result ("partial"): success 90%, partial 60%, failed 30%. It reflects what the reporter said, not a measurement or a statistical probability.',
    measurement: null, recordedAt: '2026-09-07 16:11:41', recordedBy: 'User #86' },
  outcomeState: 'reported',
  evidence: { execution: [], executionCount: 0, finding: [{ id: 'ev1', source: 'lms', type: 'observation', summary: 'Class average: 62.6%', confidence: 1, observedAt: null }], findingTotal: 8 },
  evidenceCount: 0,
  attention: { kind: 'evidence_missing', severity: 'medium', reason: 'REASON-TEXT', nextStep: 'NEXT-TEXT' },
  technical: { executionId: UUID, esoId: 'eso-1' },
  ...over,
});

const payload = (over: Partial<BrainExecutionCenterPayload> = {}): BrainExecutionCenterPayload => ({
  available: true, tenantId: '1', generatedAt: '2026-10-22T10:00:00Z', partial: null,
  health: { real: counts({ completed: 1, total: 1 }), sample: counts({ completed: 8, queued: 4, total: 12 }) },
  verification: {
    real: { finished: 1, withOutcome: 1, noOutcome: 0, failedOutcome: 0, reported: 1, measured: 0, verified: 0, withEvidence: 0, withoutEvidence: 1 },
    sample: { finished: 8, withOutcome: 8, reported: 8, verified: 0, withEvidence: 0 },
    outcomes: { total: 9, linkedToAnExecution: 9, notLinked: 0 },
  },
  attention: [
    { kind: 'evidence_missing', severity: 'medium', reason: 'REASON-TEXT', nextStep: 'NEXT-TEXT', id: UUID, title: 'Assign a head to every department', status: 'completed', group: 'completed', isSample: false, ageDays: 45, createdAt: null, executor: 'User #86', outcomeState: 'reported' },
    { kind: 'stale_queue', severity: 'high', reason: 'Approved 17 days ago and not yet completed.', nextStep: 'Carry out the action', id: 'demo-run-1', title: 'SAMPLE-ATTENTION-TITLE', status: 'queued', group: 'queued', isSample: true, ageDays: 17, createdAt: null, executor: 'Sample data', outcomeState: 'not_applicable' },
  ],
  impact: [
    { id: UUID, title: 'Assign a head to every department', isSample: false, outcomeState: 'reported', result: 'partial', feedback: '18 of 607 departments now have a head.', measurement: null, confidence: 0.6, confidenceMeaning: 'CONF-MEANING', recordedAt: '2026-09-07 16:11:41', recordedBy: 'User #86', evidenceCount: 0 },
    { id: 'demo-run-2', title: 'SAMPLE-IMPACT-TITLE', isSample: true, outcomeState: 'reported', result: 'improved', feedback: '[Sample] Owner assigned', measurement: null, confidence: 0.82, confidenceMeaning: 'sample record', recordedAt: null, recordedBy: 'Sample data', evidenceCount: 0 },
  ],
  history: { total: 1, page: 1, perPage: 25, lastPage: 1, data: [record()] },
  definitions: {
    statuses: { queued: 'QUEUED-DEF', completed: 'COMPLETED-DEF says it was done, not that it worked.', failed: 'FAILED-DEF', blocked: 'BLOCKED-DEF', running: '', rolled_back: '' },
    verification: { verified: 'VERIFIED-DEF', measured: 'MEASURED-DEF', reported: 'REPORTED-DEF', no_outcome: 'NOOUTCOME-DEF', failed: '' },
    evidence: { finding: '', execution: 'EXEC-EVIDENCE-DEF' },
    confidence: 'Outcome confidence is set from the reported result. It is not measured.',
  },
  ...over,
});

const filters: ExecutionFilters = { status: 'all', sample: 'all', q: '', page: 1 };
const render = (data: BrainExecutionCenterPayload, f: ExecutionFilters = filters) =>
  renderToStaticMarkup(createElement(ExecutionCenterView, { data, filters: f, onFilters: () => {}, onSelect: () => {} }));

test('health shows the real counts with their definitions, and keeps sample data apart', () => {
  const html = render(payload());
  for (const needle of ['Execution health', 'COMPLETED-DEF', 'QUEUED-DEF', 'FAILED-DEF', 'BLOCKED-DEF', '1 real execution']) assert.ok(html.includes(needle), needle);
  assert.ok(html.includes('12 demonstration executions are held separately'));
  assert.ok(html.includes('8 completed, 4 queued, 0 failed'));
});

test('completed is not presented as success: it is neutral, and verified is a separate green state', () => {
  assert.equal(GROUP_TONE.completed, 'gray');
  assert.notEqual(GROUP_TONE.completed, 'green');
  assert.equal(OUTCOME_STATE.verified.tone, 'green');
  for (const s of ['reported', 'measured', 'no_outcome'] as const) assert.notEqual(OUTCOME_STATE[s].tone, 'green', s);
});

test('verification never shows a percentage, says none is verified, and warns that no evidence is linked', () => {
  const html = render(payload());
  assert.ok(html.includes('0 of 1'), 'verified shows n of m');
  assert.ok(!/\d\s?%/.test(html.split('Evidence and outcome verification')[1].split('Actions needing attention')[0]), 'no percentage in the verification section');
  assert.ok(html.includes('No execution has evidence linked to it, so none can be verified yet'));
  assert.ok(html.includes('9 outcome records in total: 9 linked to an execution, 0 not linked'));
});

test('verification with nothing finished says there is nothing to verify instead of 0%', () => {
  const html = render(payload({ verification: { real: { finished: 0 }, sample: {}, outcomes: { total: 0, linkedToAnExecution: 0, notLinked: 0 } } }));
  assert.ok(html.includes('nothing to verify'));
});

test('sample records are labelled everywhere they appear and tucked behind a disclosure', () => {
  const html = render(payload());
  assert.ok(html.includes('Sample data'));
  assert.ok(html.includes('1 sample record (demonstration data)'));
  assert.ok(html.includes('1 sample outcome (demonstration data, not institutional results)'));
  // The real item is outside the <details>; the sample one is inside it.
  const attention = html.split('Actions needing attention')[1].split('Outcome impact')[0];
  assert.ok(attention.indexOf('Assign a head') < attention.indexOf('<details'));
  assert.ok(attention.indexOf('<details') < attention.indexOf('SAMPLE-ATTENTION-TITLE'));
});

test('attention items give the reason and the next step', () => {
  const html = render(payload());
  assert.ok(html.includes('REASON-TEXT') && html.includes('NEXT-TEXT') && html.includes('Evidence missing') && html.includes('Waiting too long'));
});

test('impact shows reported feedback, says plainly when nothing was measured, and explains confidence', () => {
  const html = render(payload());
  assert.ok(html.includes('18 of 607 departments now have a head.'));
  assert.ok(html.includes('No before and after measurement was recorded, so the size of the change is unknown.'));
  assert.ok(html.includes('CONF-MEANING'));
});

test('a measured outcome shows before, after and the unit', () => {
  const html = render(payload({
    impact: [{ ...payload().impact[0], outcomeState: 'measured', measurement: { before: 32, after: 22, change: 10, unit: 'vehicles', basis: null, accountsAffected: 22 } }],
  }));
  assert.ok(html.includes('32 vehicles before, 22 vehicles after: down 10 vehicles'));
  assert.ok(html.includes('(22 affected)'));
  assert.equal(changeText({ before: 5, after: 5, change: 0, unit: null }), '5 before, 5 after: unchanged');
});

test('the history table leads with the action title, not the raw id, and keeps the id as secondary text', () => {
  const html = render(payload());
  const row = html.split('<tbody>')[1];
  assert.ok(row.indexOf('Assign a head to every department') < row.indexOf(UUID));
  assert.ok(html.includes('aria-label="Search executions"') && html.includes('aria-label="Filter by status"'));
});

test('history shows paging only when there is more than one page, and an honest empty state', () => {
  assert.ok(!render(payload()).includes('Execution history pages'));
  const paged = render(payload({ history: { total: 60, page: 2, perPage: 25, lastPage: 3, data: [record()] } }));
  assert.ok(paged.includes('Page 2 of 3'));
  const none = render(payload({ history: { total: 0, page: 1, perPage: 25, lastPage: 1, data: [] } }), { ...filters, q: 'zzz' });
  assert.ok(none.includes('No execution matches these filters.'));
  assert.ok(render(payload({ history: { total: 0, page: 1, perPage: 25, lastPage: 1, data: [] } })).includes('No executions have been recorded.'));
});

test('an institute with no executions gets explicit empty states in every section', () => {
  const html = render(payload({
    health: { real: counts(), sample: counts() },
    verification: { real: { finished: 0 }, sample: {}, outcomes: { total: 0, linkedToAnExecution: 0, notLinked: 0 } },
    attention: [], impact: [], history: { total: 0, page: 1, perPage: 25, lastPage: 1, data: [] },
  }));
  for (const needle of ['No real executions have been recorded yet', 'nothing to verify', 'Nothing needs attention', 'No outcome has been recorded yet']) assert.ok(html.includes(needle), needle);
});

test('an unavailable backend and a partial load are said out loud', () => {
  assert.ok(render(payload({ available: false, reason: 'The execution tables are not installed on this server.' })).includes('The execution tables are not installed'));
  assert.ok(render(payload({ partial: 'Showing the newest 1000 of 1500 executions.' })).includes('Showing the newest 1000 of 1500 executions.'));
});

test('hidden sections are not rendered (customization)', () => {
  const html = renderToStaticMarkup(createElement(ExecutionCenterView, { data: payload(), filters, onFilters: () => {}, onSelect: () => {}, show: (s) => s !== 'impact' && s !== 'history' }));
  assert.ok(html.includes('Execution health') && html.includes('Actions needing attention'));
  assert.ok(!html.includes('Outcome impact') && !html.includes('Execution history'));
});

const detail = (r: BrainExecutionRecord | null, over = {}) =>
  renderToStaticMarkup(createElement(ExecutionDetail, { detail: { record: r, loading: false, error: '', ...over }, onClose: () => {}, onLinkEvidence: () => {} }));

test('the detail view explains why, who decided, the outcome, both kinds of evidence and the ids', () => {
  const html = detail(record());
  for (const needle of ['Departments have no head.', 'approved by User #86', 'Approved this week', 'Reported result', 'No before and after measurement was recorded',
    'None is linked. Without it this execution cannot be verified', 'Evidence behind the finding (8)', 'Class average: 62.6%', 'does not prove the action was carried out',
    'Technical identifiers', UUID, 'Select evidence to link']) assert.ok(html.includes(needle), needle);
});

test('the detail view has loading and error states, and missing information is stated, not blank', () => {
  assert.ok(detail(null, { loading: true }).includes('Loading the record'));
  assert.ok(detail(null, { error: 'API-DOWN' }).includes('API-DOWN'));
  const bare = detail(record({ reason: null, decision: null, outcome: null, outcomeState: 'no_outcome', attention: null, evidence: { execution: [], executionCount: 0, finding: [], findingTotal: 0 } }));
  for (const needle of ['No reason is recorded', 'No decision is linked', 'No outcome is recorded for this completed execution', 'No evidence is attached to the finding']) assert.ok(bare.includes(needle), needle);
});

test('linked evidence is shown as linked and cannot be selected again', () => {
  const linked = { id: 'ev1', source: 'lms', type: 'observation', summary: 'Class average: 62.6%', confidence: 1, observedAt: null };
  const html = detail(record({ evidence: { execution: [linked], executionCount: 1, finding: [linked], findingTotal: 1 }, evidenceCount: 1 }));
  assert.ok(html.includes('linked'));
  assert.ok(!html.includes('type="checkbox"'));
});

test('small helpers', () => {
  assert.equal(ofText(0, 0, 'finished executions'), 'No finished executions yet');
  assert.equal(ofText(1, 3, 'x'), '1 of 3');
  assert.equal(ageText(0), 'today');
  assert.equal(ageText(1), '1 day ago');
  assert.equal(ageText(17), '17 days ago');
  assert.equal(ageText(null), 'date unknown');
});
