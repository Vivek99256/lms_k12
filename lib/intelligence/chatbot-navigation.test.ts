import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCurrentModule,
  evaluateChatbotIntent,
  approvalsRouteFor,
  withSupplementalModules,
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
  // Student's own queue is its AI Stack Automations tab, known even before the registry loads.
  const student = evaluateChatbotIntent('Show me pending approvals', '/students/search_student');
  assert.equal(student.type, 'navigation');
  assert.equal(student.type === 'navigation' ? student.route : '', '/modules/student/ai-stack?tab=automations');
  // A page that belongs to no module has no queue to open.
  assert.equal(evaluateChatbotIntent('Show me pending approvals', '/dashboard').type, 'standard');
});

// ---------------------------------------------------------------------------
const routeOf = (r: ReturnType<typeof evaluateChatbotIntent>): string | undefined => (r.type === "navigation" ? r.route : undefined);

// Modules whose registry name differs from the slug this file keys on, a module
// whose own name is also a tab name, and a screen named like its module. The
// fixture mirrors the shape of the live registry feed; no database is involved.
// ---------------------------------------------------------------------------

const tabs = (base: string, items: Array<{ id: number; label: string; link: string }> = []) =>
  ['onboarding', 'reports', 'ai-stack'].map((key, index) => ({
    key,
    label: key === 'ai-stack' ? 'AI Stack' : key[0].toUpperCase() + key.slice(1),
    description: '',
    route: `${base}/${key}`,
    onboardingModuleKey: '',
    platformModuleKey: '',
    auditModuleKeys: [],
    items: index === 0 ? items : [],
  }));

const entry = (moduleName: string, label: string, baseRoute: string) => ({
  moduleName, level2MenuId: 1, label, categoryCount: 3, baseRoute, routes: [],
});

const fixtureRegistry = [
  entry('student', 'Student', '/modules/student'),
  entry('admission', 'Admission', '/modules/admission'),
  entry('transport', 'Transport', '/modules/transport'),
  entry('communication', 'Communication', '/modules/communication'),
  entry('petty-cash', 'Petty Cash', '/modules/petty-cash'),
  entry('timetable', 'Timetable', '/modules/timetable'),
];

const communicationTabs = [
  ...tabs('/modules/communication'),
  { key: 'communication', label: 'Communication', description: '', route: '/modules/communication/communication',
    onboardingModuleKey: '', platformModuleKey: '', auditModuleKeys: [], items: [] },
];

const fixtureCategories = new Map([
  ['student', tabs('/modules/student')],
  ['admission', tabs('/modules/admission')],
  ['transport', tabs('/modules/transport')],
  ['communication', communicationTabs],
  ['petty-cash', tabs('/modules/petty-cash', [{ id: 1, label: 'Petty Cash', link: '/admin-services/petty-cash' }])],
  ['timetable', tabs('/modules/timetable', [{ id: 2, label: 'Assign Class Teacher', link: '/classteacher' }])],
]);

test('A module the registry names differently is not "unavailable" from its own page', () => {
  const cases: Array<[string, string, string]> = [
    ['Open Student onboarding', '/students/search_student', '/modules/student/onboarding'],
    ['Open Admission onboarding', '/admissions/admission_enquiry', '/modules/admission/onboarding'],
    ['Go to Transport reports', '/transportation/routes', '/modules/transport/reports'],
  ];
  for (const [text, page, route] of cases) {
    const r = evaluateChatbotIntent(text, page, fixtureRegistry, fixtureCategories);
    assert.equal(r.type, 'navigation', text);
    assert.equal(routeOf(r), route, text);
  }
});

test('Another module is still refused from a module the registry names differently', () => {
  const r = evaluateChatbotIntent('Open Petty Cash onboarding', '/students/search_student', fixtureRegistry, fixtureCategories);
  assert.equal(r.type, 'unsupported');
});

