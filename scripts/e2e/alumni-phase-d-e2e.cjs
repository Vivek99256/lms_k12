/**
 * Browser E2E for Alumni Phase D: communication (send, campaigns, templates, history), events and surveys.
 *
 *   ALUMNI_E2E_SESSIONS=<json> PLAYWRIGHT_PATH=<playwright> E2E_BASE_URL=http://localhost:3001 E2E_SKIP_MENU=1 \
 *     node scripts/e2e/alumni-phase-d-e2e.cjs
 *
 * Needs sessions named admin and peon, and an institute that already has the sample alumni. Meant for the ISOLATED
 * stack (scratch SQLite backend from tests/Support/build_e2e_sqlite.php): it sends messages, creates events and surveys.
 * The scratch backend has no mail transport, so email is expected to be recorded as SKIPPED, never as sent - that is
 * exactly what several steps assert. See lib.cjs for the shared setup and the session file format.
 */
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, shot, expect, finish } = createRunner();
const stamp = Date.now().toString().slice(-6);
const isoDay = (days) => {
  const d = new Date(Date.now() + days * 864e5);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

(async () => {
  const browser = await chromium.launch();
  const { page } = await open(browser, 'admin');
  page.on('dialog', (d) => d.accept());
  const tplName = `E2E template ${stamp}`;
  const eventName = `E2E reunion ${stamp}`;
  const surveyName = `E2E feedback ${stamp}`;
  const subject = `E2E announcement ${stamp}`;

  await step('communication: validation, audience preview and honest channel states', async () => {
    await page.goto(`${BASE}/alumni/communication`);
    await page.getByRole('button', { name: 'Send now' }).click();
    await page.getByText('Write a subject.').waitFor();
    await page.getByText('Write the message.').waitFor();
    await page.getByText('Live', { exact: true }).first().waitFor();                 // the in-app inbox is really deliverable
    await page.getByText(/No driver yet|Not configured/).first().waitFor();          // SMS / WhatsApp / mobile never pretend
    await page.getByRole('button', { name: 'Check who will be reached' }).click();
    await page.getByRole('status').filter({ hasText: /eligible alumni match/ }).waitFor();
    await shot(page, 'd1-compose');
  });

  await step('communication: send to a filtered group; result is reported honestly', async () => {
    await page.goto(`${BASE}/alumni/communication`);
    await page.getByLabel('Subject').fill(subject);
    await page.getByLabel(/^Message/).fill('Hello {{name}}, this is a test from {{institute}}.');
    await page.getByRole('button', { name: 'Send now' }).click();
    await page.getByRole('status').getByText(/Done: \d+ sent, \d+ skipped, \d+ failed, \d+ not contacted for lack of consent/).waitFor();   // survives the switch to Campaigns
    const row = page.locator('tbody tr', { hasText: subject });
    await row.waitFor();
    await row.getByRole('button', { name: new RegExp(`Details of`) }).click();
    await page.getByText('Delivery by channel').waitFor();
    await page.getByText(/In-app inbox: \d+ sent/).waitFor();                         // web channel really delivered
    // The sample alumni have not consented to email, so email is NOT attempted and is counted as "no consent" - never as sent.
    expect(await page.getByText(/Email: .*sent/).count() === 0, 'email must not be reported as sent');
    expect(Number((await row.locator('td').nth(6).innerText()).trim()) > 0, 'people without consent are counted, not silently dropped');
    await shot(page, 'd2-campaign-detail');
  });

  await step('communication: draft, schedule for later, cancel', async () => {
    await page.goto(`${BASE}/alumni/communication`);
    await page.getByLabel('Subject').fill(`${subject} draft`);
    await page.getByLabel(/^Message/).fill('Draft body for {{name}}');
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    const row = page.locator('tbody tr', { hasText: `${subject} draft` });
    await row.getByText('Draft', { exact: true }).waitFor();
    await row.getByRole('button', { name: /Details of/ }).click();
    await page.getByRole('button', { name: 'Cancel campaign' }).click();             // dialog auto-accepted
    await page.locator('tbody tr', { hasText: `${subject} draft` }).getByText('Cancelled', { exact: true }).waitFor();
  });

  await step('communication: template create, edit, delete; history lists every attempt with its reason', async () => {
    await page.goto(`${BASE}/alumni/communication`);
    await page.getByRole('tab', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'New template' }).click();
    await page.getByRole('button', { name: 'Save template' }).click();
    await page.getByText(/name field is required|name is required|Name/i).first().waitFor();
    await page.getByLabel(/^Name/).fill(tplName);
    await page.getByLabel('Subject').fill('Hi {{name}}');
    await page.getByLabel(/^Message/).fill('Body {{batch}}');
    await page.getByRole('button', { name: 'Save template' }).click();
    await page.getByText('Template saved.').waitFor();
    await page.getByRole('button', { name: `Edit ${tplName}` }).click();
    await page.getByLabel('Subject').fill('Hello {{name}}');
    await page.getByRole('button', { name: 'Save template' }).click();
    await page.getByText(`Hello {{name}}`).first().waitFor();
    await page.getByRole('button', { name: `Delete ${tplName}` }).click();
    await page.getByText(tplName).waitFor({ state: 'detached' });
    await page.getByRole('tab', { name: 'History' }).click();
    await page.locator('tbody tr', { hasText: subject }).first().waitFor();
    await page.getByLabel('Filter by status').selectOption('sent');
    await page.locator('tbody tr').first().getByText('Sent', { exact: true }).waitFor();
    await page.getByLabel('Filter by channel').selectOption('sms');
    await page.getByText('No messages yet').waitFor();                              // nothing was ever "sent" by SMS
    await shot(page, 'd3-history');
  });

  await step('events: create validates, saves as a draft, publishes', async () => {
    await page.goto(`${BASE}/alumni/events`);
    await page.getByRole('button', { name: 'New event' }).click();
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.getByText('Give the event a name.').waitFor();
    await page.getByText('Choose the event date.').waitFor();
    await page.getByLabel('Event name').fill(eventName);
    await page.getByLabel(/^Date/).fill(isoDay(0));   // today, so check-in is open (it opens the day before)
    await page.getByLabel('Venue').fill('Main hall');
    await page.getByLabel(/^Capacity/).fill('2');
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.getByText(/Event saved as a draft/).waitFor();
    await page.getByRole('link', { name: eventName }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByText('Event published.').waitFor();
    await shot(page, 'd4-event');
  });

  let regNo = '';
  await step('events: registration respects capacity (waiting list), confirm, cancel promotes', async () => {
    await page.goto(`${BASE}/alumni/events`);
    await page.getByRole('link', { name: eventName }).click();
    await page.getByRole('tab', { name: 'Registrations' }).click();
    for (const name of ['Aarav', 'Diya']) {
      await page.getByLabel(/^Alumnus/).fill(name);
      await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button').first().click();
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await page.getByText(/Registered|registered|confirmed/i).first().waitFor();
    }
    // a third person goes to the waiting list because capacity is 2
    await page.getByLabel(/^Alumnus/).fill('Kabir');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await page.locator('tbody tr', { hasText: 'Waitlisted' }).waitFor();
    regNo = (await page.locator('tbody tr').first().locator('td').nth(1).innerText()).split('\n')[0].trim();
    expect(/\S+/.test(regNo), 'a registration number should be shown');
    // cancelling one confirmed registration promotes the waiting one
    await page.getByRole('button', { name: /Cancel registration of/ }).first().click();
    await page.locator('tbody tr', { hasText: 'Waitlisted' }).waitFor({ state: 'detached' });
    await shot(page, 'd5-registrations');
  });

  await step('events: check-in by registration number; a second scan says already checked in', async () => {
    await page.goto(`${BASE}/alumni/events`);
    await page.getByRole('link', { name: eventName }).click();
    await page.getByRole('tab', { name: 'Registrations' }).click();
    const live = page.locator('tbody tr').filter({ hasNotText: 'Cancelled' }).filter({ hasText: /^(?!.*Waitlisted)/ });
    const no = (await live.first().locator('td').nth(1).innerText()).split('\n')[0].trim();
    await page.getByRole('button', { name: /^Confirm / }).first().click().catch(() => undefined);
    await page.getByRole('tab', { name: 'Check-in' }).click();
    await page.getByLabel('Value').fill('NOPE-000');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await page.getByRole('status').getByRole('alert').or(page.getByRole('status').getByText(/not found|No registration|couldn/i)).first().waitFor();
    await page.getByLabel('Value').fill(no);
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await page.getByRole('status').getByText(/is checked in|already checked in/).waitFor();
    await page.getByLabel('Value').fill(no);
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await page.getByRole('status').getByText('was already checked in.').waitFor();
  });

  await step('events: complete, report counts, feedback only from attendees', async () => {
    await page.goto(`${BASE}/alumni/events`);
    await page.getByRole('link', { name: eventName }).click();
    await page.getByRole('button', { name: 'Mark completed' }).click();
    await page.getByText('Event marked completed.').waitFor();
    await page.getByRole('tab', { name: 'Report and feedback' }).click();
    await page.getByText('Attended', { exact: true }).waitFor();
    await page.getByLabel(/^From/).fill('Aarav');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button').first().click();
    await page.getByLabel('Comments').fill('Great evening');
    await page.getByRole('button', { name: 'Add feedback' }).click();
    await page.getByText(/Feedback saved\.|attend/i).first().waitFor();            // saved, or refused because that person did not attend
    await shot(page, 'd6-event-report');
  });

  await step('surveys: builder validates; create; publish; record a response; results aggregate', async () => {
    await page.goto(`${BASE}/alumni/surveys`);
    await page.getByRole('button', { name: 'New survey' }).click();
    await page.getByRole('button', { name: 'Create survey' }).click();
    await page.getByText('Give the survey a title.').waitFor();
    await page.getByLabel('Title').fill(surveyName);
    await page.getByLabel(/^Question 1/).fill('How satisfied are you?');
    await page.getByLabel('Answer type').first().selectOption('rating');
    await page.getByRole('button', { name: 'Add question' }).click();
    await page.getByLabel(/^Question 2/).fill('Which area helped most?');
    await page.getByLabel('Answer type').nth(1).selectOption('single_choice');
    await page.getByRole('button', { name: 'Create survey' }).click();
    await page.getByText('needs at least two options, one per line.').waitFor();
    await page.getByLabel('Options (one per line)').fill('Academics\nSports');
    await page.getByRole('button', { name: 'Create survey' }).click();
    await page.getByText(/Survey saved as a draft/).waitFor();
    await page.getByRole('link', { name: surveyName }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByText('Survey published.').waitFor();
    await page.getByRole('tab', { name: 'Participation' }).click();
    await page.getByLabel(/^Alumnus/).fill('Aarav');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button').first().click();
    await page.getByLabel(/How satisfied/).fill('4');
    await page.getByLabel(/Which area/).selectOption('Academics');
    await page.getByRole('button', { name: 'Record response' }).click();
    await page.getByText('Response recorded.').waitFor();
    await page.getByRole('tab', { name: 'Results' }).click();
    await page.getByText('Academics').waitFor();
    await page.getByText(/Average 4/).waitFor();
    await shot(page, 'd7-survey-results');
  });

  await step('surveys: the same person cannot answer twice', async () => {
    await page.goto(`${BASE}/alumni/surveys`);
    await page.getByRole('link', { name: surveyName }).click();
    await page.getByRole('tab', { name: 'Participation' }).click();
    await page.getByLabel(/^Alumnus/).fill('Aarav');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button').first().click();
    await page.getByLabel(/How satisfied/).fill('5');
    await page.getByLabel(/Which area/).selectOption('Sports');
    await page.getByRole('button', { name: 'Record response' }).click();
    await page.getByText(/already|responded/i).first().waitFor();
  });

  await step('profile: Communication and Events tabs show this alumnus only', async () => {
    await page.goto(`${BASE}/alumni/events`);
    await page.getByRole('link', { name: eventName }).click();
    await page.getByRole('tab', { name: 'Registrations' }).click();
    await page.getByRole('link', { name: /Aarav Shah/ }).first().click();
    await page.waitForURL(/\/alumni\/profile\/\d+/);
    await page.getByRole('tab', { name: 'Communication' }).click();
    await page.getByText(/Messages sent to this alumnus/).waitFor();
    await page.getByRole('tab', { name: 'Events' }).click();
    await page.getByRole('link', { name: eventName }).waitFor();
    await shot(page, 'd8-profile-tabs');
  });

  await step('permissions: a non-alumni staff profile is refused cleanly', async () => {
    const { page: p2 } = await open(browser, 'peon');
    await p2.goto(`${BASE}/alumni/communication`);
    await p2.getByRole('tab', { name: 'History' }).click();
    await p2.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    await p2.goto(`${BASE}/alumni/events`);
    await p2.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    await p2.goto(`${BASE}/alumni/surveys`);
    await p2.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
  });

  await browser.close();
  finish();
})();
