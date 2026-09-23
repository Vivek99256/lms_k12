import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildMenuTree, type ApiMenuItem } from '@/app/data/menuMappers';
import {
  categoryHref,
  moduleCategoryItems,
  moduleSlugFromPathname,
} from '@/app/modules/_lib/module-routes';
import type { ModuleCategoriesResponse } from '@/app/modules/_lib/module-menu-categories-api';
import {
  canonicalIntelligenceRoute,
  findIntelligenceModule,
  INTELLIGENCE_MODULES,
  intelligenceHrefFor,
  moduleIntelligenceRoute,
  resolveIntelligenceModuleForMenu,
} from '@/components/intelligence/module/registry';

/**
 * The canonical module namespace: `/modules/<module-slug>/…`.
 *
 * ── WHAT THIS GUARDS ────────────────────────────────────────────────────────
 *
 * `fees_menu_categories` holds a category bar for 64 modules, each row naming
 * its own `/modules/<slug>/<category>` route and the level-2 `tblmenumaster`
 * row the module is. Only Fees and Teach/Learn could read it, so every other
 * module's Intelligence was reachable only by typing a legacy folder URL.
 *
 * Three things have to stay true for that not to recur, and none of them is
 * visible from one file alone:
 *
 *  1. A module's Intelligence item points at the canonical route when its slug
 *     is known, and still points somewhere that renders when it is not.
 *  2. The category bar and the sidebar item agree — one route per module.
 *  3. Every route either file exists.
 */

const APP_DIR = path.join(process.cwd(), 'app');

/** A minimal `tblmenumaster` row. The real table has thirty columns nothing here reads. */
function menuRow(overrides: Partial<ApiMenuItem> & { id: number }): ApiMenuItem {
  return {
    name: '',
    menu_title: null,
    menu_sortorder: null,
    description: '',
    parent_menu_id: 0,
    level: 1,
    status: 1,
    sort_order: 1,
    link: null,
    icon: null,
    sub_institute_id: '1',
    client_id: '1',
    created_at: '',
    updated_at: '',
    menu_type: null,
    database_table: null,
    site_map_name: '',
    youtube_link: null,
    pdf_link: null,
    menu_path: '',
    quick_menu: null,
    dashboard_menu: null,
    text: null,
    ...overrides,
  };
}

/** One level-1 container holding one level-2 module, the shape a school's menu has. */
function oneModuleMenu(label: string, link = label.toLowerCase()) {
  return {
    level1: [menuRow({ id: 1, name: 'Modules', link: 'dashboard' })],
    level2: { '1': [menuRow({ id: 2, parent_menu_id: 1, level: 2, name: label, link })] },
  };
}

function allHrefs(tree: ReturnType<typeof buildMenuTree>): string[] {
  const hrefs: string[] = [];
  for (const item of tree) {
    if (item.href) hrefs.push(item.href);
    for (const sub of item.submenus ?? []) {
      if (sub.href) hrefs.push(sub.href);
      for (const third of sub.submenus ?? []) {
        if (third.href) hrefs.push(third.href);
      }
    }
  }
  return hrefs;
}

/* -------------------------------------------------------------- the routes */

test('the canonical Intelligence route is /modules/<slug>/intelligence', () => {
  assert.equal(moduleIntelligenceRoute('student'), '/modules/student/intelligence');
  assert.equal(moduleIntelligenceRoute('mobile-apps'), '/modules/mobile-apps/intelligence');
  // The slug is a database value; teach_learn's really does carry an underscore.
  assert.equal(moduleIntelligenceRoute('teach_learn'), '/modules/teach_learn/intelligence');
});

test('both canonical module routes have a page', () => {
  for (const route of ['modules/[module]/intelligence', 'modules/[module]/[category]']) {
    const page = path.join(APP_DIR, route, 'page.tsx');
    assert.ok(existsSync(page), `${route} has no page.tsx — its URLs would 404`);
  }
});

/**
 * Does a page exist at this href — literally, or behind a Next.js dynamic
 * segment (`[module]`, `[id]`, …)?
 *
 * The five People & Competency modules added after this test was written
 * (organization, task-management, talent, capability, lms-activity) have no
 * own per-module folder — they were born under, and only ever served by,
 * `app/modules/[module]/intelligence/page.tsx`. A literal `existsSync` on
 * their href's exact path segments reports a 404 that is not real.
 */
