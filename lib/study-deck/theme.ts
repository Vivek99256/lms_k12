/**
 * The look of a slide: which colour family it is drawn in and what is behind it.
 *
 * NO REACT HERE, so every rule is testable with node:test.
 *
 * A lesson is a sequence of topics, and each topic gets its own colour family so the learner can feel where they are:
 * the opening and closing screens use the brand indigo, then blue, teal, purple, cyan and amber follow the topics in
 * order. A family is five related shades (accent, strong, soft, softer, line) exposed to the components as the CSS
 * variables `--sd-*`, which `app/globals.css` maps to the `sd-*` colour utilities.
 *
 * Contrast: `accent` carries white text (every accent is at least 4.5:1 against white), `strong` carries text on
 * `soft` / `softer` / white, and `line` is only ever a border or a decoration, never the only carrier of meaning.
 */

import type { DeckImage, DeckSlide, StudyDeck } from './types';

export type BackdropKind = 'cells' | 'lens' | 'membrane' | 'organelles' | 'division' | 'tissue';

export interface StageTheme {
  /** A stable name, for tests and for `data-sd-theme`. */
  key: 'brand' | 'blue' | 'teal' | 'purple' | 'cyan' | 'amber';
  accent: string;
  strong: string;
  soft: string;
  softer: string;
  line: string;
  /** The corner artwork behind the slide. */
  backdrop: BackdropKind;
  /** Two soft washes of colour (top-left, bottom-right) laid over the page, one of the family and one beside it, like a watercolour. */
  wash: readonly [string, string];
}

export const THEMES: Record<StageTheme['key'], StageTheme> = {
  brand: { key: 'brand', accent: '#4f46e5', strong: '#312e81', soft: '#e0e7ff', softer: '#eef2ff', line: '#a5b4fc', backdrop: 'cells', wash: ['#e0e7ff', '#ccfbf1'] },
  blue: { key: 'blue', accent: '#1d4ed8', strong: '#1e3a8a', soft: '#dbeafe', softer: '#eff6ff', line: '#93c5fd', backdrop: 'lens', wash: ['#dbeafe', '#fce7f3'] },
  teal: { key: 'teal', accent: '#0f766e', strong: '#134e4a', soft: '#ccfbf1', softer: '#f0fdfa', line: '#5eead4', backdrop: 'membrane', wash: ['#ccfbf1', '#fef3c7'] },
  purple: { key: 'purple', accent: '#7c3aed', strong: '#4c1d95', soft: '#ede9fe', softer: '#f5f3ff', line: '#c4b5fd', backdrop: 'organelles', wash: ['#ede9fe', '#cffafe'] },
  cyan: { key: 'cyan', accent: '#0e7490', strong: '#164e63', soft: '#cffafe', softer: '#ecfeff', line: '#67e8f9', backdrop: 'division', wash: ['#cffafe', '#ede9fe'] },
  amber: { key: 'amber', accent: '#b45309', strong: '#78350f', soft: '#fef3c7', softer: '#fffbeb', line: '#fcd34d', backdrop: 'tissue', wash: ['#fef3c7', '#fce7f3'] },
};

/** The family for the nth topic (0 based). A deck with more topics than families starts over. */
const TOPIC_ORDER: StageTheme['key'][] = ['blue', 'teal', 'purple', 'cyan', 'amber'];

/** The colour family of the nth topic (0 based). */
export function themeForTopic(index: number): StageTheme {
  return THEMES[TOPIC_ORDER[((index % TOPIC_ORDER.length) + TOPIC_ORDER.length) % TOPIC_ORDER.length]];
}

/** The topic a slide belongs to, by position in the deck's outline; null for a slide that teaches no concept. */
export function topicIndexOf(deck: Pick<StudyDeck, 'outline'>, slide: Pick<DeckSlide, 'taught_concept_ids'>): number | null {
  for (const id of slide.taught_concept_ids) {
    const index = deck.outline.findIndex((topic) => topic.concept_ids.includes(id));
    if (index >= 0) return index;
  }

  return null;
}

/**
 * The theme of a slide. A slide that teaches a concept takes its topic's family; the framing slides (cover, hook,
 * objectives, the closing summary) and anything that teaches nothing use the brand family.
 */
export function themeOf(deck: Pick<StudyDeck, 'outline'>, slide: Pick<DeckSlide, 'taught_concept_ids' | 'slide_type'>): StageTheme {
  if (slide.slide_type === 'cover') return THEMES.brand;
  const topic = topicIndexOf(deck, slide);
  if (topic === null) return THEMES.brand;

  return themeForTopic(topic);
}

