/* eslint-disable @typescript-eslint/no-require-imports -- This browser harness is intentionally CommonJS. */
/**
 * Browser E2E for the Document Library upload flow, Question papers tab and notification bell.
 *
 *   PLAYWRIGHT_PATH=<path to playwright pkg, optional>  E2E_BASE_URL=http://localhost:3000  node scripts/e2e/question-papers-e2e.cjs
 *
* NO REAL BACKEND IS EVER CONTACTED. Every request to ANY /api/ path, on ANY host or port (the app talks to 127.0.0.1:8000 in local dev), is answered by the
 * in-memory fixture below (which mimics the server rules the UI depends on: processing phases, the metadata
 * pickers, the activation checks, one persisted notification with read state); only the Next dev server origin is passed through, and every other
* request, including any other localhost port, is aborted. The session is seeded in localStorage like the app's login would; no password or token
 * of a real user is used.
 *
 * What it proves: the UI behaviour and the exact requests it sends. What it cannot prove: that the real Laravel
 * endpoint, queue worker or AI provider behave the same - that is the staging test plan's job.
 *
 * Run one browser, serially, and do not edit lms_k12 source while it runs (HMR resets pages mid-run).
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SHOTS = process.env.E2E_SHOT_DIR || path.join(process.cwd(), 'e2e-shots');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
fs.mkdirSync(SHOTS, { recursive: true });

const UUID = '11111111-2222-4333-8444-555555555555';
const results = [];
let activePage = null;

/* ---------------- fixture backend ---------------- */

const S = {
  requests: [],        // {method, path, body}
  unmocked: [],        // API paths the fixture does not implement
  qpPolls: 0,          // GETs of the job since upload; drives the processing phases
  phase: 'none',       // none | queued | processing | needs_context | reviewed
  notified: false,
  noteRead: false,
  workerState: 'stopped',
  items: [],
  job: null,
};

const job = (over = {}) => ({
  id: UUID, document_id: 21, document_title: 'standard_9_science', file_name: 'standard_9_science.pdf',
  status: 'queued', stage: 'validating', standard_id: null, subject_id: null, chapter_id: null, academic_year: null,
  metadata_notes: [], total_pages: null, processed_pages: 0, total_chunks: null, parsed_chunks: 0,
  questions_extracted: 0, questions_saved: 0, questions_needing_review: 0, questions_skipped: 0,
  breakdown: null, used_ocr: false, progress_percent: null, attempts: 0, last_error: null, can_retry: false,
  created_at: '2026-10-28 15:24:26', started_at: null, finished_at: null, ...over,
});

const CANDIDATES = [{ id: 3975, name: 'Science', mapped: true }, { id: 41814, name: 'SCIENCE', mapped: false }];

function currentJob() {
  // Queued and nobody polling the queue yet: the server reports the worker as not detected, with a real wait time.
  if (S.phase === 'queued') return job({ worker_state: 'not_detected', queued_seconds: 4 });
  if (S.phase === 'processing') {
    return job({ status: 'processing', stage: 'parsing_questions', total_pages: 4, processed_pages: 2, total_chunks: 4, parsed_chunks: 2, questions_extracted: 5, progress_percent: 45, attempts: 1 });
  }
  if (S.phase === 'needs_context') {
    return job({
      status: 'completed_with_warnings', stage: 'finalizing', standard_id: 42, total_pages: 4, processed_pages: 4, total_chunks: 4, parsed_chunks: 4,
      questions_extracted: 3, questions_needing_review: 3, breakdown: { saved_active: 0, saved_inactive: 0, unresolved: 3, duplicate: 0, skipped: 0, pending: 0 },
      attempts: 1, can_retry: true, finished_at: '2026-10-28 15:30:00',
      metadata_notes: ['The paper\'s subject "SCIENCE" matches more than one subject of this school and the standard\'s mapping does not settle it; choose it and retry.'],
    });
  }
  const saved = S.items.filter((i) => i.state === 'saved').length;
  const inactive = S.items.filter((i) => i.state === 'needs_review').length;
  return job({
    status: 'completed_with_warnings', stage: 'finalizing', standard_id: 42, subject_id: 3975, chapter_id: 7, total_pages: 4, processed_pages: 4,
    total_chunks: 4, parsed_chunks: 4, questions_extracted: 3, questions_saved: saved + inactive, questions_needing_review: inactive,
    breakdown: { saved_active: saved, saved_inactive: inactive, unresolved: 0, duplicate: 0, skipped: 0, pending: 0 },
    attempts: 2, can_retry: true, finished_at: '2026-10-28 15:40:00',
  });
}

