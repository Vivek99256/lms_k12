'use client';

import { lazy, Suspense } from 'react';
import { Network } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';

// The graph pulls in @xyflow/react, which no other Organization Management screen needs.
const OrgKnowledgeGraph = lazy(() => import('../_components/org-knowledge-graph'));

export const ORG_KNOWLEDGE_GRAPH_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'organization-graph',
    label: 'Organization graph',
    icon: Network,
    render: () => (
      <Suspense fallback={<div className="m-6 h-[60vh] animate-pulse rounded-2xl bg-muted/40" />}>
        <OrgKnowledgeGraph />
      </Suspense>
    ),
  },
];
