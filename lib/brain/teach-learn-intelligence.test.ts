import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  canonicalIntelligenceRoute,
  findIntelligenceModule,
  INTELLIGENCE_MODULES,
  resolveIntelligenceModuleForMenu,
} from '@/components/intelligence/module/registry';

/**
 * Teach/Learn resolves to its own Intelligence, and to nothing else's.
 *
 * ── WHAT WAS ACTUALLY WRONG ─────────────────────────────────────────────────
 *
 * Teach/Learn showed no Intelligence for TWO independent reasons, and fixing
 * either alone would have left the screen empty:
 *
 *  1. It matched no registry entry. Its label is "Teach/Learn", its legacy link
 *     is `javascript:void(0);`, and its two live level-3 routes —
 *     `/lms/global-mapping` and `/course-master` — contain no word any other
 *     module's matcher looks for. `resolveIntelligenceModuleForMenu` returned
 *     undefined, so the category bar had no Intelligence to offer.
 *
 *  2. `module-intelligence-screen.tsx` short-circuited it anyway.
 *     `BESPOKE_INTELLIGENCE_SCREENS` mapped `teach_learn` straight to
 *     `/app/teach-learn/intelligence/page` — one of its ten category pages,
 *     holding a tab bar over whatever level-3 menus a tenant had filed under
 *     "Intelligence", which for Teach/Learn is none. That map is consulted
 *     BEFORE the registry, so the matcher never ran for this module at all.
 *
 * Both are pinned below, because a regression in either one reproduces the
 * original symptom exactly.
 *
 * ── THE MENU ROW THESE TESTS USE IS THE REAL ONE ────────────────────────────
 *
 * `tblmenumaster` 269, level 2, parent 230 ("LMS + PAL"), label "Teach/Learn",
 * link `javascript:void(0);`. Its `status = 1` children are 275 "LMS Global
 * Mapping" (`lmsmapping.index`) and 270 "Course Catalog" (`course-master/`),
 * which `mapApiLinkToRoute` resolves to `/lms/global-mapping` and
 * `/course-master`. 488 H5P content and 462 Content Library are `status = 0`
 * and never reach the tree.
 */

const APP_DIR = path.join(process.cwd(), 'app');

/** Teach/Learn exactly as `buildMenuTree` hands it to the matcher. */
const TEACH_LEARN_MENU = {
  label: 'teach/learn',
  link: 'javascript:void(0);',
  hrefs: ['/lms/global-mapping', '/course-master'],
};

function resolve(menu: { label: string; link: string; hrefs: string[] }) {
  return resolveIntelligenceModuleForMenu(menu.label, menu.link, menu.hrefs);
}

/* ------------------------------------------------- the domain it resolves to */

test('Teach/Learn resolves to Teach/Learn Intelligence', () => {
  const resolved = resolve(TEACH_LEARN_MENU);

  assert.ok(resolved, 'Teach/Learn matched no Intelligence module — the original bug.');
  assert.equal(resolved.key, 'teach-learn');
});

test('Teach/Learn does not resolve to another module’s Intelligence', () => {
  // Every one of these was a plausible guess from the label alone, and every
  // one would have shown a Teach/Learn reader another module's data — the
  // failure mode that put HRIT under Attendance and User I-card under Student.
  const resolved = resolve(TEACH_LEARN_MENU);

  for (const wrong of ['homework', 'academic', 'pal', 'result', 'library', 'student']) {
    assert.notEqual(
      resolved?.key,
      wrong,
      `Teach/Learn resolved to ${wrong} Intelligence. It is the curriculum content catalogue ` +
        '(sub_std_map + content_master), which no other contract reads.',
    );
  }
});

test('the module carries a contract, a slug and the ladder it claims', () => {
  const entry = findIntelligenceModule('teach-learn');

  assert.ok(entry, 'teach-learn is not registered.');
  assert.equal(typeof entry.loadContract, 'function', 'A registered module with no contract renders nothing.');
  // The slug is the database value in fees_menu_categories.module_name, and it
  // really does carry an underscore while the registry key carries a hyphen.
  assert.equal(entry.moduleSlug, 'teach_learn');
  assert.equal(canonicalIntelligenceRoute(entry), '/modules/teach_learn/intelligence');

  // `partial`, not `live`: one institute in this database publishes content at
  // a scale a rate can describe. Promoting it would overstate that.
  assert.equal(entry.status, 'partial');
  assert.equal(entry.ladder, 'L5');
});

/* ---------------------------------------------- it steals nothing, loses none */

test('Teach/Learn’s matcher does not claim another module', () => {
  // Each of these is a real level-2 module whose own matcher must keep winning.
  const others: Array<{ name: string; menu: { label: string; link: string; hrefs: string[] }; expect: string }> = [
    {
      name: 'Homework',
      menu: { label: 'homework', link: 'homework.index', hrefs: ['/lms/homework'] },
      expect: 'homework',
    },
    {
      name: 'Curriculum Planning',
      menu: { label: 'curriculum planning', link: 'javascript:void(0);', hrefs: ['/academic_setup/timetable'] },
      expect: 'academic',
    },
    {
      name: 'Books',
      menu: { label: 'books', link: 'book.index', hrefs: ['/library/book_resources'] },
      expect: 'library',
    },
    {
      name: 'Fees',
      menu: { label: 'fees', link: 'fees.index', hrefs: ['/fees/collect'] },
      expect: 'fees',
    },
  ];

  for (const { name, menu, expect } of others) {
    assert.equal(resolve(menu)?.key, expect, `${name} no longer resolves to ${expect} Intelligence.`);
  }
});

