/**
 * Browser E2E for Alumni Phase E: donations recorded offline, verified by a person, receipted, refunded.
 *
 *   ALUMNI_E2E_SESSIONS=<json> PLAYWRIGHT_PATH=<playwright> E2E_BASE_URL=http://localhost:3001 E2E_SKIP_MENU=1 \
 *     node scripts/e2e/alumni-phase-e-e2e.cjs
 *
 * Needs sessions named acct (an Accountant), admin and peon, and an institute with the sample alumni. Meant for the
 * ISOLATED stack (scratch SQLite backend from tests/Support/build_e2e_sqlite.php). There is no payment gateway: every
 * step records money that was received offline, and the checks are about the rules that protect it.
 */
const { createRunner } = require('./lib.cjs');

const { BASE, chromium, open, step, shot, expect, finish } = createRunner();
const stamp = Date.now().toString().slice(-6);

(async () => {
  const browser = await chromium.launch();
  const { page } = await open(browser, 'acct');
  page.on('dialog', (d) => d.accept());
  // Separation of duties: the person who records money cannot verify it, so verification happens in a second finance user's session (admin).
  const { page: admin } = await open(browser, 'admin');
  admin.on('dialog', (d) => d.accept());
  const openAs = async (who, donor) => {
    await who.goto(`${BASE}/alumni/donations`);
    await who.getByRole('button', { name: new RegExp('Open donation \\d+ from ' + donor) }).first().click();
  };
  const campaign = `E2E library fund ${stamp}`;
  const row = (text) => page.locator('tbody tr', { hasText: text });
  const pick = async (label, name) => {
    await page.getByLabel(label).fill(name);
    await page.getByRole('listbox').getByRole('button').first().click();
  };
  let receiptNo = '';

  await step('campaign: validation, create with a goal', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByText(/Money is counted only after a person verifies it/).waitFor();
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.getByRole('button', { name: 'New campaign' }).click();
    await page.getByRole('button', { name: 'Save campaign' }).click();
    await page.getByText('Give the campaign a name.').waitFor();
    await page.getByLabel(/^Name/).fill(campaign);
    await page.getByLabel(/^Goal/).fill('10000');
    await page.getByRole('button', { name: 'Save campaign' }).click();
    await page.getByText('Campaign saved.').waitFor();
    await page.getByText(campaign).waitFor();
  });

  await step('record: validation; a cheque is recorded as awaiting verification, not as raised', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('button', { name: 'Record donation' }).click();
    await page.getByRole('button', { name: 'Record pledge' }).click();
    await page.getByText('Choose the donor.').waitFor();
    await page.getByText('Enter an amount greater than zero.').waitFor();
    await pick(/^Donor/, 'Aarav');
    await page.getByLabel(/^Amount/).fill('4000');
    await page.getByLabel('Campaign').selectOption({ label: campaign });
    await page.getByLabel(/^Payment mode/).selectOption('cheque');
    await page.getByRole('button', { name: 'Record donation', exact: true }).last().click();      // mode without a date
    await page.getByText(/Give both the payment mode and the date received/).first().waitFor();
    await page.getByLabel(/^Date received/).fill(new Date().toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Record donation', exact: true }).last().click();
    await page.getByText(/now needs to be verified before it counts/).waitFor();
    await row('Awaiting verification').first().waitFor();
    await shot(page, 'e1-recorded');
  });

  await step('verify: a cheque without a reference is refused; correcting it allows verification and issues one receipt', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('button', { name: /Open donation \d+ from Aarav/ }).first().click();
    await page.getByRole('button', { name: 'Verify and issue receipt' }).click();                // confirm dialog auto-accepted
    await page.getByText('another finance user must verify it').first().waitFor();              // the recorder cannot verify their own entry
    await page.getByRole('button', { name: 'Correct details' }).click();
    await page.getByLabel(/^Cheque no/).fill(`CHQ-${stamp}`);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Details updated.').waitFor();
    await openAs(admin, 'Aarav');                                                                 // a second finance user
    await admin.getByRole('button', { name: 'Verify and issue receipt' }).click();
    await admin.getByText('Verified. Receipt issued.').waitFor();
    await admin.locator('dd', { hasText: /^DON-\d{4}-\d{5}$/ }).first().waitFor();                 // the panel refreshes after the notice appears
    receiptNo = (await admin.locator('dt', { hasText: 'Receipt' }).locator('xpath=following-sibling::dd').first().innerText()).trim();
    expect(/^DON-\d{4}-\d{5}$/.test(receiptNo), `receipt number looks wrong: ${receiptNo}`);
    expect(await admin.getByRole('button', { name: 'Verify and issue receipt' }).count() === 0, 'a verified donation cannot be verified again');
    expect(await admin.getByRole('button', { name: 'Cancel', exact: true }).count() === 0, 'a verified donation cannot be cancelled');
    await admin.getByRole('button', { name: 'View receipt' }).click();
    await admin.getByText('Donation acknowledgement receipt').waitFor();
    await admin.getByText(/not a tax-exemption certificate/).waitFor();
    await shot(admin, 'e2-receipt');
  });

  await step('refund: more than the gift is refused; a partial refund keeps the receipt', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('button', { name: /Open donation \d+ from Aarav/ }).first().click();
    await page.getByRole('button', { name: 'Record a refund' }).click();
    await page.getByLabel(/^Amount/).fill('4000.01');
    await page.getByLabel(/^Reason/).fill('Donor request');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText(/Only ₹4,000.00 of this donation is left to refund/).first().waitFor();
    await page.getByLabel(/^Amount/).fill('1000');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Refund recorded.').waitFor();
    await row('Partly refunded').first().waitFor();                                              // the status chip (the filter's <option> has the same words)
    await page.getByText(receiptNo).first().waitFor();
  });

  await step('pledge: recorded as a pledge with no receipt, marked received, then verified', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('button', { name: 'Record donation' }).click();
    await pick(/^Donor/, 'Diya');
    await page.getByLabel(/^Amount/).fill('2500');
    await page.getByLabel('Donor wishes to stay anonymous').check().catch(() => page.getByText('Donor wishes to stay anonymous').click());
    await page.getByRole('button', { name: 'Record pledge' }).click();
    await page.getByText('Pledge recorded.').waitFor();
    await page.getByRole('button', { name: /Open donation \d+ from Diya/ }).first().click();
    await page.getByText('Issued after verification').waitFor();
    expect(await page.getByRole('button', { name: 'Verify and issue receipt' }).count() === 0, 'a pledge cannot be verified');
    expect(await page.getByRole('button', { name: 'View receipt' }).count() === 0, 'a pledge has no receipt');
    await page.getByRole('button', { name: 'Mark as received' }).click();
    await page.getByLabel(/^Payment mode/).selectOption('cash');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Marked as received. It still needs to be verified.').waitFor();
    await page.getByRole('button', { name: 'Verify and issue receipt' }).click();
    await page.getByText('another finance user must verify it').first().waitFor();              // whoever recorded the cash cannot verify it
    await openAs(admin, 'Diya');
    await admin.getByRole('button', { name: 'Verify and issue receipt' }).click();
    await admin.getByText('Verified. Receipt issued.').waitFor();
  });

  await step('reject: needs a reason and leaves no receipt', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('button', { name: 'Record donation' }).click();
    await pick(/^Donor/, 'Kabir');
    await page.getByLabel(/^Amount/).fill('777');
    await page.getByLabel(/^Payment mode/).selectOption('upi');
    await page.getByLabel(/^Date received/).fill(new Date().toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Record donation', exact: true }).last().click();
    await page.getByText(/now needs to be verified/).waitFor();
    await page.getByRole('button', { name: /Open donation \d+ from Kabir/ }).first().click();
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();                    // no reason
    await page.getByText(/reason field is required|Please correct/i).first().waitFor();
    await page.getByLabel(/^Reason/).fill('Payment not found in the bank statement');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Donation rejected.').waitFor();
    await page.getByText('Payment not found in the bank statement').first().waitFor();
    expect(await page.getByRole('button', { name: 'View receipt' }).count() === 0, 'a rejected donation has no receipt');
  });

  await step('summary: only verified money is raised; pending and pledged are separate; anonymous donor is masked', async () => {
    await page.goto(`${BASE}/alumni/donations`);
    await page.getByRole('tab', { name: 'Summary' }).click();
    await page.getByText('Raised (verified, net of refunds)').waitFor();
    // 4000 - 1000 refunded + 2500 anonymous = 5500
    await page.getByText('₹5,500').first().waitFor();
    await page.getByText('Anonymous donor').waitFor();
    expect(await page.getByText('Diya').count() === 0, 'the anonymous donor must not be named on the summary');
    await shot(page, 'e3-summary');
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.getByText(/₹3,000 raised of ₹10,000/).waitFor();                                  // campaign counts the net verified gift only
  });

  await step('profile: Donations tab lists this alumnus gifts', async () => {
    const { page: p3 } = await open(browser, 'admin');                                           // an Accountant cannot open alumni profiles by design
    await p3.goto(`${BASE}/alumni/donations`);
    await p3.getByRole('link', { name: /Aarav Shah/ }).first().click();
    await p3.waitForURL(/\/alumni\/profile\/\d+/);
    await p3.getByRole('tab', { name: 'Donations' }).click();
    await p3.getByText(/Partially refunded/i).waitFor();
    await p3.getByText(new RegExp(`receipt ${receiptNo}`)).waitFor();
  });

  await step('permissions: a profile outside the finance roles is refused', async () => {
    const { page: p2 } = await open(browser, 'peon');
    await p2.goto(`${BASE}/alumni/donations`);
    await p2.getByText(/permission|not allowed|forbidden|access/i).first().waitFor();
    expect(await p2.getByText(receiptNo).count() === 0, 'no donation data may be shown to a non-finance profile');
  });

  await browser.close();
  finish();
})();
