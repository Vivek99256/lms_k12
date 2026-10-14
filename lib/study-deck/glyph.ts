/**
 * Which small icon suits a piece of lesson text.
 *
 * NO REACT HERE, so the rule is testable with node:test. It returns a NAME; the component maps the name to a Lucide
 * glyph. The icon only decorates a card whose words already say the same thing: it is never the only carrier of
 * meaning, and a text that matches nothing gets the neutral target.
 */

export type Glyph = 'microscope' | 'membrane' | 'water' | 'nucleus' | 'organelle' | 'energy' | 'plant' | 'division' | 'history' | 'growth' | 'target';

/** First match wins, so the more specific ideas come first. */
const RULES: Array<[Glyph, RegExp]> = [
  ['division', /\b(divis|divid|mitosis|meiosis|daughter|cell cycle)/i],
  ['history', /\b(theory|hooke|schleiden|schwann|virchow|history|discover|cork)/i],
  ['microscope', /\b(microscop|magnif|observ|lens|stain|slide|resolution|study cells|how to study)/i],
  ['nucleus', /\b(nucle|dna|chromosom|gene|genetic)/i],
  ['water', /\b(osmo|diffus|water|solution|hypo|hyper|isotonic|concentrat)/i],
  ['membrane', /\b(membrane|wall|boundary|permeab|selective|barrier|lipid)/i],
  ['energy', /\b(energy|atp|respirat|mitochond|power)/i],
  ['plant', /\b(plant|plastid|chloro|photosynth|vacuole|leaf)/i],
  ['organelle', /\b(organelle|ribosom|golgi|reticulum|lysosom|cytoplasm|interior|inside)/i],
  ['growth', /\b(growth|regulat|cancer|apoptosis|death|totipot|culture|life span|tissue)/i],
];

export function glyphOf(text: string): Glyph {
  for (const [glyph, pattern] of RULES) if (pattern.test(text)) return glyph;

  return 'target';
}