function detail() {
  const j = currentJob();
  const academic = {
    standard: j.standard_id ? { id: 42, name: '9' } : null,
    subject: j.subject_id ? { id: 3975, name: 'Science' } : null,
    chapter: j.chapter_id ? { id: 7, name: 'Matter in our surroundings' } : null,
    candidates: S.phase === 'needs_context' ? { subject: CANDIDATES } : {},
    heading: { standard: '9', subject: 'SCIENCE', chapter: null },
  };
  return { ...j, academic, attention_items: [] };
}

// How the server describes each question's chapter: one matched automatically, one only suggested, one without a hint.
const CHAPTER_FIELDS = {
  1: {
    chapter_id: null, chapter_name: null, chapter_source: null, needs_chapter: false,
    chapter_suggestion: {
      chapter_id: 7, chapter_name: 'Matter in our surroundings', confidence: 73, level: 'close', assigned: false, score: 0.178, margin: 0.17,
      explanation: 'Close between "Matter in our surroundings" and "Is matter around us pure?"; teacher confirmation needed.',
      alternatives: [{ id: 7, name: 'Matter in our surroundings', score: 0.178 }, { id: 8, name: 'Is matter around us pure?', score: 0.148 }],
    },
  },
  2: {
    chapter_id: 7, chapter_name: 'Matter in our surroundings', chapter_source: 'auto', needs_chapter: false,
    chapter_suggestion: {
      chapter_id: 7, chapter_name: 'Matter in our surroundings', confidence: 99, level: 'high', assigned: true, score: 0.25, margin: 0.42,
      explanation: 'Matches "Matter in our surroundings" on: evaporation, cooling.', alternatives: [{ id: 7, name: 'Matter in our surroundings', score: 0.25 }],
    },
  },
  3: { chapter_id: 7, chapter_name: 'Matter in our surroundings', chapter_source: 'teacher', needs_chapter: false, chapter_suggestion: null },
};

function reviewItems() {
  return S.items.map((i) => ({ ...i, ...(CHAPTER_FIELDS[i.id] ?? {}), blockers: [], can_activate: i.state === 'needs_review' && (!i.needs_answer_key) }));
}

function workerStatus() {
  const running = S.workerState === 'running';
  return {
    state: S.workerState,
    message: running ? 'Running: the worker is processing the question-papers queue.' : 'Stopped: no worker is running.',
    driver: 'fixture',
    supported: true,
    active_workers: running ? 1 : 0,
    queue: 'question-papers',
    pending: { queue_messages: 0, open_jobs: 0 },
    heartbeat: { state: running ? 'active' : null, last_beat_at: running ? new Date().toISOString() : null, age_seconds: running ? 0 : null },
    desired: running ? 'running' : 'stopped',
    last_action: null,
    last_error: null,
    restart_policy: 'The service manager restarts the worker automatically if it crashes.',
    can_control: true,
  };
}

function body(route) {
  const buffer = route.request().postDataBuffer();
  return buffer ? buffer.toString('latin1') : '';
}

