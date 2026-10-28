import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

import type { SectionKey } from '@/components/intelligence/module/contract';
import type { ModuleIntelligencePayload } from '@/components/intelligence/module/payload';

import {
  INTELLIGENCE_TABS,
  SECTION_HOME,
  SUMMARY_PART_KEYS,
  SUMMARY_PARTS,
  resolveIntelligenceTarget,
  summaryPartBadge,
  summaryPartsFor,
} from './module-tabs';

/**
 * The five-tab Intelligence navigation.
 *
 * Every module's Intelligence screen has exactly Summary, Recommendations, Decisions, Module
 * Integration and Cross-Module Workflow. Position, Breakdowns, Findings, Priorities, Data quality and
 * Learning moved INTO Summary - nothing was dropped. These tests pin the tab list, prove that every
 * one of the eleven sections still has a home, and check it against all 26 real module contracts.
 */

const ALL_SECTIONS: SectionKey[] = [
  'summary', 'position', 'breakdowns', 'findings', 'priorities', 'recommendations',
  'decisions', 'dataQuality', 'learning', 'integration', 'workflow',
];
const FORMER_TABS: SectionKey[] = ['position', 'breakdowns', 'findings', 'priorities', 'dataQuality', 'learning'];

test('there are exactly five tabs, in the required order, with the required names', () => {
  assert.deepEqual(
    INTELLIGENCE_TABS.map((tab) => tab.label),
    ['Summary', 'Recommendations', 'Decisions', 'Module Integration', 'Cross-Module Workflow'],
  );
  assert.deepEqual(INTELLIGENCE_TABS.map((tab) => tab.key), ['summary', 'recommendations', 'decisions', 'integration', 'workflow']);
});

test('none of the six former tabs is a tab any more', () => {
  const tabKeys = INTELLIGENCE_TABS.map((tab) => tab.key as string);
  for (const key of FORMER_TABS) assert.ok(!tabKeys.includes(key), `${key} must not be a tab`);
});

test('every section still has a home: the six former tabs are inside Summary, the other four are their own tabs', () => {
  assert.deepEqual(Object.keys(SECTION_HOME).sort(), [...ALL_SECTIONS].sort());
  for (const key of FORMER_TABS) {
    assert.equal(SECTION_HOME[key].tab, 'summary', `${key} lives in Summary`);
    assert.ok(SECTION_HOME[key].part, `${key} has a part to scroll to`);
  }
  for (const key of ['recommendations', 'decisions', 'integration', 'workflow'] as const) {
    assert.equal(SECTION_HOME[key].tab, key, `${key} keeps its own tab`);
    assert.equal(SECTION_HOME[key].part, undefined);
  }
});

test('the Summary parts are the management summary plus exactly the six former tabs, in reading order, with unique anchors', () => {
  assert.deepEqual([...SUMMARY_PART_KEYS], ['summary', 'position', 'breakdowns', 'findings', 'priorities', 'dataQuality', 'learning']);
  assert.deepEqual(SUMMARY_PARTS.map((part) => part.key), [...SUMMARY_PART_KEYS]);
  assert.equal(new Set(SUMMARY_PARTS.map((part) => part.anchorId)).size, SUMMARY_PARTS.length);
  assert.deepEqual(SUMMARY_PARTS.map((part) => part.label), [
    'Management summary', 'Current position', 'Performance breakdowns', 'Key findings', 'Priorities', 'Data quality', 'Learning',
  ]);
});

test('an old section link resolves to Summary plus the part to scroll to - never to a missing tab', () => {
  const expectations: Array<[string, string, string | null]> = [
    ['position', 'summary', 'position'],
    ['breakdowns', 'summary', 'breakdowns'],
    ['findings', 'summary', 'findings'],
    ['priorities', 'summary', 'priorities'],
    ['dataQuality', 'summary', 'dataQuality'],
    ['data-quality', 'summary', 'dataQuality'],
    ['#data_quality', 'summary', 'dataQuality'],
    ['Data quality', 'summary', 'dataQuality'],
    ['learning', 'summary', 'learning'],
    ['#intel-findings', 'summary', 'findings'],
    ['summary', 'summary', 'summary'],
    ['recommendations', 'recommendations', null],
    ['decisions', 'decisions', null],
    ['module-integration', 'integration', null],
    ['Cross-Module Workflow', 'workflow', null],
  ];
  for (const [input, tab, part] of expectations) {
    assert.deepEqual(resolveIntelligenceTarget(input), { tab, part }, input);
  }
});

test('something that is not a section name is left alone, never guessed at', () => {
  for (const input of ['', '   ', null, undefined, '#top', 'section-3', 'unknown', '#{}', 'x'.repeat(500)]) {
    assert.equal(resolveIntelligenceTarget(input), null, String(input));
  }
});

test('every target an old link can resolve to is one of the five tabs', () => {
  const tabKeys = new Set(INTELLIGENCE_TABS.map((tab) => tab.key));
  for (const key of ALL_SECTIONS) {
    const target = resolveIntelligenceTarget(key);
    assert.ok(target && tabKeys.has(target.tab), key);
  }
});

