import type { VisualComponentName } from './types';

/**
 * Picks a visual component from a concept's own real name and its chapter's
 * real name — never from a concept id, and never a fixed default. This is
 * the only place topic vocabulary lives; add a keyword here to route a whole
 * family of concepts to the right visual, not one concept at a time.
 *
 * A concept's OWN name is often too narrow on its own (e.g. "Common
 * denominator method" says nothing about fractions by itself), so the
 * chapter name is checked too — a much more reliable topic signal — and
 * either one matching is enough.
 *
 * `NumberLine` is the universal fallback: nothing reaches it by name, it's
 * simply what's returned when no keyword matches, so every concept gets a
 * real, generic visual instead of one specific type becoming an accidental
 * default.
 */

interface ClassificationRule {
  component: Exclude<VisualComponentName, 'NumberLine'>;
  keywords: string[];
}

const RULES: ClassificationRule[] = [
  { component: 'FractionBar', keywords: ['fraction', 'numerator', 'denominator'] },
  { component: 'BarModel', keywords: ['percent'] },
  {
    component: 'GeometryCanvas',
    keywords: [
      'area',
      'perimeter',
      'volume',
      'shape',
      'rectangle',
      'square',
      'triangle',
      'geometry',
      'factor',
      'multiple',
      'array',
    ],
  },
];

export function classifyVisual(conceptName: string, chapterName: string | null | undefined): VisualComponentName {
  const haystack = `${conceptName} ${chapterName ?? ''}`.toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.component;
  }

  return 'NumberLine';
}
