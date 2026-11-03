'use client';

/**
 * The node/relationship detail panel.
 *
 * `variant: 'modal'` (the default, unchanged) is the reference's centered
 * record modal (`.modal`/`.modal-bg`, 540px white panel over a dark
 * overlay) — every existing caller (`ModuleKnowledgeGraph.tsx`, the old
 * single-column `KnowledgeGraphExplorer.tsx`) keeps exactly this look.
 *
 * `variant: 'docked'` is a plain in-flow panel (no overlay, no centering)
 * for the rebuilt centralized explorer's persistent right-hand column.
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
}: {
  node?: KgNodeInput | null;
  /** When set (and `node` is not), the panel shows relationship detail instead of node detail. */
  edge?: KgEdgeInput | null;
  /** Display labels for the edge's two endpoints — the raw KgEdgeInput only carries ids. */
  edgeSourceLabel?: string;
  edgeTargetLabel?: string;
  hops?: KgHop[];
  variant?: 'modal' | 'docked';
  onClose: () => void;
  /** Re-centre the canvas on a hop's item, when the caller supports it. */
  onItemClick?: (entity: string, id: number | string | null) => void;
  /** Node mode only — fetch the next page of this node's relationships. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
}) {
  const body = edge && !node ? (
    <RelationshipBody edge={edge} sourceLabel={edgeSourceLabel} targetLabel={edgeTargetLabel} />
  ) : node ? (
    <NodeBody
      node={node}
      hops={hops}
      onItemClick={onItemClick}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      hasMore={hasMore}
    />
  ) : null;

  if (!body) return null;

  if (variant === 'docked') {
    return (
      <div className="flex h-full flex-col overflow-y-auto rounded-lg border p-5" style={{ borderColor: coherenceTheme.color.divider, fontFamily: coherenceTheme.font.body }}>
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
}: {
  node: KgNodeInput;
  hops: KgHop[];
  onItemClick?: (entity: string, id: number | string | null) => void;
  onLoadMore?: () => void;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  const color = categoryColor(node.entityKey);
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
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: color.dot }}>
        {node.entityKey}
      </p>
      <h2 className="mt-1 text-2xl font-normal" style={{ color: coherenceTheme.color.text }}>
        {node.label}
      </h2>

      {attributeEntries.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {attributeEntries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-slate-400">{formatPropertyLabel(key)}</dt>
              <dd style={{ color: coherenceTheme.color.text }}>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {hops.length > 0 && (
        <div className="mt-6 border-t" style={{ borderColor: coherenceTheme.color.dividerAlt }}>
          {hops.map((hop) => (
            <HopSection key={hop.relation + hop.label} hop={hop} onItemClick={onItemClick} />
          ))}
        </div>
      )}

      {onLoadMore && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: coherenceTheme.color.dividerAlt }}>
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-60"
              style={{ color: coherenceTheme.color.accent }}
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Load more connections
            </button>
          ) : (
            <p className="text-xs text-slate-400">All connections loaded.</p>
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
}: {
  edge: KgEdgeInput;
  sourceLabel?: string;
  targetLabel?: string;
}) {
  const propertyEntries = Object.entries(edge.properties ?? {});

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: coherenceTheme.color.accent }}>
        Relationship
      </p>
      <h2 className="mt-1 text-2xl font-normal" style={{ color: coherenceTheme.color.text }}>
        {edge.relation}
      </h2>

      <div className="mt-5 flex items-center gap-2 text-sm" style={{ color: coherenceTheme.color.text }}>
        <span className="truncate rounded-md border px-2.5 py-1" style={{ borderColor: coherenceTheme.color.divider }}>
          {sourceLabel ?? edge.source}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate rounded-md border px-2.5 py-1" style={{ borderColor: coherenceTheme.color.divider }}>
          {targetLabel ?? edge.target}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-400">Direction</dt>
        <dd style={{ color: coherenceTheme.color.text }}>{edge.directed ? 'Directed' : 'Undirected'}</dd>
      </dl>

      {propertyEntries.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm" style={{ borderColor: coherenceTheme.color.dividerAlt }}>
          {propertyEntries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-slate-400">{key}</dt>
              <dd style={{ color: coherenceTheme.color.text }}>{String(value)}</dd>
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
}: {
  hop: KgHop;
  onItemClick?: (entity: string, id: number | string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b" style={{ borderColor: coherenceTheme.color.dividerAlt }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!hop.available}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold disabled:cursor-default"
        style={{ color: hop.available ? coherenceTheme.color.accent : '#999791' }}
      >
        <span>
          {hop.label}
          {hop.available ? ` (${hop.total})` : ''}
        </span>
        {hop.available ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
      </button>

      {!hop.available && (
        <p className="pb-3 text-xs text-slate-400">{hop.reason ?? 'Not available.'}</p>
      )}

      {open && hop.available && (
        <ul className="pb-3">
          {hop.items.map((item) => (
            <li key={`${item.entity}:${item.id}`}>
              <button
                type="button"
                onClick={() => onItemClick?.(item.entity, item.id)}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                style={{ color: coherenceTheme.color.text }}
              >
                {item.label}
              </button>
            </li>
          ))}
          {hop.items.length === 0 && <li className="px-2 py-1.5 text-sm text-slate-400">None recorded.</li>}
        </ul>
      )}
    </div>
  );
}
