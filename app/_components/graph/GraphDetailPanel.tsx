'use client';

/**
 * The node/relationship detail panel.
 *
 * `variant: 'modal'` (the default, unchanged) is the reference's centered
 * record modal (`.modal`/`.modal-bg`, 540px white panel over a dark
 * overlay) — every existing caller (`ModuleKnowledgeGraph.tsx`, the old
 * single-column `KnowledgeGraphExplorer.tsx`) keeps exactly this look.
 *
 * `variant: 'docked'` is a dark glass drawer (rounded-2xl, backdrop-blur,
 * "Connected to (N)" list) matching `org-knowledge-graph.tsx`'s own details
 * drawer — the centralized explorer's persistent right-hand column, next to
 * `GraphBubbleCanvas`'s dark canvas. Only the skin changed here; every piece
 * of existing behaviour (hop/group accordion, externally-controlled open
 * state, load-more pagination, relationship detail body) is unchanged.
 *
 * `variant: 'docked-light'` is the SAME persistent right-hand-column layout
 * and behaviour, styled light instead — for `ModuleKnowledgeGraph.tsx`'s
 * decentralized canvas, which (per explicit, repeated user confirmation)
 * matches `CentralizedKnowledgeGraphExplorer`'s React-Flow design — light
 * chrome, dark canvas only — not `org-knowledge-graph.tsx`'s all-dark bubble
 * design. Added as its own variant, rather than reusing `'docked'`, because
 * that variant's own skin changed meaning once the centralized explorer
 * moved to the bubble design: the two consumers now need genuinely
 * different docked panel skins, not the same one.
 *
 * Shows either a node (labels, id, properties, one collapsible accordion
 * section per relation hop) or, when `edge` is given instead, a
 * relationship's type/source/target/direction/properties — the spec's
 * "click a relationship, see its details" requirement, which the original
 * modal never had a shape for.
 */

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';

import { coherenceTheme } from './coherence-theme';
import { categoryColor } from './graph-category-color';
import type { KgEdgeInput, KgHop, KgNodeInput } from './graph-model';

/** The docked variant's dark-glass tokens — the same palette `GraphBubbleCanvas`'s dark surface uses. */
const DOCKED = {
  panel: 'rgba(10,18,48,0.78)',
  border: 'rgba(255,255,255,0.16)',
  text: '#f1f5f9',
  sub: '#94a3b8',
  divider: 'rgba(255,255,255,0.14)',
  accent: '#60a5fa',
};

