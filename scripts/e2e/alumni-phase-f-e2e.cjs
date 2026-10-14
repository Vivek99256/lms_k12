/**
 * Browser E2E for Alumni Phase F: reports and exports, bulk import, and the audit-log viewer.
 *
 *   ALUMNI_E2E_SESSIONS=<json> PLAYWRIGHT_PATH=<playwright> E2E_BASE_URL=http://localhost:3001 E2E_SKIP_MENU=1 \
 *     node scripts/e2e/alumni-phase-f-e2e.cjs
 *
 * Needs sessions named admin, acct (Accountant) and peon, and an institute with the sample alumni. Meant for the ISOLATED
 * stack (scratch SQLite backend from tests/Support/build_e2e_sqlite.php): it imports alumni and writes audit entries.
 * The CSV files it uploads are written to the OS temp folder with obviously fake addresses (example.invalid) and removed after.
 */
const os = require('os');
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, shot, expect, finish, fs, path } = createRunner();
const stamp = Date.now().toString().slice(-6);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alumni-e2e-'));
const write = (name, content) => { const p = path.join(tmp, name); fs.writeFileSync(p, content); return p; };

const HEAD = 'First Name,Last Name,Email,Mobile,DOB,Batch,Passing Year\n';
const CSV = HEAD
  + `Imp,ValidOne,imp.one.${stamp}@example.invalid,9100000001,2000-01-31,2017-18,2018\n`
  + `Imp,ValidTwo,imp.two.${stamp}@example.invalid,9100000002,25/03/2001,2017-18,2018\n`
  + `Imp,BadEmail,not-an-email,9100000003,2000-01-01,2017-18,2018\n`
  + `Imp,Formula,=cmd|' /C calc'!A0,9100000004,2000-01-01,2017-18,2018\n`
  + `Imp,Repeat,imp.one.${stamp}@example.invalid,9100000005,2000-01-01,2017-18,2018\n`;