async function fixture(route) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  const m = req.method();
  // The page is on localhost and the API host differs, so the browser sends a CORS preflight and checks the
  // response headers; a real Laravel answers both, so the fixture must too or every call is blocked in the browser.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,accept,x-requested-with',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
  const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) });
  const ok = (data, status = 200) => json({ status_code: 1, message: 'SUCCESS', data }, status);
  const raw = m === 'POST' ? body(route) : '';
  S.requests.push({ method: m, path: p, body: raw.slice(0, 4000) });

  /* ---- question papers ---- */
  if (p === '/api/platform/question-papers/worker' && m === 'GET') return ok(workerStatus());
  if (p === '/api/platform/question-papers/worker/start' && m === 'POST') {
    S.workerState = 'running';
    return ok(workerStatus());
  }
  if (p === '/api/platform/question-papers/worker/stop' && m === 'POST') {
    S.workerState = 'stopped';
    return ok(workerStatus());
  }
  if (p === '/api/platform/question-papers' && m === 'POST') {
    S.phase = 'queued'; S.uploadedAt = Date.now(); S.notified = false; S.noteRead = false;
    return ok(currentJob(), 201);
  }
  if (p === '/api/platform/question-papers' && m === 'GET') {
    if (S.phase === 'none') return ok({ total: 0, jobs: [] });
    advance();
    return ok({ total: 1, jobs: [currentJob()] });
  }
  if (p === '/api/platform/question-papers/options') {
    return ok({
      standards: [{ id: 42, name: '9' }],
      subjects: CANDIDATES.map((c) => ({ id: c.id, name: c.name, mapped: c.mapped })),
      chapters: url.searchParams.get('subject_id') === '3975' ? [{ id: 7, name: 'Matter in our surroundings' }] : [],
    });
  }
  if (p === `/api/platform/question-papers/${UUID}` && m === 'GET') { advance(false); return ok(detail()); }
  if (p === `/api/platform/question-papers/${UUID}/items`) return ok({ items: reviewItems() });
  if (p === `/api/platform/question-papers/${UUID}/retry` && m === 'POST') {
    const sent = JSON.parse(raw || '{}');
    if (!sent.subject_id) return json({ status_code: 0, message: 'Choose a subject first.', data: null }, 422);
    S.phase = 'reviewed';
    S.items = [
      { id: 1, ordinal: 1, item_number: '1', page: 1, format: 'mcq', state: 'needs_review', reason: null, question_id: 9001, question_text: 'Which state of matter has no fixed volume?', options: [{ label: 'A', text: 'Solid' }, { label: 'B', text: 'Liquid' }, { label: 'C', text: 'Gas' }], correct_option: null, model_answer: null, pairs: null, marks: 1, needs_answer_key: true },
      { id: 2, ordinal: 2, item_number: '2', page: 1, format: 'short', state: 'needs_review', reason: null, question_id: 9002, question_text: 'Define evaporation.', options: [], correct_option: null, model_answer: 'Liquid to vapour.', pairs: null, marks: 2, needs_answer_key: false },
      { id: 3, ordinal: 3, item_number: '3', page: 2, format: 'mcq', state: 'saved', reason: null, question_id: 9003, question_text: 'Which state has a definite shape?', options: [{ label: 'A', text: 'Solid', is_correct: true }, { label: 'B', text: 'Gas' }], correct_option: 'A', model_answer: null, pairs: null, marks: 1, needs_answer_key: false },
    ];
    return ok(currentJob());
  }
  if (p === `/api/platform/question-papers/${UUID}/activate` && m === 'POST') {
    const sent = JSON.parse(raw);
    const results = sent.items.map((req) => {
      const item = S.items.find((i) => i.id === req.id);
      if (!item || item.state !== 'needs_review') return { id: req.id, ok: false, message: 'Already active.' };
      if (item.needs_answer_key && !req.correct_option) return { id: req.id, ok: false, message: 'Choose the correct option.' };
      item.state = 'saved';
      if (req.correct_option) { item.correct_option = req.correct_option; item.options.forEach((o) => { o.is_correct = o.label === req.correct_option; }); item.needs_answer_key = false; }
      return { id: req.id, ok: true, message: 'Activated.' };
    });
    return ok({ results, job: currentJob() });
  }

  /* ---- notifications: one persisted notice with read state, plus one with an off-site link ---- */
  if (p === '/api/platform/notifications/inbox') return json({ status_code: 0, message: 'Not allowed', data: null }, 403);
  if (p === '/api/platform/notifications/mine') {
    const rows = S.notified ? [
      { key: 'user:11', source: 'user', subject: 'Question paper processed with warnings', body: 'standard_9_science.pdf - 3 questions saved, 3 need review.', created_at: '2026-10-28 15:30:00', read: S.noteRead, link: `/documents_new?tab=question-papers&job=${UUID}` },
      { key: 'user:12', source: 'user', subject: 'Unsafe link notice', body: 'Its link points off-site.', created_at: '2026-10-28 15:29:00', read: true, link: '//evil.example/steal' },
    ] : [];
    return ok(rows);
  }
  if (/^\/api\/platform\/notifications\/user\/11\/read$/.test(p) && m === 'POST') { S.noteRead = true; return ok({ unread: 0 }); }
  if (/^\/api\/platform\/notifications\/user\//.test(p)) return ok({ unread: 0 });

  /* ---- document library (general / curriculum / textbook go through the existing endpoint) ---- */
  if (p === '/api/v1/documents' && m === 'POST') return json({ status: 1, data: { id: 5, title: 't', processing_status: 'pending' } }, 201);
  if (/^\/api\/v1\/documents\/5$/.test(p)) {
    return json({ status: 1, data: { id: 5, title: 't', document_type: 'Circular', summary: '', tags: [], warnings: [], processing_status: 'ready_for_review' } });
  }
  if (/^\/api\/v1\/documents\/5\/confirm$/.test(p)) return json({ status: 1, data: {} });
  if (p.startsWith('/api/v1/')) {
    return json({ status: 1, data: [], pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 } });
  }

  // Anything else on an API path is not mocked: fail loudly rather than reach a real server.
  // The app shell calls a few unrelated endpoints (menus, access); they get a 404 and are not this test's concern.
  if (!/^\/api\/(menu-rights|brain\/|modules\/)/.test(p)) S.unmocked.push(`${m} ${p}`);
  return json({ status_code: 0, message: `not mocked: ${m} ${p}`, data: null }, 404);
}

