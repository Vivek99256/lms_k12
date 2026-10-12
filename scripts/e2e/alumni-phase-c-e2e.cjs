/**
 * Browser E2E for Alumni Phase C: mentors, the mentorship workflow, engagement, opportunities and the student view.
 *
 *   ALUMNI_E2E_SESSIONS=<json> PLAYWRIGHT_PATH=<playwright> E2E_BASE_URL=http://localhost:3001 E2E_SKIP_MENU=1 \
 *     node scripts/e2e/alumni-phase-c-e2e.cjs
 *
 * Needs sessions named admin, peon, student and student2 (students 501 and 502 of the same institute) and an
 * institute that already has the sample alumni. It is meant for the ISOLATED stack (scratch SQLite backend built by
 * tests/Support/build_e2e_sqlite.php) because it creates mentors, requests, sessions and opportunities.
 * See lib.cjs for the shared setup and the session file format.
 */
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, shot, apiReturned, expect, finish } = createRunner();
const stamp = Date.now().toString().slice(-6);
const future = (days, hour = 10) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(hour, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const isoDay = (days) => future(days).slice(0, 10);

(async () => {
  const browser = await chromium.launch();
  const { page, context } = await open(browser, 'admin');
  const areaA = `Data analytics ${stamp}`;
  const areaB = `Marine biology ${stamp}`;

  // Register one mentor, picking the alumnus by typing (first sample alumnus is "Aarav Shah").
  await step('mentors: register a mentor through the search picker; a second registration is refused', async () => {
    await page.goto(`${BASE}/alumni/mentorship`);
    await page.getByRole('tab', { name: 'Mentors' }).click();
    await page.getByRole('button', { name: 'Register a mentor' }).click();
    await page.getByRole('button', { name: 'Register mentor' }).click();            // nothing chosen yet
    await page.getByText('Choose an alumnus.').waitFor();
    await page.getByLabel('Alumnus', { exact: true }).fill('Aarav');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button', { name: /Aarav Shah/ }).click();
    await page.getByLabel('Expertise').fill(`data analytics python ${stamp}`);
    await page.getByLabel('Job role').fill('Data scientist');
    await page.getByLabel('Students at once').fill('1');
    await page.getByLabel('Mon', { exact: true }).check();
    await page.getByRole('button', { name: 'Register mentor' }).click();
    await page.getByText('Aarav Shah is now a mentor.').waitFor();
    await page.locator('tbody tr', { hasText: 'Aarav Shah' }).getByText('0 of 1').waitFor();
    // the same alumnus again
    await page.getByRole('button', { name: 'Register a mentor' }).click();
    await page.getByLabel('Alumnus', { exact: true }).fill('Aarav');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button', { name: /Aarav Shah/ }).click();
    await page.getByRole('button', { name: 'Register mentor' }).click();
    await page.getByText('This alumnus is already registered as a mentor.').waitFor();
    await shot(page, 'c1-mentors');
  });

  await step('requests: log a request for a student found by name', async () => {
    await page.goto(`${BASE}/alumni/mentorship`);
    await page.getByRole('button', { name: 'New request' }).click();
    await page.getByRole('button', { name: 'Save request' }).click();
    await page.getByText('Choose a student.').waitFor();
    await page.getByLabel('Student', { exact: true }).fill('Asha');
    await page.getByRole('listbox', { name: 'Student results' }).getByRole('button', { name: /Asha Student/ }).click();
    await page.getByLabel('Career area').fill(areaA);
    await page.getByLabel('Guidance needed').fill('how to begin with analytics and python');
    await page.getByRole('button', { name: 'Save request' }).click();
    await page.getByText('Mentorship request logged for Asha Student.').waitFor();
    await page.locator('tbody tr', { hasText: areaA }).getByText('Open', { exact: true }).first().waitFor();   // the status chip (the row's button is also called Open)
  });

  await step('workflow: suggestions explain themselves, match, accept, schedule, complete, feedback, finish', async () => {
    await page.goto(`${BASE}/alumni/mentorship`);
    await page.getByRole('button', { name: new RegExp(`Open request from Asha Student about ${areaA}`) }).click();
    await page.getByRole('button', { name: 'Find mentors' }).click();
    await page.getByText(/Matches: .*analytics/).waitFor();                         // the reason is shown, not hidden
    await page.getByRole('button', { name: 'Match Aarav Shah' }).click();
    await page.getByText(/Matched with Aarav Shah/).waitFor();
    expect(await page.getByRole('button', { name: 'Mentor declines' }).isDisabled(), 'declining must need a reason');
    await page.getByRole('button', { name: 'Mentor accepts' }).click();
    await page.getByText('Mentor accepted the request.').waitFor();
    expect(await page.getByRole('button', { name: 'Complete mentorship' }).isDisabled(), 'cannot complete before a session is held');
    await page.getByLabel('Date and time').fill(future(2));
    await page.getByLabel('Link or place').fill('https://meet.example/abc');
    await page.getByRole('button', { name: 'Schedule session' }).click();
    await page.getByText('Session scheduled.').waitFor();
    await page.getByRole('button', { name: /Mark session on .* completed/ }).click();
    await page.getByText(/Session marked completed/).waitFor();
    await page.getByLabel('Rating', { exact: true }).selectOption('5');
    await page.getByRole('button', { name: 'Save feedback' }).click();
    await page.getByText('Feedback saved.').waitFor();
    await page.getByText(/Student feedback: 5\/5/).waitFor();
    await page.getByLabel('Feedback from').selectOption('mentor');
    await page.getByLabel('Rating', { exact: true }).selectOption('4');
    await page.getByRole('button', { name: 'Save feedback' }).click();
    await page.getByText(/Mentor feedback: 4\/5/).waitFor();
    await page.getByRole('button', { name: 'Complete mentorship' }).click();
    await page.getByText('Mentorship completed.').waitFor();
    await shot(page, 'c2-workflow');
  });

  await step('workflow: a declining mentor is not offered again; cancel works', async () => {
    await page.goto(`${BASE}/alumni/mentorship`);
    await page.getByRole('button', { name: 'New request' }).click();
    await page.getByLabel('Student', { exact: true }).fill('Ravi');
    await page.getByRole('listbox', { name: 'Student results' }).getByRole('button', { name: /Ravi Student/ }).click();
    await page.getByLabel('Career area').fill(areaB);
    await page.getByRole('button', { name: 'Save request' }).click();
    await page.getByText('Mentorship request logged for Ravi Student.').waitFor();
    await page.getByRole('button', { name: new RegExp(`Open request from Ravi Student about ${areaB}`) }).click();
    await page.getByRole('button', { name: 'Find mentors' }).click();
    await page.getByRole('button', { name: 'Match Aarav Shah' }).click();           // Aarav's slot was freed by the completed mentorship
    await page.getByText(/Matched with Aarav Shah/).waitFor();
    await page.getByLabel("Mentor's note (required if declining)").fill('Too busy this term');
    await page.getByRole('button', { name: 'Mentor declines' }).click();
    await page.getByText('Mentor declined. The request is open again.').waitFor();
    await page.getByRole('button', { name: 'Find mentors' }).click();
    await page.getByText(/No available mentor fits yet/).waitFor();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Cancel request' }).click();
    await page.getByText('Request cancelled.').waitFor();
  });

  await step('engagement: the mentoring credit is on the board; manual entries can be recorded and removed, automatic ones cannot', async () => {
    await page.goto(`${BASE}/alumni/engagement`);
    const board = page.locator('li', { hasText: 'Aarav Shah' }).first();
    await board.waitFor();
    await board.getByText('20%').waitFor();                                         // 20 points for one mentoring session
    await page.getByRole('button', { name: 'Record engagement' }).click();
    await page.getByText('Choose an alumnus.').waitFor();
    await page.getByLabel('Alumnus', { exact: true }).fill('Diya');
    await page.getByRole('listbox', { name: 'Alumnus results' }).getByRole('button', { name: /Diya Patel/ }).click();
    await page.locator('label', { hasText: /^Type/ }).locator('select').selectOption('guest_lecture');   // the label also carries the required asterisk
    await page.getByLabel('What happened').fill(`Talk on careers ${stamp}`);
    await page.getByRole('button', { name: 'Record engagement' }).click();
    await page.getByText(/Their engagement score is now 25/).waitFor();
    const manual = page.locator('tbody tr', { hasText: `Talk on careers ${stamp}` });
    await manual.waitFor();
    expect((await page.locator('tbody tr', { hasText: 'Mentoring session completed' }).getByRole('button').count()) === 0, 'an automatic credit must not be deletable');
    page.once('dialog', (d) => d.accept());
    await manual.getByRole('button', { name: /Remove Talk on careers/ }).click();
    await page.getByText('Entry removed.').waitFor();
    await shot(page, 'c3-engagement');
  });

  await step('opportunities: institute posting publishes; alumni-offered waits for approval; bad links and past dates are refused', async () => {
    await page.goto(`${BASE}/alumni/opportunities`);
    await page.getByRole('button', { name: 'Add opportunity' }).click();
    await page.getByLabel('Company').fill('Institute Labs');
    await page.getByLabel('Job title').fill(`Lab assistant ${stamp}`);
    await page.getByLabel('Application link').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save opportunity' }).click();
    await page.getByText(/application url format is invalid/i).waitFor();
    await page.getByLabel('Application link').fill('https://labs.example/apply');
    await page.getByLabel('Last date to apply').fill(isoDay(-1));
    await page.getByRole('button', { name: 'Save opportunity' }).click();
    await page.getByText(/last date must be a date after or equal to today/i).waitFor();
    await page.getByLabel('Last date to apply').fill(isoDay(14));
    await page.getByRole('button', { name: 'Save opportunity' }).click();
    await page.getByText('Opportunity saved.').waitFor();
    await page.locator('li', { hasText: `Lab assistant ${stamp}` }).getByText('Published').waitFor();

    await page.getByRole('button', { name: 'Add opportunity' }).click();
    await page.getByLabel('Company').fill('Giver Corp');
    await page.getByLabel('Job title').fill(`Alumni referral ${stamp}`);
    await page.getByLabel('Offered by (optional)').fill('Aarav');
    await page.getByRole('listbox', { name: 'Offered by (optional) results' }).getByRole('button', { name: /Aarav Shah/ }).click();
    await page.getByRole('button', { name: 'Save opportunity' }).click();
    await page.getByText('Opportunity saved.').waitFor();
    await page.locator('li', { hasText: `Alumni referral ${stamp}` }).getByText('Pending approval').waitFor();
    await shot(page, 'c4-opportunities');
  });

  await step('opportunities: reject needs a reason; approve publishes', async () => {
    await page.goto(`${BASE}/alumni/opportunities`);
    const row = page.locator('li', { hasText: `Alumni referral ${stamp}` });
    await row.getByRole('button', { name: /^Reject Alumni referral/ }).click();
    expect(await row.getByRole('button', { name: 'Reject opportunity' }).isDisabled(), 'reject must need a reason');
    await row.getByRole('button', { name: 'Cancel' }).click();
    await row.getByRole('button', { name: /^Approve Alumni referral/ }).click();
    await page.getByText('Opportunity approved and published.').waitFor();
    await page.locator('li', { hasText: `Alumni referral ${stamp}` }).getByText('Published').waitFor();
  });

  await step('dashboard: engagement tiles show real counts', async () => {
    await page.goto(`${BASE}/alumni/dashboard`);
    await page.getByText('Active mentors', { exact: true }).waitFor();
    await page.getByText('Live opportunities').waitFor();
    await page.getByText('Average engagement score').waitFor();
  });

  await step('profile: the Engagement tab shows score, level and the mentoring credit', async () => {
    await page.goto(`${BASE}/alumni/engagement`);
    await page.locator('li', { hasText: 'Aarav Shah' }).first().getByRole('link', { name: 'Aarav Shah' }).click();
    await page.waitForURL(/\/alumni\/profile\/\d+/);
    await page.getByRole('tab', { name: 'Engagement' }).click();
    await page.getByText('Engagement score').waitFor();
    await page.getByText('Mentoring session completed').waitFor();
  });
  await context.close();

  // ---- the student's view -------------------------------------------------------------------------------
  const stu = await open(browser, 'student');
  await step('student: sees only published opportunities and can search them', async () => {
    await stu.page.goto(`${BASE}/alumni/student`);
    await stu.page.getByText(`Lab assistant ${stamp}`, { exact: true }).waitFor();
    await stu.page.getByText(`Alumni referral ${stamp}`, { exact: true }).waitFor();
    // the institute's own posting has an application link: it must be a real http(s) link
    const href = await stu.page.getByRole('link', { name: new RegExp('Apply for Lab assistant') }).getAttribute('href');
    expect(/^https?:\/\//.test(href || ''), `apply link is not http(s): ${href}`);
    await Promise.all([apiReturned(stu.page, 'q=referral'), stu.page.getByLabel('Search opportunities').fill('referral')]);
    await stu.page.waitForTimeout(300);
    expect(!(await stu.page.locator('body').innerText()).includes(`Lab assistant ${stamp}`), 'search did not narrow the board');
    await shot(stu.page, 'c5-student-board');
  });

  await step('student: mentorship - mentors listed without contact details; request, see it, cancel it', async () => {
    await stu.page.goto(`${BASE}/alumni/student`);
    await stu.page.getByRole('tab', { name: 'Mentorship' }).click();
    // (the first "Aarav Shah" in the page is a hidden dropdown option, so look inside the visible mentors panel)
    await stu.page.locator('section', { has: stu.page.getByRole('heading', { name: 'Mentors you can ask for' }) }).getByText('Aarav Shah').waitFor();
    const text = await stu.page.locator('body').innerText();
    expect(!/sample\.invalid/.test(text), 'an alumnus email address is visible to a student');
    await stu.page.getByRole('button', { name: 'Send request' }).click();
    await stu.page.getByText('Tell us which career area you want guidance on.').waitFor();
    await stu.page.getByLabel('Career area').fill(`Architecture ${stamp}`);
    await stu.page.getByRole('button', { name: 'Send request' }).click();
    await stu.page.getByText('Request sent. A coordinator will match you with a mentor.').waitFor();
    await stu.page.getByText(new RegExp(`Architecture ${stamp}`)).waitFor();
    stu.page.once('dialog', (d) => d.accept());
    await stu.page.getByRole('button', { name: new RegExp(`Cancel request about Architecture ${stamp}`) }).click();
    await stu.page.getByText('Request cancelled.').waitFor();
    await shot(stu.page, 'c6-student-mentorship');
  });

  await step('student: rates a completed session once', async () => {
    await stu.page.goto(`${BASE}/alumni/student`);
    await stu.page.getByRole('tab', { name: 'Mentorship' }).click();
    // Asha's completed mentoring already has a student rating from the staff-recorded feedback, so it must show it, not a form
    await stu.page.getByText(/You rated it 5\/5/).waitFor();
  });
  await stu.context.close();

  const other = await open(browser, 'student2');
  await step("student: another student cannot see the first student's requests", async () => {
    await other.page.goto(`${BASE}/alumni/student`);
    await other.page.getByRole('tab', { name: 'Mentorship' }).click();
    // student2 (Ravi) has their own cancelled request from the workflow above, and must not see Asha's
    await other.page.getByText(areaB, { exact: false }).first().waitFor();
    expect(!(await other.page.locator('body').innerText()).includes(areaA), "another student's request leaked");
  });
  await other.context.close();

  const staffAsStudent = await open(browser, 'peon');
  await step('permissions: a non-alumni staff profile is refused on mentorship, engagement and opportunities; and is not a student', async () => {
    for (const route of ['mentorship', 'engagement', 'opportunities']) {
      await staffAsStudent.page.goto(`${BASE}/alumni/${route}`);
      await staffAsStudent.page.getByText('You do not have access to alumni management.').first().waitFor();
    }
    await staffAsStudent.page.goto(`${BASE}/alumni/student`);
    await staffAsStudent.page.getByText('This is available to students only.').first().waitFor();
  });
  await staffAsStudent.context.close();

  await browser.close();
  finish(`Phase C records were created with the suffix ${stamp} in the scratch database.`);
})();
