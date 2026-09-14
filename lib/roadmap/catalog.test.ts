import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOG_CATEGORY_PLAN,
  NAMING,
  ROADMAP_ITEMS,
  catalogCategorySummary,
  resolveCatalogCategory,
} from './index';

/**
 * The catalog rollup strip makes two claims at once — how many subjects a tier
 * has, and whether that tier is built. Both were wrong in ways only the real
 * `sub_std_map.subject_category` values expose, so the spellings used here are
 * the stored ones, not invented examples.
 */

test('an aliased spelling counts towards its canonical tier', () => {
  // Sub-institute 195 stores 11 subjects as "Soft Skill"; 341 stores 4 as
  // "My Courses". Keyed by the raw value each became a tile of its own.
  assert.equal(resolveCatalogCategory('Soft Skill'), 'Soft Skills');
  assert.equal(resolveCatalogCategory('My Courses'), 'My Course');
  assert.equal(resolveCatalogCategory('Soft Skills'), 'Soft Skills');
  assert.equal(resolveCatalogCategory('My Course'), 'My Course');
});

test('a category the plan does not mention is left alone', () => {
  // A school may add its own category at any time; it shows its live count
  // rather than being hidden or renamed.
  assert.equal(resolveCatalogCategory('Library'), 'Library');
  assert.equal(resolveCatalogCategory('Non-Academic Skill'), 'Non-Academic Skill');
});

test('a tier with real subjects is never labelled coming soon', () => {
  // Sub-institute 1's subjects are merged into every LMS tenant's catalog, so
  // these counts reach many schools. Both rows are planned `coming-soon`.
  const stem = catalogCategorySummary('STEM Resources', 36);
  assert.equal(stem.status, 'live');
  assert.equal(stem.summary, '36 active');

  const careers = catalogCategorySummary('Career Counselling', 5);
  assert.equal(careers.status, 'live');
});

test('a tier that is part built with more planned reads as in progress', () => {
  const vocational = catalogCategorySummary('Vocational Traning', 12);
  assert.equal(vocational.status, 'in-progress');
  assert.equal(vocational.summary, '12 active · 18 planned');
  assert.equal(vocational.label, 'Vocational training');
});

test('an empty tier keeps the status the registry gave it', () => {
  const future = catalogCategorySummary('Future Capabilities', 0);
  assert.equal(future.status, 'coming-soon');
  assert.equal(future.phase, 'Phase 3');
  assert.equal(future.summary, '0 active');

  const vocational = catalogCategorySummary('Vocational Traning', 0);
  assert.equal(vocational.status, 'coming-soon');
  assert.equal(vocational.summary, '0 active · 18 planned');
});

test('a live tier is unaffected by its count', () => {
  assert.equal(catalogCategorySummary('My Course', 0).status, 'live');
  assert.equal(catalogCategorySummary('My Course', 120).status, 'live');
  assert.equal(catalogCategorySummary('My Courses', 4).label, 'Mainstream');
});

test('the three tiers the build plan names by name are all on the strip', () => {
  // Row 2 of the placeholder build plan names Future Capabilities, Vocational
  // and Career Exploration. Career Exploration is stored as "Career
  // Counselling" — the strip shows the stored tier, the roadmap screen carries
  // the product name.
  for (const category of ['Future Capabilities', 'Vocational Traning', 'Career Counselling']) {
    assert.ok(
      CATALOG_CATEGORY_PLAN.some((plan) => plan.category === category),
      `${category} is missing from the catalog plan`,
    );
  }
});

test('no category or alias is claimed by two plan rows', () => {
  const keys = CATALOG_CATEGORY_PLAN.flatMap((plan) => [plan.category, ...(plan.aliases ?? [])]);
  assert.equal(new Set(keys).size, keys.length, 'two plan rows claim the same stored category');
});

test('the settled names are actually used, not just declared', () => {
  // Row 8 of the build plan is a naming decision, and a decision nothing reads
  // drifts the first time someone edits a title without knowing it existed.
  // These assert the registry embodies NAMING rather than repeating strings
  // that happen to match today.
  const byId = new Map(ROADMAP_ITEMS.map((item) => [item.id, item]));

  assert.equal(byId.get('lms.interactive-learning')?.title, NAMING.interactiveLearning);
  assert.equal(byId.get('course-catalog.future-capabilities')?.title, NAMING.futureCapabilities);
  assert.equal(
    CATALOG_CATEGORY_PLAN.find((plan) => plan.category === 'Future Capabilities')?.label,
    NAMING.futureCapabilities,
  );
});

test('the rejected names appear nowhere in the roadmap copy', () => {
  // "Interactive Content" and "Student Resources" lost; "Enrichment" survives
  // only as the per-concept activity, which no roadmap row is about. Catching a
  // rejected name here is cheaper than catching it on a customer's screen.
  const copy = ROADMAP_ITEMS.flatMap((item) => [item.title, item.blurb])
    .concat(CATALOG_CATEGORY_PLAN.map((plan) => plan.label ?? plan.category))
    .join(' | ')
    .toLowerCase();

  for (const rejected of ['interactive content', 'student resource']) {
    assert.ok(!copy.includes(rejected), `rejected name "${rejected}" is in roadmap copy`);
  }
});

test('framework keywords match words, not fragments of other words', () => {
  // The Framework tab decides which frameworks a concept touches by scanning
  // its text for keywords. A plain substring test found "sel" inside "self" and
  // "stem" inside "system" — both near-universal in teaching material — so every
  // framework claimed every concept. Measured against the 89 real semantic
  // records, CASEL and NGSS each matched 100% of them, including an English
  // chapter whose only STEM content was the word "system".
  //
  // This pins the matcher's shape. It mirrors keywordPattern() in
  // app/pal/data/pal-content-model.ts, which cannot be imported here because
  // that module reaches for next/headers at load time.
  const pattern = (keyword: string) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return keyword.length <= 4
      ? new RegExp(`\\b${escaped}\\b`, 'i')
      : new RegExp(`\\b${escaped}`, 'i');
  };

  // Acronyms must not fire inside ordinary words.
  assert.ok(!pattern('stem').test('the digestive system works'));
  assert.ok(!pattern('sel').test('a way to know yourself'));
  assert.ok(!pattern('sel').test('please select an option'));

  // ...but must still fire when genuinely present.
  assert.ok(pattern('stem').test('a STEM activity'));
  assert.ok(pattern('sel').test('SEL competencies'));
  assert.ok(pattern('ngss').test('aligned to NGSS'));

  // Longer keywords keep ordinary inflections.
  assert.ok(pattern('model').test('build models of atoms'));
  assert.ok(pattern('model').test('modelling the system'));
  assert.ok(!pattern('model').test('they will remodel it'));
  assert.ok(pattern('mathematics').test('mathematics is fun'));
});
