/**
 * Browser E2E for the alumni portal: self-registration, email confirmation, staff verification, sign-in, self-service, staff
 * invitations, password reset, sign-out, account disabling, and isolation from the staff login.
 *
 *   ALUMNI_E2E_SESSIONS=<json> PLAYWRIGHT_PATH=<playwright> E2E_BASE_URL=http://localhost:3001 E2E_SKIP_MENU=1 \
 *   PORTAL_HELPER=<portal-helper.php> E2E_SQLITE=<scratch.sqlite> node scripts/e2e/alumni-portal-e2e.cjs
 *
 * ISOLATED STACK ONLY. The backend must be the scratch SQLite one (tests/Support/build_e2e_sqlite.php) started with
 * ALUMNI_JWT_SECRET (>= 32 characters, not the staff secret) in its environment. That stack sends no real email, so the helper
 * script plays the part of "the email arrived": it stores a fresh one-time token (hashed, exactly as the app does) and prints it.
 * The helper refuses to run against anything but sqlite. Passwords used here are throw-away values for the scratch database.
 */
const { execFileSync } = require('child_process');
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, setActive, shot, expect, finish } = createRunner();
const stamp = Date.now().toString().slice(-6);
const PASSWORD = `Portal-pass-${stamp}`;
const NEW_PASSWORD = `Changed-pass-${stamp}`;
const helper = (...args) => execFileSync('php', [process.env.PORTAL_HELPER, ...args], {
  env: { ...process.env, DB_CONNECTION: 'sqlite', DB_DATABASE: process.env.E2E_SQLITE, SESSION_DRIVER: 'array', CACHE_STORE: 'array' }, encoding: 'utf8',
}).trim();

