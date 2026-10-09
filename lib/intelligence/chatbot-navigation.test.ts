import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCurrentModule,
  evaluateChatbotIntent,
} from './chatbot-navigation';

test('getCurrentModule resolves correct module slug and display label', () => {
  assert.deepEqual(getCurrentModule('/fees/collect'), { name: 'fees', label: 'Fees' });
  assert.deepEqual(getCurrentModule('/students/search_student'), { name: 'students', label: 'Student' });
  assert.deepEqual(getCurrentModule('/admissions/admission_enquiry'), { name: 'admissions', label: 'Admissions' });
  assert.deepEqual(getCurrentModule('/attendance/attendance_dashboard'), { name: 'attendance', label: 'Attendance' });
  assert.deepEqual(getCurrentModule('/dashboard'), { name: 'general', label: 'General' });
});

test('Scenario 1: Open Fees onboarding in Fees context returns exact Fees onboarding action', () => {
  const result = evaluateChatbotIntent('Open Fees onboarding', '/fees/onboarding');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Fees Onboarding');
  assert.equal(result.message, 'Open the Fees onboarding process.');
  assert.equal(result.route, '/fees/onboarding');
  assert.equal(result.actionLabel, 'Open Fees Onboarding');
});

test('Scenario 2: Open Student module returns Student module navigation', () => {
  const result = evaluateChatbotIntent('Open Student module', '/dashboard');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Student Module');
  assert.equal(result.message, 'Open the Student module.');
  assert.equal(result.route, '/students/search_student');
  assert.equal(result.actionLabel, 'Open Student Module');
});

test('Scenario 3: Unsupported action in Student module context returns clarification message', () => {
  const result = evaluateChatbotIntent('Open Fees onboarding', '/students/search_student');

  assert.equal(result.type, 'unsupported');
  assert.equal(
    result.message,
    'This action isn’t available from the Student module. What would you like to check in the Student module?'
  );
});

test('Scenario 4: Direct module switch from another module is allowed', () => {
  const result = evaluateChatbotIntent('Open Fees module', '/students/search_student');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Fees Module');
  assert.equal(result.route, '/fees/onboarding');
});

test('Scenario 5: Pending fees and data queries evaluate to standard to use real backend flow and DB data', () => {
  const queryResult = evaluateChatbotIntent(
    'Whose fees are pending?',
    '/fees'
  );
  assert.equal(queryResult.type, 'standard');

  const detailResult = evaluateChatbotIntent('Show the details of the first class.', '/fees');
  assert.equal(detailResult.type, 'standard');
});

const feesRegistry = [
  { moduleName: 'fees', level2MenuId: 6, label: 'Fees', categoryCount: 12, baseRoute: '/fees', routes: [] },
];
const cat = (key: string, label: string, route: string, items: Array<{ id: number; label: string; link: string }> = []) => ({
  key, label, description: '', route, onboardingModuleKey: '', platformModuleKey: '', auditModuleKeys: [], items,
});
const feesCategories = new Map([
  [
    'fees',
    [
      cat('onboarding', 'Onboarding', '/fees/onboarding'),
      cat('process-builder', 'Process Builder', '/fees/process-builder'),
      cat('operations', 'Operations', '/fees/operations', [{ id: 1, label: 'Fee Collect', link: '/fees/collect' }]),
      cat('help-guide-support', 'Help Guide/Support', '/fees/help-guide-support'),
      cat('ai-stack', 'AI Stack', '/fees/ai-stack'),
      cat('workflow', 'Workflow', '/fees/workflow'),
      cat('schedular', 'Schedular', '/fees/scheduler'),
      cat('audit-trail', 'Audit Trail', '/fees/audit-trail'),
    ],
  ],
]);

test('Every Fees tab resolves to its own route from the live registry', () => {
  const cases: Array<[string, string]> = [
    ['open onboarding in fees module', '/fees/onboarding'],
    ['open process builder in fees module', '/fees/process-builder'],
    ['go to operations in fees', '/fees/operations'],
    ['open help in fees module', '/fees/help-guide-support'],
    ['open ai stack in fees module', '/fees/ai-stack'],
    ['open workflow in fees module', '/fees/workflow'],
    ['open scheduler in fees module', '/fees/scheduler'],
    ['open audit trail in fees module', '/fees/audit-trail'],
  ];
  for (const [text, route] of cases) {
    const result = evaluateChatbotIntent(text, '/fees/onboarding', feesRegistry, feesCategories);
    assert.equal(result.type, 'navigation', text);
    assert.equal(result.route, route, text);
  }
});

