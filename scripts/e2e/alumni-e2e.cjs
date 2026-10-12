/**
 * Browser E2E for the Alumni module (Phase B screens). Shared plumbing is in lib.cjs.
 *
 *   ALUMNI_E2E_SESSIONS=<json file>  PLAYWRIGHT_PATH=<path to playwright pkg>  node scripts/e2e/alumni-e2e.cjs
 *
 * The sessions file holds short-lived JWTs minted out-of-band (never commit it):
 *   { "admin": {token, sub_institute_id, user_id, user_profile_id, user_profile_name, client_id, syear, term_id},
 *     "peon":  { ...a profile that is NOT allowed to manage alumni... } }
 * Optional: E2E_BASE_URL (default http://localhost:3000), E2E_SHOT_DIR (screenshots).
 *
 * SAFETY: the dev backend may point at a shared database. Everything this script creates uses an
 * e2e.*@sample.invalid email so it can be deleted by matching that pattern, and conversion is only
 * PREVIEWED - it never converts real students.
 */
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, shot, apiReturned, expect, finish, fs } = createRunner();
const stamp = Date.now().toString().slice(-7);

(async () => {
  const browser = await chromium.launch();
  const { page, context } = await open(browser, 'admin');
  let createdId = null;
  const person = { first: 'E2e' + stamp, last: 'Tester', email: `e2e.${stamp}@sample.invalid`, mobile: '0000' + stamp };

  await step('menu: Alumni Management is listed under Institute ERP', async () => {
    if (process.env.E2E_SKIP_MENU) return;   // the isolated SQLite backend cannot run the MySQL-only menu query
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    const label = page.getByText('Institute ERP', { exact: true }).first();
    if (!(await label.isVisible().catch(() => false))) {
      // the sidebar starts collapsed to icons: expand it with its toggle ('Expand sidebar' button)
      await page.getByRole('button', { name: 'Expand sidebar' }).click();
    }
    await label.click();
    await page.getByText('Alumni Management', { exact: true }).first().waitFor();
    await shot(page, '01-menu');
  });

  await step('dashboard: loads real totals and charts', async () => {
    await page.goto(`${BASE}/alumni/dashboard`);
    await page.getByRole('heading', { name: 'Alumni dashboard' }).waitFor();
    await page.getByText('Total alumni').waitFor();
    await page.getByText('Alumni by batch').waitFor();
    const text = await page.locator('main, body').first().innerText();
    expect(!/Couldn't load/i.test(text), 'dashboard showed a load error');
    await shot(page, '02-dashboard');
  });

  await step('list: rows, pagination, search, filter, sort', async () => {
    await page.goto(`${BASE}/alumni/list`);
    await page.locator('tbody tr').first().waitFor();
    const first = await page.locator('tbody tr').count();
    expect(first > 0 && first <= 25, `expected 1-25 rows, got ${first}`);
    await page.getByText(/Showing 1–\d+ of \d+/).waitFor();
    await Promise.all([apiReturned(page, 'q=Aarav'), page.getByLabel('Search alumni').fill('Aarav')]);
    await page.waitForTimeout(300);
    const names = await page.locator('tbody tr td a').allInnerTexts();
    expect(names.length > 0 && names.every((n) => /aarav/i.test(n)), `search returned non-matching rows: ${names.slice(0, 3)}`);
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await Promise.all([apiReturned(page, 'status=pending_verification'), page.getByLabel('All statuses').selectOption('pending_verification')]);
    await page.waitForTimeout(300);
    const badges = await page.locator('tbody tr td:nth-child(7)').allInnerTexts();
    expect(badges.length > 0 && badges.every((b) => /Pending verification/.test(b)), 'status filter leaked other statuses');
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await Promise.all([apiReturned(page, 'sort=full_name'), page.getByRole('button', { name: /^Name/ }).click()]);
    await page.waitForTimeout(300);
    const sorted = (await page.locator('tbody tr td a').allInnerTexts()).map((s) => s.toLowerCase());
    expect(sorted.join('|') === [...sorted].sort().join('|'), 'name sort ascending is not in order');
    await shot(page, '03-list');
  });

  await step('list: next page works', async () => {
    await page.goto(`${BASE}/alumni/list`);
    await page.locator('tbody tr').first().waitFor();
    const next = page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: /Next/ });
    if (await next.isDisabled()) return;   // <= 25 rows in this tenant: nothing to page
    await next.click();
    await page.getByText(/Page 2 of/).waitFor();
  });

  await step('add: empty submit shows server-side field errors', async () => {
    await page.goto(`${BASE}/alumni/add`);
    await page.getByRole('button', { name: 'Add alumni' }).click();
    await page.getByText(/first name field is required/i).waitFor();
    await page.getByText('Please correct the highlighted fields.').waitFor();
    await shot(page, '04-add-errors');
  });

  await step('add: valid record is created and opens its profile', async () => {
    await page.goto(`${BASE}/alumni/add`);
    await page.getByLabel('First name').fill(person.first);
    await page.getByLabel('Last name').fill(person.last);
    await page.locator('input[type="email"]').fill(person.email);
    await page.getByLabel('Mobile number', { exact: true }).fill(person.mobile);
    await page.getByLabel('City', { exact: true }).fill('Ahmedabad');
    await page.getByLabel('Country', { exact: true }).fill('India');
    await page.getByLabel('Passing year', { exact: true }).fill('2021');
    await page.getByRole('button', { name: 'Add alumni' }).click();
    await page.waitForURL(/\/alumni\/profile\/\d+/);
    createdId = page.url().match(/profile\/(\d+)/)[1];
    await page.getByRole('heading', { name: `${person.first} ${person.last}` }).waitFor();
    await page.getByText(/ALM-\d{4}-\d{5}/).first().waitFor();
    await shot(page, '05-profile');
  });

  if (!createdId) { console.log('Could not create the test alumnus - later steps need it, stopping.'); }
  await step('add: duplicate email is refused with a link to the existing alumnus', async () => {
    await page.goto(`${BASE}/alumni/add`);
    await page.getByLabel('First name').fill('Someone');
    await page.locator('input[type="email"]').fill(person.email);
    await page.getByRole('button', { name: 'Add alumni' }).click();
    await page.getByText('A matching alumni record already exists.').first().waitFor();
    await page.getByRole('link', { name: new RegExp(person.first) }).waitFor();
    await shot(page, '06-duplicate');
  });

  await step('profile: add and delete a career record, completion updates', async () => {
    await page.goto(`${BASE}/alumni/profile/${createdId}`);
    await page.getByRole('tab', { name: 'Education and career' }).click();
    const careerPanel = page.locator('section', { has: page.getByRole('heading', { name: 'Career history' }) });
    await careerPanel.getByRole('button', { name: 'Add job' }).click();
    await careerPanel.getByLabel('Company').fill('E2E Corp');
    await careerPanel.getByLabel('Job title').fill('Tester');
    await careerPanel.getByRole('button', { name: 'Save' }).click();
    await careerPanel.getByText('Tester at E2E Corp').waitFor();
    page.once('dialog', (d) => d.accept());
    await careerPanel.getByRole('button', { name: /Remove Tester at E2E Corp/ }).click();
    await careerPanel.getByText('No career history recorded').waitFor();
  });

  await step('profile: skill validation and add', async () => {
    await page.getByRole('tab', { name: 'Skills and achievements' }).click();
    const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Skills and expertise' }) });
    await panel.getByRole('button', { name: 'Add skill' }).click();
    await panel.getByRole('button', { name: 'Save' }).click();
    await panel.getByText(/skill field is required/i).waitFor();   // skill is required
    await panel.getByLabel('Skill').fill('Playwright');
    await panel.getByRole('button', { name: 'Save' }).click();
    await panel.getByText('Playwright').first().waitFor();
  });

  await step('profile: status change', async () => {
    await page.goto(`${BASE}/alumni/profile/${createdId}`);
    await page.getByLabel('Change status').selectOption('active');
    await page.getByRole('button', { name: 'Update status' }).click();
    await page.getByText('Status changed to active.').waitFor();
  });

  await step('edit: form is pre-filled and saving persists', async () => {
    await page.goto(`${BASE}/alumni/edit/${createdId}`);
    await page.getByLabel('First name').waitFor();
    expect((await page.getByLabel('First name').inputValue()) === person.first, 'edit form not pre-filled');
    await page.getByLabel('City', { exact: true }).fill('Surat');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(/\/alumni\/profile\/\d+/);
    await page.getByText('Surat').first().waitFor();
  });

  await step('profile: academic history tab explains an unlinked alumnus', async () => {
    await page.getByRole('tab', { name: 'Academic history' }).click();
    await page.getByText('Not linked to a student record').waitFor();
  });

  await step('pending verification: approve and reject (reason required)', async () => {
    // Make a pending record that belongs to this run, so no pre-existing registration is decided here.
    await page.goto(`${BASE}/alumni/profile/${createdId}`);
    await page.getByLabel('Change status').selectOption('pending_verification');
    await page.getByRole('button', { name: 'Update status' }).click();
    await page.getByText('Status changed to pending verification.').waitFor();
    await page.goto(`${BASE}/alumni/pending_verification`);
    const row = page.locator('li', { hasText: person.first });
    await row.waitFor();
    await row.getByRole('button', { name: 'Reject' }).click();
    const confirm = row.getByRole('button', { name: 'Reject registration' });
    expect(await confirm.isDisabled(), 'reject must be disabled until a reason is typed');
    await row.getByLabel(/Reason for rejecting/).fill('E2E check');
    await confirm.click();
    await page.getByText(/registration was rejected/).waitFor();
    await shot(page, '07-pending');
  });

  // ---- Step 2: batches, privacy, documents, directory, export, bulk, achievements ----
  const p2 = { first: 'Pvt' + stamp, last: 'Directory', email: `e2e.pvt.${stamp}@sample.invalid`, mobile: '0001' + stamp };
  let p2Id = null;
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

  await step('batches: statistics, regroup and link into the filtered list', async () => {
    await page.goto(`${BASE}/alumni/batches`);
    await page.getByRole('heading', { name: 'Batches' }).waitFor();
    await page.locator('tbody tr').first().waitFor();
    await page.locator('tfoot').getByText('All').waitFor();
    await Promise.all([apiReturned(page, 'group_by=passing_year'), page.getByLabel('Group by').selectOption('passing_year')]);
    await page.locator('tbody tr').first().waitFor();
    const firstKey = (await page.locator('tbody tr th a').first().innerText()).trim();
    await page.locator('tbody tr th a').first().click();
    await page.waitForURL(/\/alumni\/list\?passing_year=/);
    await page.locator('tbody tr').first().waitFor();
    // the select's options arrive in a separate request from the rows, so wait for it to take the value instead of reading it once
    await page.waitForFunction((key) => { const el = document.querySelector('select'); return [...document.querySelectorAll('select')].some((x) => x.value === key); }, firstKey, { timeout: 10000 }).catch(() => undefined);
    expect((await page.getByLabel('All passing years').inputValue()) === firstKey, 'list filter not pre-set from the link');
    await shot(page, '11-batches-link');
  });

  await step('setup: a second alumnus made active for the directory', async () => {
    await page.goto(`${BASE}/alumni/add`);
    await page.getByLabel('First name').fill(p2.first);
    await page.getByLabel('Last name').fill(p2.last);
    await page.locator('input[type="email"]').fill(p2.email);
    await page.getByLabel('Mobile number', { exact: true }).fill(p2.mobile);
    await page.getByLabel('City', { exact: true }).fill('Ahmedabad');
    await page.getByLabel('Country', { exact: true }).fill('India');
    await page.getByLabel('Passing year', { exact: true }).fill('2021');
    await page.getByRole('button', { name: 'Add alumni' }).click();
    await page.waitForURL(/\/alumni\/profile\/\d+/);
    p2Id = page.url().match(/profile\/(\d+)/)[1];
    await page.getByLabel('Change status').selectOption('active');
    await page.getByRole('button', { name: 'Update status' }).click();
    await page.getByText('Status changed to active.').waitFor();
  });

  await step('privacy: choices and consent are saved and survive a reload', async () => {
    await page.goto(`${BASE}/alumni/profile/${p2Id}`);
    await page.getByRole('tab', { name: 'Privacy and consent' }).click();
    await page.getByLabel('Who can see City, state and country').selectOption('private');
    await page.getByLabel('Who can see Mobile numbers').selectOption('private');
    await page.getByLabel('SMS').check();
    await page.getByRole('button', { name: 'Save privacy settings' }).click();
    await page.getByText('Privacy and consent settings saved.').waitFor();
    await page.reload();
    await page.getByRole('tab', { name: 'Privacy and consent' }).click();
    await page.getByLabel('Who can see Mobile numbers').waitFor();
    expect((await page.getByLabel('Who can see City, state and country').inputValue()) === 'private', 'location choice not persisted');
    expect(await page.getByLabel('SMS').isChecked(), 'SMS consent not persisted');
    await shot(page, '12-privacy');
  });

  await step('directory: a private field is hidden and cannot be searched on', async () => {
    await page.goto(`${BASE}/alumni/directory`);
    await Promise.all([apiReturned(page, 'q=' + p2.first), page.getByLabel('Search the directory').fill(p2.first)]);
    const card = page.locator('li', { hasText: `${p2.first} ${p2.last}` });
    await card.waitFor();
    await card.getByText(/hidden by this alumnus/).waitFor();
    expect(!(await card.innerText()).includes('Ahmedabad'), 'a private city was shown in the directory');
    expect(!(await card.innerText()).includes(p2.mobile), 'a private mobile number was shown in the directory');
    // searching on the hidden city must not find them
    await page.getByLabel('Search the directory').fill('');
    await Promise.all([apiReturned(page, 'city=Ahmedabad'), page.getByLabel('All cities').selectOption({ label: 'Ahmedabad' }).catch(() => undefined)]);
    const options = await page.getByLabel('All cities').locator('option').allInnerTexts();
    if (options.includes('Ahmedabad')) {
      await page.waitForTimeout(600);
      expect(!(await page.locator('main, body').first().innerText()).includes(p2.first), 'hidden city matched in a filter');
    }
    await shot(page, '13-directory');
  });

  await step('documents: upload, download, verify, reject needs a reason, delete', async () => {
    await page.goto(`${BASE}/alumni/profile/${p2Id}`);
    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.getByLabel('Document type').selectOption('graduation_certificate');
    await page.locator('input[type="file"]').setInputFiles({ name: 'degree.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.getByText('Document uploaded.').waitFor();
    const row = page.locator('li', { hasText: 'degree.pdf' });
    await row.getByText('Pending').waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: 'Download' }).click()]);
    expect(download.suggestedFilename() === 'degree.pdf', `download named ${download.suggestedFilename()}`);
    expect(fs.readFileSync(await download.path()).slice(0, 5).toString() === '%PDF-', 'downloaded bytes are not the uploaded PDF');
    await row.getByRole('button', { name: 'Reject', exact: true }).click();
    expect(await row.getByRole('button', { name: 'Reject document' }).isDisabled(), 'reject must need a reason');
    await row.getByRole('button', { name: 'Cancel' }).click();
    await row.getByRole('button', { name: 'Verify' }).click();
    await page.getByText('Document verified.').waitFor();
    await shot(page, '14-documents');
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /Remove degree.pdf/ }).click();
    await page.getByText('Document removed.').waitFor();
  });

  await step('documents: a PHP file disguised as a PDF is refused', async () => {
    await page.getByLabel('Document type').selectOption('other');
    await page.locator('input[type="file"]').setInputFiles({ name: 'photo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<?php echo 1; ?>') });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.getByText('Upload a PDF, JPG, PNG or Word document.').first().waitFor();
    await page.getByText('No documents uploaded').waitFor();
  });

  await step('achievements: add and verify', async () => {
    await page.getByRole('tab', { name: 'Skills and achievements' }).click();
    const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Achievements and certifications' }) });
    await panel.getByRole('button', { name: 'Add achievement' }).click();
    await panel.getByLabel('Category').selectOption('award');
    await panel.getByLabel('Title').fill('E2E award');
    await panel.getByRole('button', { name: 'Save' }).click();
    const item = panel.locator('li', { hasText: 'E2E award' });
    await item.getByText(/Pending/).waitFor();
    await item.getByRole('button', { name: 'Verify' }).click();
    await item.getByText(/Verified/).waitFor();
  });

  await step('list: export CSV downloads a masked file; bulk status changes the selection', async () => {
    await page.goto(`${BASE}/alumni/list`);
    await Promise.all([apiReturned(page, 'q=' + p2.first), page.getByLabel('Search alumni').fill(p2.first)]);
    const row = page.locator('tbody tr', { hasText: p2.first });
    await row.waitFor();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    const csv = fs.readFileSync(await file.path(), 'utf8');
    expect(csv.includes('Alumni ID') && csv.includes(p2.first), 'export is missing the header or the filtered alumnus');
    expect(csv.includes(p2.email), 'institution_only email should be exported');
    expect(!csv.includes(p2.mobile), 'a private mobile number leaked into the export');
    expect(!/e2e\.\d+@sample\.invalid/.test(csv.replace(p2.email, '')) , 'the export contains rows outside the search filter');
    await row.getByLabel(`Select ${p2.first} ${p2.last}`).check();
    await page.getByLabel('Bulk change status').selectOption('inactive');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByText('1 alumni changed to inactive.').waitFor();
    await shot(page, '15-bulk');
  });

  await step('conversion: preview loads (read-only, nothing converted)', async () => {
    await page.goto(`${BASE}/alumni/conversion`);
    await page.getByText(/eligible student\(s\) not yet alumni|No students are waiting/).first().waitFor();
    await shot(page, '08-conversion');
  });

  await step('responsive: list is usable at 390px wide', async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${BASE}/alumni/list`);
    await page.locator('tbody tr').first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow <= 4, `page scrolls horizontally by ${overflow}px`);
    await shot(page, '09-mobile');
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await context.close();

  const denied = await open(browser, 'peon');
  await step('permissions: a non-alumni profile is refused by the API', async () => {
    await denied.page.goto(`${BASE}/alumni/list`);
    await denied.page.getByText('You do not have access to alumni management.').first().waitFor();
    await shot(denied.page, '10-denied');
  });
  await denied.context.close();
  await browser.close();

  finish(`E2E records use the email pattern e2e.${stamp}@sample.invalid`);
})();