/** The CSS variables a theme sets on the element that wraps a slide. */
export function themeVars(theme: StageTheme): Record<string, string> {
  return {
    '--sd-accent': theme.accent,
    '--sd-strong': theme.strong,
    '--sd-soft': theme.soft,
    '--sd-softer': theme.softer,
    '--sd-line': theme.line,
  };
}

/** The page behind the canvas: the family's palest shade, so the slide lifts off it. */
export function pageTint(theme: StageTheme): string {
  return theme.softer;
}

// ---------------------------------------------------------------------------
// Backdrops
// ---------------------------------------------------------------------------

export interface BackdropShape {
  kind: 'circle' | 'ring' | 'hex' | 'line';
  cx: number;
  cy: number;
  r: number;
  /** Opacity 0..1 of the shape. */
  o: number;
  /** A small inner circle (a nucleus) is drawn when set. */
  nucleus?: boolean;
}

/**
 * The corner artwork of each backdrop, in a 1280 x 720 box. Plain data: round "cells" with a nucleus, concentric
 * lens rings, a row of membrane heads, organelle blobs, dividing pairs and a hex tissue. They sit in the top-right
 * and bottom-left corners and fade to nothing toward the middle, so text on top never meets a busy area.
 */
export function backdropShapes(kind: BackdropKind): BackdropShape[] {
  switch (kind) {
    case 'cells':
      return [
        { kind: 'circle', cx: 1190, cy: 70, r: 120, o: 0.16, nucleus: true },
        { kind: 'circle', cx: 1070, cy: 20, r: 62, o: 0.13, nucleus: true },
        { kind: 'circle', cx: 1260, cy: 210, r: 70, o: 0.12, nucleus: true },
        { kind: 'circle', cx: 80, cy: 690, r: 130, o: 0.14, nucleus: true },
        { kind: 'circle', cx: 230, cy: 740, r: 72, o: 0.11, nucleus: true },
        { kind: 'circle', cx: 20, cy: 540, r: 54, o: 0.11, nucleus: true },
      ];
    case 'lens':
      return [
        { kind: 'ring', cx: 1200, cy: 60, r: 70, o: 0.2 },
        { kind: 'ring', cx: 1200, cy: 60, r: 120, o: 0.15 },
        { kind: 'ring', cx: 1200, cy: 60, r: 175, o: 0.11 },
        { kind: 'ring', cx: 1200, cy: 60, r: 235, o: 0.07 },
        { kind: 'circle', cx: 70, cy: 700, r: 90, o: 0.12, nucleus: true },
        { kind: 'circle', cx: 200, cy: 750, r: 50, o: 0.1, nucleus: true },
      ];
    case 'membrane': {
      const heads: BackdropShape[] = [];
      for (let i = 0; i < 9; i++) {
        heads.push({ kind: 'circle', cx: 760 + i * 58, cy: 26, r: 22, o: 0.16 - i * 0.012 });
        heads.push({ kind: 'line', cx: 760 + i * 58, cy: 48, r: 36, o: 0.12 - i * 0.009 });
      }
      return [...heads, { kind: 'circle', cx: 70, cy: 690, r: 120, o: 0.12, nucleus: true }, { kind: 'circle', cx: 215, cy: 740, r: 60, o: 0.1, nucleus: true }];
    }
    case 'organelles':
      return [
        { kind: 'circle', cx: 1195, cy: 85, r: 115, o: 0.15, nucleus: true },
        { kind: 'circle', cx: 1075, cy: 25, r: 40, o: 0.14 },
        { kind: 'circle', cx: 1265, cy: 230, r: 34, o: 0.14 },
        { kind: 'circle', cx: 1110, cy: 170, r: 24, o: 0.12 },
        { kind: 'circle', cx: 70, cy: 700, r: 100, o: 0.12, nucleus: true },
        { kind: 'circle', cx: 210, cy: 745, r: 36, o: 0.12 },
      ];
    case 'division':
      return [
        { kind: 'circle', cx: 1130, cy: 56, r: 74, o: 0.15, nucleus: true },
        { kind: 'circle', cx: 1252, cy: 56, r: 74, o: 0.15, nucleus: true },
        { kind: 'circle', cx: 1190, cy: 190, r: 52, o: 0.1, nucleus: true },
        { kind: 'circle', cx: 60, cy: 690, r: 82, o: 0.12, nucleus: true },
        { kind: 'circle', cx: 200, cy: 735, r: 56, o: 0.1, nucleus: true },
      ];
    case 'tissue': {
      const cells: BackdropShape[] = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          cells.push({ kind: 'hex', cx: 990 + col * 92 + (row % 2) * 46, cy: 30 + row * 80, r: 48, o: 0.14 - row * 0.03 - col * 0.005 });
        }
      }
      return [...cells, { kind: 'hex', cx: 60, cy: 690, r: 80, o: 0.11 }, { kind: 'hex', cx: 190, cy: 700, r: 52, o: 0.09 }];
    }
  }
}

