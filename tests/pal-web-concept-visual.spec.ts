import { test, expect, type Page } from '@playwright/test';

/**
 * "Learn this concept visually" — the web-image-search path
 * (WebConceptVisual.tsx / palController::learnConceptImage() /
 * ConceptImageSearchService, Openverse restricted to Wikimedia Commons).
 *
 * Concept 2295, "Multiplication as repeated addition of negative integers"
 * (chapter 8677, Integers), is a real, verified case where Openverse's
 * Wikimedia-only search finds a genuinely matching, correctly-licensed
 * diagram — confirmed directly against the service before writing this test.
 * Most concepts do NOT have a matching open-license diagram (see
 * ConceptImageSearchService's own notes on the relevance floor and the
 * general-purpose-corpus ceiling); this is deliberately the one concept
 * known to succeed, so this test asserts the real success path rather than
 * only ever exercising the fallback.
 */
const STUDENT_TOKEN =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MjgxNDcxLCJzdWJfaW5zdGl0dXRlX2lkIjozNDEsImlzX2FkbWluIjowLCJjbGllbnRfaWQiOm51bGwsInVzZXJfcHJvZmlsZV9pZCI6MzY4NCwiaXNfc3R1ZGVudCI6dHJ1ZX0.kIWOps3mLUTtU2MQ02Ervj8HsMF9OhLOkPVIQpnw7vA';

async function signInAsStudent(page: Page) {
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem(
        'menuContext',
        JSON.stringify({ sub_institute_id: 341, user_id: 281471, user_profile_name: 'Student', user_profile_id: 3684, client_id: 0 })
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
      localStorage.setItem('auth', JSON.stringify({ name: 'Test Student', email: 'pal-pilot-test@example.invalid' }));
      localStorage.setItem('sessionDate', new Date().toISOString().split('T')[0]);
    },
    { token: STUDENT_TOKEN }
  );
}

test.describe('Learn this concept visually — web image search', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStudent(page);
  });

  test('a concept with a real Wikimedia match shows the web image, not the SVG fallback', async ({ page }) => {
    await page.goto('/pal/learn/concept/2295?chapterId=8677', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Multiplication as repeated addition of negative integers' })).toBeVisible();

    await page.getByRole('button', { name: 'Learn this concept visually' }).click();

    // The web-image teach screen, not the rule-based journey's progress rail.
    const image = page.getByRole('img', { name: /multiplication|repeated addition/i });
    await expect(image).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-label="Interactive learning journey progress"]')).toHaveCount(0);

    // Real attribution, not a placeholder — links to the actual Wikimedia
    // Commons file page.
    const sourceLink = page.getByRole('link', { name: 'Source' });
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute('href', /wikimedia\.org/);

    // The lightweight observation step, then practice.
    await page.getByRole('button', { name: /what do you notice/i }).click();
    await expect(page.getByRole('button', { name: /what do you notice/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue to practice' })).toBeVisible();
  });

  test('exploring the visual opens an enlarged view of the same image', async ({ page }) => {
    await page.goto('/pal/learn/concept/2295?chapterId=8677', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Learn this concept visually' }).click();

    const image = page.getByRole('img', { name: /multiplication|repeated addition/i });
    await expect(image).toBeVisible({ timeout: 30_000 });

    await image.click();
    await expect(page.getByRole('dialog', { name: /enlarged/i })).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: /enlarged/i })).toHaveCount(0);
  });

  test('a concept with no usable web image falls back to the existing SVG journey silently', async ({ page }) => {
    // 2461 "Common denominator method" — verified directly against
    // ConceptImageSearchService to find nothing above the relevance floor.
    await page.goto('/pal/learn/concept/2461?chapterId=8683', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Learn this concept visually' }).click();

    await expect(page.locator('[aria-label="Interactive learning journey progress"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Shade one more part/i })).toBeVisible();

    // No error text anywhere on screen.
    await expect(page.getByText(/error|failed|unavailable/i)).toHaveCount(0);
  });
});
