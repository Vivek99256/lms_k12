/**
 * Shared plumbing for the Alumni browser E2E scripts (alumni-e2e.cjs, alumni-phase-c-e2e.cjs).
 *
 * Environment:
 *   ALUMNI_E2E_SESSIONS  JSON file of short-lived JWTs minted out-of-band - NEVER commit it:
 *                        { "<name>": {token, sub_institute_id, user_id, user_profile_id, user_profile_name, client_id, syear, term_id}, ... }
 *   PLAYWRIGHT_PATH      path to a Playwright package (it is not a project dependency)
 *   E2E_BASE_URL         default http://localhost:3000
 *   E2E_SHOT_DIR         screenshots and results.json
 *
 * Sessions seed localStorage the way the app's login would, so no password is ever used. Tokens are never logged.
 */
const fs = require('fs');
const path = require('path');

function createRunner() {
  const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const SHOTS = process.env.E2E_SHOT_DIR || path.join(process.cwd(), 'e2e-shots');
  const sessions = JSON.parse(fs.readFileSync(process.env.ALUMNI_E2E_SESSIONS, 'utf8'));
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  fs.mkdirSync(SHOTS, { recursive: true });

  const results = [];
  const consoleErrors = [];
  let activePage = null;

  async function open(browser, who, viewport = { width: 1440, height: 900 }) {
    const s = sessions[who];
    if (!s) throw new Error(`No session named "${who}" in ${process.env.ALUMNI_E2E_SESSIONS}`);
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    await context.addInitScript(({ s }) => {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('auth', JSON.stringify({ name: 'E2E', email: 'e2e@example.invalid' }));
      localStorage.setItem('sessionDate', today);
      localStorage.setItem('menuContext', JSON.stringify({
        sub_institute_id: s.sub_institute_id, user_id: s.user_id, user_profile_name: s.user_profile_name,
        user_profile_id: s.user_profile_id, client_id: s.client_id,
      }));
      localStorage.setItem('userData', JSON.stringify({
        user_token: s.token, token: s.token, sub_institute_id: s.sub_institute_id, user_id: s.user_id, id: s.user_id,
        user_profile_id: s.user_profile_id, user_profile_name: s.user_profile_name, client_id: s.client_id,
        syear: s.syear, term_id: s.term_id,
      }));
      localStorage.setItem('selectedAcademicYear', String(s.syear));
    }, { s });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/verify\.min\.js|require is not defined|favicon/i.test(t)) return;   // known pre-existing noise
      consoleErrors.push(`[${who}] ${t.slice(0, 200)}`);
    });
    page.on('response', (r) => {
      if (r.status() < 400) return;
      const u = new URL(r.url());
      consoleErrors.push(`[${who}] HTTP ${r.status()} ${u.pathname}${u.searchParams.get('path') ? ' path=' + u.searchParams.get('path') : ''}`);   // path only: no headers, no tokens
    });
    page.setDefaultTimeout(20000);
    activePage = page;
    return { context, page };
  }

  async function step(name, fn) {
    const started = Date.now();
    try {
      await fn();
      results.push({ name, ok: true, ms: Date.now() - started });
      console.log(`PASS  ${name}`);
    } catch (error) {
      // the Playwright call log names the locator that failed, so keep a few lines
      const msg = String(error.message || error).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' | ');
      if (activePage) await activePage.screenshot({ path: path.join(SHOTS, 'FAIL-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 50) + '.png') }).catch(() => undefined);
      results.push({ name, ok: false, error: msg });
      console.log(`FAIL  ${name}\n      ${msg}`);
    }
  }

  const setActive = (page) => { activePage = page; };
  const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => undefined);
  const apiReturned = (page, needle) => page.waitForResponse((r) => r.url().includes('alumni') && r.url().includes(needle) && r.status() < 500, { timeout: 30000 });
  function expect(cond, msg) { if (!cond) throw new Error(msg); }

  function finish(extra = '') {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
    // 4xx are the API refusing bad input on purpose; 5xx are bugs - say so separately.
    const unique = [...new Set(consoleErrors)];
    const serverErrors = unique.filter((e) => / HTTP 5\d\d /.test(e));
    if (serverErrors.length) console.log('HTTP 5xx seen (investigate unless it is a non-alumni shell endpoint):\n  ' + serverErrors.join('\n  '));
    if (extra) console.log(extra);
    fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, consoleErrors: unique }, null, 2));
    process.exit(failed.length ? 1 : 0);
  }

  return { BASE, SHOTS, chromium, open, step, setActive, shot, apiReturned, expect, finish, fs, path };
}

module.exports = { createRunner };
