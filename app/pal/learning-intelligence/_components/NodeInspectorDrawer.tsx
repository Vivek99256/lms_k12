'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, GitBranch } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { NODE_KIND_LABEL, type GraphEdgeInput, type GraphNodeInput } from './graph-model';
import { KIND_CHIP, EDGE_COLOR } from './design-system';

/**
 * Click-to-inspect side panel: the selected node's real properties and its
 * incident edges, read from whatever the canvas already fetched — nothing
 * here issues its own request. `ownLessonHref` is passed only when the
 * viewer is the enrolled student themselves looking at one of their own
 * ESO-ready concepts (resolved by the caller, which knows the viewer's
 * role); everyone else sees properties only, no "go learn this" action.
 */
export default function NodeInspectorDrawer({
  node,
  edges,
  nodesById,
  open,
  onOpenChange,
  ownLessonHref,
}: {
  node: GraphNodeInput | null;
  edges: GraphEdgeInput[];
  nodesById: Map<string, GraphNodeInput>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownLessonHref?: string | null;
}) {
  if (!node) return null;

  const chip = KIND_CHIP[node.kind];
  const incident = edges.filter((e) => e.source === node.id || e.target === node.id);
  const prerequisites = incident.filter((e) => e.kind === 'prerequisite' && e.target === node.id);
  const unlocks = incident.filter((e) => e.kind === 'prerequisite' && e.source === node.id);
  const related = incident.filter((e) => e.kind === 'cross_curricular');

  const nameOf = (id: string) => nodesById.get(id)?.label ?? id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <span className={`w-fit rounded-full bg-gradient-to-r ${chip.gradient} px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm`}>
            {NODE_KIND_LABEL[node.kind]}
          </span>
          <SheetTitle>{node.label}</SheetTitle>
          {node.current ? (
            <SheetDescription>This is the node the screen is centred on.</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="space-y-5 text-sm">
          {node.meta && Object.keys(node.meta).length > 0 ? (
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Properties
              </h4>
              <dl className="space-y-1">
                {Object.entries(node.meta).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{formatKey(key)}</dt>
                    <dd className="text-right font-medium">{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {prerequisites.length > 0 ? (
            <EdgeList title="Needs first" icon={<GitBranch className="h-3.5 w-3.5" />} items={prerequisites.map((e) => ({
              label: nameOf(e.source),
              dashed: !e.approved,
              aiSuggested: e.aiSuggested,
            }))} />
          ) : null}

          {unlocks.length > 0 ? (
            <EdgeList title="Unlocks" icon={<ArrowRight className="h-3.5 w-3.5" />} items={unlocks.map((e) => ({
              label: nameOf(e.target),
              dashed: !e.approved,
              aiSuggested: e.aiSuggested,
            }))} />
          ) : null}

          {related.length > 0 ? (
            <EdgeList title="Related (cross-curricular)" items={related.map((e) => ({
              label: nameOf(e.source === node.id ? e.target : e.source),
              dashed: !e.approved,
              aiSuggested: e.aiSuggested,
            }))} />
          ) : null}

          {incident.length === 0 ? (
            <p className="text-muted-foreground">No relationships are recorded for this node yet.</p>
          ) : null}

          {ownLessonHref ? (
            <Link href={ownLessonHref} className={buttonVariants({ className: 'w-full' })}>
              Go to this concept <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EdgeList({
  title,
  icon,
  items,
}: {
  title: string;
  icon?: React.ReactNode;
  items: { label: string; dashed: boolean; aiSuggested?: boolean }[];
}) {
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-4"
              style={item.dashed ? { borderTop: `2px dashed ${EDGE_COLOR.aiSuggested}` } : { backgroundColor: EDGE_COLOR.prerequisite }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
            {item.aiSuggested ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                AI-suggested
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
