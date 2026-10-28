import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { createElement } from 'react';

/**
 * The real Execution Center container mounted in jsdom, with `fetch` stubbed: loading, error + retry,
 * filter requests, opening a record, linking evidence, and that nothing is written until a person acts.
 * Skips (rather than fails) where jsdom is not installed.
 */

let hasJsdom = true;
try { createRequire(`${process.cwd()}/package.json`).resolve('jsdom'); } catch { hasJsdom = false; }
const domTest = (name: string, fn: () => Promise<void>) => test(name, { skip: hasJsdom ? false : 'jsdom is not installed' }, fn);

const UUID = '6b42338a-a8c4-4eb6-9ea6-0b2eb31c504e';
const counts = (o: Record<string, number> = {}) => ({ queued: 0, running: 0, completed: 0, failed: 0, blocked: 0, rolled_back: 0, other: 0, total: 0, ...o });
const rec = {
  id: UUID, esoId: 'e', decisionId: 'd', title: 'Assign a head to every department', reason: 'Departments have no head.',
  decision: { rationale: 'ok', status: 'approved', decidedBy: 'User #86', decidedAt: null }, action: null,
  executor: { label: 'User #86', type: 'human', raw: '86' }, status: 'completed', group: 'completed', createdAt: '2026-09-07 16:11:39',
  startedAt: null, completedAt: null, ageDays: 40, error: null, isSample: false,
  outcome: { id: 'o', result: 'partial', feedback: 'fb', confidence: 0.6, confidenceMeaning: 'CONF', measurement: null, recordedAt: null, recordedBy: 'User #86' },
  outcomeState: 'reported',
  evidence: { execution: [], executionCount: 0, finding: [{ id: 'ev1', source: 'lms', type: 'observation', summary: 'EVIDENCE-ONE', confidence: 1, observedAt: null }], findingTotal: 1 },
  evidenceCount: 0, attention: null, technical: { executionId: UUID },
};
const payload = {
  available: true, tenantId: '1', generatedAt: '2026-10-22T10:00:00Z', partial: null,
  health: { real: counts({ completed: 1, total: 1 }), sample: counts() },
  verification: { real: { finished: 1, withOutcome: 1, reported: 1, withEvidence: 0 }, sample: {}, outcomes: { total: 1, linkedToAnExecution: 1, notLinked: 0 } },
  attention: [], impact: [],
  history: { total: 1, page: 1, perPage: 25, lastPage: 1, data: [rec] },
  definitions: { statuses: { queued: '', completed: '', failed: '', blocked: '' }, verification: { verified: '', measured: '', reported: '', no_outcome: '' }, evidence: { finding: '', execution: '' }, confidence: 'CONF-NOTE' },
};

const calls: Array<{ url: string; method: string; body: string | null }> = [];
let failCenter = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let env: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dom: any;

before(async () => {
  if (!hasJsdom) return;
  const { JSDOM } = (await import('jsdom' as string)) as { JSDOM: new (html: string, o: object) => unknown };
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/enterprise-brain/intelligence-loop/executions', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true, writable: true });
  }
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.localStorage.setItem('userData', JSON.stringify({ token: 't', tenant: '1', sub_institute_id: '1', syear: '2025' }));

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true, writable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (url.includes('/execution-center/')) return json(rec);
      if (url.includes('/execution-center')) return failCenter ? json({ message: 'Server exploded' }, 500) : json(payload);
      if (url.includes('/evidence')) return json({ executionId: UUID, linked: 1, alreadyLinked: 0 });
      return json({}); // dashboard preferences and anything else
    },
  });

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { default: ExecutionCenter } = await import('@/app/enterprise-brain/intelligence-loop/executions/_components/ExecutionCenter');
  env = { act: React.act, createRoot, ExecutionCenter };
});

after(() => dom?.window.close());

const settle = () => env.act(async () => { await new Promise((r) => setTimeout(r, 40)); });
const click = (el: Element) => env.act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

