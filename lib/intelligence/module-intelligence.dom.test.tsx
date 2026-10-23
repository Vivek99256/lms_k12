import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { createElement } from 'react';

import { defineContract, sectionsWith } from '@/components/intelligence/module/contract';
import type { ModuleIntelligenceContract } from '@/components/intelligence/module/contract';
import type { ModuleIntelligencePayload } from '@/components/intelligence/module/payload';

/**
 * The real `ModuleIntelligence` mounted in jsdom: five tabs, six former tabs inside Summary, old links,
 * collapse/expand, error and refresh. No network: `load()` is a stub and `fetch` is stubbed for the
 * Integration/Workflow tabs.
 */

// jsdom is not a declared dependency of this app; where it is not installed these tests skip
// rather than fail, and the pure tests in module-tabs.test.ts still run.
let hasJsdom = true;
try { createRequire(`${process.cwd()}/package.json`).resolve('jsdom'); } catch { hasJsdom = false; }
const opts = { skip: hasJsdom ? false : 'jsdom is not installed' };
const domTest = (name: string, fn: () => Promise<void>) => test(name, opts, fn);

const TABS = ['Summary', 'Recommendations', 'Decisions', 'Module Integration', 'Cross-Module Workflow'];

const payload: ModuleIntelligencePayload = {
  organization: 'Org', source: 'unit', academicYear: { syear: '2025' }, coverage: { available: true },
  freshness: { positionLabel: 'live', findingsRefreshedAt: null },
  summary: { available: true, headline: 'HEADLINE-TEXT', sentences: ['SUMMARY-SENTENCE'] },
  position: { available: true, metrics: [{ key: 'm1', label: 'POSITION-METRIC', value: 42 }] },
  breakdowns: [{ key: 'b1', label: 'BREAKDOWN-LABEL', available: true, columns: [{ key: 'c', label: 'C' }], rows: [{ c: 'x' }] }],
  findings: [{ id: 'f1', severity: 'high', title: 'FINDING-TITLE', whatHappened: 'what' }],
  ruleStatus: [],
  priorities: [{ id: 'p1', severity: 'high', title: 'PRIORITY-TITLE', whatHappened: 'what', owner: 'Principal' }],
  recommendations: [], decisionTrail: [],
  dataQuality: { available: true, checks: [{ key: 'q', label: 'DQ-CHECK', state: 'attention', value: 3 }] },
  learning: { available: true, entries: [{ recordedAt: '', result: 'success', action: 'LEARN-ACTION', finding: 'f' }] },
} as unknown as ModuleIntelligencePayload;

let loads = 0;
const makeContract = (over: Partial<ModuleIntelligenceContract> = {}): ModuleIntelligenceContract =>
  defineContract({
    key: `dom-${Math.random()}`,
    label: 'Test Intelligence',
    accent: '#0891B2',
    grain: 'one row',
    nouns: { singular: 'row', plural: 'rows' },
    load: async () => { loads += 1; return payload; },
    sections: sectionsWith({}),
    emptyState: { title: 'Nothing yet', fallbackReason: 'No data.' },
    ...over,
  });

let env: { React: typeof import('react'); createRoot: typeof import('react-dom/client').createRoot; act: (fn: () => unknown) => Promise<void>; ModuleIntelligence: typeof import('@/components/intelligence/module/ModuleIntelligence').ModuleIntelligence; Router: typeof import('next/dist/shared/lib/app-router-context.shared-runtime').AppRouterContext };
let dom: { window: Window & typeof globalThis };

before(async () => {
  if (!hasJsdom) return;
  const { JSDOM } = (await import('jsdom' as string)) as { JSDOM: new (html: string, options: object) => typeof dom };
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/intelligence', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, unknown>;
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'localStorage', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : w[key], configurable: true, writable: true });
  }
  (dom.window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  (dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.localStorage.setItem('userData', JSON.stringify({ token: 't', tenant: 'tenant', organization: 'tenant' }));
  Object.defineProperty(globalThis, 'fetch', {
    value: async () => new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } }),
    configurable: true, writable: true,
  });

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const { ModuleIntelligence } = await import('@/components/intelligence/module/ModuleIntelligence');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  env = { React, createRoot, act: act as never, ModuleIntelligence, Router: AppRouterContext };
});

after(() => dom?.window.close());

async function mount(contract: ModuleIntelligenceContract, url = '/intelligence') {
  dom.window.history.replaceState({}, '', url);
  const host = dom.window.document.createElement('div') as HTMLElement;
  dom.window.document.body.appendChild(host);
  const root = env.createRoot(host);
  const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
  await env.act(async () => {
    root.render(createElement(env.Router.Provider, { value: router as never }, createElement(env.ModuleIntelligence, { contract })));
  });
  await env.act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  return { host, unmount: () => env.act(async () => root.unmount()) };
}

const tabs = (host: HTMLElement) => Array.from(host.querySelectorAll('[role="tab"]')).map((el) => (el.textContent ?? '').trim());
const click = (el: Element) => env.act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
const tabButton = (host: HTMLElement, label: string) =>
  Array.from(host.querySelectorAll('[role="tab"]')).find((el) => (el.textContent ?? '').trim() === label)!;

domTest('shows exactly the five tabs, in order, and none of the six former tabs', async () => {
  const { host, unmount } = await mount(makeContract());
  assert.deepEqual(tabs(host), TABS);
  await unmount();
});