/** Time-free phases: each poll of the job moves it along, like the worker would between polls. */
function advance() {
  // Driven by elapsed time since the upload, like a real worker, not by how often the page happens to poll.
  if (S.phase === 'queued' || S.phase === 'processing') {
    const seconds = (Date.now() - S.uploadedAt) / 1000;
    if (seconds >= 16) { S.phase = 'needs_context'; S.notified = true; }
    else if (seconds >= 8) S.phase = 'processing';
  }
}

/* ---------------- runner ---------------- */

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`PASS  ${name}`);
  } catch (error) {
    const msg = String(error.message || error).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' | ');
    if (activePage) await activePage.screenshot({ path: path.join(SHOTS, 'FAIL-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 50) + '.png') }).catch(() => undefined);
    results.push({ name, ok: false, error: msg });
    console.log(`FAIL  ${name}\n      ${msg}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const pdf = (name = 'standard_9_science.pdf') => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n') });
const sent = (method, p) => S.requests.filter((r) => r.method === method && r.path === p);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    if (window.__qpSeeded) return;
    window.__qpSeeded = true;
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('auth', JSON.stringify({ name: 'E2E', email: 'e2e@example.invalid' }));
    localStorage.setItem('sessionDate', today);
    // Fake identity on purpose: if a request ever did reach a real backend it would match no real school or user.
    const ctx = { sub_institute_id: 999001, user_id: 999002, user_profile_name: 'Admin', user_profile_id: 1, is_admin: 1, client_id: 1 };
    localStorage.setItem('menuContext', JSON.stringify(ctx));
    localStorage.setItem('userData', JSON.stringify({ ...ctx, token: 'e2e-fixture-token', user_token: 'e2e-fixture-token', host_name: 'http://qa-erp.invalid', syear: 2026, term_id: 1 }));
    localStorage.setItem('selectedAcademicYear', '2026');
  });
  // NOTHING may reach a real backend. In local development the app's API base is http://127.0.0.1:8000 (the developer's
  // own Laravel, which points at a shared database), so "localhost" must NOT be trusted: an earlier version of this script
  // let localhost calls through and one upload really reached that backend. Now:
  //   - any /api/... path, on ANY host or port, is answered by the fixture (unmocked ones get a 404, never the network);
  //   - only the Next dev server's own origin (pages, scripts, assets) is passed through, and only for non-/api paths;
  //   - everything else, including any other localhost port, is aborted.
  const nextOrigin = new URL(BASE).origin;
  let leaked = 0;
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/api/')) return fixture(route);
    if (u.origin === nextOrigin) return route.continue();
    // Another localhost port would be a local backend (the dangerous case) and fails the run; an external host
    // (fonts, avatars, analytics) is just blocked and harmless.
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') leaked += 1;
    return route.abort();
  });

  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(30000);
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 200)));

  const openLibrary = async (query = '') => {
    await page.goto(`${BASE}/documents_new${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.getByRole('heading', { name: 'Document Library' }).waitFor({ timeout: 120000 });
  };
  const openUpload = async () => {
    await page.getByRole('button', { name: /Upload documents/ }).click();
    await page.getByRole('heading', { name: 'Upload Once, Organize Automatically' }).waitFor();
  };
  const chooseAll = async (label) => page.locator('fieldset label', { hasText: label }).first().click();
  const startUpload = () => page.getByRole('button', { name: /^Upload( \d+ files)?$/ }).click();
  const closeModal = async () => { await page.getByRole('button', { name: 'Close' }).click().catch(() => undefined); };
  // Each step that needs a clean screen starts from a fresh load, so one failure cannot cascade into the next.
  const fresh = async () => { await openLibrary(); };

  await step('library opens and the Question papers tab is offered', async () => {
    await openLibrary();
    await page.getByRole('button', { name: 'Question papers' }).waitFor();
  });

  await step('worker controls read and change mocked server state, and stopping requires confirmation', async () => {
    S.requests.length = 0;
    await page.getByRole('button', { name: 'Question papers' }).click();
    await page.getByTestId('worker-state').getByText('Stopped').waitFor();
    expect(await page.getByRole('button', { name: 'Start worker' }).isEnabled(), 'Start should be enabled for an authorized user when stopped');
    await page.getByRole('button', { name: 'Start worker' }).click();
    await page.getByTestId('worker-state').getByText('Running').waitFor();
    expect(sent('POST', '/api/platform/question-papers/worker/start').length === 1, 'Start must call the backend worker endpoint');
    await page.getByRole('button', { name: 'Stop worker' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('heading', { name: 'Stop the question paper worker?' }).waitFor();
    await dialog.getByRole('button', { name: 'Stop worker' }).click();
    await page.getByTestId('worker-state').getByText('Stopped').waitFor();
    expect(sent('POST', '/api/platform/question-papers/worker/stop').length === 1, 'confirmed Stop must call the backend worker endpoint');
    expect(sent('GET', '/api/platform/question-papers/worker').length > 0, 'the panel must read worker status from the backend');
  });

  await step('choosing files asks for a document type with four options and blocks Upload until one is chosen', async () => {
    await openUpload();
    await page.locator('#file-upload').setInputFiles(pdf('circular.pdf'));
    for (const label of ['Question paper', 'Curriculum', 'General document', 'Textbook']) {
      await page.locator('fieldset label', { hasText: label }).first().waitFor();
    }
    expect(await page.getByRole('button', { name: /^Upload$/ }).isDisabled(), 'Upload must be disabled before a type is chosen');
    await page.getByText(/Choose a document type for/).waitFor();
    await page.screenshot({ path: path.join(SHOTS, '01-type-picker.png') });
  });

  await step('General document upload sends the same request as before (no declared_type) and still publishes', async () => {
    await chooseAll('General document');
    expect(await page.getByRole('button', { name: /^Upload$/ }).isEnabled(), 'Upload should be enabled');
    await startUpload();
    await page.getByRole('heading', { name: /All 1 file uploaded and published/ }).waitFor({ timeout: 60000 });
    const upload = sent('POST', '/api/v1/documents').pop();
    expect(!!upload, 'no POST to /api/v1/documents was seen');
    const fields = [...upload.body.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(!fields.includes('declared_type'), `a General document upload must not add declared_type; fields sent: ${fields.join(',')}`);
    expect(sent('POST', '/api/v1/documents/5/confirm').length >= 1, `the existing publish step must still run (confirm calls: ${sent('POST', '/api/v1/documents/5/confirm').length})`);
    expect(sent('POST', '/api/platform/question-papers').length === 0, 'a general document must not reach the question paper endpoint');
    await page.waitForTimeout(2200); // the modal closes itself
  });

  await step('Curriculum is recorded as declared_type=curriculum on the existing endpoint', async () => {
    S.requests.length = 0;
    await fresh();
    await openUpload();
    await page.locator('#file-upload').setInputFiles(pdf('syllabus.pdf'));
    await chooseAll('Curriculum');
    await startUpload();
    await page.getByRole('heading', { name: /All 1 file uploaded and published/ }).waitFor({ timeout: 60000 });
    const upload = sent('POST', '/api/v1/documents').pop();
    expect(upload && /name="declared_type"\r?\n\r?\ncurriculum/.test(upload.body), 'declared_type=curriculum expected');
    expect(sent('POST', '/api/platform/question-papers').length === 0, 'curriculum must not reach the question paper endpoint');
    await page.waitForTimeout(2200);
  });

  await step('a Question paper that is not a PDF is refused in the dialog before anything is sent', async () => {
    S.requests.length = 0;
    await fresh();
    await openUpload();
    await page.locator('#file-upload').setInputFiles({ name: 'paper.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') });
    await chooseAll('Question paper');
    await page.getByText(/Question papers must be PDF files/).waitFor();
    expect(await page.getByRole('button', { name: /^Upload$/ }).isDisabled(), 'Upload must stay disabled for a non-PDF question paper');
    expect(S.requests.filter((r) => r.method === 'POST' && /^\/api\/(v1\/documents|platform\/question-papers)/.test(r.path)).length === 0, 'no upload may be sent');
    await closeModal();
  });

  await step('Question paper upload returns at once, never polls the document pipeline, and says it keeps processing', async () => {
    S.requests.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Document Library' }).waitFor();
    await openUpload();
    await page.locator('#file-upload').setInputFiles(pdf());
    await chooseAll('Question paper');
    await startUpload();
    await page.getByText('Processing in background').waitFor();
    await page.getByText(/processing continues and you will get a notification/).waitFor();
    expect(sent('POST', '/api/platform/question-papers').length === 1, 'exactly one upload to the question paper endpoint');
    expect(sent('POST', '/api/v1/documents').length === 0, 'a question paper must not use the general document endpoint');
    expect(S.requests.filter((r) => /\/api\/v1\/documents\/\d+$/.test(r.path)).length === 0, 'the browser must not poll document processing for a question paper');
    expect(!(await page.getByText(/Everything was uploaded and published/).isVisible().catch(() => false)), 'must not claim it was published');
    await page.screenshot({ path: path.join(SHOTS, '02-background.png') });
  });

  await step('the processing tab shows persisted, real status: waiting, then pages and counts, with no invented estimate', async () => {
    await page.getByRole('button', { name: 'View question paper progress' }).click();
    const row = page.getByRole('button', { name: /standard_9_science\.pdf/ });
    await row.waitFor();
    await page.getByText('Queued', { exact: true }).first().waitFor();
    // A queued paper never claims to be processing, and when no worker is detected it says so and what to run.
    await page.getByText(/worker is not running, so nothing has started this paper/).first().waitFor();
    await page.getByText(/dev-question-papers.ps1/).first().waitFor();
    expect(await page.getByText('Processing', { exact: true }).count() === 0, 'a queued paper must not be labelled Processing');
    expect(await page.getByRole('progressbar').count() === 0, 'no progress bar while no real percentage exists');
    await page.getByText('Extracting questions').first().waitFor({ timeout: 30000 });
    await page.getByText(/2 \/ 4 pages/).first().waitFor();
    await page.getByText(/5 extracted/).first().waitFor();
    const bar = page.getByRole('progressbar').first();
    await bar.waitFor();
    expect((await bar.getAttribute('aria-valuenow')) === '45', 'the bar must show the stored value (45), not an estimate');
    expect(!/\b(time remaining|estimated time|ETA)\b/i.test(await page.locator('main, body').first().innerText()), 'no time estimate may be shown');
    await page.screenshot({ path: path.join(SHOTS, '03-processing.png') });
  });

  await step('when the paper is ambiguous the screen says nothing was guessed and offers the candidates', async () => {
    await page.getByText('Completed with warnings').first().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: /standard_9_science\.pdf/ }).first().click();
    await page.getByText('Academic context').waitFor();
    await page.getByText(/Nothing is guessed/).waitFor();
    await page.getByText(/Matching subjects:/).waitFor();
    await page.getByText(/Science \(#3975, used by this standard\)/).waitFor();
    await page.getByText(/waiting for standard or subject/).first().waitFor();
    await page.screenshot({ path: path.join(SHOTS, '04-needs-context.png') });
  });

  await step('retry sends the chosen standard, subject and chapter', async () => {
    const pick = (name) => page.locator('label').filter({ hasText: new RegExp('^' + name) }).locator('select');
    await pick('Standard').selectOption('42');
    // the mapped subject is labelled so same-named subjects can be told apart
    await pick('Subject').selectOption({ label: 'Science (used by this standard)' });
    await pick('Chapter').selectOption('7');
    S.requests.length = 0;
    await page.getByRole('button', { name: 'Retry with these choices' }).click();
    await page.getByText('Extracted questions (3)').waitFor();
    const retry = sent('POST', `/api/platform/question-papers/${UUID}/retry`).pop();
    const chosen = JSON.parse(retry.body);
    expect(chosen.standard_id === 42 && chosen.subject_id === 3975 && chosen.chapter_id === 7, `retry body was ${retry.body}`);
  });

  await step('review: the unkeyed MCQ cannot be selected until a correct option is chosen; activation sends that option', async () => {
    await page.getByText('Which state of matter has no fixed volume?').waitFor();
    await page.getByText(/The paper prints no answer key/).waitFor();
    const unkeyedBox = page.getByLabel('Select question 1 for activation');
    const shortBox = page.getByLabel('Select question 2 for activation');
    expect(await unkeyedBox.isDisabled(), 'the unkeyed question must not be selectable yet');
    expect(await shortBox.isEnabled(), 'the complete short question is selectable');
    await shortBox.check();
    S.requests.length = 0;
    await page.getByRole('button', { name: /Activate 1 selected/ }).click();
    await page.getByText('Activated.').waitFor();
    expect(JSON.parse(sent('POST', `/api/platform/question-papers/${UUID}/activate`).pop().body).items.length === 1, 'only the selected question is sent');

    await page.locator('li', { hasText: 'Which state of matter has no fixed volume?' }).getByLabel('Correct option').selectOption('C');
    expect(await unkeyedBox.isEnabled(), 'choosing an option unlocks the question');
    await unkeyedBox.check();
    S.requests.length = 0;
    await page.getByRole('button', { name: /Activate 1 selected/ }).click();
    await page.getByText('Activated.').first().waitFor();
    const body2 = JSON.parse(sent('POST', `/api/platform/question-papers/${UUID}/activate`).pop().body);
    expect(body2.items[0].id === 1 && body2.items[0].correct_option === 'C', `activation body was ${JSON.stringify(body2)}`);
    await page.getByText('Active').first().waitFor();
    await page.screenshot({ path: path.join(SHOTS, '05-review.png') });
  });

  await step('each question shows its own chapter and how it was decided: automatic, suggestion only, or teacher-confirmed', async () => {
    // Question 2: matched automatically, so it says so and why, with the measured accuracy.
    await page.getByText(/Chapter: Matter in our surroundings \(ID 7\), matched automatically/).first().waitFor();
    // Question 3: a person confirmed it.
    await page.getByText(/Chapter: Matter in our surroundings \(ID 7\), confirmed by a teacher/).first().waitFor();
    // A question's chapter is never shown as a paper-level "Not resolved" problem.
    expect((await page.getByText(/Chapter:\s*Not resolved/).count()) === 0, 'a per-question chapter must not read "Not resolved"');
    await page.screenshot({ path: path.join(SHOTS, '05b-chapters.png') });
  });

  await step('leaving the page and coming back shows the same job and counts (state is server-side)', async () => {
    await page.goto('about:blank'); // leave the app entirely, as closing the tab would
    await openLibrary();
    await page.getByRole('button', { name: 'Question papers' }).click();
    await page.getByRole('button', { name: /standard_9_science\.pdf/ }).waitFor();
    await page.getByText(/2 active|3 active/).first().waitFor();
  });

  await step('the bell shows the persisted notice as unread, opens its details, and marks it read on the server', async () => {
    await openLibrary();
    const bell = page.getByRole('button', { name: /Notifications, 1 new/ });
    await bell.waitFor({ timeout: 30000 });
    await bell.click();
    await page.getByText('Question paper processed with warnings').waitFor();
    S.requests.length = 0;
    await page.getByRole('button', { name: /Question paper processed with warnings/ }).click();
    await page.waitForURL(new RegExp(`tab=question-papers&job=${UUID}`), { timeout: 30000 });
    await page.getByRole('button', { name: /standard_9_science\.pdf/ }).waitFor({ timeout: 60000 });
    await page.getByText('Academic context').waitFor();
    expect(sent('POST', '/api/platform/notifications/user/11/read').length === 1, 'the read must be recorded on the server');
    // after a reload the badge is gone because the server says it is read
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Notifications$/ }).waitFor({ timeout: 30000 });
    expect(await page.getByRole('button', { name: /Notifications, \d+ new/ }).count() === 0, 'badge must clear after the server-side read');
  });

  await step('a notification whose stored link is off-site never navigates away', async () => {
    const before = page.url();
    await page.getByRole('button', { name: /^Notifications$/ }).click();
    await page.getByRole('button', { name: /Unsafe link notice/ }).click();
    await page.waitForTimeout(800);
    expect(page.url() === before && new URL(page.url()).hostname === 'localhost', `navigated to ${page.url()}`);
  });

  await step('every API call was answered by the fixture: nothing unmocked, nothing aborted off-origin, no page errors', async () => {
    expect(S.unmocked.length === 0, `API calls the fixture does not know (they got a 404, not a backend): ${S.unmocked.join(', ')}`);
    expect(leaked === 0, `${leaked} request(s) to another localhost port were aborted (a local backend must never be reachable)`);
    expect(consoleErrors.filter((e) => /Hydration|Cannot read|is not a function|Minified React/i.test(e)).length === 0, `page errors: ${consoleErrors.join(' | ')}`);
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
