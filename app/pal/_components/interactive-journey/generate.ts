import { classifyVisual } from './classify';
import type {
  BarModelParams,
  FractionBarParams,
  GeometryCanvasParams,
  JourneyRecipe,
  NumberLineParams,
  VisualComponentName,
} from './types';

/**
 * Builds a full 7-step (minus Practice, which is generic by design) journey
 * recipe for ANY concept, from that concept's own real data — never from a
 * concept id or a fixed per-concept map. This is the entire dynamic
 * pipeline the feature runs on:
 *
 *   conceptId -> ConceptLearn (real API data) -> classifyVisual() (real
 *   concept/chapter NAME, keyword-matched) -> generateJourneyRecipe()
 *   (real name + real chapter + real authored description, illustrative
 *   numbers for the mechanic itself) -> JourneyRecipe -> JourneyPlayer
 *
 * WHAT IS REAL VS. ILLUSTRATIVE, STATED PLAINLY. The concept name, chapter
 * name, and — when the concept has one — its own authored description
 * (`ConceptLearn.content.body`) are genuine, concept-specific data and are
 * used verbatim below. The NUMBERS each visual illustrates with (e.g. "25%
 * of 100", "1/4", a 4x3 grid, "start at 0, move by 5") are generic,
 * reasonable example values for that VISUAL TYPE — there is no per-concept
 * numeric dataset exposed anywhere in the API to draw real numbers from, so
 * inventing concept-specific numbers would be fabrication, not data. What
 * genuinely changes per concept is which of the four visual types is picked
 * (by real name/chapter keyword match — see classify.ts) and the real
 * copy wrapped around it; the illustrative numbers stay the sensible
 * defaults for that visual type until a concept has its own authored
 * numeric content to draw from instead.
 */

export interface ConceptContext {
  conceptId: number;
  conceptName: string;
  chapterName: string | null;
  /** Plain-text authored description, when this concept has one (often null). */
  description: string | null;
}

function truncate(text: string, max = 240): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (lastStop > max * 0.4 ? cut.slice(0, lastStop + 1) : cut).trim() + (lastStop > max * 0.4 ? '' : '…');
}

function explainRule(ctx: ConceptContext): string {
  if (ctx.description) return truncate(ctx.description);
  return `This is the relationship at the heart of ${ctx.conceptName.toLowerCase()} — look at how the visual above responds as the numbers change.`;
}

function bar(ctx: ConceptContext): JourneyRecipe<'BarModel'> {
  const hookParams: BarModelParams = { whole: 100, percent: 25 };
  return {
    conceptId: ctx.conceptId,
    component: 'BarModel',
    hook: {
      scenario: `Let's see ${ctx.conceptName.toLowerCase()} as parts of 100.`,
      prompt: 'Reveal it a piece at a time and watch the amount build up.',
      params: hookParams,
    },
    visual: {
      prompt: 'Each highlighted square is one hundredth of the whole — reveal 10% at a time.',
      params: hookParams,
    },
    explore: {
      prompt: 'Now try it yourself. Drag the slider and watch the amount change.',
      params: { whole: 100, percent: 0 },
    },
    explain: { rule: explainRule(ctx), params: hookParams },
    animate: {
      prompt: 'The same idea, different numbers — watch it play out on its own.',
      params: { whole: 150, percent: 40 },
    },
    guided: {
      prompt: 'Set the slider so the highlighted amount shows 25% of this whole.',
      params: { whole: 300, percent: 0 },
      target: { percent: 25 },
    },
  };
}

function fraction(ctx: ConceptContext): JourneyRecipe<'FractionBar'> {
  const hookParams: FractionBarParams = { numerator: 1, denominator: 4 };
  return {
    conceptId: ctx.conceptId,
    component: 'FractionBar',
    hook: {
      scenario: `Let's see ${ctx.conceptName.toLowerCase()} as parts of a whole.`,
      prompt: 'Reveal one part at a time to see how much of the whole is shaded.',
      params: hookParams,
    },
    visual: {
      prompt: 'Each shaded part is one out of the whole, split into equal pieces.',
      params: hookParams,
    },
    explore: {
      prompt: 'Drag the slider to shade a different number of parts.',
      params: { numerator: 1, denominator: 4 },
    },
    explain: { rule: explainRule(ctx), params: hookParams },
    animate: {
      prompt: 'A different fraction, the same idea — watch it shade in on its own.',
      params: { numerator: 3, denominator: 5 },
    },
    guided: {
      prompt: 'Set the slider to show three quarters.',
      params: { numerator: 0, denominator: 4 },
      target: { numerator: 3 },
    },
  };
}

function geometry(ctx: ConceptContext): JourneyRecipe<'GeometryCanvas'> {
  const hookParams: GeometryCanvasParams = { width: 4, height: 3 };
  return {
    conceptId: ctx.conceptId,
    component: 'GeometryCanvas',
    hook: {
      scenario: `Let's see ${ctx.conceptName.toLowerCase()} as a grid you can count.`,
      prompt: 'Reveal it one row at a time to see the whole arrangement.',
      params: hookParams,
    },
    visual: {
      prompt: 'Each square is one unit — count them as they fill in.',
      params: hookParams,
    },
    explore: {
      prompt: 'Now change the width and height yourself, and watch the total change.',
      params: { width: 4, height: 3 },
    },
    explain: { rule: explainRule(ctx), params: hookParams },
    animate: {
      prompt: 'A different arrangement, the same idea — watch it fill in on its own.',
      params: { width: 5, height: 2 },
    },
    guided: {
      prompt: 'Keeping the width the same, set the height so the grid covers 20 in total.',
      params: { width: 4, height: 1 },
      target: { height: 5 },
    },
  };
}

function numberLine(ctx: ConceptContext): JourneyRecipe<'NumberLine'> {
  const hookParams: NumberLineParams = { start: 0, change: 5 };
  return {
    conceptId: ctx.conceptId,
    component: 'NumberLine',
    hook: {
      scenario: `Let's see ${ctx.conceptName.toLowerCase()} as movement on a number line.`,
      prompt: 'Move forward a step at a time and watch where you land.',
      params: hookParams,
    },
    visual: {
      prompt: 'The marker moves from the start value by the given amount.',
      params: hookParams,
    },
    explore: {
      prompt: 'Drag the slider to change the amount moved, in either direction.',
      params: { start: 0, change: 0 },
    },
    explain: { rule: explainRule(ctx), params: hookParams },
    animate: {
      prompt: 'A different starting point and move — watch it play out on its own.',
      params: { start: 2, change: -4 },
    },
    guided: {
      prompt: 'Starting at 0, set the slider so the marker lands on +7.',
      params: { start: 0, change: 0 },
      target: { change: 7 },
    },
  };
}

const BUILDERS: Record<VisualComponentName, (ctx: ConceptContext) => JourneyRecipe> = {
  BarModel: bar,
  FractionBar: fraction,
  GeometryCanvas: geometry,
  NumberLine: numberLine,
};

/**
 * The single entry point the Learn page calls. Always returns a recipe —
 * there is no "no recipe" case any more (see JourneyEntryCard's caller):
 * every concept gets a real, dynamically-chosen learning journey.
 */
export function generateJourneyRecipe(ctx: ConceptContext): JourneyRecipe {
  const component = classifyVisual(ctx.conceptName, ctx.chapterName);
  return BUILDERS[component](ctx);
}
