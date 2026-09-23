import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildMenuTree, type ApiMenuItem } from '@/app/data/menuMappers';
import {
  INTELLIGENCE_MODULES,
  intelligenceHrefFor,
} from '@/components/intelligence/module/registry';

/**
 * Can a person actually REACH each Intelligence screen?
 *
 * ── THE FAILURE THIS GUARDS ─────────────────────────────────────────────────
 *
 * `app/data/menuMappers.ts` used to keep its own table of `{key, route, match}`
 * triples, separate from the registry. It had already drifted: Fees — the
 * reference implementation, and the only module with the full ladder — was
 * missing from it, so the one complete Intelligence screen in the product was
 * the one you could only open by typing its URL.
 *
 * Nothing about that was visible from either file on its own, which is why
 * these assertions cross the two.
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

/**
 * Does a page exist at this href — literally, or behind a Next.js dynamic
 * segment (`[module]`, `[id]`, …)?
 *
 * Five People & Competency modules (organization, task-management, talent,
 * capability, lms-activity) have no own per-module folder: they are served
 * entirely by `app/modules/[module]/intelligence/page.tsx`, resolved at
 * request time from `fees_menu_categories`. A literal `existsSync` on their
 * href's exact path segments would report a 404 that does not exist — this
 * walks the same path `existsSync` would, but accepts a `[...]` directory as
 * a match for any literal segment, the way the Next.js router itself does.
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

/** Every href in a built menu tree, at any depth. */
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

/* ------------------------------------------------------------- the routes */

test('every routed Intelligence module has a page at the href the registry gives', () => {
  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned') continue;

    const href = intelligenceHrefFor(entry);
    assert.ok(href.startsWith('/'), `${entry.key}: href must be absolute, got ${href}`);

    // The route is a filesystem path under app/. A registry entry pointing at a
    // directory that does not exist (literally, or behind a Next.js dynamic
    // segment) is a menu item that 404s.
    assert.ok(
      pageExistsForHref(href),
      `${entry.key}: the registry points at ${href} but no literal or dynamic-segment page resolves it`,
    );
  }
});

test('no two modules claim the same Intelligence href', () => {
  const seen = new Map<string, string>();

  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned') continue;

    const href = intelligenceHrefFor(entry).toLowerCase();
    const owner = seen.get(href);
    assert.equal(owner, undefined, `${entry.key} and ${owner} both claim ${href}`);
    seen.set(href, entry.key);
  }
});

/* ---------------------------------------------------------- the menu tree */

test('a module that appears in the LMS menu gets an Intelligence item beneath it', () => {
  // One level-1 module with one level-2 entry per registered module, labelled
  // the way a school's own menu would label it.
  const labels: Record<string, string> = {
    fees: 'Fees',
    result: 'Result',
    attendance: 'Attendance',
    student: 'Students',
    academic: 'Academic Setup',
    admissions: 'Admissions',
    library: 'Library',
    hostel: 'Hostel',
    transportation: 'Transportation',
    hr: 'User Master',
    communication: 'Easy Com',
    homework: 'Homework',
    inventory: 'Inventory',
    visitor: 'Visitor Management',
    correspondence: 'Inward Outward',
    // tblmenumaster 269, level 2 under "LMS + PAL" — the curriculum content
    // catalogue. Its own two routes resolve it as well, but the label alone
    // must, because this fixture builds no level-3 rows.
    'teach-learn': 'Teach/Learn',

    // People & Competency (tblmenumaster 350) — verified against live
    // tblmenumaster/fees_menu_categories rows before these matchers were
    // written (590, 551, 563, 598, 628).
    organization: 'Organization Management',
    talent: 'Talent Management',
    capability: 'Capability Intelligence',
    // LMS (628) is a different row from Teach/Learn's parent "LMS + PAL"
    // (230); the label alone must resolve it, because its own children
    // resolve to route-name identifiers rather than real paths.
    'lms-activity': 'LMS',
  };

  // task-management is deliberately NOT label-matched (an unrelated legacy
  // module, tblmenumaster 253, shares the exact same label "Task
  // Management"), so it needs a real level-3 href fixture instead of relying
  // on the label alone, unlike every other module in this test.
  const level3Fixtures: Record<string, string> = {
    'task-management': '/task-management/dashboard',
  };

  for (const entry of INTELLIGENCE_MODULES) {
    if (entry.status === 'planned' || typeof entry.nav !== 'function') continue;

    const label = labels[entry.key] ?? entry.label;
    const level1 = [menuRow({ id: 1, name: 'Modules', link: 'dashboard' })];
    const level2 = { '1': [menuRow({ id: 2, parent_menu_id: 1, level: 2, name: label, link: label.toLowerCase() })] };

    const level3Href = level3Fixtures[entry.key];
    const level3 = level3Href
      ? { '2': [menuRow({ id: 3, parent_menu_id: 2, level: 3, name: label, link: level3Href })] }
      : undefined;

    if (!labels[entry.key] && !level3Href) {
      assert.fail(`No menu label or level-3 href fixture for registered module "${entry.key}" — add one`);
    }

    const tree = buildMenuTree(level1, level2, level3);
    const hrefs = allHrefs(tree).map((h) => h.toLowerCase());

    assert.ok(
      hrefs.includes(intelligenceHrefFor(entry).toLowerCase()),
      `"${label}" in the menu produced no Intelligence item for ${entry.key}. Hrefs: ${hrefs.join(', ')}`,
    );
  }
});

test('Fees — the reference implementation — is reachable from the menu', () => {
  // Called out on its own because this is the case that was broken: every other
  // module had an entry in the old hardcoded table and Fees did not.
  const level1 = [menuRow({ id: 1, name: 'Modules', link: 'dashboard' })];
  const level2 = { '1': [menuRow({ id: 2, parent_menu_id: 1, level: 2, name: 'Fees', link: 'fees' })] };

  const hrefs = allHrefs(buildMenuTree(level1, level2, undefined));

  assert.ok(hrefs.includes('/fees/intelligence'), `Fees Intelligence is not in the menu. Hrefs: ${hrefs.join(', ')}`);
});

test('a module with no Intelligence gets no Intelligence item', () => {
  const level1 = [menuRow({ id: 1, name: 'Modules', link: 'dashboard' })];
  const level2 = {
    '1': [menuRow({ id: 2, parent_menu_id: 1, level: 2, name: 'Payroll Register', link: 'payroll_register' })],
  };

  const hrefs = allHrefs(buildMenuTree(level1, level2, undefined));

  assert.ok(
    !hrefs.some((h) => h.endsWith('/intelligence')),
    `An unrelated module was given an Intelligence item. Hrefs: ${hrefs.join(', ')}`,
  );
});

test('an Intelligence item is not added twice when the menu already has one', () => {
  const level1 = [menuRow({ id: 1, name: 'Modules', link: 'dashboard' })];
  const level2 = { '1': [menuRow({ id: 2, parent_menu_id: 1, level: 2, name: 'Fees', link: 'fees' })] };
  const level3 = {
    '2': [menuRow({ id: 3, parent_menu_id: 2, level: 3, name: 'Intelligence', link: '/fees/intelligence' })],
  };

  const hrefs = allHrefs(buildMenuTree(level1, level2, level3));
  const intelligenceItems = hrefs.filter((h) => h.toLowerCase().endsWith('/intelligence'));

  assert.equal(
    intelligenceItems.length,
    1,
    `Expected exactly one Intelligence item, got ${intelligenceItems.length}: ${intelligenceItems.join(', ')}`,
  );
});