test('A named screen opens that screen, not just its tab', () => {
  const result = evaluateChatbotIntent('open fee collect in fees module', '/fees/onboarding', feesRegistry, feesCategories);
  assert.equal(result.type, 'navigation');
  assert.equal(result.route, '/fees/collect');
});

test('A named tab never falls back to Onboarding when the tab list is missing', () => {
  for (const text of ['open fees reports', 'open fees ai stack', 'open fees operations', 'open fees master setup']) {
    const result = evaluateChatbotIntent(text, '/fees/onboarding');
    assert.notEqual(result.type === 'navigation' ? result.route : null, '/fees/onboarding', text);
  }
});

test('Master Setup, Reports, Intelligence and Communication resolve to their own tabs', () => {
  const more = new Map([['fees', [
    cat('onboarding', 'Onboarding', '/fees/onboarding'),
    cat('master-setup', 'Master Setup', '/fees/master-setup'),
    cat('reports', 'Reports', '/fees/reports'),
    cat('intelligence', 'Intelligence', '/fees/intelligence'),
    cat('communication', 'Communication', '/fees/communication'),
  ]]]);
  for (const k of ['master-setup', 'reports', 'intelligence', 'communication']) {
    const r = evaluateChatbotIntent(`open fees ${k.replace('-', ' ')}`, '/fees/onboarding', feesRegistry, more);
    assert.equal(r.type, 'navigation');
    assert.equal(r.route, `/fees/${k}`);
  }
});

test('Data questions are never treated as navigation', () => {
  for (const text of [
    'Show me classes with the most pending fees',
    'Show the details of the first class',
    'Show the details of the second class',
    'Show classes with most pending where students owing is 23',
    'Which classes have the most pending fees?',
    'Show me the Fees report',
    'fees collection summary',
  ]) {
    const result = evaluateChatbotIntent(text, '/fees/intelligence', feesRegistry, feesCategories);
    assert.equal(result.type, 'standard', text);
  }
});

test('Open Intelligence in Fees module is a navigation, not a data query', () => {
  const tabs = new Map([['fees', [cat('intelligence', 'Intelligence', '/fees/intelligence')]]]);
  const r = evaluateChatbotIntent('Open Intelligence in Fees module.', '/fees/intelligence', feesRegistry, tabs);
  assert.equal(r.type, 'navigation');
  assert.equal(r.route, '/fees/intelligence');
});

test('Every Fees tab resolves with no live tab list, each to its own page', () => {
  const cases: Array<[string, string]> = [
    ['Open Fees Onboarding', '/fees/onboarding'],
    ['Open Process Builder in Fees module', '/fees/process-builder'],
    ['Open Master Setup in Fees module', '/fees/master-setup'],
    ['Go to Operations in Fees', '/fees/operations'],
    ['Open Reports in Fees module', '/fees/reports'],
    ['Open Intelligence in Fees module', '/fees/intelligence'],
    ['Open Help Guide/Support in Fees module', '/fees/help-guide-support'],
    ['Open Communication in Fees module', '/fees/communication'],
    ['Open AI Stack in Fees', '/fees/ai-stack'],
    ['Open Workflow in Fees module', '/fees/workflow'],
    ['Open Scheduler in Fees module', '/fees/scheduler'],
    ['Open Audit Trail in Fees module', '/fees/audit-trail'],
  ];
  for (const [text, route] of cases) {
    const r = evaluateChatbotIntent(text, '/fees/operations');
    assert.equal(r.type, 'navigation', text);
    assert.equal(r.route, route, text);
  }
});

test('Approval requests open the Fees approvals queue and never decide anything', () => {
  for (const text of [
    'Show me pending approvals',
    'Take me to staff approval',
    'Approve this action',
    'Approve the pending Fees action',
  ]) {
    const r = evaluateChatbotIntent(text, '/fees/operations');
    assert.equal(r.type, 'navigation', text);
    assert.equal(r.route, '/fees/ai-stack?tab=automations', text);
  }
  assert.equal(evaluateChatbotIntent('How many pending approvals are there?', '/fees').type, 'standard');
  assert.equal(evaluateChatbotIntent('Show me pending approvals', '/students/search_student').type, 'standard');
});