test('A module whose name is also a tab name still opens the tab that was asked for', () => {
  const onboarding = evaluateChatbotIntent('Open Communication onboarding', '/modules/communication/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(onboarding.type, 'navigation');
  assert.equal(routeOf(onboarding), '/modules/communication/onboarding');

  const aiStack = evaluateChatbotIntent('Open Communication AI stack', '/modules/communication/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(routeOf(aiStack), '/modules/communication/ai-stack');
});

test('A screen named like its module does not hide the tab that was asked for', () => {
  const reports = evaluateChatbotIntent('Go to Petty Cash reports', '/modules/petty-cash/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(routeOf(reports), '/modules/petty-cash/reports');

  // Asked for by name with no tab, the screen is still the destination.
  const screen = evaluateChatbotIntent('Open Petty Cash', '/modules/petty-cash/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(routeOf(screen), '/admin-services/petty-cash');
});

test('Naming a screen is navigation even when its name contains a data word', () => {
  const r = evaluateChatbotIntent('Open Assign Class Teacher in Timetable', '/modules/timetable/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(r.type, 'navigation');
  assert.equal(routeOf(r), '/classteacher');

  // A data question that names no screen is still left to the model.
  const q = evaluateChatbotIntent('Which class has no teacher in Timetable', '/modules/timetable/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(q.type, 'standard');
});

// ---------------------------------------------------------------------------
// Approvals and the current module for modules beyond Fees.
// ---------------------------------------------------------------------------

test('Pending approvals open the Automations tab of a module that has approvals', () => {
  const cases: Array<[string, string]> = [
    ['/modules/student/onboarding', '/modules/student/ai-stack?tab=automations'],
    ['/modules/admission/reports', '/modules/admission/ai-stack?tab=automations'],
  ];
  for (const [page, route] of cases) {
    const r = evaluateChatbotIntent('Show me pending approvals', page, fixtureRegistry, fixtureCategories);
    assert.equal(r.type, 'navigation', page);
    assert.equal(routeOf(r), route, page);
  }
});

test('A module with no flow that waits for approval says so instead of opening an empty tab', () => {
  for (const [page, label] of [
    ['/modules/transport/reports', 'Transportation'],
    ['/modules/petty-cash/onboarding', 'Petty Cash'],
    ['/modules/communication/onboarding', 'Communication'],
  ] as const) {
    const r = evaluateChatbotIntent('Show me pending approvals', page, fixtureRegistry, fixtureCategories);
    assert.equal(r.type, 'unsupported', page);
    assert.match(r.type === 'unsupported' ? r.message : '', new RegExp(`^${label} has no actions that wait for approval`), page);
  }

  // The same with no registry at all.
  assert.equal(evaluateChatbotIntent('Show me pending approvals', '/modules/petty-cash/onboarding').type, 'unsupported');
});

test('The Actions tab links to the approvals of the module it is in', () => {
  assert.equal(approvalsRouteFor('fees'), '/fees/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('students'), '/modules/student/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('admissions'), '/modules/admission/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('attendance'), '/modules/attendance/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('exam'), '/modules/exam/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('exam_assessment'), '/modules/exam-assessment/ai-stack?tab=automations');
  assert.equal(approvalsRouteFor('/admissions/admission_enquiry'), '/modules/admission/ai-stack?tab=automations');
  // A module with nothing to approve has no link, so the tab shows none.
  assert.equal(approvalsRouteFor('petty_cash'), null);
  assert.equal(approvalsRouteFor('/dashboard'), null);
});

test('Pending approvals can name the module from anywhere, and never decide anything', () => {
  const r = evaluateChatbotIntent('Show me pending approvals for Admission', '/dashboard', fixtureRegistry, fixtureCategories);
  assert.equal(routeOf(r), '/modules/admission/ai-stack?tab=automations');

  // A question about approvals is a data question, not a request to move.
  assert.equal(
    evaluateChatbotIntent('How many pending approvals are there in Admission?', '/modules/admission/onboarding', fixtureRegistry, fixtureCategories).type,
    'standard'
  );
});

test('A page under a registry module resolves to that module, so the cross-module guard applies', () => {
  const refused = evaluateChatbotIntent('Open Student onboarding', '/modules/petty-cash/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(refused.type, 'unsupported');
  assert.equal(refused.currentModule.label, 'Petty Cash');

  // Naming the other module outright is still a switch, not a refusal.
  const switched = evaluateChatbotIntent('Open Student module', '/modules/petty-cash/onboarding', fixtureRegistry, fixtureCategories);
  assert.equal(switched.type, 'navigation');
});

test('Alumni Management, which the registry lacks, is opened by name from code', () => {
  const { registry, categoriesMap } = withSupplementalModules(fixtureRegistry, fixtureCategories);

  const events = evaluateChatbotIntent('Open alumni events', '/dashboard', registry, categoriesMap);
  assert.equal(events.type, 'navigation');
  assert.equal(routeOf(events), '/alumni/events');

  const add = evaluateChatbotIntent('Go to add alumni', '/dashboard', registry, categoriesMap);
  assert.equal(routeOf(add), '/alumni/add');

  const moduleOpen = evaluateChatbotIntent('Open Alumni Management module', '/dashboard', registry, categoriesMap);
  assert.equal(moduleOpen.type, 'navigation');

  // The registry's own entry wins the day it has one, and nothing else is touched.
  const own = withSupplementalModules([...fixtureRegistry, entry('alumni-management', 'Alumni Management', '/modules/alumni-management')], fixtureCategories);
  assert.equal(own.registry.length, fixtureRegistry.length + 1);
  assert.equal(own.categoriesMap.has('alumni'), false);
});

// ---------------------------------------------------------------------------
// The exact requests that came back as data or as "I could not answer that".
// ---------------------------------------------------------------------------

test('A tab request opens the tab even when the live registry has not loaded', () => {
  const cases: Array<[string, string, string]> = [
    ['Open Student onboarding', '/students/search_student', '/modules/student/onboarding'],
    ['Go to Admission reports', '/admissions/admission_enquiry', '/modules/admission/reports'],
    ['Open Transport AI stack', '/transportation/dashboard', '/modules/transport/ai-stack'],
    ['Go to Users AI stack', '/user/add_user', '/modules/user/ai-stack'],
  ];
  for (const [text, page, route] of cases) {
    const r = evaluateChatbotIntent(text, page); // no registry
    assert.equal(r.type, 'navigation', text);
    assert.equal(routeOf(r), route, text);
  }
});

test('"Go to onboarding" with no module named opens that tab of the module the user is in', () => {
  const inStudent = evaluateChatbotIntent('Go to onboarding', '/students/search_student');
  assert.equal(inStudent.type, 'navigation');
  assert.equal(routeOf(inStudent), '/modules/student/onboarding');

  // Whatever surrounds it, a typo in the page name does not matter: only the tab is read.
  assert.equal(routeOf(evaluateChatbotIntent('open onboarding in studnt apge', '/students/search_student')), '/modules/student/onboarding');

  assert.equal(routeOf(evaluateChatbotIntent('open reports', '/admissions/admission_enquiry')), '/modules/admission/reports');
  assert.equal(routeOf(evaluateChatbotIntent('Go to onboarding', '/fees/collect')), '/fees/onboarding');

  // The live registry, when loaded, supplies the route and may say there is no such tab.
  const withRegistry = evaluateChatbotIntent('Go to onboarding', '/modules/petty-cash/reports', fixtureRegistry, fixtureCategories);
  assert.equal(routeOf(withRegistry), '/modules/petty-cash/onboarding');
});

test('A bare tab request is not navigation without a module, and a data question never is', () => {
  assert.equal(evaluateChatbotIntent('Go to onboarding', '/dashboard').type, 'standard');
  assert.equal(evaluateChatbotIntent('Which students are pending in class 7?', '/students/search_student').type, 'standard');
  assert.equal(evaluateChatbotIntent('How many students are enrolled?', '/students/search_student').type, 'standard');
});

test('LMS + PAL pages resolve to their own module, not Student or Exam', () => {
  const expect = (path: string, name: string) => assert.equal(getCurrentModule(path).name, name, path);

  expect('/lms/homework', 'exam_assessment');
  expect('/lms/homework/submission', 'exam_assessment');
  expect('/exam/online', 'exam_assessment');
  expect('/exam/progress-report', 'exam_assessment');
  expect('/lms/lmsAssignment', 'exam_assessment');
  expect('/lms/worksheet', 'exam_assessment');
  expect('/lms/curriculum-planning/', 'curriculum_planning');
  expect('/lms/lesson-plan/', 'curriculum_planning');
  expect('/lms/teacher-diary', 'curriculum_planning');
  expect('/lmsLeaderboard', 'engagement');
  expect('/lms/student-analysis', 'interactions');
  expect('/lms/dashboard', 'interactions');
  expect('/new_pal/content_model', 'new_pal');
  // Unchanged neighbours.
  expect('/exam/marks_entry', 'exam');
  expect('/students/search_student', 'students');
  expect('/course-master', 'teach_learn');
});

test('Teach/Learn tab requests navigate to its own tab pages without the live registry', () => {
  const nav = (q: string) => evaluateChatbotIntent(q, '/course-master');

  for (const [q, route] of [
    ['Open operation in Teach/Learn.', '/teach-learn/operations'],
    ['Open Master Setup in Teach/Learn', '/teach-learn/master-setup'],
    ['Show me master setup in Teach/Learn.', '/teach-learn/master-setup'],
    ['Take me to process builder in Teach/Learn', '/teach-learn/process-builder'],
  ]) {
    const result = nav(q);
    assert.equal(result.type, 'navigation', q);
    assert.equal(result.route, route, q);
  }

  // A data question is never turned into navigation.
  assert.equal(nav('How many courses are there for Grade 8?').type, 'standard');
  assert.equal(nav('Summarise the chapters and lesson plan for this course.').type, 'standard');
});