function pageExistsForHref(href: string, dir = APP_DIR, segments = href.replace(/^\//, '').split('/').filter(Boolean)): boolean {
  if (segments.length === 0) return existsSync(path.join(dir, 'page.tsx'));

  const [segment, ...rest] = segments;

  const literal = path.join(dir, segment);
  if (existsSync(literal) && pageExistsForHref(href, literal, rest)) return true;

  // A directory can hold more than one dynamic segment (`app/modules/` has
  // both `[module]` and `[moduleKey]`) — every candidate is tried, not just
  // the first found, since picking the wrong one silently resolves to a
  // sibling route that does not actually serve this href.
  const entries = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\[.+\]$/.test(entry.name)) continue;
    if (pageExistsForHref(href, path.join(dir, entry.name), rest)) return true;
  }

  return false;
}

test('the legacy per-module Intelligence routes still render', () => {
  // They are no longer navigated to, but links already shared must keep working.
  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned') continue;
    assert.ok(
      pageExistsForHref(intelligenceHrefFor(entry)),
      `${entry.key}: the legacy route ${intelligenceHrefFor(entry)} no longer has a page`,
    );
  }
});

/* ------------------------------------------------------------ the menu tree */

test('a module whose slug is known gets the canonical Intelligence route', () => {
  const { level1, level2 } = oneModuleMenu('Student');
  // level-2 menu id 2 in this fixture; 259 in the real tblmenumaster.
  const tree = buildMenuTree(level1, level2, undefined, new Map([[2, 'student']]));

  const hrefs = allHrefs(tree).map((h) => h.toLowerCase());
  assert.ok(
    hrefs.includes('/modules/student/intelligence'),
    `Student produced no canonical Intelligence item. Hrefs: ${hrefs.join(', ')}`,
  );
  assert.ok(
    !hrefs.includes('/students/intelligence'),
    `Student still points at the legacy route as well. Hrefs: ${hrefs.join(', ')}`,
  );
});

test('a module whose slug is unknown keeps a working Intelligence item', () => {
  // The directory feed being unavailable must cost the canonical URL, never the
  // menu item: the legacy route renders the same screen.
  const { level1, level2 } = oneModuleMenu('Student');
  const hrefs = allHrefs(buildMenuTree(level1, level2, undefined, new Map())).map((h) => h.toLowerCase());

  assert.ok(
    hrefs.includes('/students/intelligence'),
    `Student lost its Intelligence item when no slug was known. Hrefs: ${hrefs.join(', ')}`,
  );
});

test('exactly one Intelligence item per module, whichever route it uses', () => {
  const { level1, level2 } = oneModuleMenu('Fees');
  for (const slugs of [new Map([[2, 'fees']]), new Map<number, string>()]) {
    const intelligence = allHrefs(buildMenuTree(level1, level2, undefined, slugs)).filter((h) =>
      h.toLowerCase().endsWith('/intelligence'),
    );
    assert.equal(intelligence.length, 1, `Expected one Intelligence item, got: ${intelligence.join(', ')}`);
  }
});

/* ------------------------------------------- linking in from outside the menu */

test('a declared module slug is the one thing a launcher outside the menu needs', () => {
  // A hub page has no tblmenumaster row to look a slug up by, and the registry
  // key is not the slug: the Result module has no level-2 row called "Result".
  const result = findIntelligenceModule('result');
  assert.ok(result, 'the result module left the registry');
  assert.equal(result.moduleSlug, 'exam', 'Result Intelligence is reached under the Exam module');
  assert.equal(canonicalIntelligenceRoute(result), '/modules/exam/intelligence');
});

test('a module that declares no slug still links somewhere that renders', () => {
  // Falling back to the legacy route is the point: it is the same screen, so a
  // launcher never has to guess a slug to stay working.
  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned' || entry.moduleSlug) continue;
    assert.equal(
      canonicalIntelligenceRoute(entry),
      intelligenceHrefFor(entry),
      `${entry.key} declares no slug but does not fall back to its legacy route`,
    );
  }
});