export default function GraphDetailPanel({
  node,
  edge,
  edgeSourceLabel,
  edgeTargetLabel,
  hops = [],
  variant = 'modal',
  onClose,
  onItemClick,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  isGroupOpen,
  onToggleGroup,
  onExpand,
  expanding = false,
}: {
  node?: KgNodeInput | null;
  /** When set (and `node` is not), the panel shows relationship detail instead of node detail. */
  edge?: KgEdgeInput | null;
  /** Display labels for the edge's two endpoints — the raw KgEdgeInput only carries ids. */
  edgeSourceLabel?: string;
  edgeTargetLabel?: string;
  hops?: KgHop[];
  variant?: 'modal' | 'docked' | 'docked-light';
  onClose: () => void;
  /** Re-centre the canvas on a hop's item, when the caller supports it. */
  onItemClick?: (entity: string, id: number | string | null) => void;
  /** Node mode only — fetch the next page of this node's relationships. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  /**
   * Node mode only, optional — when given, shows a button that fetches this
   * node's own real connections (every direction) and adds them to the
   * canvas in place, without switching canvas variant or visual design.
   * Omitted (most callers): no button, panel behaves exactly as before.
   */
  onExpand?: () => void;
  expanding?: boolean;
  /**
   * When given (the progressive centralized explorer), a hop section's
   * open/closed state is driven externally — clicking its header expands
   * or collapses that relationship-group *on the canvas*, not just the
   * accordion list. Omitted (every other caller, e.g. `ModuleKnowledgeGraph`),
   * each section manages its own open/closed state exactly as before —
   * a plain accordion with no canvas effect.
   */
  isGroupOpen?: (hop: KgHop) => boolean;
  onToggleGroup?: (hop: KgHop) => void;
}) {
  const dark = variant === 'docked';
  const body = edge && !node ? (
    <RelationshipBody edge={edge} sourceLabel={edgeSourceLabel} targetLabel={edgeTargetLabel} dark={dark} />
  ) : node ? (
    <NodeBody
      node={node}
      hops={hops}
      onItemClick={onItemClick}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      hasMore={hasMore}
      isGroupOpen={isGroupOpen}
      onToggleGroup={onToggleGroup}
      onExpand={onExpand}
      expanding={expanding}
      dark={dark}
    />
  ) : null;

  if (!body) return null;

  if (variant === 'docked') {
    return (
      <div
        className="flex h-full flex-col overflow-y-auto rounded-2xl border p-5 backdrop-blur-md"
        style={{ background: DOCKED.panel, borderColor: DOCKED.border, color: DOCKED.text, fontFamily: coherenceTheme.font.body }}
      >
        <button
          type="button"
          onClick={onClose}
          className="mb-2 self-end rounded-lg p-1 transition-colors hover:bg-white/10"
          style={{ color: DOCKED.sub }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        {body}
      </div>
    );
  }

  if (variant === 'docked-light') {
    return (
      <div
        className="flex h-full flex-col overflow-y-auto rounded-lg border p-5"
        style={{ borderColor: coherenceTheme.color.divider, backgroundColor: '#fff', fontFamily: coherenceTheme.font.body }}
      >
        <button
          type="button"
          onClick={onClose}
          className="mb-2 self-end text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        {body}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      />

      <div
        className="relative z-10 max-h-[85vh] w-full max-w-[540px] overflow-y-auto rounded-sm bg-white p-10 shadow-xl"
        style={{ fontFamily: coherenceTheme.font.body }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center"
          style={{ color: coherenceTheme.color.accent }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {body}
      </div>
    </div>
  );
}

function NodeBody({
  node,
  hops,
  onItemClick,
  onLoadMore,
  loadingMore,
  hasMore,
  isGroupOpen,
  onToggleGroup,
  onExpand,
  expanding,
  dark = false,
}: {
  node: KgNodeInput;
  hops: KgHop[];
  onItemClick?: (entity: string, id: number | string | null) => void;
  onLoadMore?: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  isGroupOpen?: (hop: KgHop) => boolean;
  onToggleGroup?: (hop: KgHop) => void;
  onExpand?: () => void;
  expanding?: boolean;
  dark?: boolean;
}) {
  const color = categoryColor(node.entityKey);
  const text = dark ? DOCKED.text : coherenceTheme.color.text;
  const sub = dark ? DOCKED.sub : '#94a3b8';
  const divider = dark ? DOCKED.divider : coherenceTheme.color.dividerAlt;
  const accent = dark ? DOCKED.accent : coherenceTheme.color.accent;
  const attributeEntries = Object.entries(node.attributes ?? {}).filter(
    ([key, value]) =>
      value !== null &&
      value !== undefined &&
      typeof value !== 'object' &&
      key.toLowerCase() !== 'displaylabel' &&
      key.toLowerCase() !== 'id' &&
      !key.toLowerCase().endsWith('id')
  );

  return (
    <>
      <div className="flex items-center gap-3">
        {dark && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: `linear-gradient(145deg, ${color.dot}, ${color.dot}b3)`, boxShadow: `0 0 16px ${color.dot}66` }}
          >
            {node.label.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: color.dot }}>
            {node.entityKey}
          </p>
          <h2 className="mt-0.5 truncate text-xl font-normal" style={{ color: text }}>
            {node.label}
          </h2>
        </div>
      </div>

      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          disabled={expanding}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-60"
          style={{ borderColor: accent, color: accent }}
        >
          {expanding && <Loader2 className="h-3 w-3 animate-spin" />}
          Expand this node&apos;s connections
        </button>
      )}

      {attributeEntries.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {attributeEntries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt style={{ color: sub }}>{formatPropertyLabel(key)}</dt>
              <dd style={{ color: text }}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {hops.length > 0 && (
        <div className="mt-6 border-t" style={{ borderColor: divider }}>
          <p className="pt-3 text-xs font-semibold" style={{ color: sub }}>
            Connected to
          </p>
          {hops.map((hop) => (
            <HopSection
              key={hop.relation + hop.label}
              hop={hop}
              onItemClick={onItemClick}
              isGroupOpen={isGroupOpen}
              onToggleGroup={onToggleGroup}
              dark={dark}
            />
          ))}
        </div>
      )}

      {onLoadMore && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: divider }}>
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-60"
              style={{ color: accent }}
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Load more connections
            </button>
          ) : (
            <p className="text-xs" style={{ color: sub }}>All connections loaded.</p>
          )}
        </div>
      )}
    </>
  );
}

function formatPropertyLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function RelationshipBody({
  edge,
  sourceLabel,
  targetLabel,
  dark = false,
}: {
  edge: KgEdgeInput;
  sourceLabel?: string;
  targetLabel?: string;
  dark?: boolean;
}) {
  const text = dark ? DOCKED.text : coherenceTheme.color.text;
  const sub = dark ? DOCKED.sub : '#94a3b8';
  const divider = dark ? DOCKED.divider : coherenceTheme.color.dividerAlt;
  const accent = dark ? DOCKED.accent : coherenceTheme.color.accent;
  const propertyEntries = Object.entries(edge.properties ?? {});

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
        Relationship
      </p>
      <h2 className="mt-1 text-2xl font-normal" style={{ color: text }}>
        {edge.relation}
      </h2>

      <div className="mt-5 flex items-center gap-2 text-sm" style={{ color: text }}>
        <span className="truncate rounded-md border px-2.5 py-1" style={{ borderColor: divider }}>
          {sourceLabel ?? edge.source}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: sub }} />
        <span className="truncate rounded-md border px-2.5 py-1" style={{ borderColor: divider }}>
          {targetLabel ?? edge.target}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt style={{ color: sub }}>Direction</dt>
        <dd style={{ color: text }}>{edge.directed ? 'Directed' : 'Undirected'}</dd>
      </dl>

      {propertyEntries.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm" style={{ borderColor: divider }}>
          {propertyEntries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt style={{ color: sub }}>{key}</dt>
              <dd style={{ color: text }}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function HopSection({
  hop,
  onItemClick,
  isGroupOpen,
  onToggleGroup,
  dark = false,
}: {
  hop: KgHop;
  onItemClick?: (entity: string, id: number | string | null) => void;
  isGroupOpen?: (hop: KgHop) => boolean;
  onToggleGroup?: (hop: KgHop) => void;
  dark?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  // Externally-driven (progressive explorer: open means "this relationship
  // type is expanded onto the canvas") when isGroupOpen is given; otherwise
  // a plain, self-contained accordion — unchanged for every other caller.
  const externallyControlled = isGroupOpen !== undefined;
  const open = externallyControlled ? isGroupOpen!(hop) : localOpen;
  const text = dark ? DOCKED.text : coherenceTheme.color.text;
  const sub = dark ? DOCKED.sub : '#94a3b8';
  const divider = dark ? DOCKED.divider : coherenceTheme.color.dividerAlt;
  const accent = dark ? DOCKED.accent : coherenceTheme.color.accent;
  const itemHover = dark ? 'hover:bg-white/10' : 'hover:bg-slate-50';

  const toggle = () => {
    if (externallyControlled) {
      onToggleGroup?.(hop);
    } else {
      setLocalOpen((v) => !v);
    }
  };

  return (
    <div className="border-b" style={{ borderColor: divider }}>
      <button
        type="button"
        onClick={toggle}
        disabled={!hop.available}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold disabled:cursor-default"
        style={{ color: hop.available ? accent : sub }}
        title={externallyControlled ? (open ? 'Click to collapse from the graph' : 'Click to expand onto the graph') : undefined}
      >
        <span>
          {hop.label}
          {hop.available ? ` (${hop.total})` : ''}
        </span>
        {hop.available ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
      </button>

      {!hop.available && (
        <p className="pb-3 text-xs" style={{ color: sub }}>{hop.reason ?? 'Not available.'}</p>
      )}

      {open && hop.available && (
        <ul className="pb-3">
          {hop.items.map((item) => (
            <li key={`${item.entity}:${item.id}`}>
              <button
                type="button"
                onClick={() => onItemClick?.(item.entity, item.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${itemHover}`}
                style={{ color: text }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoryColor(item.entity).dot }} />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
          {hop.items.length === 0 && <li className="px-2 py-1.5 text-sm" style={{ color: sub }}>None recorded.</li>}
        </ul>
      )}
    </div>
  );
}
