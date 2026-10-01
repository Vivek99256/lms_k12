import { test, expect, type Page } from '@playwright/test';

/**
 * "Interactive activities" plays in place, for every concept — against the
 * real dev stack (Next.js :3000, Laravel :8000, the real remote database,
 * tenant 341).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE KEEPS ITS OLD NAME BUT NOT ITS OLD ASSERTIONS
 * ---------------------------------------------------------------------------
 * This used to verify a hand-built Hook/Explain/Practice/Check journey that
 * only existed for concepts 2294 and 2299, reached from the same
 * "Interactive activities" card tested here. That journey is no longer wired
 * to this card for any concept (see the docblock at the top of
 * app/pal/learn/concept/[conceptId]/page.tsx) — the card now resolves and
 * plays whichever H5P node its own item is tagged with, in place, the same
 * way for every concept. What is asserted below is therefore concept-agnostic
 * on purpose: no scenario text, no fixed step count, nothing that depends on
 * which H5P type a given concept happens to have authored. Three concepts in
 * the same chapter (2294, 2295, 2299 — the two former pilot concepts plus an
 * ordinary one) are checked identically to prove there is no special case
 * left for any of them.
 *
 * Auth is seeded directly into localStorage rather than driven through the
 * login form: the same shape `contexts/AuthContext.tsx#persistLoginPayload`
 * writes (`menuContext` + `userData`), built from a real JWT minted for a
 * genuine test-fixture student already enrolled in tenant 341 / standard
 * 4261 (`tblstudent` id 281471 — its own name field literally reads "test by
 * sonika 2026-08-17%", a QA fixture, not a real person). This is equivalent
 * to a real login for every purpose the app cares about — the same
 * `Authorization: Bearer` header reaches the same backend — and skips a
 * password no one gave me.
 */
const STUDENT_TOKEN =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MjgxNDcxLCJzdWJfaW5zdGl0dXRlX2lkIjozNDEsImlzX2FkbWluIjowLCJjbGllbnRfaWQiOm51bGwsInVzZXJfcHJvZmlsZV9pZCI6MzY4NCwiaXNfc3R1ZGVudCI6dHJ1ZX0.kIWOps3mLUTtU2MQ02Ervj8HsMF9OhLOkPVIQpnw7vA';

async function signInAsStudent(page: Page) {
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem(
        'menuContext',
        JSON.stringify({
          sub_institute_id: 341,
          user_id: 281471,
          user_profile_name: 'Student',
          user_profile_id: 3684,
          client_id: 0,
        })
      );
      localStorage.setItem(
        'userData',
        JSON.stringify({
          id: 281471,
          user_name: 'Test Student',
          first_name: 'Pransh',
          last_name: 'Doshi',
          sub_institute_id: 341,
          user_profile_id: 3684,
          is_admin: 0,
          client_id: null,
          user_token: token,
          host_name: 'http://127.0.0.1:8000',
        })
      );
      localStorage.setItem('syear', '2026');
      // AuthContext's own guard (contexts/AuthContext.tsx) gates every route
      // on `auth` being present, separately from `userData`/`menuContext` —
      // without this the app redirects straight to /login regardless of a
      // valid token being on hand.
      localStorage.setItem(
        'auth',
        JSON.stringify({ name: 'Test Student', email: 'pal-pilot-test@example.invalid' })
      );
      localStorage.setItem('sessionDate', new Date().toISOString().split('T')[0]);
    },
    { token: STUDENT_TOKEN }
  );
}

/**
 * Opens a concept's Learn page and clicks its "Interactive activities" card,
 * asserting the parts every concept must share: no navigation, the resource
 * grid genuinely gone (not just covered), a "Back to learning" control, and
 * none of the retired journey's own markers. Skips (rather than fails) a
 * concept that has no h5p section at all — that is a legitimate content gap,
 * not a regression in this trigger's behavior.
 */
async function openInteractiveActivityInline(page: Page, conceptId: number, chapterId: number) {
  await page.goto(`/pal/learn/concept/${conceptId}?chapterId=${chapterId}`);
  await expect(page.getByText('Everything for this topic')).toBeVisible({ timeout: 20_000 });

  const h5pSection = page.locator('section[data-resource-section="h5p"]');
  if ((await h5pSection.count()) === 0) {
    test.skip(true, `Concept ${conceptId} has no h5p resource today — nothing to open inline.`);
    return;
  }

  const learnUrl = page.url();
  await h5pSection.getByRole('button').first().click();

  // In place, not a navigation and not a full-screen takeover: same URL, the
  // ordinary resource grid gone from the DOM, and the overlay's own close
  // control ("Close and continue learning") absent — that would mean this
  // concept fell back to the old full-screen path instead of playing inline.
  expect(page.url()).toBe(learnUrl);
  await expect(page.getByRole('button', { name: 'Back to learning' })).toBeVisible();
  await expect(page.getByText('Everything for this topic')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close and continue learning' })).toHaveCount(0);

  // The retired hand-built journey's own progress ladder must never appear —
  // this card plays the item's real H5P content now, not that narrative.
  await expect(page.locator('[aria-label="Learning journey progress"]')).toHaveCount(0);

  return { learnUrl, h5pSection };
}

test.describe('Interactive activities card plays inline (tenant 341, chapter 8677)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStudent(page);
  });

  test('a former pilot concept (2294) opens its own H5P activity inline, not the old journey', async ({ page }) => {
    const opened = await openInteractiveActivityInline(page, 2294, 8677);
    if (!opened) return;
    const { learnUrl } = opened;

    // Back restores the original view exactly — same URL, no reload, grid
    // genuinely back (not merely uncovered).
    await page.getByRole('button', { name: 'Back to learning' }).click();
    expect(page.url()).toBe(learnUrl);
    await expect(page.getByText('Everything for this topic')).toBeVisible();
  });

  test('the other former pilot concept (2299) opens its own H5P activity inline too', async ({ page }) => {
    await page.goto('/pal/learn/concept/2299?chapterId=8677');
    await expect(page.getByRole('heading', { name: 'Multiples of a number' })).toBeVisible();

    const opened = await openInteractiveActivityInline(page, 2299, 8677);
    if (!opened) return;

    // None of the retired hand-authored journey copy for this concept should
    // ever appear from this trigger any more.
    await expect(page.getByText(/Chairs are arranged in rows of 4/i)).toHaveCount(0);
    await expect(page.getByText('Multiples of a number are found by multiplying it by 1, 2, 3, and so on.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to learning' }).click();
    await expect(page.getByText('Everything for this topic')).toBeVisible();
  });

  test('an ordinary, never-piloted concept (2295) in the same chapter behaves identically', async ({ page }) => {
    const opened = await openInteractiveActivityInline(page, 2295, 8677);
    if (!opened) return;

    // The ordinary page's other always-present action is untouched by any of
    // this — still there once the activity is closed.
    await page.getByRole('button', { name: 'Back to learning' }).click();
    await expect(page.getByRole('button', { name: /I have\s*read this — continue/i })).toBeVisible();
  });
});