test('no two modules are canonicalised onto the same route', () => {
  const seen = new Map<string, string>();
  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned') continue;
    const route = canonicalIntelligenceRoute(entry).toLowerCase();
    assert.equal(seen.get(route), undefined, `${entry.key} and ${seen.get(route)} both claim ${route}`);
    seen.set(route, entry.key);
  }
});

test('PAL is outside the module Intelligence system, by decision', () => {
  // Not an oversight and not a backlog item. `/pal/intelligence` is a
  // per-learner PAL V4 workspace opened from `/pal`; no tblmenumaster row
  // points at it, so there is no owning module to canonicalise it under. The
  // registry entry carries the measured reasons.
  const pal = findIntelligenceModule('pal');
  assert.ok(pal, 'the pal module left the registry');
  assert.equal(pal.moduleSlug, undefined, 'PAL must not claim a module slug it has no menu row for');
  assert.equal(pal.nav, undefined, 'PAL must not be attached to the LMS menu as module Intelligence');
  assert.equal(pal.loadContract, undefined, 'PAL has no module Intelligence contract');
  // The legacy screen still renders — it is how a teacher reaches PAL V4.
  assert.equal(canonicalIntelligenceRoute(pal), '/pal/intelligence');
});

/* --------------------------------------------------------- the module match */

test('the registry matcher and the sidebar agree about which module is which', () => {
  // The matcher is the one the menu tree uses AND the one
  // /modules/<slug>/intelligence uses. If the two ever diverge, a module's tab
  // and its route open different screens.
  assert.equal(resolveIntelligenceModuleForMenu('Fees', 'fees', [])?.key, 'fees');
  assert.equal(resolveIntelligenceModuleForMenu('Student', 'student', [])?.key, 'student');
  assert.equal(resolveIntelligenceModuleForMenu('Transport', 'transport', [])?.key, 'transportation');
  assert.equal(resolveIntelligenceModuleForMenu('Payroll Register', 'payroll_register', []), undefined);
});

test('the matcher is case- and spacing-insensitive, because tenant labels are', () => {
  assert.equal(resolveIntelligenceModuleForMenu('  ACADEMIC   SETUP ', '', [])?.key, 'academic');
});

test('a module is not claimed because one of its screens has "library" in its name', () => {
  // Found by running the matcher over all 64 configured modules: Capability
  // Intelligence and Organization Management were both being handed LIBRARY
  // Intelligence, because their own screens are called competency-library and
  // compliance-library. A menu item that opens another module's screen.
  //
  // Both modules have since been given their own real Intelligence contracts
  // (they are genuine level-2 modules under People & Competency, verified
  // against live tblmenumaster rows 598 and 590) — so the assertion that
  // matters now is that they resolve to THEMSELVES, never to Library.
  assert.equal(
    resolveIntelligenceModuleForMenu('Capability Intelligence', 'javascript:void(0);', [
      '/capability-intelligence/competency-library',
      '/capability-intelligence/capability-explorer',
    ])?.key,
    'capability',
  );
  assert.equal(
    resolveIntelligenceModuleForMenu('Organization Management', 'javascript:void(0);', [
      '/organization-management/compliance-library',
      '/organization-management/disciplinary-library',
    ])?.key,
    'organization',
  );

  // The real Library module, by label and by its own route family.
  assert.equal(resolveIntelligenceModuleForMenu('Books', 'javascript:void(0);', ['/library/book_resources'])?.key, 'library');
  assert.equal(resolveIntelligenceModuleForMenu('Library Report', 'javascript:void(0);', [])?.key, 'library');
  assert.equal(resolveIntelligenceModuleForMenu('Anything', '', ['/library/quick_return'])?.key, 'library');
});