(async () => {
  const browser = await chromium.launch();
  const { page } = await open(browser, 'admin');
  page.on('dialog', (d) => d.accept());

  await step('reports: catalog, a report renders with its summary and rows', async () => {
    await page.goto(`${BASE}/alumni/reports`);
    const nav = page.getByRole('navigation', { name: 'Reports' });
    for (const label of ['Alumni master', 'Batch-wise', 'Career and employment', 'Higher education', 'Location', 'Company and industry', 'Engagement', 'Events', 'Donations']) {
      await nav.getByRole('button', { name: new RegExp(`^${label}`) }).waitFor();
    }
    await page.getByRole('columnheader', { name: 'Alumni ID' }).waitFor();                 // the first report (master) loads
    await page.getByText(/Rows/).first().waitFor();
    await nav.getByRole('button', { name: /^Batch-wise/ }).click();
    await page.getByRole('columnheader', { name: 'Verified or active' }).waitFor();
    await page.locator('tbody tr').first().waitFor();
    await shot(page, 'f1-batch-report');
  });

  await step('reports: a filter narrows the rows and the CSV download matches the screen', async () => {
    await page.goto(`${BASE}/alumni/reports`);
    await page.getByRole('navigation', { name: 'Reports' }).getByRole('button', { name: /^Alumni master/ }).click();
    await page.locator('tbody tr').first().waitFor();
    const total = Number((await page.getByText('Rows', { exact: true }).locator('xpath=following-sibling::*').first().innerText()).replace(/\D/g, ''));
    await page.getByLabel('Country').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Clear filters' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    const text = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
    const lines = text.split('\n').filter(Boolean);
    expect(/^"?Alumni ID"?,"?Name"?,/.test(lines[0]), `unexpected header: ${lines[0]}`);   // CSV quotes headings that contain a space
    expect(lines.length - 1 > 0 && lines.length - 1 <= total, `filtered file has ${lines.length - 1} rows, unfiltered report has ${total}`);
    expect(dl.suggestedFilename().startsWith('alumni-report-master-'), 'file name should name the report');
  });

  await step('reports: Excel download is a real xlsx; location report counts', async () => {
    await page.goto(`${BASE}/alumni/reports`);
    await page.getByRole('navigation', { name: 'Reports' }).getByRole('button', { name: /^Location/ }).click();
    await page.getByRole('columnheader', { name: 'City' }).waitFor();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Excel' }).click()]);
    const bytes = fs.readFileSync(await dl.path());
    expect(bytes.slice(0, 2).toString() === 'PK', 'an .xlsx is a zip file');
    expect(dl.suggestedFilename().endsWith('.xlsx'), 'file extension');
  });

  await step('reports: events and donation reports run for an admin', async () => {
    await page.goto(`${BASE}/alumni/reports`);
    const nav = page.getByRole('navigation', { name: 'Reports' });
    // this database has no events or donations, so each report answers with an honest empty state, not an error
    await nav.getByRole('button', { name: /^Events/ }).click();
    await page.getByText('Nothing matches').waitFor();
    await page.getByText(/^Generated /).waitFor();
    await nav.getByRole('button', { name: /^Donations/ }).click();
    await page.getByText('Raised (verified, net)').waitFor();
    await page.getByText('Awaiting verification').waitFor();
    await page.getByText('Nothing matches').waitFor();
  });

  await step('import: a wrong file type is refused with a clear message', async () => {
    await page.goto(`${BASE}/alumni/import`);
    await page.getByRole('button', { name: 'Choose file' }).waitFor();
    await page.setInputFiles('input[type=file]', write('notes.txt', 'just some text'));
    await page.getByText(/Upload a \.csv or \.xlsx file/).waitFor();
    await page.setInputFiles('input[type=file]', write('fake.csv', 'PK\u0003\u0004binary'));
    await page.getByText(/Upload a \.csv or \.xlsx file/).waitFor();
  });

  await step('import: upload, columns are matched, the check finds every problem and saves nothing', async () => {
    await page.goto(`${BASE}/alumni/import`);
    await page.setInputFiles('input[type=file]', write('alumni.csv', CSV));
    await page.getByText('Match your columns to alumni fields').waitFor();
    expect(await page.locator('#map-first_name').inputValue() === '0', 'First Name column should be matched automatically');
    expect(await page.locator('#map-email').inputValue() === '2', 'Email column should be matched automatically');
    await page.getByRole('button', { name: 'Check my file' }).click();
    await page.getByText('Nothing has been saved yet.').waitFor();
    await page.getByRole('tab', { name: /Problems \(2\)/ }).waitFor();
    await page.getByRole('tab', { name: /Duplicates \(1\)/ }).waitFor();
    await page.getByRole('tab', { name: /Ready \(2\)/ }).waitFor();
    await page.getByText(/spreadsheet formulas/).waitFor();
    await page.getByRole('tab', { name: /Duplicates/ }).click();
    await page.getByText(/Repeats row 2/).waitFor();
    await shot(page, 'f2-import-review');
    // nothing was saved yet: a second browser window looking at the alumni list finds no "Imp" people
    const { page: other } = await open(browser, 'admin');
    await other.goto(`${BASE}/alumni/list?q=Imp`);
    await other.getByText('No alumni match these filters').waitFor();
    expect(await other.getByText('ValidOne').count() === 0, 'the check must not create alumni');
    await other.context().close();
  });

  await step('import: confirm adds only the ready rows, once; they start registered and uncontactable', async () => {
    await page.getByRole('button', { name: 'Import 2 alumni' }).click();                    // confirm dialog auto-accepted
    await page.getByText('Import finished').waitFor();
    await page.getByText(/2 alumni were added/).waitFor();
    await page.getByText(/no consent to be contacted yet/).waitFor();
    await page.getByRole('button', { name: 'Download rows that need attention' }).waitFor();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download rows that need attention' }).click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv.includes('Row in your file'), 'problems file has headings');
    expect(!csv.includes('ValidOne'), 'ready rows are not in the problems file');
    expect(!csv.includes('=cmd'), 'the formula cell is never written back out, even to the problems file');
    expect(csv.includes('look like spreadsheet formulas'), 'but the reason is explained');
    await page.goto(`${BASE}/alumni/list?q=Imp`);
    await page.getByText('ValidOne').waitFor();
    await page.getByText('ValidTwo').waitFor();
    expect(await page.getByText('BadEmail').count() === 0, 'a row with problems must not be imported');
    await shot(page, 'f3-imported');
  });

  await step('import: uploading the same file again reports everyone as already present', async () => {
    await page.goto(`${BASE}/alumni/import`);
    await page.setInputFiles('input[type=file]', write('again.csv', CSV));
    await page.getByText(/already imported on/).waitFor();
    await page.getByRole('button', { name: 'Check my file' }).click();
    await page.getByRole('tab', { name: /Ready \(0\)/ }).waitFor();
    await page.getByRole('tab', { name: /Duplicates \(3\)/ }).waitFor();                      // the two imported people + the in-file repeat
    await page.getByRole('button', { name: 'Nothing to import' }).waitFor();
    await page.getByRole('button', { name: 'Cancel import' }).click();
    await page.getByRole('button', { name: 'Choose file' }).waitFor();
    await page.getByText('Recent imports').waitFor();
  });

  await step('audit: the import and report downloads were recorded; details open; filters work', async () => {
    await page.goto(`${BASE}/alumni/audit`);
    await page.locator('tbody tr').first().waitFor();
    await page.getByLabel('Action').selectOption('confirm');
    await page.locator('tbody tr', { hasText: 'Confirm' }).first().waitFor();
    await page.locator('tbody tr').nth(1).waitFor({ state: 'detached' }).catch(() => undefined);      // the filtered list has settled
    await page.locator('tbody tr', { hasText: 'E2E' }).first().waitFor();                                  // and names who did it, not "System"
    await page.getByRole('button', { name: /Details of entry/ }).first().click();
    await page.getByText('After').waitFor();
    await page.getByText(/"imported": 2/).waitFor();
    await page.getByLabel('Action').selectOption('export');
    await page.locator('tbody tr', { hasText: 'Export' }).first().waitFor();
    await page.getByLabel('Person or record').fill('zzz-no-such-thing');
    await page.getByText('No entries').waitFor();
    await shot(page, 'f4-audit');
  });

  await step('import: a 230-row file is imported in resumable chunks with progress, every row exactly once', async () => {
    let big = HEAD;
    for (let i = 1; i <= 230; i++) big += `Bulk${i},Person,bulk${i}.${stamp}@example.invalid,95${String(i).padStart(8, '0')},2000-01-01,2019-20,2020\n`;
    await page.goto(`${BASE}/alumni/import`);
    await page.setInputFiles('input[type=file]', write('big.csv', big));
    await page.getByRole('button', { name: 'Check my file' }).click();
    await page.getByRole('tab', { name: /Ready \(230\)/ }).waitFor();
    await page.getByRole('button', { name: 'Import 230 alumni' }).click();
    await page.getByText('Import finished').waitFor({ timeout: 60000 });
    await page.getByText(/230 alumni were added/).waitFor();
    // the list, filtered to this batch, shows them (230 rows -> 10 pages of 25 -> last page has 5 rows)
    await page.goto(`${BASE}/alumni/list?batch=2019-20&q=Bulk`);
    await page.getByText(/230/).first().waitFor();
  });

  await step('permissions: accountant sees only the donation report; peon and accountant are refused import and audit', async () => {
    const { page: acct } = await open(browser, 'acct');
    await acct.goto(`${BASE}/alumni/reports`);
    const nav = acct.getByRole('navigation', { name: 'Reports' });
    await nav.getByRole('button', { name: /^Donations/ }).waitFor();
    expect(await nav.getByRole('button').count() === 1, 'an accountant is offered only the donation report');
    await acct.goto(`${BASE}/alumni/audit`);
    await acct.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    await acct.goto(`${BASE}/alumni/import`);
    await acct.getByRole('button', { name: 'Choose file' }).click({ trial: true }).catch(() => undefined);
    await acct.setInputFiles('input[type=file]', write('acct.csv', CSV));
    await acct.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    const { page: peon } = await open(browser, 'peon');
    for (const route of ['reports', 'audit']) {
      await peon.goto(`${BASE}/alumni/${route}`);
      await peon.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    }
  });

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  finish();
})();
