/**
 * Learning Intelligence's shared design tokens.
 *
 * One palette, reused by the Knowledge Graph Explorer, Teacher Insights
 * and the Context Graph Inspector, so the three feel like one product
 * rather than three separately-styled pages. Light surfaces throughout
 * (matching the rest of the app), with saturated, confident accent colour
 * doing the work of "colourful" — solid chips and icon badges, not pale
 * tinted backgrounds.
 */

import type { GraphNodeKind } from './graph-model';

/**
 * Node-kind colour, as a solid gradient chip — used where the node renders
 * as a rounded card (e.g. the inspector drawer's kind badge).
 */
export const KIND_CHIP: Record<GraphNodeKind, { gradient: string; ring: string; solidText: string }> = {
  unit: { gradient: 'from-purple-500 to-purple-600', ring: 'ring-purple-300', solidText: 'text-purple-700' },
  chapter: { gradient: 'from-cyan-500 to-cyan-600', ring: 'ring-cyan-300', solidText: 'text-cyan-700' },
  topic: { gradient: 'from-teal-500 to-teal-600', ring: 'ring-teal-300', solidText: 'text-teal-700' },
  concept: { gradient: 'from-indigo-500 to-indigo-600', ring: 'ring-indigo-300', solidText: 'text-indigo-700' },
};

/**
 * Node-kind colour as a flat solid fill — the Knowledge Graph canvas's own
 * nodes, deliberately matched to how Neo4j Browser itself renders labelled
 * nodes (flat-coloured circles on a dark canvas, one colour per label).
 */
export const KIND_CIRCLE: Record<GraphNodeKind, { bg: string; ring: string }> = {
  unit: { bg: 'bg-lime-600', ring: 'ring-lime-300' },
  chapter: { bg: 'bg-cyan-500', ring: 'ring-cyan-300' },
  topic: { bg: 'bg-amber-600', ring: 'ring-amber-300' },
  concept: { bg: 'bg-pink-400', ring: 'ring-pink-200' },
};

/** The graph canvas's own dark surface — Neo4j Browser's near-black workspace, independent of the rest of each page's light theme. */
export const CANVAS_DARK = {
  bg: '#0a0e1a',
  dot: '#1e2a42',
  controlsBg: 'rgba(15,23,42,0.85)',
};

/** Edge stroke colours, shared by the canvas and the legend — picked for contrast against the canvas's dark surface (CANVAS_DARK). */
export const EDGE_COLOR = {
  hierarchy: '#64748b',
  prerequisite: '#818cf8',
  crossCurricular: '#2dd4bf',
  aiSuggested: '#fbbf24',
};

/** Semantic accent — one consistent meaning for "this needs attention" / "this is good" / "this is informational" across every page. */
export const ACCENT = {
  brand: { solid: 'bg-indigo-600', gradient: 'from-indigo-500 to-violet-600', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  success: { solid: 'bg-emerald-600', gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warning: { solid: 'bg-amber-500', gradient: 'from-amber-400 to-orange-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  danger: { solid: 'bg-rose-600', gradient: 'from-rose-500 to-pink-600', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  info: { solid: 'bg-cyan-600', gradient: 'from-cyan-500 to-sky-600', text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  purple: { solid: 'bg-purple-600', gradient: 'from-purple-500 to-fuchsia-600', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  neutral: { solid: 'bg-slate-500', gradient: 'from-slate-400 to-slate-500', text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
} as const;

export type AccentKey = keyof typeof ACCENT;

/** A soft, multi-hue wash for page headers — the one "premium gradient" surface each page gets, behind the title only, never behind body content. */
export const HEADER_WASH =
  'bg-gradient-to-br from-indigo-50 via-white to-cyan-50 border border-slate-200/80';