/** The vertices of a flat-top hexagon. */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;

    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/**
 * A backdrop as an SVG document string, `1280 x 720`, drawn in one colour. It is decoration only (the caller hides it
 * from assistive technology) and is used as a CSS background, so it is URL-safe by construction.
 */
export function backdropSvg(kind: BackdropKind, color: string): string {
  const stroke = (o: number) => `fill="none" stroke="${color}" stroke-opacity="${o}" stroke-width="3"`;
  const body = backdropShapes(kind)
    .map((s) => {
      switch (s.kind) {
        case 'circle':
          return (
            `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${color}" fill-opacity="${(s.o * 0.55).toFixed(3)}" stroke="${color}" stroke-opacity="${s.o + 0.08}" stroke-width="3"/>` +
            (s.nucleus ? `<circle cx="${s.cx + s.r * 0.18}" cy="${s.cy - s.r * 0.12}" r="${(s.r * 0.34).toFixed(1)}" fill="${color}" fill-opacity="${(s.o * 1.1).toFixed(3)}"/>` : '')
          );
        case 'ring':
          return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${stroke(s.o)}/>`;
        case 'hex':
          return `<polygon points="${hexPoints(s.cx, s.cy, s.r)}" fill="${color}" fill-opacity="${(s.o * 0.5).toFixed(3)}" stroke="${color}" stroke-opacity="${(s.o + 0.06).toFixed(3)}" stroke-width="3"/>`;
        case 'line':
          return `<line x1="${s.cx}" y1="${s.cy}" x2="${s.cx}" y2="${s.cy + s.r}" stroke="${color}" stroke-opacity="${s.o}" stroke-width="5" stroke-linecap="round"/>`;
      }
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
}

/** The backdrop as a CSS `url(...)` value. */
export function backdropUrl(kind: BackdropKind, color: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(backdropSvg(kind, color))}")`;
}

// ---------------------------------------------------------------------------
// Photographs behind slides
// ---------------------------------------------------------------------------

/** The least width (px) a photograph needs to be shown across the whole slide without looking soft. */
export const BLEED_MIN_WIDTH = 900;

/** The least width / height a photograph needs to fill a 16:9 slide without losing most of itself to the crop. */
export const BLEED_MIN_RATIO = 1.25;

type Picture = Pick<DeckImage, 'type' | 'width' | 'height'> | null | undefined;

/** True for a photograph wide and large enough to be the background of a whole slide. A drawn diagram never is. */
export function isBleedPhoto(image: Picture): boolean {
  return Boolean(image) && image!.type === 'photo' && image!.width >= BLEED_MIN_WIDTH && image!.height > 0 && image!.width / image!.height >= BLEED_MIN_RATIO;
}

/** A photograph that may also be a soft background behind other slides: wide and large enough, and not marked unsuitable. */
export function isBackdropPhoto(image: (Pick<DeckImage, 'type' | 'width' | 'height'> & { backdrop?: boolean }) | null | undefined): boolean {
  return isBleedPhoto(image) && image!.backdrop !== false;
}

/**
 * The slide whose photograph is the soft background of this slide.
 *
 * A slide with a photograph of its own and nothing drawn on it shows that photograph large (see `layoutOf` and
 * `usesBleed`); every other slide takes the nearest suitable photograph of its own topic as a faint texture, so
 * the lesson looks like one piece: a diagram of the membrane sits on cells from the same topic. Never a picture from
 * outside the deck: every photograph here is one of the deck's own registered pictures. A slide that belongs to no
 * topic (the opening ones) takes the first photograph of the deck. Null when the deck has no suitable photograph.
 */
export function backdropSlideOf(deck: Pick<StudyDeck, 'outline' | 'slides'>, slide: Pick<DeckSlide, 'n' | 'taught_concept_ids'>): number | null {
  const candidates = deck.slides.filter((s) => isBackdropPhoto(s.image));
  if (candidates.length === 0) return null;

  const topic = topicIndexOf(deck, slide);
  const pool = topic === null ? [] : candidates.filter((s) => topicIndexOf(deck, s) === topic);
  const nearest = (list: typeof candidates) => [...list].sort((a, b) => Math.abs(a.n - slide.n) - Math.abs(b.n - slide.n) || a.n - b.n)[0];

  if (pool.length > 0) return nearest(pool).n;

  return (topic === null ? candidates[0] : candidates.find((s) => s.slide_type === 'cover') ?? candidates[0]).n;
}
