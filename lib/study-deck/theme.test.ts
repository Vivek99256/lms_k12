import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backdropShapes, backdropSvg, backdropUrl, themeOf, themeVars, THEMES, topicIndexOf, type BackdropKind } from './theme';

const outline = [
  { topic_id: 1, name: 'A', concept_ids: [10, 11] },
  { topic_id: 2, name: 'B', concept_ids: [20] },
  { topic_id: 3, name: 'C', concept_ids: [30] },
  { topic_id: 4, name: 'D', concept_ids: [40] },
  { topic_id: 5, name: 'E', concept_ids: [50] },
  { topic_id: 6, name: 'F', concept_ids: [60] },
];

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

describe('themeOf', () => {
  it('gives the cover and every slide that teaches nothing the brand family', () => {
    assert.equal(themeOf({ outline }, { slide_type: 'cover', taught_concept_ids: [] }).key, 'brand');
    assert.equal(themeOf({ outline }, { slide_type: 'hook', taught_concept_ids: [] }).key, 'brand');
    assert.equal(themeOf({ outline }, { slide_type: 'concept_intro', taught_concept_ids: [999] }).key, 'brand');
  });

  it('gives a slide the family of its topic, in outline order, and starts over after the last family', () => {
    const keys = [10, 20, 30, 40, 50, 60].map((id) => themeOf({ outline }, { slide_type: 'concept_intro', taught_concept_ids: [id] }).key);
    assert.deepEqual(keys, ['blue', 'teal', 'purple', 'cyan', 'amber', 'blue']);
  });

  it('uses the first taught concept that belongs to a topic', () => {
    assert.equal(topicIndexOf({ outline }, { taught_concept_ids: [999, 30] }), 2);
    assert.equal(topicIndexOf({ outline }, { taught_concept_ids: [] }), null);
  });
});

describe('palettes', () => {
  it('keep white text readable on the accent and the strong shade readable on the soft shades', () => {
    for (const theme of Object.values(THEMES)) {
      assert.ok(contrast('#ffffff', theme.accent) >= 4.5, `${theme.key} accent vs white`);
      for (const bg of [theme.soft, theme.softer, '#ffffff']) assert.ok(contrast(theme.strong, bg) >= 7, `${theme.key} strong vs ${bg}`);
    }
  });

  it('expose the five variables the components use', () => {
    assert.deepEqual(Object.keys(themeVars(THEMES.teal)), ['--sd-accent', '--sd-strong', '--sd-soft', '--sd-softer', '--sd-line']);
  });
});

describe('backdrops', () => {
  const kinds: BackdropKind[] = ['cells', 'lens', 'membrane', 'organelles', 'division', 'tissue'];

  it('draw something for every kind, and keep it inside or near the 1280 x 720 box', () => {
    for (const kind of kinds) {
      const shapes = backdropShapes(kind);
      assert.ok(shapes.length >= 5, kind);
      for (const s of shapes) {
        assert.ok(s.o > 0 && s.o <= 0.25, `${kind} opacity ${s.o}`);
        assert.ok(s.cx >= -50 && s.cx <= 1330 && s.cy >= -50 && s.cy <= 800, `${kind} position`);
      }
    }
  });

  it('produce a well-formed, URL-safe SVG', () => {
    for (const kind of kinds) {
      const svg = backdropSvg(kind, '#0f766e');
      assert.match(svg, /^<svg [^>]*viewBox="0 0 1280 720"/);
      assert.ok(svg.endsWith('</svg>'));
      assert.doesNotMatch(backdropUrl(kind, '#0f766e'), /[<>]/);
    }
  });
});

describe('photographs behind slides', () => {
  const photo = (width: number, height: number): { type: 'photo'; width: number; height: number; backdrop?: boolean } => ({ type: 'photo' as const, width, height });
  const slide = (n: number, concept: number[], image: ReturnType<typeof photo> | { type: 'diagram'; width: number; height: number } | null, type = 'concept_intro') => ({
    n,
    slide_type: type,
    taught_concept_ids: concept,
    image,
  });

  it('only a wide, large photograph can fill a slide', async () => {
    const { isBleedPhoto } = await import('./theme');
    assert.equal(isBleedPhoto(photo(1920, 1080)), true);
    assert.equal(isBleedPhoto(photo(960, 640)), true);
    assert.equal(isBleedPhoto(photo(500, 333)), false, 'too small: it would look soft across a slide');
    assert.equal(isBleedPhoto(photo(1000, 1400)), false, 'portrait: most of it would be cropped away');
    assert.equal(isBleedPhoto({ type: 'diagram', width: 1600, height: 900 }), false, 'a drawn diagram has labels that must not be cropped');
    assert.equal(isBleedPhoto(null), false);
  });

  it('gives a slide the nearest photograph of its own topic, and the cover photograph to slides that belong to none', async () => {
    const { backdropSlideOf } = await import('./theme');
    const deck = {
      outline,
      slides: [
        slide(1, [], photo(1920, 1080), 'cover'),
        slide(2, [], null),
        slide(3, [10], null),
        slide(4, [20], photo(1280, 800)),
        slide(5, [20], null),
        slide(6, [20], photo(1280, 800)),
        slide(7, [30], null),
        slide(8, [30], { type: 'diagram', width: 1280, height: 720 }),
      ],
    } as never;
    const of = (n: number) => backdropSlideOf(deck, (deck as { slides: Array<{ n: number; taught_concept_ids: number[] }> }).slides.find((s) => s.n === n)!);
    assert.equal(of(2), 1, 'a slide of no topic takes the first photograph');
    assert.equal(of(3), 1, 'a topic with no photograph of its own takes the cover photograph');
    assert.equal(of(5), 4, 'the nearer of two photographs of the topic (a tie goes to the earlier slide)');
    assert.equal(of(6), 6);
    assert.equal(of(7), 1);
  });

  it('does not use a photograph marked unsuitable as a texture behind other slides', async () => {
    const { backdropSlideOf, isBackdropPhoto } = await import('./theme');
    assert.equal(isBackdropPhoto({ ...photo(1920, 1080), backdrop: false }), false);
    assert.equal(isBackdropPhoto({ ...photo(1920, 1080), backdrop: true }), true);
    assert.equal(isBackdropPhoto(photo(1920, 1080)), true, 'no flag means it may be');
    const deck = {
      outline,
      slides: [slide(1, [], photo(1920, 1080), 'cover'), slide(2, [10], { ...photo(1920, 1080), backdrop: false }), slide(3, [10], null)],
    } as never;
    assert.equal(backdropSlideOf(deck, { n: 3, taught_concept_ids: [10] }), 1, 'the grey one is skipped; the cover photograph is used');
  });

  it('is null when the deck has no suitable photograph', async () => {
    const { backdropSlideOf } = await import('./theme');
    const deck = { outline, slides: [slide(1, [], null, 'cover'), slide(2, [10], { type: 'diagram', width: 1280, height: 720 })] } as never;
    assert.equal(backdropSlideOf(deck, { n: 2, taught_concept_ids: [10] }), null);
  });
});