const sample = (over: Partial<ModuleIntelligencePayload> = {}): ModuleIntelligencePayload => ({
  organization: 'Org', source: 's', academicYear: { syear: '2025' }, coverage: { available: true },
  freshness: { positionLabel: 'live', findingsRefreshedAt: null },
  summary: { available: true, headline: 'h', sentences: [] },
  position: { available: true, metrics: [{ key: 'a', label: 'A', value: 1 }, { key: 'b', label: 'B', value: 2 }] },
  breakdowns: [], findings: [], ruleStatus: [], priorities: [], recommendations: [], decisionTrail: [],
  dataQuality: { available: true, checks: [] }, learning: { available: true, entries: [] },
  ...over,
});

test('part headers carry a count, and flag the ones that need a look', () => {
  const data = sample({
    breakdowns: [{ key: 'x', label: 'X', available: true, columns: [], rows: [] }],
    findings: [{ id: '1', severity: 'high', title: 't', whatHappened: 'w' }],
    priorities: [
      { id: '1', severity: 'high', title: 't', whatHappened: 'w', owner: 'o' },
      { id: '2', severity: 'low', title: 't2', whatHappened: 'w', owner: 'o' },
    ],
    dataQuality: { available: true, checks: [{ key: 'a', label: 'A', state: 'attention', value: 3 }, { key: 'b', label: 'B', state: 'ok', value: 0 }] },
    learning: { available: true, entries: [{ recordedAt: '', result: 'success', action: 'a', finding: 'f' }] },
  });

  assert.deepEqual(summaryPartBadge('position', data), { text: '2 measures', attention: false });
  assert.deepEqual(summaryPartBadge('breakdowns', data), { text: '1 breakdown', attention: false });
  assert.deepEqual(summaryPartBadge('findings', data), { text: '1 finding', attention: true });
  assert.deepEqual(summaryPartBadge('priorities', data), { text: '2 priorities', attention: true });
  assert.deepEqual(summaryPartBadge('dataQuality', data), { text: '1 to review', attention: true });
  assert.deepEqual(summaryPartBadge('learning', data), { text: '1 entry', attention: false });
});

test('an empty or unavailable part says so instead of looking clean', () => {
  const empty = sample({ position: null, dataQuality: { available: false, reason: 'never ran', checks: [] }, learning: { available: false, entries: [] } });

  assert.deepEqual(summaryPartBadge('position', empty), { text: 'Unavailable', attention: false });
  assert.deepEqual(summaryPartBadge('dataQuality', empty), { text: 'Unavailable', attention: false });
  assert.deepEqual(summaryPartBadge('findings', empty), { text: 'None raised', attention: false });
  assert.deepEqual(summaryPartBadge('priorities', empty), { text: 'None flagged', attention: false });
  assert.deepEqual(summaryPartBadge('learning', empty), { text: 'Nothing yet', attention: false });
  assert.equal(summaryPartBadge('breakdowns', empty), null);
  assert.deepEqual(summaryPartBadge('dataQuality', sample({ dataQuality: { available: true, checks: [{ key: 'a', label: 'A', state: 'ok', value: 0 }] } })), { text: 'All clear', attention: false });
});

test('a module that omitted a section does not get one invented, but always keeps the summary head', () => {
  assert.deepEqual(summaryPartsFor(['summary', 'position', 'findings']).map((part) => part.key), ['summary', 'position', 'findings']);
  assert.deepEqual(summaryPartsFor([]).map((part) => part.key), ['summary']);
});

test('all 26 module contracts: every declared section is reachable, the tabs are the same five, and nothing is left out of Summary', async () => {
  const dir = path.join(process.cwd(), 'components/intelligence/module/contracts');
  const files = readdirSync(dir).filter((file) => file.endsWith('.ts')).sort();
  assert.ok(files.length >= 26, `found ${files.length} contract files`);

  const seen: string[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(path.join(dir, file)).href)) as Record<string, unknown>;
    const contract = Object.values(mod).find(
      (value): value is { key: string; sections: Array<{ key: SectionKey }> } =>
        typeof value === 'object' && value !== null && Array.isArray((value as { sections?: unknown }).sections),
    );
    assert.ok(contract, `${file} exports a contract`);
    seen.push(contract.key);

    const declared = contract.sections.map((section) => section.key);
    for (const key of declared) {
      const home = SECTION_HOME[key];
      assert.ok(home, `${contract.key}: ${key} has a home`);
      assert.ok(INTELLIGENCE_TABS.some((tab) => tab.key === home.tab), `${contract.key}: ${key} lands on a real tab`);
    }
    // Every former tab the module declared is now a Summary part - none is dropped.
    const parts = summaryPartsFor(declared).map((part) => part.key as string);
    for (const key of FORMER_TABS) {
      if (declared.includes(key)) assert.ok(parts.includes(key), `${contract.key}: ${key} is in Summary`);
    }
    // Module Integration and Cross-Module Workflow are tabs for every module.
    assert.ok(declared.includes('integration') && declared.includes('workflow'), `${contract.key} declares both`);
  }
  assert.equal(new Set(seen).size, seen.length, 'every contract has its own key');
});