(async () => {
  const browser = await chromium.launch();
  const portal = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });   // a visitor with NO staff session
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('dialog', (d) => d.accept());
    setActive(page);
    return page;
  };
  const email = `portal.new.${stamp}@example.invalid`;
  let page = await portal();

  await step('register: validation, then a confirmation message that does not reveal anything', async () => {
    await page.goto(`${BASE}/alumni-portal/register`);
    await page.getByRole('heading', { name: 'Create an account' }).waitFor();
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Enter your first name.').waitFor();
    await page.getByText('Choose a password.').waitFor();
    await page.getByLabel(/^Institute code/).fill('E2E');
    await page.getByLabel(/^First name/).fill('Portalnew');
    await page.getByLabel(/^Last name/).fill(`Person${stamp}`);
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText(/Use at least 10 characters/).waitFor();                                 // the server's password rule
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('heading', { name: 'Check your email' }).waitFor();
    await page.getByText(/If this email can be used to register/).waitFor();
    await shot(page, 'g1-registered');
  });

  await step('sign in before confirming the email is refused with a way forward', async () => {
    await page.goto(`${BASE}/alumni-portal/login`);
    await page.getByLabel(/^Institute code/).fill('E2E');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText(/Confirm your email address first/).waitFor();
    await page.getByRole('button', { name: 'Send me a new confirmation link' }).waitFor();
    // a wrong password looks like any other failure
    await page.getByLabel(/^Password/).fill('Not-the-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText(/Sign-in failed\. Check the institute code, email and password/).waitFor();
  });

  await step('confirm the email (the link needs a button press), sign in: standing only until staff verify', async () => {
    const token = helper('token', 'verify_email', email);
    await page.goto(`${BASE}/alumni-portal/verify-email?token=${token}`);
    await page.getByRole('button', { name: 'Confirm my email' }).click();
    await page.getByText(/Your email address is confirmed/).waitFor();
    await page.goto(`${BASE}/alumni-portal/verify-email?token=${token}`);                           // used once already
    await page.getByRole('button', { name: 'Confirm my email' }).click();
    await page.getByText(/invalid or has expired/).waitFor();

    await page.goto(`${BASE}/alumni-portal/login`);
    await page.getByLabel(/^Institute code/).fill('E2E');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/alumni-portal$/);
    await page.getByRole('heading', { name: `Portalnew Person${stamp}` }).waitFor();
    await page.getByText(/waiting for the institute to verify it/).first().waitFor();
    expect(await page.getByRole('button', { name: 'Save changes' }).isDisabled(), 'details cannot be edited before staff verification');
    await page.getByRole('tab', { name: 'Events' }).click();
    await page.getByText(/Events open up once the institute has verified/).waitFor();
    await shot(page, 'g2-pending');
  });

  await step('staff verify the person; the portal then opens up and the person edits their own details', async () => {
    const { page: admin } = await open(browser, 'admin');
    admin.on('dialog', (d) => d.accept());
    await admin.goto(`${BASE}/alumni/pending_verification`);
    await admin.getByText(`Portalnew Person${stamp}`).waitFor();
    await admin.locator('li, tr, article, div', { hasText: `Portalnew Person${stamp}` }).filter({ has: admin.getByRole('button', { name: /Approve/ }) }).last().getByRole('button', { name: /Approve/ }).click();
    await admin.getByText(/verified|approved/i).first().waitFor();
    await admin.context().close();

    setActive(page);
    await page.reload();
    await page.getByRole('heading', { name: `Portalnew Person${stamp}` }).waitFor();
    expect(await page.getByText(/waiting for the institute to verify it/).count() === 0, 'the pending notice is gone');
    await page.getByLabel('City').fill('Nashik');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Your details are saved.').waitFor();
    await page.reload();
    await page.getByLabel('City').waitFor();
    expect(await page.getByLabel('City').inputValue() === 'Nashik', 'the change was really saved');
    // the record itself (name, batch, email) is not editable here
    expect(await page.getByLabel('First name').count() === 0, 'name is not an editable field');
  });

  await step('privacy and contact choices are saved; an event can be joined and left', async () => {
    helper('seed-event');
    await page.getByRole('tab', { name: 'Privacy and contact' }).click();
    await page.getByText('Who can see your details').waitFor();
    await page.locator('select').first().selectOption('private');                                 // the first group on this tab is Email
    await page.getByRole('checkbox', { name: 'Email' }).check();
    await page.getByRole('button', { name: 'Save my choices' }).click();
    await page.getByText('Your choices are saved.').waitFor();

    await page.getByRole('tab', { name: 'Events' }).click();
    await page.getByText('Portal E2E Reunion').waitFor();
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByText(/You are registered/).first().waitFor();
    await page.getByRole('button', { name: 'Cancel registration' }).click();                      // the confirm dialog is accepted by the handler
    await page.getByRole('button', { name: 'Register' }).waitFor();
    await shot(page, 'g3-events');
  });

  await step('change password: wrong current refused; other devices are signed out', async () => {
    const other = await portal();                                                                 // a second device
    await other.goto(`${BASE}/alumni-portal/login`);
    await other.getByLabel(/^Institute code/).fill('E2E');
    await other.getByLabel(/^Email/).fill(email);
    await other.getByLabel(/^Password/).fill(PASSWORD);
    await other.getByRole('button', { name: 'Sign in' }).click();
    await other.waitForURL(/\/alumni-portal$/);

    setActive(page);
    await page.getByRole('tab', { name: 'Password' }).click();
    await page.getByLabel(/^Current password/).fill('Not-my-password-1');
    await page.getByLabel(/^New password/).fill(NEW_PASSWORD);
    await page.getByLabel(/^Type it again/).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/not your current password/i).first().waitFor();
    await page.getByLabel(/^Current password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/Your password has been changed/).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: `Portalnew Person${stamp}` }).waitFor();             // this device is still signed in

    setActive(other);
    await other.reload();
    await other.waitForURL(/\/alumni-portal\/login/);                                             // the other device was signed out
    await other.context().close();
  });

  await step('forgot password: same answer for anyone; the reset link works once; the old password stops working', async () => {
    const visitor = await portal();
    await visitor.goto(`${BASE}/alumni-portal/forgot-password`);
    await visitor.getByLabel(/^Institute code/).fill('E2E');
    await visitor.getByLabel(/^Email/).fill('nobody.at.all@example.invalid');
    await visitor.getByRole('button', { name: 'Send the link' }).click();
    const unknownAnswer = await visitor.getByText(/If that email has an account/).innerText();
    await visitor.goto(`${BASE}/alumni-portal/forgot-password`);
    await visitor.getByLabel(/^Institute code/).fill('E2E');
    await visitor.getByLabel(/^Email/).fill(email);
    await visitor.getByRole('button', { name: 'Send the link' }).click();
    expect((await visitor.getByText(/If that email has an account/).innerText()) === unknownAnswer, 'the answer must not depend on whether the account exists');

    const token = helper('token', 'reset_password', email);
    await visitor.goto(`${BASE}/alumni-portal/reset-password?token=${token}`);
    await visitor.getByLabel(/^New password/).fill('short');
    await visitor.getByLabel(/^Type it again/).fill('short');
    await visitor.getByRole('button', { name: 'Change password' }).click();
    await visitor.getByText(/Use at least 10 characters/).waitFor();                              // refused, and the link is not used up
    const reset = `Reset-pass-${stamp}`;
    await visitor.getByLabel(/^New password/).fill(reset);
    await visitor.getByLabel(/^Type it again/).fill(reset);
    await visitor.getByRole('button', { name: 'Change password' }).click();
    await visitor.getByText(/Your password has been changed/).waitFor();
    await visitor.goto(`${BASE}/alumni-portal/reset-password?token=${token}`);
    await visitor.getByLabel(/^New password/).fill(reset);
    await visitor.getByLabel(/^Type it again/).fill(reset);
    await visitor.getByRole('button', { name: 'Change password' }).click();
    await visitor.getByText(/invalid or has expired/).waitFor();

    await visitor.goto(`${BASE}/alumni-portal/login`);
    await visitor.getByLabel(/^Institute code/).fill('E2E');
    await visitor.getByLabel(/^Email/).fill(email);
    await visitor.getByLabel(/^Password/).fill(NEW_PASSWORD);                                     // the previous password
    await visitor.getByRole('button', { name: 'Sign in' }).click();
    await visitor.getByText(/Sign-in failed/).waitFor();
    await visitor.getByLabel(/^Password/).fill(reset);
    await visitor.getByRole('button', { name: 'Sign in' }).click();
    await visitor.waitForURL(/\/alumni-portal$/);
    await visitor.context().close();
    setActive(page);
  });

  await step('staff invite an existing alumnus: the link is shown once, the alumnus sets a password and confirms their email', async () => {
    const { page: admin } = await open(browser, 'admin');
    admin.on('dialog', (d) => d.accept());
    await admin.goto(`${BASE}/alumni/list?q=Aarav`);
    await admin.getByRole('link', { name: /Aarav Shah/ }).first().click();
    await admin.waitForURL(/\/alumni\/profile\/\d+/);
    await admin.getByRole('tab', { name: 'Portal access' }).click();
    await admin.getByText(/has no portal account/).waitFor();
    await admin.getByRole('button', { name: 'Send an invitation' }).click();
    const link = await admin.getByLabel('Invitation link').inputValue();
    expect(/\/alumni-portal\/invite\?token=[a-f0-9]{64}/.test(link), `unexpected link: ${link}`);
    await admin.getByText(/shown only now/).waitFor();
    await admin.getByRole('button', { name: 'Hide' }).click();
    await admin.getByRole('button', { name: 'Send a new invitation' }).waitFor();                // account now exists as "invited"
    await admin.getByText(/Invited - has not chosen a password yet/).waitFor();
    expect(await admin.getByLabel('Invitation link').count() === 0, 'the link is gone once hidden');

    const guest = await portal();
    await guest.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await guest.getByRole('heading', { name: 'Welcome to the alumni portal' }).waitFor();
    await guest.getByText(/\*\*\*@sample\.invalid/).waitFor();                                    // a masked address, not the full one
    await guest.getByLabel(/^Password/).fill('weak');
    await guest.getByLabel(/^Type it again/).fill('weak');
    await guest.getByRole('button', { name: 'Set my password' }).click();
    await guest.getByText(/Use at least 10 characters/).waitFor();
    await guest.getByLabel(/^Password/).fill(PASSWORD);
    await guest.getByLabel(/^Type it again/).fill(PASSWORD);
    await guest.getByRole('button', { name: 'Set my password' }).click();
    await guest.getByText(/Your password is set/).waitFor();
    await guest.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await guest.getByText(/invalid or has expired/).waitFor();                                    // single use

    await admin.context().close();
    await guest.context().close();
    setActive(page);
  });

  await step('the portal session gives no access to the staff application', async () => {
    // `page` holds a signed-in alumnus. The staff app must still ask for a staff login, and staff API calls must fail.
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole('button', { name: /sign in|log in|login/i }).first().waitFor();          // the staff login form, not a dashboard
    const staffCall = await page.evaluate(async () => {
      const raw = window.localStorage.getItem('alumniPortalSession');
      const token = raw ? JSON.parse(raw).access : '';
      const r = await fetch('/api/proxy?path=' + encodeURIComponent('api/alumni/list'), { headers: { Authorization: `Bearer ${token}` } });
      return r.status;
    });
    expect(staffCall === 401, `an alumni token must be refused by the staff API (got ${staffCall})`);
  });

  await step('staff disable the account: the open session ends at once and the person cannot sign back in', async () => {
    const { page: admin } = await open(browser, 'admin');
    await admin.goto(`${BASE}/alumni/list?q=Portalnew`);
    await admin.getByRole('link', { name: new RegExp(`Portalnew Person${stamp}`) }).first().click();
    await admin.waitForURL(/\/alumni\/profile\/\d+/);
    await admin.getByRole('tab', { name: 'Portal access' }).click();
    await admin.locator('dd', { hasText: /^Active$/ }).waitFor();                                 // the status row (the status dropdown has an Active option too)
    admin.once('dialog', (d) => d.accept('Requested by the alumnus'));                             // the reason prompt
    await admin.getByRole('button', { name: 'Disable access' }).click();
    await admin.getByText('Account disabled.').waitFor();
    await admin.getByText(/Requested by the alumnus/).waitFor();

    setActive(page);
    await page.goto(`${BASE}/alumni-portal`);
    await page.waitForURL(/\/alumni-portal\/login/);                                              // the next request found the session ended
    await page.getByLabel(/^Institute code/).fill('E2E');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill(`Reset-pass-${stamp}`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText(/Sign-in failed/).waitFor();

    await admin.getByRole('button', { name: 'Enable access' }).click();
    await admin.getByText('Account enabled.').waitFor();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/alumni-portal$/);                                                    // enabled again: the same password works
    await admin.context().close();
  });

  await step('signing out ends the session', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/alumni-portal\/login/);
    await page.goto(`${BASE}/alumni-portal`);
    await page.waitForURL(/\/alumni-portal\/login/);
    const stored = await page.evaluate(() => window.localStorage.getItem('alumniPortalSession'));
    expect(stored === null, 'tokens are removed from the browser on sign-out');
  });

  await browser.close();
  finish();
})();