test('a disabled course_master menu under another parent is not claimed', () => {
  // `tblmenumaster` 456 "Course Content" (`course_master.index`, status 0) sits
  // under a different parent. The matcher checks `/course-master` as a ROUTE
  // PREFIX rather than as a substring precisely so this cannot be claimed if
  // somebody enables it.
  const resolved = resolve({
    label: 'course content',
    link: 'course_master.index',
    hrefs: ['/course_master.index'],
  });

  assert.notEqual(
    resolved?.key,
    'teach-learn',
    'An unrelated course_master menu was claimed by Teach/Learn’s matcher.',
  );
});

test('each of Teach/Learn’s two real screens resolves it on its own', () => {
  // A tenant that has switched one of the two screens off must still get
  // Intelligence from the other.
  for (const href of ['/lms/global-mapping', '/course-master']) {
    assert.equal(
      resolveIntelligenceModuleForMenu('some renamed module', 'javascript:void(0);', [href])?.key,
      'teach-learn',
      `${href} alone no longer resolves Teach/Learn.`,
    );
  }
});

test('a school that renamed the module still gets Intelligence from its routes', () => {
  // tblmenumaster labels are whatever a school called the module, which is the
  // reason the matcher is a predicate over routes as well as the label.
  assert.equal(
    resolveIntelligenceModuleForMenu('courses & content', 'javascript:void(0);', ['/course-master'])?.key,
    'teach-learn',
  );
});

/* --------------------------------------------------------------- the routes */

test('the registry is still internally consistent after the addition', () => {
  const keys = INTELLIGENCE_MODULES.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, 'Duplicate registry keys.');

  const slugs = INTELLIGENCE_MODULES.map((m) => m.moduleSlug).filter(Boolean);
  assert.equal(new Set(slugs).size, slugs.length, 'Two modules claim the same module slug.');
});

/* ------------------------------------------- the bespoke override is removed */

test('Teach/Learn is no longer short-circuited past the registry', () => {
  // The second half of the bug. While `teach_learn` sat in
  // BESPOKE_INTELLIGENCE_SCREENS, the canonical route rendered the empty
  // category page and the matcher above never ran — so a contract alone would
  // not have reached the screen.
  const source = readFileSync(
    path.join(APP_DIR, 'modules', '_components', 'module-intelligence-screen.tsx'),
    'utf8',
  );

  const map = source.slice(
    source.indexOf('const BESPOKE_INTELLIGENCE_SCREENS'),
    source.indexOf('type LoadState'),
  );

  assert.ok(map.length > 0, 'BESPOKE_INTELLIGENCE_SCREENS could not be located.');
  assert.ok(
    !/\bteach_learn\s*:/.test(map),
    'teach_learn is back in BESPOKE_INTELLIGENCE_SCREENS, which bypasses the registry and renders the ' +
      'category page with no intelligence in it.',
  );
  // Fees is the one genuine bespoke screen and must stay.
  assert.ok(/\bfees\s*:/.test(map), 'Fees was removed from BESPOKE_INTELLIGENCE_SCREENS.');
});

/* ------------------------------------------------------------- the contract */

test('the contract is honest about what it cannot show', async () => {
  const entry = findIntelligenceModule('teach-learn');
  const contract = await entry!.loadContract!();

  assert.equal(contract.key, 'teach-learn');
  assert.equal(contract.label, 'Teach/Learn Intelligence');

  // The empty state must explain the real reason rather than assert a failure.
  // A school with 782 courses and no content is not a school with an empty
  // curriculum, and the fallback text is what a reader sees when the backend
  // supplies no reason of its own.
  assert.ok(contract.emptyState.fallbackReason.length > 0);
  assert.ok(
    /not (used|published)|has not published/i.test(contract.emptyState.fallbackReason),
    'The empty state must name what did not happen, not imply the curriculum is empty.',
  );

  // The grain is stated, which is what lets a reader check a figure means what
  // they assume.
  assert.ok(contract.grain.includes('course'));

  // The data-quality section must be present: a missing one reads as "no
  // problems", which is a different claim from "not checked".
  const sections = contract.sections.map((s) => s.key);
  assert.ok(sections.includes('dataQuality'));
  assert.ok(sections.includes('findings'));
  assert.ok(sections.includes('recommendations'));

  // No section is declared twice, and the summary strip stays scannable.
  assert.equal(new Set(sections).size, sections.length);
  assert.ok((contract.summaryMetrics ?? []).length <= 6);
});

test('the contract reads the Teach/Learn endpoint and no other', async () => {
  const source = readFileSync(
    path.join(process.cwd(), 'components', 'intelligence', 'module', 'contracts', 'teach-learn.ts'),
    'utf8',
  );

  assert.ok(
    source.includes("tenantPath('/teach-learn/intelligence')"),
    'The contract no longer loads from the Teach/Learn endpoint.',
  );
  assert.ok(
    source.includes("runModuleIntelligence('teach-learn')"),
    'The run action must target this module, or it recomputes another module’s signals.',
  );
});
