import test from 'node:test';
import assert from 'node:assert/strict';

import { isDeferredModuleRoute } from './index';
import { resolveDashboardRole } from '../../app/dashboard/_lib/resolveDashboardRole';
import { mapApiLinkToRoute } from '../../app/data/routeMapper';
import { isVisibleMenuLink } from '../../app/data/menuMappers';

/**
 * V1 ships the school-operations core. These pin what the sidebar hides and,
 * as importantly, what it must NOT hide.
 */

test('modules outside V1 are hidden, including their sub-routes', () => {
  for (const route of ['/pal', '/h5p/h5p_mcq', '/ai', '/hrit/attendance', '/career-explorer']) {
    assert.equal(isDeferredModuleRoute(route), true, route);
  }
});

test('New PAL (tblmenumaster parent 531) is not V1-deferred, despite sharing the /pal prefix', () => {
  for (const route of [
    '/pal/new',
    '/pal/new/content-model',
    '/pal/new/administration',
    '/pal/new/gamification',
    '/pal/new/ai-stack',
    '/pal/ulu',
    '/pal/eso',
    '/pal/eso/chapter/1014',
    '/pal/pedagogy-engine',
    '/pal/reports/attainment',
  ]) {
    assert.equal(isDeferredModuleRoute(route), false, route);
  }
});

test('legacy /pal/* screens that are NOT New PAL children stay V1-deferred', () => {
  // These are real pages but are not under tblmenumaster parent 531 (New PAL) —
  // /pal/frameworks in particular hangs off parent 327 (Curriculum) instead.
  for (const route of ['/pal/adaptive/chapter/1', '/pal/diagnostic/chapter/1', '/pal/mastery/concept/1', '/pal/frameworks/algebra']) {
    assert.equal(isDeferredModuleRoute(route), true, route);
  }
});

test('the V1 core is never hidden', () => {
  for (const route of ['/fees', '/fees/collect', '/students', '/student', '/admissions/admission_enquiry', '/attendance/attendance_dashboard', '/result/master', '/exam', '/lms', '/subjects', '/dashboard', '/settings', '/general/groupwise_rights', '/user', '/reports']) {
    assert.equal(isDeferredModuleRoute(route), false, route);
  }
});

test('rights-granted Enterprise Brain menus remain visible without enabling deferred modules', () => {
  for (const route of ['/enterprise-brain', '/enterprise-brain/automation', '/enterprise-brain/automation/agents', '/enterprise-brain/governance']) {
    assert.equal(isDeferredModuleRoute(route), false, route);
    assert.equal(isVisibleMenuLink(route), true, route);
  }
});

test('matching is by path segment, not by string prefix', () => {
  // "/ai" is deferred, "/airlines" and "/aid-fund" are different routes entirely.
  assert.equal(isDeferredModuleRoute('/airlines'), false);
  assert.equal(isDeferredModuleRoute('/aid-fund'), false);
  assert.equal(isDeferredModuleRoute('/pal-exports'), false);
});

test('query strings, hashes and trailing slashes do not defeat the filter', () => {
  assert.equal(isDeferredModuleRoute('/pal/?tab=1'), true);
  assert.equal(isDeferredModuleRoute('/h5p#top'), true);
  assert.equal(isDeferredModuleRoute(''), false);
  assert.equal(isDeferredModuleRoute(null), false);
});

test('the dashboard role is found in free-text profile names', () => {
  assert.equal(resolveDashboardRole('Teacher'), 'teacher');
  assert.equal(resolveDashboardRole('Class Teacher'), 'teacher');
  assert.equal(resolveDashboardRole('Senior Teacher'), 'teacher');
  assert.equal(resolveDashboardRole('HOD'), 'teacher');
  assert.equal(resolveDashboardRole('Student'), 'student');
  assert.equal(resolveDashboardRole('Super Admin'), 'admin');
  assert.equal(resolveDashboardRole('Principal'), 'admin');
  assert.equal(resolveDashboardRole(''), 'admin');
  assert.equal(resolveDashboardRole(undefined), 'admin');
});

test('result menu links, in every spelling the menu table uses, reach a real Result page', () => {
  const expected: Record<string, string> = {
    '/exam/exam_master': '/result/master/exam-master',
    '/exam/grade_master': '/result/master/grade-master',
    '/result/consolidate_report': '/result/reports/consolidate',
    '/result/result-template': '/result/templates',
    'result_activity_master.index': '/result/master/hpc-activity',
    'result_activity_marks_V1.index': '/result/hpc-entry-v1',
    'classwise_grade_report.index': '/result/reports/classwise-grade',
    '/result/student_attendance_master/': '/result/student-attendance',
    '/exam/marks-entry': '/exam/marks-entry',
  };
  for (const [link, route] of Object.entries(expected)) {
    assert.equal(mapApiLinkToRoute(link), route, link);
  }
});

test('other legacy names that have a page under a new name are mapped to it', () => {
  assert.equal(mapApiLinkToRoute('hostel_report.index'), '/hostel/hostel-report');
  assert.equal(mapApiLinkToRoute('online_fees.index'), '/fees/online-fees-settings');
  assert.equal(mapApiLinkToRoute('add_fields.index'), '/general/fields_configuration');
});

test('a link that can only 404 is kept out of the sidebar', () => {
  // Legacy Blade-only screens and AI containers: no Next.js page exists for any of these.
  for (const link of ['leave.report', 'payroll_type.index', 'ai_agents.fees', 'ai_admin.agents', 'platform_services.workflow', 'my-leave', 'ai_agents', 'student_change_request_type.index', 'lmsCommunication.index']) {
    assert.equal(isVisibleMenuLink(link), false, link);
  }
});

test('links to real V1 screens stay in the sidebar', () => {
  for (const link of ['/exam/marks-entry', '/result/report-card', 'hostel_report.index', 'students/search_student', 'fees/collect', 'chapter_master.index']) {
    assert.equal(isVisibleMenuLink(link), true, link);
  }
});