async function mount() {
  const host = dom.window.document.createElement('div') as HTMLElement;
  dom.window.document.body.appendChild(host);
  const root = env.createRoot(host);
  await env.act(async () => { root.render(createElement(env.ExecutionCenter)); });
  await settle();
  await settle();
  return { host, unmount: () => env.act(async () => root.unmount()) };
}

const buttonWith = (host: HTMLElement, text: RegExp) =>
  Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => text.test(b.textContent ?? ''));

domTest('renders the five sections from one request, with the page title and no write', async () => {
  calls.length = 0;
  failCenter = false;
  const { host, unmount } = await mount();
  const text = host.textContent ?? '';
  for (const needle of ['Execution Center', 'Execution health', 'Evidence and outcome verification', 'Actions needing attention', 'Outcome impact', 'Execution history', 'CONF-NOTE']) {
    assert.ok(text.includes(needle), needle);
  }
  assert.equal(calls.filter((c) => c.url.includes('/execution-center') && !c.url.includes('/execution-center/')).length, 1, 'one request for the whole screen');
  assert.equal(calls.filter((c) => c.method !== 'GET').length, 0, 'viewing writes nothing');
  await unmount();
});

domTest('an API error shows the message with Try again, and retrying loads the screen', async () => {
  failCenter = true;
  const { host, unmount } = await mount();
  assert.ok((host.textContent ?? '').includes('Server exploded') || (host.textContent ?? '').toLowerCase().includes('failed'));
  const retry = buttonWith(host, /Try again|Retry/i);
  assert.ok(retry, 'retry button');
  failCenter = false;
  await click(retry!);
  await settle();
  assert.ok((host.textContent ?? '').includes('Execution health'));
  await unmount();
});

domTest('searching and filtering request the server with those filters and keep the page on screen meanwhile', async () => {
  failCenter = false;
  calls.length = 0;
  const { host, unmount } = await mount();
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Filter by status"]')!;
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
  await env.act(async () => {
    setter.call(select, 'queued');
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle();
  const last = calls.filter((c) => c.url.includes('/execution-center') && !c.url.includes('/execution-center/')).pop()!;
  assert.ok(last.url.includes('status=queued'), last.url);
  assert.ok(last.url.includes('page=1'));
  assert.ok((host.textContent ?? '').includes('Execution health'), 'page still shown');
  await unmount();
});

domTest('opening a record loads its detail, and linking evidence posts only what was selected', async () => {
  failCenter = false;
  calls.length = 0;
  const { host, unmount } = await mount();
  await click(Array.from(host.querySelectorAll<HTMLButtonElement>('table button')).find((b) => (b.textContent ?? '').includes('Assign a head'))!);
  await settle();
  const dialog = dom.window.document.querySelector('[role="dialog"]') as HTMLElement;
  assert.ok(dialog, 'detail opens');
  assert.ok((dialog.textContent ?? '').includes('Departments have no head.'));
  assert.ok((dialog.textContent ?? '').includes('EVIDENCE-ONE'));
  assert.ok(calls.some((c) => c.url.includes(`/execution-center/${UUID}`)));

  const link = buttonWith(dialog, /Select evidence to link/)!;
  assert.equal(link.disabled, true, 'nothing is linked until something is selected');
  await click(dialog.querySelector('input[type="checkbox"]')!);
  await click(buttonWith(dialog, /^Link 1 selected/)!);
  await settle();
  const post = calls.find((c) => c.method === 'POST')!;
  assert.ok(post.url.includes(`/executions/${UUID}/evidence`), post.url);
  assert.deepEqual(JSON.parse(post.body!), { evidence_ids: ['ev1'] });

  await click(dialog.querySelector('[aria-label="Close details"]')!);
  assert.equal(dom.window.document.querySelector('[role="dialog"]'), null, 'closes');
  await unmount();
});
