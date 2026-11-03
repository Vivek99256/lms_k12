/**
 * Design tokens for the Knowledge Graph canvas, copied verbatim from
 * `achievethecore.org/coherence-map/`'s own served CSS (downloaded and read
 * directly — this environment has no browser to view the live JS/Flash app,
 * so the actual `style.css`/`bundle.css` values are the source of truth, not
 * a description of them).
 *
 * Shared by both Knowledge Graph entry points (the centralized AI console
 * page and every module's own tab) so the two read as one feature rather
 * than two differently themed screens.
 */
export const coherenceTheme = {
  color: {
    accent: '#2a7251',
    accentHover: '#266648',
    accentAlt: '#297352',
    accentBright: '#25a56a',
    bgCream: '#f0ede6',
    bgPage: '#f4f5f0',
    text: '#50524f',
    shadow: '#d9d7d2',
    shadowAlt: '#d5d3cf',
    divider: '#e8e6e0',
    dividerAlt: '#ccc',
    edgeDim: '#7a7a7a',
    edgeHighlight: '#333',
    dimOverlay: 'rgba(0,0,0,0.4)',
    major: '#21b04c',
    supporting: '#019de8',
    additional: '#f5ec10',
  },
  font: {
    body: "museo_sans300, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    heading: "museo_sans500, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    eyebrow: "'Gotham A', Arial, sans-serif",
  },
  node: {
    width: 160,
    height: 100,
    selectedWidth: 250,
    selectedHeight: 160,
  },
} as const;

export type SourceDotKind = 'graph' | 'sql';

/**
 * The reference's Major/Supporting/Additional dot, repurposed: `graph` (a
 * real Neo4j-backed hop, filled) reads as the stronger signal, `sql` (the
 * relational fallback, outline) as the softer one. Adjustable — the 3-state
 * visual pattern is what matters, not this particular mapping.
 */
export const sourceDotStyle: Record<SourceDotKind, { fill: string; filled: boolean }> = {
  graph: { fill: coherenceTheme.color.major, filled: true },
  sql: { fill: coherenceTheme.color.supporting, filled: false },
};