test('the five new People & Competency modules resolve by their own label and route family, and HRIT Management still reaches HR', () => {
  assert.equal(
    resolveIntelligenceModuleForMenu('Organization Management', 'javascript:void(0);', [
      '/organization-management/employee-directory',
    ])?.key,
    'organization',
  );
  // A different, unrelated menu row sharing the same label must NOT be
  // claimed — only the real route family is trusted for this one.
  assert.equal(resolveIntelligenceModuleForMenu('Task Management', 'javascript:void(0);', ['/some-other-legacy-path'])?.key, undefined);
  assert.equal(
    resolveIntelligenceModuleForMenu('Task Management', 'javascript:void(0);', [
      '/task-management/dashboard',
      '/task-management/my-tasks',
    ])?.key,
    'task-management',
  );
  assert.equal(
    resolveIntelligenceModuleForMenu('Talent Management', 'javascript:void(0);', [
      '/talent-management/talent-dashboard',
    ])?.key,
    'talent',
  );
  assert.equal(
    resolveIntelligenceModuleForMenu('Capability Intelligence', 'javascript:void(0);', [
      '/capability-intelligence/dashboard',
    ])?.key,
    'capability',
  );
  // LMS (tblmenumaster 628, under People & Competency) is a different row
  // from Teach/Learn (269, under the unrelated "LMS + PAL"), and its own
  // children resolve to route-name identifiers rather than real paths, so
  // only the label is trusted here.
  assert.equal(resolveIntelligenceModuleForMenu('LMS', 'javascript:void(0);', [])?.key, 'lms-activity');
  assert.equal(resolveIntelligenceModuleForMenu('Teach/Learn', 'javascript:void(0);', ['/course-master'])?.key, 'teach-learn');

  // HRIT Management (535) is still fully owned by `hr`, unchanged — there is
  // no separate "Attendance Management" registry entry to contest it with.
  assert.equal(
    resolveIntelligenceModuleForMenu('HRIT Management', 'javascript:void(0);', [
      '/hrit/attendance-management/attendance-tracking',
      '/hrit/leave/leave-dashboard',
    ])?.key,
    'hr',
  );
});

test('the six staff modules all reach HR, and none of them reaches a pupil screen', () => {
  // Found by running the matcher over all 64 configured modules against the
  // live tblmenumaster rows. FOUR of these reached nothing at all, and TWO
  // reached the wrong screen — which is worse, because nothing about a module
  // showing another module's data looks broken.
  //
  // The labels, links and routes below are the real ones, copied from the
  // rows the menu actually serves.
  const staff: Array<[string, string, string[]]> = [
    ['Leave', 'javascript:void(0);', ['/leave-apply.index', '/leave-authorisation.index', '/my-leave']],
    ['User Attendance', 'javascript:void(0);', ['/hrms_attendance.index', '/hrms_inout_time.index']],
    ['Payroll', 'javascript:void(0);', ['/payroll_type.index', '/employee_salary_structure.index']],
    ['HRMS Report', 'javascript:void(0);', ['/hrms_attendance_report.index', '/leave_encashment.index']],
    ['HRIT Management', 'javascript:void(0);', ['/hrit/attendance-management/attendance-tracking', '/hrit/payroll-management/form-16']],
    ['User I-card', 'javascript:void(0);', ['/student/user_icard']],
  ];

  for (const [label, link, hrefs] of staff) {
    assert.equal(
      resolveIntelligenceModuleForMenu(label, link, hrefs)?.key,
      'hr',
      `"${label}" should open HR Intelligence`,
    );
  }
});

test('a staff module is not claimed because its route contains "attendance" or lives under /student', () => {
  // The two specific defects, pinned at the end that caused them. HRIT's route
  // contains "/attendance" and the staff ID card lives at /student/user_icard,
  // so both were matched by predicates meant for the pupil modules.
  assert.notEqual(
    resolveIntelligenceModuleForMenu('HRIT Management', 'javascript:void(0);', [
      '/hrit/attendance-management/attendance-tracking',
    ])?.key,
    'attendance',
    'a staff leave-and-payroll workspace must not open the children’s attendance register',
  );
  assert.notEqual(
    resolveIntelligenceModuleForMenu('User I-card', 'javascript:void(0);', ['/student/user_icard'])?.key,
    'student',
    'the staff ID-card module must not open the pupil roll',
  );

  // And the pupil modules they were being confused with still work.
  assert.equal(
    resolveIntelligenceModuleForMenu('Attendance', 'javascript:void(0);', ['/attendance/student_attendance'])?.key,
    'attendance',
  );
  assert.equal(
    resolveIntelligenceModuleForMenu('Student I-card', 'javascript:void(0);', ['/student/student_icard'])?.key,
    'student',
  );
});