domTest('Summary holds the content of all six former tabs, with nothing hidden by default', async () => {
  const { host, unmount } = await mount(makeContract());
  const text = host.textContent ?? '';
  for (const needle of ['HEADLINE-TEXT', 'POSITION-METRIC', 'BREAKDOWN-LABEL', 'FINDING-TITLE', 'PRIORITY-TITLE', 'DQ-CHECK', 'LEARN-ACTION']) {
    assert.ok(text.includes(needle), `${needle} is in Summary`);
  }
  assert.equal(host.querySelectorAll('[hidden]').length, 0, 'every part starts expanded');
  for (const anchor of ['intel-position', 'intel-breakdowns', 'intel-findings', 'intel-priorities', 'intel-data-quality', 'intel-learning']) {
    assert.ok(host.querySelector(`#${anchor}`), anchor);
  }
  await unmount();
});

domTest('the data is loaded once - consolidating sections added no request', async () => {
  loads = 0;
  const { unmount } = await mount(makeContract());
  assert.equal(loads, 1);
  await unmount();
});

domTest('collapsing a part hides it without removing it, and Expand all brings everything back', async () => {
  const { host, unmount } = await mount(makeContract());
  const toggle = host.querySelector('#intel-findings button[aria-expanded]')!;
  await click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const body = host.querySelector(`#${toggle.getAttribute('aria-controls')}`) as HTMLElement;
  assert.equal(body.hidden, true);
  assert.ok((body.textContent ?? '').includes('FINDING-TITLE'), 'content stays mounted');

  const all = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => /Collapse all|Expand all/.test(b.textContent ?? ''))!;
  assert.equal(all.textContent, 'Expand all');
  await click(all);
  assert.equal(host.querySelectorAll('[hidden]').length, 0);
  assert.equal(all.textContent, 'Collapse all');
  await click(all);
  assert.equal(host.querySelectorAll('[hidden]').length, 6, 'Collapse all closes the six parts');
  await click(all);
  assert.equal(host.querySelectorAll('[hidden]').length, 0);
  await unmount();
});

domTest('the other four tabs open independently and Summary content is not mixed into them', async () => {
  const { host, unmount } = await mount(makeContract());
  for (const label of TABS.slice(1)) {
    await click(tabButton(host, label));
    await env.act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    assert.equal(tabButton(host, label).getAttribute('aria-selected'), 'true', label);
    assert.equal(host.querySelector('[role="tabpanel"]')?.getAttribute('aria-label'), label);
    assert.ok(!(host.textContent ?? '').includes('POSITION-METRIC'), `${label} does not repeat Summary parts`);
  }
  await click(tabButton(host, 'Summary'));
  assert.ok((host.textContent ?? '').includes('FINDING-TITLE'));
  await unmount();
});

domTest('old links (?intelSection= and #hash) land on Summary and the right part, never a blank screen', async () => {
  for (const [url, anchor] of [
    ['/intelligence?intelSection=findings', 'intel-findings'],
    ['/intelligence#data-quality', 'intel-data-quality'],
    ['/intelligence?intelSection=learning', 'intel-learning'],
  ] as const) {
    const { host, unmount } = await mount(makeContract(), url);
    assert.equal(tabButton(host, 'Summary').getAttribute('aria-selected'), 'true', url);
    assert.ok(host.querySelector(`#${anchor}`), `${url} -> ${anchor}`);
    assert.equal((host.querySelector(`#${anchor} button[aria-expanded]`) as HTMLElement).getAttribute('aria-expanded'), 'true');
    await unmount();
  }
  const { host, unmount } = await mount(makeContract(), '/intelligence?intelSection=decisions');
  assert.equal(tabButton(host, 'Decisions').getAttribute('aria-selected'), 'true');
  await unmount();
  const other = await mount(makeContract(), '/intelligence#top');
  assert.equal(tabButton(other.host, 'Summary').getAttribute('aria-selected'), 'true');
  await other.unmount();
});

domTest('a module that omitted sections still shows five tabs and does not invent the omitted parts', async () => {
  const { host, unmount } = await mount(makeContract({ sections: sectionsWith({}, ['learning', 'breakdowns']) }));
  assert.deepEqual(tabs(host), TABS);
  assert.equal(host.querySelector('#intel-learning'), null);
  assert.equal(host.querySelector('#intel-breakdowns'), null);
  assert.ok(host.querySelector('#intel-findings'));
  await unmount();
});

domTest('an API error shows the error with Try again, and retrying loads the screen', async () => {
  let fail = true;
  const { host, unmount } = await mount(makeContract({ load: async () => { if (fail) throw new Error('BOOM-ERROR'); return payload; } }));
  assert.ok((host.textContent ?? '').includes('BOOM-ERROR'));
  const retry = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => /Try again/.test(b.textContent ?? ''))!;
  assert.ok(retry);
  fail = false;
  await click(retry);
  await env.act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.deepEqual(tabs(host), TABS);
  assert.ok((host.textContent ?? '').includes('FINDING-TITLE'));
  await unmount();
});

domTest('Refresh reloads the data and keeps the five tabs', async () => {
  loads = 0;
  const { host, unmount } = await mount(makeContract());
  const refresh = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => /^\s*Refresh\s*$/.test(b.textContent ?? ''))!;
  await click(refresh);
  await env.act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(loads, 2);
  assert.deepEqual(tabs(host), TABS);
  await unmount();
});

domTest('empty parts say so instead of vanishing', async () => {
  const empty = { ...payload, findings: [], priorities: [], learning: { available: false, entries: [] } } as ModuleIntelligencePayload;
  const { host, unmount } = await mount(makeContract({ load: async () => empty }));
  for (const anchor of ['intel-findings', 'intel-priorities', 'intel-learning']) {
    const section = host.querySelector(`#${anchor}`)!;
    assert.ok(section, anchor);
    assert.ok(((section.querySelector(`[id$="-body"]`)?.textContent) ?? '').trim().length > 0, `${anchor} explains its empty state`);
  }
  await unmount();
});
