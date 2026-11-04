'use client';

import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import { ORG_KNOWLEDGE_GRAPH_SCREENS } from './_screens/org-knowledge-graph-screens';

export default function OrganizationManagementKnowledgeGraphPage() {
  return (
    <ModuleCategoryPage
      moduleName="organization-management"
      categoryKey="knowledge-graph"
      staticScreens={ORG_KNOWLEDGE_GRAPH_SCREENS}
    />
  );
}