test('the student-record modules share one Student Intelligence rather than six copies', () => {
  // Student, Mobile Apps, Student I-card, Certificate, Student Medical and
  // Student Request are separate level-2 menu modules describing the SAME
  // children, so they resolve to one contract. Six duplicates would be six
  // things to keep in agreement. Real routes, from the live menu rows.
  const studentFamily: Array<[string, string[]]> = [
    ['Student', ['/student/student_master']],
    ['Mobile Apps', ['/students/leave/']],
    ['Student I-card', ['/student/student_icard']],
    ['Certificate', ['/student/student_certificate']],
    ['Student Medical', ['/student/student_infirmary', '/student/student_vaccination']],
    ['Student Request', ['/students/requests/']],
  ];

  for (const [label, hrefs] of studentFamily) {
    assert.equal(
      resolveIntelligenceModuleForMenu(label, 'javascript:void(0);', hrefs)?.key,
      'student',
      `"${label}" should share Student Intelligence`,
    );
  }
});

test('the two modules added in this pass are reachable from their own menu rows', () => {
  assert.equal(
    resolveIntelligenceModuleForMenu('Visitor Management', 'javascript:void(0);', [
      '/admin-services/add-visitor',
    ])?.key,
    'visitor',
  );

  // The register and its reports module are the same records read two ways.
  assert.equal(
    resolveIntelligenceModuleForMenu('Inward Outward', 'javascript:void(0);', [
      '/inward_outward/add_inward',
      '/inward_outward/add_outward',
    ])?.key,
    'correspondence',
  );
  assert.equal(
    resolveIntelligenceModuleForMenu('Inward Outward Report', 'javascript:void(0);', [
      '/inward_outward/show_inward_report',
    ])?.key,
    'correspondence',
  );

  // The gate register is not the hostel's visitor book.
  assert.notEqual(
    resolveIntelligenceModuleForMenu('Hostel', 'javascript:void(0);', ['/hostel/hostel_visitor_master'])?.key,
    'visitor',
  );
});

/* --------------------------------------------------------- the category bar */

function response(moduleName: string, categories: Array<{ key: string; route: string }>): ModuleCategoriesResponse {
  return {
    modules: [],
    module: { moduleName, level2MenuId: 1, label: moduleName, link: '' },
    categories: categories.map((category) => ({
      key: category.key,
      label: category.key,
      description: '',
      route: category.route,
      items: [],
    })),
  };
}

test('the category bar opens each category where its row says, except Intelligence', () => {
  const items = moduleCategoryItems(
    response('student', [
      { key: 'operations', route: '/modules/student/operations' },
      { key: 'intelligence', route: '/modules/student/intelligence' },
    ]),
  );

  assert.deepEqual(
    items.map((item) => item.href),
    ['/modules/student/operations', '/modules/student/intelligence'],
  );
});

test("Fees' own screens stay at their own routes while its Intelligence is canonicalised", () => {
  // The one case where the configured route and the canonical route differ.
  // Rewriting the others would send a bursar to a page that does not exist.
  const items = moduleCategoryItems(
    response('fees', [
      { key: 'master-setup', route: '/fees/master-setup' },
      { key: 'workflow', route: '/fees/workflow' },
      { key: 'intelligence', route: '/fees/intelligence' },
    ]),
  );

  assert.deepEqual(
    items.map((item) => item.href),
    ['/fees/master-setup', '/fees/workflow', '/modules/fees/intelligence'],
  );
});

test('a category with no configured route still resolves inside its module', () => {
  assert.equal(categoryHref('hostel', 'reports', ''), '/modules/hostel/reports');
});

test('a response naming no module produces no navigation', () => {
  const empty = response('student', [{ key: 'reports', route: '/modules/student/reports' }]);
  assert.deepEqual(moduleCategoryItems({ ...empty, module: null }), []);
});

/* ------------------------------------------------------------- the pathname */

test('the module slug is read from the path, not guessed', () => {
  assert.equal(moduleSlugFromPathname('/modules/student/reports'), 'student');
  assert.equal(moduleSlugFromPathname('/modules/mobile-apps/intelligence?tab=2'), 'mobile-apps');
  assert.equal(moduleSlugFromPathname('/modules/student/'), 'student');
  assert.equal(moduleSlugFromPathname('/modules'), '');
  assert.equal(moduleSlugFromPathname('/students/intelligence'), '');
  assert.equal(moduleSlugFromPathname(''), '');
  assert.equal(moduleSlugFromPathname(null), '');
});
