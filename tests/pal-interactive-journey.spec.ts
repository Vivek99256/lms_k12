import { test, expect, type Page } from '@playwright/test';

/**
 * The Interactive Learning Journey — the rule-based SVG fallback behind
 * "Learn this concept visually" (see app/pal/_components/WebConceptVisual.tsx
 * for the primary, real-web-image path this now sits behind — a live
 * Openverse/Wikimedia Commons search, not AI image generation). None of the
 * four concepts below have a web image clearing ConceptImageSearchService's
 * relevance floor (verified directly against the service), so
 * WebConceptVisual reports "unavailable" quickly and the page falls back to
 * this journey automatically — which is exactly what these tests exercise
 * and rely on. See tests/pal-web-concept-visual.spec.ts for the success path
 * (concept 2295, which does have a real, verified Wikimedia match). The
 * fallback itself stays fully dynamic: generated from its own real name +
 * chapter name (+ authored description, when it has one) via
 * `generateJourneyRecipe()` / `classifyVisual()` (see
 * interactive-journey/generate.ts, classify.ts). There is no concept-id map
 * any more, no chapter restriction, and no default visual — the four tests
 * below deliberately span four different chapters and confirm each gets a
 * DIFFERENT, topic-appropriate visual:
 *
 *   2461 "Common denominator method"     (chapter "Fractions")        -> FractionBar
 *   2572 "Decimal method for percentage of quantity" (chapter "Percentages") -> BarModel
 *   2654 "Area as space covered"          (chapter "Shapes ,area and volume") -> GeometryCanvas
 *   2296 "Division as inverse of multiplication" (chapter "Integers") -> NumberLine (the
 *        universal fallback — nothing in its name/chapter matches a specific
 *        keyword, proving the system never silently defaults to one topic)
 *
 * Each visual type has its own distinct primary action label (a real DOM
 * signature, not an assumption): "Reveal 10% more" (BarModel), "Shade one
 * more part" (FractionBar), "Fill the next row" (GeometryCanvas), "Move
 * forward" (NumberLine).
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

async function openJourney(page: Page, conceptId: number, chapterId: number, conceptName: string) {
  await page.goto(`/pal/learn/concept/${conceptId}?chapterId=${chapterId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: conceptName })).toBeVisible();
  const entry = page.getByRole('button', { name: 'Learn this concept visually' });
  await expect(entry).toBeVisible();
  await entry.click();
  // AiConceptVisual tries first ("Preparing a visual explanation…"); this
  // tenant has no AI image policy enabled, so it fails fast and falls back to
  // this same rule-based journey automatically — which is what every
  // assertion below is actually checking.
  await expect(page.locator('[aria-label="Interactive learning journey progress"]')).toBeVisible();
  // The concept's own real name appears in the journey header too.
  await expect(page.getByRole('heading', { name: conceptName, level: 2 })).toBeVisible();
}

test.describe('Interactive Learning Journey — dynamic, per-concept generation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStudent(page);
  });

  test('Fractions concept (2461) gets FractionBar, not any other visual', async ({ page }) => {
    await openJourney(page, 2461, 8683, 'Common denominator method');
    await expect(page.getByRole('button', { name: /Shade one more part/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reveal 10% more/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Fill the next row/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Move forward$/i })).toHaveCount(0);
  });

  test('Percentages concept (2572) gets BarModel, not FractionBar', async ({ page }) => {
    await openJourney(page, 2572, 8687, 'Decimal method for percentage of quantity');
    await expect(page.getByRole('button', { name: /Reveal 10% more/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Shade one more part/i })).toHaveCount(0);
  });

  test('Geometry concept (2654) gets GeometryCanvas, not FractionBar', async ({ page }) => {
    await openJourney(page, 2654, 8692, 'Area as space covered');
    await expect(page.getByRole('button', { name: /Fill the next row/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Shade one more part/i })).toHaveCount(0);
  });

  test('a concept matching no specific keyword (2296, Integers) falls back to NumberLine, never FractionBar', async ({ page }) => {
    await openJourney(page, 2296, 8677, 'Division as inverse of multiplication');
    await expect(page.getByRole('button', { name: /^Move forward$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Shade one more part/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reveal 10% more/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Fill the next row/i })).toHaveCount(0);
  });
});
