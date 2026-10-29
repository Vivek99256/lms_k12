/**
 * The map's colour language: a curated, vivid palette assigned deterministically by
 * id, so the same chapter gets the same colour in the deck and on the canvas. This is
 * what makes the screen colourful without becoming arbitrary - colour still means
 * something (which chapter/topic this is), it just isn't limited to one brand hue.
 *
 * Deliberately separate from the brand accent (#059669, ConceptCard.tsx's ACCENT):
 * that colour means "this is the thing you're acting on" (the centred concept, the
 * primary action); this palette means "this is which chapter it belongs to". Mixing
 * the two languages would make neither readable.
 */
export const CONCEPT_PALETTE = [
  '#7C3AED', // violet
  '#2563EB', // blue
  '#0D9488', // teal
  '#16A34A', // green
  '#D97706', // amber
  '#DB2777', // rose
  '#EA580C', // orange
  '#0891B2', // cyan
] as const;

/** Deterministic - the same id always lands on the same colour, across renders and
 *  across components, with no shared state to keep in sync. */
export function colorForId(id: string): string {
  let hash = 0;

  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }

  return CONCEPT_PALETTE[Math.abs(hash) % CONCEPT_PALETTE.length];
}

/** Each palette hue's "r, g, b" triplet, for building an `rgba(...)` glow - the dark
 *  theme's stand-in for a drop shadow, which a near-black canvas would swallow. */
const GLOW_RGB: Record<string, string> = {
  '#7C3AED': '124, 58, 237',
  '#2563EB': '37, 99, 235',
  '#0D9488': '13, 148, 136',
  '#16A34A': '22, 163, 74',
  '#D97706': '217, 119, 6',
  '#DB2777': '219, 39, 119',
  '#EA580C': '234, 88, 12',
  '#0891B2': '8, 145, 178',
};

/** The "r, g, b" triplet for a hex colour, so it can sit inside `rgba(${rgb},alpha)`.
 *  Falls back to a neutral slate for any hex outside CONCEPT_PALETTE (e.g. the
 *  brand accent, which glows in its own fixed colour wherever it's used). */
export function glowRgb(hex: string): string {
  return GLOW_RGB[hex] ?? '148, 163, 184';
}

/** Distinct styling and tokens for each curriculum level. */
export const LEVEL_THEMES = {
  unit: {
    name: 'Unit',
    badge: 'bg-indigo-600 text-white',
    chipBg: 'bg-indigo-50 border-indigo-200/70',
    chipText: 'text-indigo-700',
    border: 'border-indigo-200 hover:border-indigo-400',
    glow: 'rgba(79, 70, 229, 0.22)',
    gradient: 'from-indigo-600 to-indigo-700',
    hex: '#4F46E5',
  },
  chapter: {
    name: 'Chapter',
    badge: 'bg-sky-600 text-white',
    chipBg: 'bg-sky-50 border-sky-200/70',
    chipText: 'text-sky-700',
    border: 'border-sky-200 hover:border-sky-400',
    glow: 'rgba(2, 132, 199, 0.22)',
    gradient: 'from-sky-500 to-blue-600',
    hex: '#0284C7',
  },
  topic: {
    name: 'Topic',
    badge: 'bg-purple-600 text-white',
    chipBg: 'bg-purple-50 border-purple-200/70',
    chipText: 'text-purple-700',
    border: 'border-purple-200 hover:border-purple-400',
    glow: 'rgba(124, 58, 237, 0.22)',
    gradient: 'from-purple-500 to-violet-600',
    hex: '#7C3AED',
  },
  concept: {
    name: 'Concept',
    badge: 'bg-emerald-600 text-white',
    chipBg: 'bg-emerald-50 border-emerald-200/70',
    chipText: 'text-emerald-700',
    border: 'border-emerald-200 hover:border-emerald-400',
    glow: 'rgba(5, 150, 105, 0.22)',
    gradient: 'from-emerald-500 to-teal-600',
    hex: '#059669',
  },
} as const;
